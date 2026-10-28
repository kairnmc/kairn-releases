// The BloodSymphony network's /shop (« » Échoppe de BloodSymphony »): a category, then one item per ware; a left click
// opens « Acheter <item> » (the item and its price, « Confirmer », « Annuler », « Acheter en grande quantité »), and
// « Confirmer » buys one (a right click on the category's item sells it back: never sent). Every purchase is checked
// on the inventory.
import type { Bot, ScriptContext, Window } from '../../kairn'
import { confirmPrice, leftClickPrice, stackButton } from './blood.ts'
import type { Shop, Ware } from './profiles.ts'
import type { Offer } from './space.ts'

const SHOP = '/shop'
/** Where each ware is, as surveyed: Minerais › Block of Emerald (#15) and Emerald (#6), Blocs › Dirt (#1). */
const CATEGORY: Record<Ware, string> = { emerald_block: 'Minerais', emerald: 'Minerais', dirt: 'Blocs' }

/** « Acheter en grande quantité » offers 1 to 9 stacks of 64 (surveyed: « Acheter 1 stack » $288,000 … 9 stacks). */
const STACK = 64
const MAX_STACKS = 9

interface Listing {
  readonly slot: number
  readonly price: number
}

/** The open menu as the log shows it: title and items with their lore, for a purchase that did not go as surveyed. */
function describeMenu(ctx: ScriptContext, window: Window | null): string {
  if (!window) return 'fermé'
  const top: number = window.inventoryStart ?? window.slots.length - 36
  const items = window.slots
    .slice(0, top)
    .map((item: any, slot: number) => (item && !/stained_glass_pane/.test(item.name) ? `#${slot} ${item.name}×${item.count} « ${ctx.items.name(item)} » [${ctx.items.lore(item).join(' / ')}]` : null))
    .filter(Boolean)
  return `« ${ctx.menus.title(window)} » ${items.slice(0, 20).join(' | ')}`
}

export function echoppe(): Shop {
  let open: { window: Window; category: string } | null = null

  const menu = async (ctx: ScriptContext, bot: Bot, category: string): Promise<Window> => {
    if (open && open.category === category && bot.currentWindow === open.window) {
      // It may have just come back from a confirmation: the same pause as after an opening.
      await ctx.sleep(600)
      return open.window
    }
    if (bot.currentWindow) bot.closeWindow(bot.currentWindow)
    const main = await ctx.menus.open(bot, { command: SHOP }, { title: 'Échoppe' })
    // The server ignores a click sent the moment its menu opens.
    await ctx.sleep(600)
    await ctx.menus.click(bot, main, category)
    const window = await ctx.menus.waitFor(bot, { title: category, timeoutMs: 5_000 })
    // Same in the category: a purchase clicked right as it opened was ignored live (no money taken, no message).
    await ctx.sleep(600)
    open = { window, category }
    return window
  }

  /** The ware's item in its category: its exact type, no variant, a left-click price, one item a click. */
  const listing = (ctx: ScriptContext, window: Window, ware: Ware): Listing | null => {
    const top: number = window.inventoryStart ?? window.slots.length - 36
    for (let slot = 0; slot < top; slot++) {
      const item = window.slots[slot]
      if (!item || item.name !== ware || (item.metadata ?? 0) !== 0) continue
      const price = leftClickPrice(ctx.items.lore(item))
      if (price === null) continue
      if (item.count !== 1) throw new Error(`shop : ${ware} vendu par ${item.count}, pas à l’unité (cas pas relevé).`)
      return { slot, price }
    }
    return null
  }

  /**
   * The confirmation menu as surveyed: the ware itself with its price (« Acheter » $4,500 ») and a « Confirmer »
   * button. Throws (nothing paid) when either is missing or the shown item is another one.
   */
  const confirmed = (ctx: ScriptContext, window: Window, ware: Ware): { price: number | null; confirm: number; bulk: number } => {
    const top: number = window.inventoryStart ?? window.slots.length - 36
    let price: number | null = null
    let confirm = -1
    let bulk = -1
    for (let slot = 0; slot < top; slot++) {
      const item = window.slots[slot]
      if (!item) continue
      const name = ctx.items.name(item).trim()
      if (/^confirmer$/i.test(name)) confirm = slot
      else if (/^acheter en grande quantit[ée]$/i.test(name)) bulk = slot
      else if (item.name === ware && (item.metadata ?? 0) === 0 && item.count === 1) price ??= confirmPrice(ctx.items.lore(item))
    }
    // The menu is closed by the purchase round's close(), whatever is thrown.
    if (confirm < 0 || price === null) throw new Error(`shop : confirmation pas reconnue (${describeMenu(ctx, window)}), rien acheté.`)
    return { price, confirm, bulk }
  }

  /** « Acheter N stacks » of the bulk menu: the ware itself, shown N times, with its « Prix : » line. */
  const stacksButton = (ctx: ScriptContext, window: Window, ware: Ware, stacks: number): { slot: number; price: number } | null => {
    const top: number = window.inventoryStart ?? window.slots.length - 36
    for (let slot = 0; slot < top; slot++) {
      const item = window.slots[slot]
      if (!item || item.name !== ware || (item.metadata ?? 0) !== 0) continue
      const button = stackButton(ctx.items.name(item), ctx.items.lore(item))
      if (button && button.stacks === stacks && item.count === stacks) return { slot, price: button.price }
    }
    return null
  }

  const held = (bot: Bot, ware: Ware) => bot.inventory.items().filter((item: any) => item.name === ware && (item.metadata ?? 0) === 0).reduce((n: number, item: any) => n + item.count, 0)

  return {
    sizes: [1, ...Array.from({ length: MAX_STACKS }, (_, i) => (i + 1) * STACK)],
    async offer(ctx, bot, ware): Promise<Offer | null> {
      const found = listing(ctx, await menu(ctx, bot, CATEGORY[ware]), ware)
      return found ? { goods: { type: ware, max: 64 }, unitPrice: found.price } : null
    },
    async buy(ctx, bot, ware, size): Promise<number> {
      const stacks = size / STACK
      if (size !== 1 && !(Number.isInteger(stacks) && stacks >= 1 && stacks <= MAX_STACKS)) throw new Error(`shop : achat par ${size} impossible (1, ou 1 à ${MAX_STACKS} stacks de ${STACK}).`)
      const window = await menu(ctx, bot, CATEGORY[ware])
      const found = listing(ctx, window, ware)
      if (!found) throw new Error(`shop : ${ware} n’est plus dans « ${CATEGORY[ware]} ».`)
      // The item opens a confirmation menu; nothing is paid before « Confirmer ».
      await bot.clickWindow(found.slot, 0, 0)
      open = null
      const confirm = await ctx.menus.waitFor(bot, { title: 'Acheter', timeoutMs: 5_000 }).catch(() => null)
      if (!confirm || confirm === window) throw new Error(`shop : pas de menu de confirmation après ${ware} (${describeMenu(ctx, bot.currentWindow)}).`)
      const shown = confirmed(ctx, confirm, ware)
      if (shown.price !== found.price) {
        bot.closeWindow(confirm)
        throw new Error(`shop : la confirmation montre ${shown.price ?? '?'} $ au lieu de ${found.price} $ pour ${ware}, rien acheté.`)
      }
      await ctx.sleep(600)
      // One item: « Confirmer ». Stacks: « Acheter en grande quantité », then « Acheter N stacks » at N × 64 × the price.
      let click = shown.confirm
      if (size > 1) {
        if (shown.bulk < 0) throw new Error(`shop : pas d’achat en grande quantité pour ${ware}, rien acheté.`)
        await bot.clickWindow(shown.bulk, 0, 0)
        let bulk: Window | null = null
        for (let waited = 0; waited < 5_000 && !bulk; waited += 100) {
          await ctx.sleep(100)
          if (bot.currentWindow && bot.currentWindow !== confirm) bulk = bot.currentWindow
        }
        if (!bulk) throw new Error(`shop : le menu d’achat en grande quantité ne s’ouvre pas (${describeMenu(ctx, bot.currentWindow)}), rien acheté.`)
        const button = stacksButton(ctx, bulk, ware, stacks)
        if (!button) throw new Error(`shop : pas de bouton « Acheter ${stacks} stacks » (${describeMenu(ctx, bulk)}), rien acheté.`)
        if (button.price !== found.price * size) throw new Error(`shop : ${stacks} stack(s) à ${button.price} $ au lieu de ${found.price * size} $, rien acheté.`)
        await ctx.sleep(600)
        click = button.slot
      }
      const before = held(bot, ware)
      const said: string[] = []
      const onChat = (line: string) => said.push(line.trim())
      bot.on('messagestr', onChat)
      try {
        await bot.clickWindow(click, 0, 0)
        for (let waited = 0; waited < 3_000 && held(bot, ware) - before < size; waited += 100) await ctx.sleep(100)
        // A late extra item would show here: a short wait more before the count is final.
        await ctx.sleep(150)
      } finally {
        bot.removeListener('messagestr', onChat)
      }
      const got = held(bot, ware) - before
      // Back in the category after the purchase: the next one starts there, else from /shop.
      const now = bot.currentWindow
      if (now && ctx.menus.title(now) === CATEGORY[ware]) open = { window: now, category: CATEGORY[ware] }
      if (got !== size) ctx.warn(`shop : ${got} reçu(s) au lieu de ${size}. Menu : ${describeMenu(ctx, bot.currentWindow)} ; serveur : ${said.slice(0, 5).join(' | ') || '(rien)'}`)
      return got
    },
    close(bot) {
      if (bot.currentWindow) bot.closeWindow(bot.currentWindow)
      open = null
    },
  }
}
