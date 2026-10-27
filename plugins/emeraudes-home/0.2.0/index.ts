import type { Account, Bot, ScriptContext } from '../kairn'
import { assertNear, chestsAround, chunkHere, claimOwner, command, count, depositBlocks, factionMap, goHome, isPlain, listen, MovedAway, ourChests, reachChest, takeDown, visitChunks } from './lib/base.ts'
import { EMPTY_BOOK, factionFromTitle, ownerIn, withChunk } from './lib/blood.ts'
import { EMPTY_LEDGER, scaffoldFor, type Ledger } from './lib/build.ts'
import { chooseChests, type ChestChoice, type ChestTarget, type Point } from './lib/chests.ts'
import { parseAmount } from './lib/money.ts'
import { factionFromShow, pickProfile, type ServerProfile, type Shop, type Ware } from './lib/profiles.ts'
import { planPurchase, splitPurchase, type Inventory, type Slot } from './lib/space.ts'

/**
 * Émeraudes au home (play.sunaria.fr, play.bloodsymphony.com): for each account, all its money becomes emerald
 * blocks (bought at the /shop, emeralds condensed 9 → 1 where the shop sells no block), stored in the chests of a
 * home that stand in the account's own faction claim. A high chest is reached with dirt bought for it (towers and
 * bridges, never a block of the base broken), and the dirt is taken back down afterwards. Trips go on while money is
 * left and the chests have room. What differs between the two servers is in lib/profiles.ts.
 */

const BLOCK = 'emerald_block'
/** How far from the home the bot may be before it counts as moved away (teleported, killed). */
const HOME_RADIUS = 64

interface Totals {
  moneyBefore: number | null
  moneyAfter: number | null
  bought: number
  deposited: number
  chests: Map<string, number>
}

const at = (p: Point) => `${p.x} ${p.y} ${p.z}`

/** The 36 main inventory slots as lib/space.ts reads them (window slots 9-44 of the player inventory). */
function inventoryOf(ctx: ScriptContext, bot: Bot): Inventory {
  return bot.inventory.slots.slice(9, 45).map((item: any): Slot | null => (item ? { type: item.name, metadata: item.metadata ?? 0, count: item.count, max: item.stackSize ?? 64, special: !isPlain(ctx, item, item.name) } : null))
}

async function readMoney(ctx: ScriptContext, bot: Bot, profile: ServerProfile): Promise<number | null> {
  const lines = await command(ctx, bot, profile.money.command, 2_000)
  for (const line of lines) {
    const value = parseAmount(line, profile.money.label)
    if (value !== null) return value
  }
  return null
}

/** A purchase that took money (or may have) without the items arriving as planned: nothing more is bought. */
class StateUnknown extends Error {}

/**
 * One purchase round: the dirt this trip needs, then the emeralds (or blocks) that fit, condensed to blocks.
 * Every purchase is checked on the inventory; a short delivery stops the account (the money may be gone).
 */
async function purchase(ctx: ScriptContext, bot: Bot, profile: ServerProfile, shop: Shop | null, dirtNeed: number, budget: number, totals: Totals): Promise<number> {
  if (!shop) throw new Error(`l’achat au shop de ${profile.label} n’est pas encore relevé : lancez avec « Acheter » décoché pour ranger ce que le compte porte.`)
  try {
    return await buyRound(ctx, bot, profile, shop, dirtNeed, budget, totals)
  } finally {
    shop.close?.(bot)
  }
}

async function buyRound(ctx: ScriptContext, bot: Bot, profile: ServerProfile, shop: Shop, dirtNeed: number, budget: number, totals: Totals): Promise<number> {
  const money = await readMoney(ctx, bot, profile)
  if (money === null) throw new Error(`argent illisible (${profile.money.command}).`)
  totals.moneyBefore ??= money
  const usable = budget > 0 ? Math.min(money, budget - (totals.moneyBefore - money)) : money
  const direct = profile.convert.kind === 'shop'
  const ware: Ware = direct ? 'emerald_block' : 'emerald'
  const target = await shop.offer(ctx, bot, ware)
  if (!target) throw new Error(`le shop ne vend pas ${ware}.`)
  const dirt = dirtNeed > 0 ? await shop.offer(ctx, bot, 'dirt') : null
  const plan = planPurchase(inventoryOf(ctx, bot), usable, target, dirtNeed, dirt, direct ? undefined : { to: { type: BLOCK }, ratio: 9 })
  ctx.log(`${bot.username} : argent ${money}, à dépenser ${usable} → ${plan.scaffold} terre + ${plan.target} ${ware} (${plan.cost}).`)
  const buy = async (w: Ware, total: number) => {
    for (const size of splitPurchase(total, shop.sizes)) {
      await ctx.checkpoint()
      const got = await shop.buy(ctx, bot, w, size)
      if (got !== size) throw new StateUnknown(`achat de ${size} ${w} : ${got} reçu(s). Arrêt du compte, vérifiez son argent et son inventaire.`)
    }
  }
  if (plan.scaffold > 0) await buy('dirt', plan.scaffold)
  if (plan.target === 0) return 0
  const before = count(ctx, bot, BLOCK)
  await buy(ware, plan.target)
  if (profile.convert.kind === 'command') {
    // Emeralds the account already held are condensed too.
    const expected = Math.floor(count(ctx, bot, 'emerald') / 9)
    await command(ctx, bot, profile.convert.command, 2_000)
    const made = count(ctx, bot, BLOCK) - before
    if (made !== expected) throw new StateUnknown(`${profile.convert.command} : ${made} bloc(s) au lieu de ${expected}.`)
  }
  const blocks = count(ctx, bot, BLOCK) - before
  totals.bought += blocks
  return blocks
}

/** Fills the chests in order; the full and unreachable ones are left for the next trips. */
async function store(ctx: ScriptContext, bot: Bot, chests: readonly ChestTarget[], done: Set<string>, ours: (cx: number, cz: number) => boolean, home: Point, totals: Totals): Promise<void> {
  for (const chest of chests) {
    if (count(ctx, bot, BLOCK) === 0) return
    if (done.has(at(chest.position))) continue
    const ledger: { value: Ledger } = { value: EMPTY_LEDGER }
    try {
      if (!(await reachChest(ctx, bot, chest, ours, ledger))) {
        ctx.warn(`${bot.username} : coffre ${at(chest.position)} inaccessible (à pied ou avec la terre), passé.`)
        done.add(at(chest.position))
        continue
      }
      const { moved, full } = await depositBlocks(ctx, bot, chest, BLOCK)
      totals.deposited += moved
      if (moved > 0) totals.chests.set(at(chest.position), (totals.chests.get(at(chest.position)) ?? 0) + moved)
      ctx.log(`${bot.username} : ${moved} bloc(s) dans le coffre ${at(chest.position)}${full ? ' (plein)' : ''}.`)
      if (full) done.add(at(chest.position))
    } catch (error) {
      if (error instanceof MovedAway || ctx.signal.aborted) throw error
      ctx.warn(`${bot.username} : coffre ${at(chest.position)} passé (${error instanceof Error ? error.message : String(error)}).`)
      done.add(at(chest.position))
    } finally {
      if (ledger.value.placed.length > 0 && !ctx.signal.aborted) {
        const still = await takeDown(ctx, bot, ledger).catch((error: unknown) => (ctx.warn(`${bot.username} : retrait de la terre interrompu (${error instanceof Error ? error.message : String(error)}).`), ledger.value.placed))
        if (still.length) ctx.warn(`${bot.username} : ${still.length} bloc(s) de terre pas recassé(s) : ${still.map(at).join(' ; ')}.`)
      }
    }
    assertNear(bot, home, HOME_RADIUS)
  }
}

async function runAccount(ctx: ScriptContext, bot: Bot, account: Account): Promise<void> {
  const homeName = String(ctx.settings['home'] ?? '').trim()
  const toBuy = ctx.settings['acheter'] !== false
  const trips = Math.max(1, Number(ctx.settings['voyages'] ?? 10))
  const radius = Math.min(48, Math.max(8, Number(ctx.settings['rayon'] ?? 32)))
  const dirtCap = Math.min(128, Math.max(0, Number(ctx.settings['terre'] ?? 64)))
  const budget = Math.max(0, Number(ctx.settings['plafond'] ?? 0))
  const arrival = await listen(ctx, bot, 4_000)
  const shown = [bot.tablist?.header?.toString?.() ?? '', bot.tablist?.footer?.toString?.() ?? '', bot.scoreboard?.sidebar?.title ?? '', ...arrival].join(' ')
  const profile = pickProfile(String(ctx.settings['serveur'] ?? 'auto'), shown)
  if (!profile) throw new Error('serveur pas reconnu : choisissez-le dans « Serveur ».')
  const showLines = await command(ctx, bot, profile.faction.show, 2_500)
  const faction = profile.faction.format === 'blood' ? factionFromTitle(showLines) : factionFromShow(showLines)
  if (!faction) throw new Error(`pas de faction (${profile.faction.show}) : rien n’est rangé hors d’un claim.`)
  const home = await goHome(ctx, bot, homeName)
  let choice: ChestChoice
  let ours: (cx: number, cz: number) => boolean
  if (profile.faction.format === 'blood') {
    // Only the chunk the bot stands in is told: the home's, then each other chest's chunk, walked into.
    const here = await chunkHere(ctx, bot, profile.faction.map)
    if (!here) throw new Error(`${profile.faction.map} illisible au home : sans claim lu, aucun coffre n’est sûr.`)
    if (here.owner !== faction) throw new Error(`le home « ${homeName} » est dans un chunk de ${here.owner}, pas dans le claim de ${faction}.`)
    const blocks = chestsAround(bot, radius)
    const book = await visitChunks(ctx, bot, blocks, withChunk(EMPTY_BOOK, here), profile.faction.map, 16)
    if (book.owners.size > 1) await ctx.walkTo(bot, home, { range: 1, timeoutMs: 30_000 })
    assertNear(bot, home, HOME_RADIUS)
    ours = (cx, cz) => ownerIn(book, cx, cz) === faction
    choice = chooseChests(blocks, bot.entity.position, faction, (cx, cz) => ownerIn(book, cx, cz))
  } else {
    const map = await factionMap(ctx, bot, profile.faction.map)
    if (!map) throw new Error(`${profile.faction.map} illisible : sans carte, aucun coffre n’est sûr.`)
    // Two answers from the server must agree: the faction of /f show holds land on the map around the home.
    if (map.here !== faction && ![...map.map.legend.values()].includes(faction)) throw new Error(`la faction ${faction} n’a aucun claim sur la carte autour du home.`)
    const owner = claimOwner(map)
    ours = (cx, cz) => owner(cx, cz) === faction
    choice = ourChests(bot, map, faction, radius)
  }
  ctx.log(`${bot.username} (${profile.label}, faction ${faction}) : home « ${homeName} » en ${at({ x: Math.floor(home.x), y: Math.floor(home.y), z: Math.floor(home.z) })}, ${choice.usable.length} coffre(s) du claim, ${choice.refused.length} écarté(s).`)
  for (const r of choice.refused.slice(0, 10)) ctx.log(`  écarté ${at(r.position)} : ${r.why}`)
  if (choice.usable.length === 0) throw new Error('aucun coffre du claim de la faction autour du home.')
  const shop = profile.shop?.() ?? null
  const totals: Totals = { moneyBefore: null, moneyAfter: null, bought: 0, deposited: 0, chests: new Map() }
  const done = new Set<string>()
  let dead = false
  const onDeath = () => (dead = true)
  bot.on('death', onDeath)
  try {
    for (let trip = 1; trip <= trips; trip++) {
      await ctx.checkpoint()
      if (dead) throw new MovedAway('le bot est mort')
      assertNear(bot, home, HOME_RADIUS)
      const open = choice.usable.filter((c) => !done.has(at(c.position)))
      if (open.length === 0) {
        ctx.warn(`${bot.username} : plus de coffre libre et accessible.`)
        break
      }
      if (toBuy) {
        const dirtNeed = Math.min(dirtCap, Math.max(0, ...open.map((c) => scaffoldFor(home, c.position, dirtCap))))
        const bought = await purchase(ctx, bot, profile, shop, dirtNeed, budget, totals)
        if (bought === 0 && count(ctx, bot, BLOCK) === 0) break
      }
      if (count(ctx, bot, BLOCK) === 0) {
        if (!toBuy) ctx.log(`${bot.username} : aucun bloc d’émeraude à ranger.`)
        break
      }
      const stored = totals.deposited
      await store(ctx, bot, open, done, ours, home, totals)
      // Without purchases, trips go on only while each one still puts blocks away (a deposit cut short by the server).
      if (!toBuy && totals.deposited === stored) break
    }
  } finally {
    bot.removeListener('death', onDeath)
    if (toBuy && profile.shop && !dead) totals.moneyAfter = await readMoney(ctx, bot, profile).catch(() => null)
    const used = [...totals.chests].map(([p, n]) => `${p} (${n})`).join(', ') || 'aucun'
    ctx.log(`${bot.username} — argent ${totals.moneyBefore ?? '?'} → ${totals.moneyAfter ?? '?'}, ${totals.bought} bloc(s) acheté(s), ${totals.deposited} déposé(s), ${count(ctx, bot, BLOCK)} encore sur le compte ; coffres : ${used}.`)
  }
}

export default async function (ctx: ScriptContext): Promise<void> {
  if (!String(ctx.settings['home'] ?? '').trim()) throw new Error('indiquez le nom du home (réglage « Home »).')
  const result = await ctx.forEachBot(async (bot, account) => {
    try {
      await runAccount(ctx, bot, account)
    } catch (error) {
      if (error instanceof StateUnknown || error instanceof MovedAway) ctx.notify(`${bot.username} : ${error.message}`, { level: 'warn' })
      throw error
    }
  })
  ctx.log(`Terminé : ${result.done.length} compte(s), ${result.failed.length} en échec, ${result.skipped.length} passé(s).`)
}
