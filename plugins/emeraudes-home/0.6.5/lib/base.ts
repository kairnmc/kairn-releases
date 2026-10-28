// At the faction home, with a live bot: go there, see which chests are ours, reach each one (walking, else towering
// and bridging with the bot's own dirt), put the emerald blocks in, then take the dirt back down. Nothing of the base
// is ever broken: the pathfinder cannot dig, and the only blocks the bot breaks are the ones its ledger says it placed.
import type { Bot, ScriptContext, Window } from '../../kairn'
import { cleanupOrder, EMPTY_LEDGER, leftovers, placeCost, placedAt, record, type Ledger } from './build.ts'
import { chooseChests, type ChestBlock, type ChestChoice, type ChestTarget, type ChooseOptions, type Point } from './chests.ts'
import { chunkFromMap, ownerIn, withChunk, type ChunkOwner, type ClaimBook } from './blood.ts'
import { hereFromTitle, ownerOf, parseFactionMap, type FactionMap } from './fmap.ts'
import { chestAim, chunkGoal, eyeDistance, eyesAt, reachGoal, sightOf, withinReach, type BlockNameAt, type ReachGoal } from './reach.ts'

/** The bot left the home on its own (death, teleport by staff or by a plugin): the run for this account stops. */
export class MovedAway extends Error {}

/**
 * The server refused to open the chest from where the bot stands although Kairn saw it: its « voir directement » rule
 * is not known exactly (measured live 2026-10-29: 13 of 17 places predicted right by the line to the centre, the other
 * 4 refused from above at an angle). The caller tries another place.
 */
export class ClickRefused extends Error {}

/** The block the bot stands in, as reachChest's places to avoid are written. */
export const standKey = (feet: Point): string => `${Math.floor(feet.x)},${Math.floor(feet.y)},${Math.floor(feet.z)}`

export function listen(ctx: ScriptContext, bot: Bot, ms: number): Promise<string[]> {
  const lines: string[] = []
  const on = (message: string) => {
    if (message.trim()) lines.push(message.trim())
  }
  bot.on('messagestr', on)
  return ctx.sleep(ms).then(
    () => (bot.removeListener('messagestr', on), lines),
    (error: unknown) => {
      bot.removeListener('messagestr', on)
      throw error
    },
  )
}

export async function command(ctx: ScriptContext, bot: Bot, text: string, ms = 2_500): Promise<string[]> {
  const answer = listen(ctx, bot, ms)
  bot.chat(text)
  return answer
}

const floor = (p: Point): Point => ({ x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) })
const chunk = (p: Point) => ({ cx: Math.floor(p.x) >> 4, cz: Math.floor(p.z) >> 4 })

/**
 * /home <name>, then waits for the teleport (a delay of a few seconds standing still is common). The teleport is the
 * server's position packet (mineflayer « forcedMove »), which also comes when the bot already stood at the home.
 * Returns where it landed.
 */
export async function goHome(ctx: ScriptContext, bot: Bot, home: string): Promise<Point> {
  let teleported = false
  const onMove = () => (teleported = true)
  bot.on('forcedMove', onMove)
  try {
    const said = listen(ctx, bot, 3_000)
    bot.chat(`/home ${home}`)
    const lines = await said
    for (let waited = 0; waited < 15 && !teleported; waited++) await ctx.sleep(1_000)
    if (!teleported) throw new Error(`/home ${home} : pas de téléportation en 18 s${lines.length ? ` (${lines.slice(0, 2).join(' | ')})` : ''}.`)
  } finally {
    bot.removeListener('forcedMove', onMove)
  }
  // Chunks around arrive after the teleport.
  await ctx.sleep(2_500)
  return bot.entity.position.clone()
}

export interface MapHere {
  readonly map: FactionMap
  /** The chunk the bot stood in, the map's « + ». */
  readonly at: { readonly cx: number; readonly cz: number }
  /** Who holds that chunk, from the map's title (null when the title is not there). */
  readonly here: string | null
}

/** /f map from where the bot stands. Null if the answer holds no map, or the bot moved chunk meanwhile. */
export async function factionMap(ctx: ScriptContext, bot: Bot, mapCommand: string): Promise<MapHere | null> {
  const at = chunk(bot.entity.position)
  const lines = await command(ctx, bot, mapCommand, 2_500)
  const map = parseFactionMap(lines)
  if (!map || chunk(bot.entity.position).cx !== at.cx || chunk(bot.entity.position).cz !== at.cz) return null
  return { map, at, here: hereFromTitle(lines) }
}

/**
 * /f map's title where the bot stands (format « blood »): the owner of the bot's own chunk. Null when the answer holds
 * no title, the bot changed chunk meanwhile, or the title names another chunk than the bot's (not the server's answer
 * to this bot).
 */
export async function chunkHere(ctx: ScriptContext, bot: Bot, mapCommand: string, trace: Trace = () => {}): Promise<ChunkOwner | null> {
  const at = chunk(bot.entity.position)
  const lines = await command(ctx, bot, mapCommand, 2_500)
  const read = chunkFromMap(lines)
  const now = chunk(bot.entity.position)
  if (!read || now.cx !== at.cx || now.cz !== at.cz || read.cx !== at.cx || read.cz !== at.cz) {
    trace(`${mapCommand} en chunk ${at.cx},${at.cz} (puis ${now.cx},${now.cz}) pas retenu : ${lines.filter((l) => l.includes('<')).slice(0, 3).join(' | ') || `${lines.length} ligne(s) sans titre`}`)
    return null
  }
  return read
}

/** The detailed log (setting « journal »): what players send us when the plugin refuses their chests. */
export type Trace = (message: string) => void

/** The pathfinder, walking only (no digging, no placing), into chunk (cx, cz). Where it stops is read by the caller. */
function walkIntoChunk(ctx: ScriptContext, bot: Bot, cx: number, cz: number, timeoutMs: number): Promise<void> {
  return walkToGoal(ctx, bot, chunkGoal(cx, cz), timeoutMs)
}

/** The pathfinder, walking only (no digging, no placing, no doors), to a goal; where it stops is read by the caller. */
async function walkToGoal(ctx: ScriptContext, bot: Bot, goal: ReachGoal, timeoutMs: number): Promise<void> {
  const navigator = bot.pathfinder
  const previous = navigator.movements
  const moves = new previous.constructor(bot)
  Object.assign(moves, { canDig: false, allow1by1towers: false, allowParkour: false, canOpenDoors: false, scafoldingBlocks: [] })
  navigator.setMovements(moves)
  const timer = setTimeout(() => navigator.stop(), timeoutMs)
  const onAbort = () => navigator.stop()
  ctx.signal.addEventListener('abort', onAbort, { once: true })
  try {
    await navigator.goto(goal)
  } catch {
    // No path, stopped, timeout: decided by the caller from where the bot stands.
  } finally {
    clearTimeout(timer)
    ctx.signal.removeEventListener('abort', onAbort)
    navigator.setMovements(previous)
  }
  if (ctx.signal.aborted) throw ctx.signal.reason
}

/**
 * Reads the owner of each chunk a chest of `chests` stands in that the book does not know yet, standing anywhere in
 * it (on foot only, at most `limit` chunks tried): a chest is often in a wall on the chunk line, out of the bot's way.
 * Every unknown chunk the bot happens to stop in is read too. A chunk it cannot get into stays unknown, so its chests
 * are never used.
 */
export async function visitChunks(ctx: ScriptContext, bot: Bot, chests: readonly ChestBlock[], book: ClaimBook, mapCommand: string, limit: number, trace: Trace = () => {}): Promise<ClaimBook> {
  let result = book
  const readHere = async () => {
    const here = chunk(bot.entity.position)
    if (ownerIn(result, here.cx, here.cz) !== null) return
    const read = await chunkHere(ctx, bot, mapCommand, trace)
    if (read) result = withChunk(result, read)
    trace(`chunk ${here.cx},${here.cz} : ${read ? read.owner : 'illisible'}`)
  }
  const tried = new Set<string>()
  for (let visit = 0; visit < limit; visit++) {
    await ctx.checkpoint()
    // The nearest chest (findBlocks' order) whose chunk is still unknown.
    const next = chests.find((c) => {
      const { cx, cz } = chunk(c.position)
      return ownerIn(result, cx, cz) === null && !tried.has(`${cx},${cz}`)
    })
    if (!next) break
    const { cx, cz } = chunk(next.position)
    tried.add(`${cx},${cz}`)
    if (!bot.pathfinder) {
      // Kairn loads the pathfinder on the first walk.
      try {
        await ctx.walkTo(bot, { x: next.position.x + 0.5, y: next.position.y, z: next.position.z + 0.5 }, { range: 2, timeoutMs: 20_000 })
      } catch {
        // Read below from where it stopped.
      }
      await readHere()
    }
    const here = chunk(bot.entity.position)
    if ((here.cx !== cx || here.cz !== cz) && bot.pathfinder) await walkIntoChunk(ctx, bot, cx, cz, 20_000)
    await readHere()
    const end = chunk(bot.entity.position)
    if (end.cx !== cx || end.cz !== cz) trace(`chunk ${cx},${cz} (coffre ${next.position.x} ${next.position.y} ${next.position.z}) pas atteint à pied, arrêté en ${end.cx},${end.cz}`)
  }
  return result
}

/** The chests within `radius` of the bot, as chooseChests reads them. */
export function chestsAround(bot: Bot, radius: number): ChestBlock[] {
  const ids = ['chest', 'trapped_chest', 'ender_chest'].map((name) => bot.registry.blocksByName[name]?.id).filter((id: unknown) => id !== undefined)
  return bot.findBlocks({ matching: ids, maxDistance: radius, count: 256 }).map((v: any) => {
    const above = bot.blockAt(v.offset(0, 1, 0))
    // Minecraft refuses to open a chest under an opaque full block (BlockChest: isOccluding of the block above).
    // minecraft-data's « transparent » is false exactly for those opaque cubes; an unloaded block counts as blocking.
    const blockedAbove = above ? above.boundingBox === 'block' && !above.transparent : true
    return { position: { x: v.x, y: v.y, z: v.z }, name: bot.blockAt(v)?.name ?? '?', blockedAbove }
  })
}

/** The chests of our claim around the bot, from the faction map. */
/** Who holds a chunk, as the map read from `map.at` shows it (the bot's own cell, « + », from the title). */
export function claimOwner(map: MapHere): (cx: number, cz: number) => string | null {
  return (cx, cz) => (cx === map.at.cx && cz === map.at.cz ? map.here : ownerOf(map.map, map.at.cx, map.at.cz, cx, cz))
}

export function ourChests(bot: Bot, map: MapHere, faction: string, radius: number, options: ChooseOptions = {}): ChestChoice {
  return chooseChests(chestsAround(bot, radius), bot.entity.position, faction, claimOwner(map), options)
}

/** Plain emerald blocks (no custom name or lore: a renamed item of the player is not ours to store) in the bot's inventory. */
export function isPlain(ctx: ScriptContext, item: any, type: string): boolean {
  if (!item || item.name !== type) return false
  return ctx.items.lore(item).length === 0 && !item.customName && !(item.nbt && JSON.stringify(item.nbt).includes('display'))
}

export const count = (ctx: ScriptContext, bot: Bot, type: string): number => bot.inventory.items().filter((item: any) => isPlain(ctx, item, type)).reduce((n: number, item: any) => n + item.count, 0)

/**
 * The bot's pathfinder set to tower and bridge with dirt and never dig, for one reach; `ours` and the chest halves
 * forbid placing outside the claim and over a chest. Every placement goes to the ledger when it is asked, before the
 * server answers: a placement the server refused is just air afterwards, one it took is always known.
 */
async function reachWithDirt(ctx: ScriptContext, bot: Bot, target: ChestTarget, ours: (cx: number, cz: number) => boolean, ledger: { value: Ledger }, goal: ReachGoal, timeoutMs: number): Promise<void> {
  const navigator = bot.pathfinder
  if (!navigator) throw new Error('pathfinder absent (Kairn le charge au premier déplacement)')
  const previous = navigator.movements
  const Movements = previous.constructor
  const moves = new Movements(bot)
  const dirt = bot.registry.itemsByName.dirt.id
  Object.assign(moves, { canDig: false, allow1by1towers: true, allowParkour: false, canOpenDoors: false, allowSprinting: false, scafoldingBlocks: [dirt], maxDropDown: 3 })
  moves.exclusionAreasPlace = [(block: { position: Point }) => placeCost(block.position, target.halves, ours)]
  // A placement refused stops the climb at once: mineflayer-pathfinder would reset its path and place again, over and
  // over (index.js, resetPath('place_error')), and the network kicks for packet flood (seen live, 2026-10-29).
  let refused = false
  const refuse = () => {
    refused = true
    navigator.stop()
  }
  const onChat = (line: string) => NOT_SEEN.test(line) && refuse()
  const place = bot.placeBlock
  bot.placeBlock = (reference: { position: Point }, face: Point, ...rest: unknown[]) => {
    if (refused) return Promise.reject(new Error('pose refusée par le serveur'))
    ledger.value = record(ledger.value, placedAt(reference.position, face))
    return place.call(bot, reference, face, ...rest).catch((error: unknown) => {
      refuse()
      throw error
    })
  }
  bot.on('messagestr', onChat)
  navigator.setMovements(moves)
  const timer = setTimeout(() => navigator.stop(), timeoutMs)
  const onAbort = () => navigator.stop()
  ctx.signal.addEventListener('abort', onAbort, { once: true })
  try {
    await navigator.goto(goal)
  } catch {
    // No path, stopped, timeout, a placement refused: decided below from where the bot stands.
  } finally {
    clearTimeout(timer)
    ctx.signal.removeEventListener('abort', onAbort)
    bot.removeListener('messagestr', onChat)
    bot.placeBlock = place
    navigator.setMovements(previous)
  }
  if (refused) ctx.warn(`${bot.username} : pose de terre refusée par le serveur, montée arrêtée.`)
  if (ctx.signal.aborted) throw ctx.signal.reason
}

/** The block names of the bot's world, as sightOf reads them (null where not loaded). */
function namesOf(bot: Bot): BlockNameAt {
  const Vec3 = bot.entity.position.constructor
  return (x, y, z) => bot.blockAt(new Vec3(x, y, z))?.name ?? null
}

/** How the bot can click the chest from where it stands: within reach, and seen directly (see reachGoal). Null if not. */
export function clickOf(bot: Bot, target: ChestTarget): { face: Point; cursor: Point } | null {
  const eyes = eyesAt(bot.entity.position)
  if (!withinReach(eyes, target.position)) return null
  return sightOf(eyes, target.position, namesOf(bot))
}

/**
 * Walks, else builds, to where the chest is within reach and seen directly (the BloodSymphony network refuses a click
 * on a chest the player does not see: « Tu ne peux pas interagir avec ce bloc sans le voir directement. »). False if it
 * stays out of reach or out of sight.
 */
export async function reachChest(ctx: ScriptContext, bot: Bot, target: ChestTarget, ours: (cx: number, cz: number) => boolean, ledger: { value: Ledger }, avoid: ReadonlySet<string> = new Set()): Promise<boolean> {
  // `avoid`: places the server already refused this chest from (ClickRefused).
  const inReach = () => !avoid.has(standKey(bot.entity.position)) && clickOf(bot, target) !== null
  if (inReach()) return true
  const names = namesOf(bot)
  const goal = reachGoal(target.position, (node) => !avoid.has(standKey(node)) && sightOf(eyesAt(node, true), target.position, names) !== null)
  if (!bot.pathfinder) {
    // Kairn loads the pathfinder on the first walk.
    try {
      await ctx.walkTo(bot, { x: target.position.x + 0.5, y: target.position.y, z: target.position.z + 0.5 }, { range: 3, timeoutMs: 30_000 })
    } catch {
      // Decided below.
    }
    if (inReach()) return true
  }
  if (bot.pathfinder) await walkToGoal(ctx, bot, goal, 30_000)
  if (inReach()) return true
  if (count(ctx, bot, 'dirt') === 0) return false
  await reachWithDirt(ctx, bot, target, ours, ledger, goal, 60_000)
  return inReach()
}

/** How long a chest may take to open before it counts as refused (live, an accepted click opens it in under 0.5 s). */
const OPEN_TIMEOUT_MS = 2_500
/** The network's refusal (BloodSymphony, Sunaria). */
const NOT_SEEN = /sans le voir directement/i

/**
 * Opens the chest by the face the bot sees, at the point its look hits, as a vanilla client sends the click. Fails
 * when the chest is out of sight; ClickRefused when the server says it is not seen or it does not open in time (a
 * window that opens late is closed at once).
 */
async function openChest(ctx: ScriptContext, bot: Bot, target: ChestTarget, block: unknown): Promise<Window> {
  const click = clickOf(bot, target)
  if (!click) throw new Error(`coffre ${target.position.x} ${target.position.y} ${target.position.z} hors de vue directe`)
  const Vec3 = bot.entity.position.constructor
  const aim = chestAim(target.position)
  await bot.lookAt(new Vec3(aim.x, aim.y, aim.z), true)
  let settled = false
  let onChat: (line: string) => void = () => {}
  const refused = new Promise<never>((_, reject) => {
    onChat = (line) => NOT_SEEN.test(line) && reject(new ClickRefused('le serveur dit ne pas voir le coffre d’ici'))
    bot.on('messagestr', onChat)
  })
  const opening: Promise<Window> = bot.openContainer(block, new Vec3(click.face.x, click.face.y, click.face.z), new Vec3(click.cursor.x, click.cursor.y, click.cursor.z))
  opening.then((window: Window) => settled && bot.closeWindow(window), () => {})
  const timeout = ctx.sleep(OPEN_TIMEOUT_MS).then(() => {
    throw new ClickRefused(`le coffre ne s’ouvre pas d’ici`)
  })
  try {
    return await Promise.race([opening, refused, timeout])
  } finally {
    settled = true
    bot.removeListener('messagestr', onChat)
  }
}

/** Live: with the first shift-click sent as the chest opened, it went through and every later one of that opening got
 * no answer; with 1 s between the opening and the first click, the clicks were confirmed. 1.2 s leaves a margin. */
const OPEN_WAIT_MS = 1_200

/**
 * Opens the chest and moves the plain emerald blocks in, checking the result on the chest's own count. Returns how
 * many went in (0 when the chest is full).
 */
export async function depositBlocks(ctx: ScriptContext, bot: Bot, target: ChestTarget, type: string): Promise<{ moved: number; full: boolean }> {
  const block = bot.blockAt(new (bot.entity.position.constructor)(target.position.x, target.position.y, target.position.z))
  if (!block || !/chest/.test(block.name)) throw new Error(`plus de coffre en ${target.position.x} ${target.position.y} ${target.position.z}`)
  const window: Window = await openChest(ctx, bot, target, block)
  try {
    const top: number = window.inventoryStart
    const inChest = () => window.slots.slice(0, top).reduce((n: number, item: any) => n + (item?.name === type ? item.count : 0), 0)
    const free = () => window.slots.slice(0, top).some((item: any) => item === null) || window.slots.slice(0, top).some((item: any) => isPlain(ctx, item, type) && item.count < item.stackSize)
    const start = inChest()
    await ctx.sleep(OPEN_WAIT_MS)
    // What the chest can still take: its empty slots and the room left on its stacks of plain blocks.
    const room = window.slots.slice(0, top).reduce((n: number, item: any) => n + (item === null ? 64 : isPlain(ctx, item, type) ? Math.max(0, item.stackSize - item.count) : 0), 0)
    const stacks: number[] = []
    let planned = 0
    for (let slot = top; slot < window.slots.length && planned < room; slot++) {
      const item = window.slots[slot]
      if (!isPlain(ctx, item, type)) continue
      stacks.push(slot)
      planned += item.count
    }
    // All the shift-clicks at once, as the game's shift + double-click sends them (live on BloodSymphony 2026-10-28:
    // 10 at once, all confirmed in 65 ms; 0.6.0 waited 1.2 s after each stack). Shift-clicks only: a block is always
    // in the inventory or in the chest. A pick-up / put-down click the server leaves unanswered holds the stack on the
    // cursor, and closing the chest then drops it (seen live: 64 blocks on the cursor after an unanswered click).
    const answers = await Promise.allSettled(stacks.map((slot) => bot.clickWindow(slot, 0, 1)))
    const refused = answers.filter((a): a is PromiseRejectedResult => a.status === 'rejected')
    // What went in is read on the chest below, the rest waits for the next trip.
    if (refused.length > 0) ctx.warn(`${bot.username} : ${refused.length} clic(s) de dépôt sans réponse (${String(refused[0]!.reason instanceof Error ? refused[0]!.reason.message : refused[0]!.reason)}).`)
    await ctx.sleep(400)
    const moved = inChest() - start
    return { moved, full: !free() }
  } finally {
    bot.closeWindow(window)
  }
}

/** How far the bot would fall if the block under its feet went away (blocks of air under it, up to 16). */
function dropUnder(bot: Bot, feet: Point): number {
  const Vec3 = bot.entity.position.constructor
  let drop = 0
  while (drop < 16 && bot.blockAt(new Vec3(feet.x, feet.y - 2 - drop, feet.z))?.boundingBox === 'empty') drop++
  return drop
}

/**
 * Breaks the scaffolding back, top first, the dirt dropping at the bot (picked up as it goes). Under its own feet the
 * bot only digs when the fall is a block or two (a pillar taken down from its top); a bridge block under it is first
 * left for the previous one. Only blocks the ledger placed and that are dirt now are ever broken. Returns the blocks
 * still standing.
 */
export async function takeDown(ctx: ScriptContext, bot: Bot, ledger: { value: Ledger }): Promise<Point[]> {
  const Vec3 = bot.entity.position.constructor
  const isDirt = (p: Point) => bot.blockAt(new Vec3(p.x, p.y, p.z))?.name === 'dirt'
  for (let pass = 0; pass < 3; pass++) {
    for (const p of cleanupOrder(ledger.value)) {
      await ctx.checkpoint()
      if (!isDirt(p)) continue
      const feet = floor(bot.entity.position)
      const under = feet.x === p.x && feet.z === p.z && feet.y - 1 === p.y
      if (under && dropUnder(bot, feet) > 2) {
        // A bridge: step back onto another of our blocks at this height, then break this one from there.
        const back = ledger.value.placed.find((q) => q.y === p.y && Math.abs(q.x - p.x) + Math.abs(q.z - p.z) === 1 && isDirt(q))
        if (!back) continue
        try {
          await ctx.walkTo(bot, { x: back.x + 0.5, y: back.y + 1, z: back.z + 0.5 }, { range: 0.4, timeoutMs: 10_000 })
        } catch {
          continue
        }
      } else if (!under && eyeDistance(floor(bot.entity.position), p) > 4.5) {
        try {
          await ctx.walkTo(bot, { x: p.x + 0.5, y: p.y, z: p.z + 0.5 }, { range: 3, timeoutMs: 20_000 })
        } catch {
          continue
        }
        if (eyeDistance(floor(bot.entity.position), p) > 4.5) continue
      }
      const block = bot.blockAt(new Vec3(p.x, p.y, p.z))
      if (!block || block.name !== 'dirt') continue
      try {
        await bot.dig(block, true)
        await ctx.sleep(400)
      } catch (error) {
        ctx.warn(`${bot.username} : terre en ${p.x} ${p.y} ${p.z} pas recassée (${error instanceof Error ? error.message : String(error)})`)
      }
    }
    if (!ledger.value.placed.some(isDirt)) break
  }
  // The last drops land at the bot's feet: a moment to pick them up.
  await ctx.sleep(1_500)
  const still = leftovers(ledger.value, (p) => bot.blockAt(new Vec3(p.x, p.y, p.z))?.name ?? null).filter(isDirt)
  ledger.value = { placed: still }
  return still
}

/** Throws MovedAway when the bot is no longer near the home (teleported, dead and respawned). */
export function assertNear(bot: Bot, home: Point, radius: number): void {
  if (!bot.entity || bot.health <= 0) throw new MovedAway('le bot est mort')
  const p = bot.entity.position
  if (Math.hypot(p.x - home.x, p.z - home.z) > radius) throw new MovedAway(`le bot a été déplacé loin du home (${Math.round(p.x)} ${Math.round(p.y)} ${Math.round(p.z)})`)
}

export { EMPTY_LEDGER }
