// At the faction home, with a live bot: go there, see which chests are ours, reach each one (walking, else towering
// and bridging with the bot's own dirt), put the emerald blocks in, then take the dirt back down. Nothing of the base
// is ever broken: the pathfinder cannot dig, and the only blocks the bot breaks are the ones its ledger says it placed.
import type { Bot, ScriptContext, Window } from '../../kairn'
import { cleanupOrder, EMPTY_LEDGER, leftovers, placeCost, placedAt, record, type Ledger } from './build.ts'
import { chooseChests, type ChestBlock, type ChestChoice, type ChestTarget, type ChooseOptions, type Point } from './chests.ts'
import { chunkFromMap, ownerIn, withChunk, type ChunkOwner, type ClaimBook } from './blood.ts'
import { hereFromTitle, ownerOf, parseFactionMap, type FactionMap } from './fmap.ts'
import { chunkGoal, eyeDistance, reachGoal } from './reach.ts'

/** The bot left the home on its own (death, teleport by staff or by a plugin): the run for this account stops. */
export class MovedAway extends Error {}

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
async function walkIntoChunk(ctx: ScriptContext, bot: Bot, cx: number, cz: number, timeoutMs: number): Promise<void> {
  const navigator = bot.pathfinder
  const previous = navigator.movements
  const moves = new previous.constructor(bot)
  Object.assign(moves, { canDig: false, allow1by1towers: false, allowParkour: false, canOpenDoors: false, scafoldingBlocks: [] })
  navigator.setMovements(moves)
  const timer = setTimeout(() => navigator.stop(), timeoutMs)
  const onAbort = () => navigator.stop()
  ctx.signal.addEventListener('abort', onAbort, { once: true })
  try {
    await navigator.goto(chunkGoal(cx, cz))
  } catch {
    // No path, stopped, timeout: the chunk stays unknown unless the bot got into it anyway.
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
async function reachWithDirt(ctx: ScriptContext, bot: Bot, target: ChestTarget, ours: (cx: number, cz: number) => boolean, ledger: { value: Ledger }, timeoutMs: number): Promise<void> {
  const navigator = bot.pathfinder
  if (!navigator) throw new Error('pathfinder absent (Kairn le charge au premier déplacement)')
  const previous = navigator.movements
  const Movements = previous.constructor
  const moves = new Movements(bot)
  const dirt = bot.registry.itemsByName.dirt.id
  Object.assign(moves, { canDig: false, allow1by1towers: true, allowParkour: false, canOpenDoors: false, allowSprinting: false, scafoldingBlocks: [dirt], maxDropDown: 3 })
  moves.exclusionAreasPlace = [(block: { position: Point }) => placeCost(block.position, target.halves, ours)]
  const place = bot.placeBlock
  bot.placeBlock = (reference: { position: Point }, face: Point, ...rest: unknown[]) => {
    ledger.value = record(ledger.value, placedAt(reference.position, face))
    return place.call(bot, reference, face, ...rest)
  }
  navigator.setMovements(moves)
  const timer = setTimeout(() => navigator.stop(), timeoutMs)
  const onAbort = () => navigator.stop()
  ctx.signal.addEventListener('abort', onAbort, { once: true })
  try {
    await navigator.goto(reachGoal(target.position))
  } catch {
    // No path, stopped, timeout: decided below from where the bot stands.
  } finally {
    clearTimeout(timer)
    ctx.signal.removeEventListener('abort', onAbort)
    bot.placeBlock = place
    navigator.setMovements(previous)
  }
  if (ctx.signal.aborted) throw ctx.signal.reason
}

/** Walks, else builds, to within reach of the chest. False if it stays out of reach. */
export async function reachChest(ctx: ScriptContext, bot: Bot, target: ChestTarget, ours: (cx: number, cz: number) => boolean, ledger: { value: Ledger }): Promise<boolean> {
  const inReach = () => eyeDistance(floor(bot.entity.position), target.position) <= 4.5
  if (inReach()) return true
  try {
    await ctx.walkTo(bot, { x: target.position.x + 0.5, y: target.position.y, z: target.position.z + 0.5 }, { range: 3, timeoutMs: 30_000 })
  } catch {
    // Not on foot: with dirt below.
  }
  if (inReach()) return true
  if (count(ctx, bot, 'dirt') === 0) return false
  await reachWithDirt(ctx, bot, target, ours, ledger, 60_000)
  return inReach()
}

const CLICK_GAP_MS = 1_200

/**
 * Opens the chest and moves the plain emerald blocks in, checking the result on the chest's own count. Returns how
 * many went in (0 when the chest is full).
 */
export async function depositBlocks(ctx: ScriptContext, bot: Bot, target: ChestTarget, type: string): Promise<{ moved: number; full: boolean }> {
  const block = bot.blockAt(new (bot.entity.position.constructor)(target.position.x, target.position.y, target.position.z))
  if (!block || !/chest/.test(block.name)) throw new Error(`plus de coffre en ${target.position.x} ${target.position.y} ${target.position.z}`)
  const window: Window = await bot.openContainer(block)
  try {
    const top: number = window.inventoryStart
    const inChest = () => window.slots.slice(0, top).reduce((n: number, item: any) => n + (item?.name === type ? item.count : 0), 0)
    const free = () => window.slots.slice(0, top).some((item: any) => item === null) || window.slots.slice(0, top).some((item: any) => isPlain(ctx, item, type) && item.count < item.stackSize)
    const start = inChest()
    // Live: with the first shift-click sent as the chest opened, it went through and every later one of that opening
    // got no answer; with 1 s between the opening and the first click, both clicks captured were confirmed.
    await ctx.sleep(CLICK_GAP_MS)
    // Shift-clicks only: a block is always in the inventory or in the chest. A pick-up / put-down click the server
    // leaves unanswered holds the stack on the cursor, and closing the chest then drops it (seen live: 64 blocks on
    // the cursor after an unanswered click).
    for (let slot = top; slot < window.slots.length; slot++) {
      if (!free()) break
      const item = window.slots[slot]
      if (!isPlain(ctx, item, type)) continue
      try {
        await bot.clickWindow(slot, 0, 1)
      } catch (error) {
        // What went in is read on the chest below, the rest waits for the next trip.
        ctx.warn(`${bot.username} : dépôt interrompu (${error instanceof Error ? error.message : String(error)}).`)
        break
      }
      // Live on BloodSymphony (captured 2026-10-27): a shift-click 250 or 600 ms after the previous one got no answer
      // at all, 1 s after it was confirmed in 40 ms. 1.2 s leaves a margin.
      await ctx.sleep(CLICK_GAP_MS)
    }
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
