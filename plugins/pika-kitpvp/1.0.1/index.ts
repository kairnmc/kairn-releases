import type { Account, Bot, ScriptContext } from '../kairn'

/**
 * PikaNetwork (play.pika-network.net), KitPvP: joins the mode from the lobby, claims the Classes of
 * /gkit the account has unlocked (weekly gkits, received as armor stands) and sends them to the main
 * account by mail (/maildelivery), and optionally the kits of /kit. Cracked or premium: Kairn signs
 * in (and registers a new cracked account) before. Claims note their cooldown (pika:…), so the plugin
 * can be scheduled. On Pika a kit is equipped when selected, one per life: only the first kit of a
 * life is taken, the others say « once a life » and are tried again next time.
 */

const HOUR = 3_600_000
const DAY = 24 * HOUR
/** The kits of « Select a Kit » the form offers, with the delay to note after a claim. */
const KITS = [
  { setting: 'monthly', name: 'Monthly Kit', delay: 30 * DAY },
  { setting: 'weekly', name: 'Weekly Kit', delay: 7 * DAY },
  { setting: 'daily', name: 'Daily Kit', delay: DAY },
  { setting: 'vip', name: 'Vip Kit', delay: HOUR },
  { setting: 'god', name: 'God Kit', delay: HOUR },
  { setting: 'legend', name: 'Legend Kit', delay: HOUR },
  { setting: 'ultimate', name: 'Ultimate Kit', delay: HOUR },
  { setting: 'baron', name: 'Baron Kit', delay: HOUR },
  { setting: 'omega', name: 'Omega Kit', delay: HOUR },
  { setting: 'omegaplus', name: 'Omega+ Kit', delay: HOUR },
  { setting: 'pikastar', name: 'Pika+ ▪ ✭ Tier Kit', delay: 30 * DAY },
  { setting: 'pikaheart', name: 'Pika+ ▪ ❤ Tier Kit', delay: 30 * DAY },
]
const LOCKED_KIT = /can ?not use this kit/i
const LOCKED_CLASS = /LOCKED|do not have permission/i
const CLAIMED = /selected the kit|claimed|received|obtained|you got/i
/** A refusal that is not a cooldown: nothing noted, tried again next time. */
const REFUSED = /once a life|can ?not|cannot|already|not allowed|no permission|do not have/i
const SEND_MENU = 'Select items to send'
/** The delay to plan this plugin by (Planifier › pika:kitpvp): set after each pass to the next useful moment. */
const SCHEDULE_KEY = 'pika:kitpvp'
/** A server line about kits or classes and when they come back. */
const ABOUT_IT = /kit|class|cooldown|available|again|wait|claim/i
/** Players' chat (« <2> <Baron> Name › text »): never the server's answer. */
const PLAYER_CHAT = /›|<\d+>/

/** The server's chat lines during `ms`. */
function listen(ctx: ScriptContext, bot: Bot, ms: number): Promise<string[]> {
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

const shown = (lines: readonly string[]) => lines.filter((l) => !/›|<\d+>|store\.pika|killstreak|Welcome .* to KitPvP/.test(l)).slice(0, 2).join(' | ')

/** In KitPvP already, or from the lobby through the Server Selector (queue included). */
async function joinKitPvp(ctx: ScriptContext, bot: Bot): Promise<void> {
  if (!ctx.items.find(bot, 'Server Selector')) return
  const menu = await ctx.menus.open(bot, { item: 'Server Selector' }, { title: 'Server Selector' })
  await ctx.menus.click(bot, menu, 'KitPvP')
  for (let waited = 0; waited < 45 && ctx.items.find(bot, 'Server Selector'); waited++) await ctx.sleep(1_000)
  if (ctx.items.find(bot, 'Server Selector')) throw new Error('pas arrivé en KitPvP en 45 s (toujours au lobby).')
  await ctx.sleep(3_000)
  ctx.log(`${bot.username} : en KitPvP.`)
}

/** What a click answered: claimed (cooldown noted), in cooldown (noted from the text), refused or unclear (nothing noted). */
function outcome(ctx: ScriptContext, account: Account, key: string, delay: number, said: readonly string[]): string {
  // A delay only from the server's answer about it: KitPvP's chat also shows unrelated timers (« koth … 02:30 left! »).
  const told = said.find((line) => ABOUT_IT.test(line) && !PLAYER_CHAT.test(line) && ctx.cooldowns.parse(line) !== null && !CLAIMED.test(line))
  if (told) {
    ctx.cooldowns.setFromText(account, key, told)
    return `en délai (${told})`
  }
  const claimed = said.find((line) => CLAIMED.test(line) && !PLAYER_CHAT.test(line))
  if (claimed) {
    ctx.cooldowns.set(account, key, delay)
    return `récupéré — ${claimed}`
  }
  const refused = said.find((line) => REFUSED.test(line) && !PLAYER_CHAT.test(line))
  return refused ? `refusé — ${refused}` : `pas de réponse claire${said.length ? ` — ${shown(said)}` : ''} (rien noté)`
}

/** Clicks one kit of « Select a Kit » if it is ready and owned. */
async function claimKit(ctx: ScriptContext, bot: Bot, account: Account, name: string, key: string, delay: number): Promise<string> {
  if (!ctx.cooldowns.ready(account, key)) return `${name} : pas encore (délai noté)`
  const menu = await ctx.menus.open(bot, { command: '/kit' }, { title: 'Select a Kit' })
  const found = ctx.items.find(menu, name)
  if (!found || found.lore.some((line) => LOCKED_KIT.test(line))) {
    bot.closeWindow(menu)
    return `${name} : ${found ? 'pas débloqué pour ce compte' : 'absent du menu'}`
  }
  const answer = listen(ctx, bot, 2_500)
  await ctx.menus.click(bot, menu, name)
  const said = await answer
  if (bot.currentWindow) bot.closeWindow(bot.currentWindow)
  return `${name} : ${outcome(ctx, account, key, delay, said)}`
}

/** Opens /gkit at a page (1 or 2). */
async function classesPage(ctx: ScriptContext, bot: Bot, page: number) {
  const menu = await ctx.menus.open(bot, { command: '/gkit' }, { title: 'Classes' })
  if (page === 1) return menu
  if (!ctx.items.find(menu, 'Next Page')) {
    bot.closeWindow(menu)
    return null
  }
  // Page 2 has the same title: wait until the menu's content really changes (a new window, or the same one refilled).
  const signature = (window: { id?: number; containerItems(): unknown[] } | null) => (window ? `${window.id}:${window.containerItems().map((item) => ctx.items.name(item)).join('|')}` : '')
  const before = signature(menu)
  await ctx.menus.click(bot, menu, 'Next Page')
  for (let waited = 0; waited < 5_000; waited += 200) {
    await ctx.sleep(200)
    if (bot.currentWindow && signature(bot.currentWindow) !== before) return ctx.menus.waitFor(bot, { title: 'Classes' })
  }
  if (bot.currentWindow) bot.closeWindow(bot.currentWindow)
  return null
}

/** The unlocked Classes of /gkit (both pages), all or only the named ones, once a week each. */
async function claimClasses(ctx: ScriptContext, bot: Bot, account: Account, only: readonly string[], reset: boolean, keys: string[]): Promise<string[]> {
  const results: string[] = []
  for (let page = 1; page <= 2; page++) {
    const menu = await classesPage(ctx, bot, page)
    if (!menu) break
    const classes = ctx.items.findAll(menu, { lore: 'get the class' })
    const open = classes.filter((item) => !item.lore.some((line) => LOCKED_CLASS.test(line)) && (only.length === 0 || only.includes(item.name.toLowerCase())))
    bot.closeWindow(menu)
    if (open.length === 0) results.push(`Classes page ${page} : aucune à récupérer (${classes.length} au total, verrouillées ou non choisies)`)
    for (const item of open) {
      const key = `pika:class:${item.name.toLowerCase()}`
      keys.push(key)
      if (reset) ctx.cooldowns.clear(account, key)
      if (!ctx.cooldowns.ready(account, key)) {
        results.push(`Classe ${item.name} : pas encore (délai noté)`)
        continue
      }
      const current = await classesPage(ctx, bot, page)
      if (!current) break
      const answer = listen(ctx, bot, 2_500)
      await ctx.menus.click(bot, current, item.name)
      const said = await answer
      if (bot.currentWindow) bot.closeWindow(bot.currentWindow)
      results.push(`Classe ${item.name} : ${outcome(ctx, account, key, 7 * DAY, said)}`)
      await ctx.sleep(1_500)
    }
  }
  return results
}

/**
 * Sends the account's armor stands (Classes as Pika gives them) to the main account: /maildelivery
 * opens « Select items to send »; items clicked in the inventory go into its 18 slots, and closing
 * the menu sends them. Only armor stands are ever clicked: the rest of the inventory stays.
 */
async function sendClasses(ctx: ScriptContext, bot: Bot, main: string): Promise<string> {
  const count = () => bot.inventory.items().filter((item: { name: string }) => item.name === 'armor_stand').reduce((n: number, item: { count: number }) => n + item.count, 0)
  const before = count()
  if (before === 0) return 'aucune Classe (armor stand) à envoyer'
  if (main.toLowerCase() === String(bot.username).toLowerCase()) return 'c’est le compte principal : ses Classes restent sur lui'
  for (let round = 0; round < 5 && count() > 0; round++) {
    const answer = listen(ctx, bot, 3_500)
    bot.chat(`/maildelivery ${main}`)
    const menu = await ctx.menus.waitFor(bot, { title: SEND_MENU })
    const top = menu.inventoryStart ?? 27
    let placed = 0
    for (let slot = top; slot < menu.slots.length && placed < 18; slot++) {
      if (menu.slots[slot]?.name !== 'armor_stand') continue
      await bot.clickWindow(slot, 0, 0)
      placed++
      await ctx.sleep(400)
    }
    const deposited = menu.slots.slice(0, top).filter((item: { name: string } | null) => item?.name === 'armor_stand').length
    if (deposited === 0) {
      bot.closeWindow(menu)
      return `le menu d’envoi n’a pris aucun armor stand — ${shown(await answer)}`
    }
    // Closing the menu sends what it holds.
    bot.closeWindow(menu)
    const said = await answer
    if (said.some((line) => REFUSED.test(line) || /not found|never played|doesn.t exist|invalid/i.test(line))) return `envoi refusé — ${shown(said)}`
    await ctx.sleep(1_500)
  }
  return `${before - count()} Classe(s) envoyée(s) à ${main}${count() > 0 ? `, ${count()} restée(s) sur le compte` : ''}`
}

export default async function (ctx: ScriptContext): Promise<void> {
  const want = (key: string) => ctx.settings[key] === true
  const main = String(ctx.settings['main'] ?? '').trim()
  const only = String(ctx.settings['classesOnly'] ?? '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean)
  const result = await ctx.forEachBot(async (bot, account) => {
    if (want('reset')) {
      for (const kit of KITS) ctx.cooldowns.clear(account, `pika:kit:${kit.setting}`)
      ctx.log(`${bot.username} : délais notés oubliés.`)
    }
    await ctx.sleep(4_000)
    await joinKitPvp(ctx, bot)
    /** The delays this pass looked at: the next of them sets SCHEDULE_KEY. */
    const keys: string[] = []
    if (want('classes')) {
      for (const line of await claimClasses(ctx, bot, account, only, want('reset'), keys)) ctx.log(`${bot.username} — ${line}`)
      if (main) ctx.log(`${bot.username} — ${await sendClasses(ctx, bot, main)}`)
    }
    for (const kit of KITS) {
      if (!want(kit.setting)) continue
      const key = `pika:kit:${kit.setting}`
      keys.push(key)
      ctx.log(`${bot.username} — ${await claimKit(ctx, bot, account, kit.name, key, kit.delay)}`)
      await ctx.sleep(1_000)
    }
    // One delay to schedule the plugin by: when the next checked thing is back (an hour if one was refused for now).
    const waits = keys.map((key) => ctx.cooldowns.remaining(account, key))
    const next = waits.length === 0 ? 6 * HOUR : waits.some((ms) => ms === 0) ? HOUR : Math.min(...waits)
    ctx.cooldowns.set(account, SCHEDULE_KEY, next)
    ctx.log(`${bot.username} : prochain passage utile dans ${Math.round(next / 60_000)} min (${SCHEDULE_KEY}).`)
  })
  ctx.log(`Terminé : ${result.done.length} compte(s), ${result.failed.length} en échec, ${result.skipped.length} passé(s).`)
}
