// Room in the player's inventory, and what to buy so that every bought item has a slot to land in: a shop that sells
// to a full inventory either drops the items on the ground or takes the money for nothing, so nothing is ever bought
// that the free room computed here cannot hold. Pure functions over an immutable picture of the 36 main slots.
import { affordable } from './money.ts'

/** One of the 36 main inventory slots (hotbar included, armour and crafting grid excluded); null when empty. */
export interface Slot {
  readonly type: string
  readonly metadata: number
  readonly count: number
  /** Largest stack of this item (64, 16 for ender pearls, 1 for tools). */
  readonly max: number
  /** A custom name, lore or other data: never stacked with a plain bought item. */
  readonly special: boolean
}

export type Inventory = readonly (Slot | null)[]

/** A plain item as a shop gives it. */
export interface Goods {
  readonly type: string
  readonly metadata?: number
  /** Stack size, 64 by default. */
  readonly max?: number
}

const sameKind = (slot: Slot, goods: Goods) => !slot.special && slot.type === goods.type && slot.metadata === (goods.metadata ?? 0)

/** How many of `goods` the inventory can still take. */
export function room(inventory: Inventory, goods: Goods): number {
  const max = goods.max ?? 64
  let free = 0
  for (const slot of inventory) {
    if (slot === null) free += max
    else if (sameKind(slot, goods)) free += Math.max(0, slot.max - slot.count)
  }
  return free
}

/** The inventory after `count` of `goods` came in, partial stacks first, as Minecraft fills it. Throws if it does not fit. */
export function add(inventory: Inventory, goods: Goods, count: number): Inventory {
  if (!Number.isInteger(count) || count < 0) throw new Error(`quantité invalide : ${count}`)
  const max = goods.max ?? 64
  const next = [...inventory]
  let left = count
  for (let i = 0; i < next.length && left > 0; i++) {
    const slot = next[i]
    if (slot && sameKind(slot, goods) && slot.count < slot.max) {
      const put = Math.min(left, slot.max - slot.count)
      next[i] = { ...slot, count: slot.count + put }
      left -= put
    }
  }
  for (let i = 0; i < next.length && left > 0; i++) {
    if (next[i] !== null) continue
    const put = Math.min(left, max)
    next[i] = { type: goods.type, metadata: goods.metadata ?? 0, count: put, max, special: false }
    left -= put
  }
  if (left > 0) throw new Error(`pas la place pour ${count} ${goods.type} (${left} de trop)`)
  return next
}

/** The inventory after `count` of `goods` left it (last stacks first). Throws if there are not that many. */
export function remove(inventory: Inventory, goods: Goods, count: number): Inventory {
  const next = [...inventory]
  let left = count
  for (let i = next.length - 1; i >= 0 && left > 0; i--) {
    const slot = next[i]
    if (!slot || !sameKind(slot, goods)) continue
    const take = Math.min(left, slot.count)
    next[i] = slot.count === take ? null : { ...slot, count: slot.count - take }
    left -= take
  }
  if (left > 0) throw new Error(`il manque ${left} ${goods.type}`)
  return next
}

export function countOf(inventory: Inventory, goods: Goods): number {
  return inventory.reduce((n, slot) => n + (slot && sameKind(slot, goods) ? slot.count : 0), 0)
}

/** Something the shop sells: what lands in the inventory for one purchase unit, and its price. */
export interface Offer {
  readonly goods: Goods
  /** Price of one item (the profile divides a stack price by its size). */
  readonly unitPrice: number
}

export interface PurchasePlan {
  /** Scaffolding blocks to buy first (already held ones count). */
  readonly scaffold: number
  /** Items of the target offer to buy. */
  readonly target: number
  /** Money spent by the whole plan. */
  readonly cost: number
}

/**
 * What to buy with `money`: first the scaffolding the trip needs (`scaffoldNeeded`, minus what the bot already holds),
 * then as many of `target` as both the money left and the room left allow. With `convert` (9 emeralds → 1 block), a
 * multiple of the ratio only (odd emeralds would stay emeralds), and only as many as still fit once converted.
 * Scaffolding that cannot be paid or held makes the plan buy nothing: a trip without it could not reach a high chest.
 */
export function planPurchase(inventory: Inventory, money: number, target: Offer, scaffoldNeeded: number, scaffold: Offer | null, convert?: Conversion): PurchasePlan {
  let inv = inventory
  let left = money
  let scaffoldBuy = 0
  if (scaffoldNeeded > 0) {
    if (!scaffold) return { scaffold: 0, target: 0, cost: 0 }
    scaffoldBuy = Math.max(0, scaffoldNeeded - countOf(inv, scaffold.goods))
    if (scaffoldBuy > 0) {
      if (affordable(left, scaffold.unitPrice) < scaffoldBuy || room(inv, scaffold.goods) < scaffoldBuy) return { scaffold: 0, target: 0, cost: 0 }
      inv = add(inv, scaffold.goods, scaffoldBuy)
      left -= scaffoldBuy * scaffold.unitPrice
    }
  }
  const ratio = convert?.ratio ?? 1
  let n = Math.min(affordable(left, target.unitPrice), room(inv, target.goods))
  n -= n % ratio
  while (convert && n > 0 && !fitsConverted(add(inv, target.goods, n), target.goods, convert)) n -= ratio
  return { scaffold: scaffoldBuy, target: n, cost: scaffoldBuy * (scaffold?.unitPrice ?? 0) + n * target.unitPrice }
}

/**
 * Turns `total` into purchases of the sizes the shop offers (e.g. 64, 32, 16, 8, 1), largest first. Whatever no size
 * can make exactly is left out (never rounded up): the sum of the result is at most `total`.
 */
export function splitPurchase(total: number, sizes: readonly number[]): number[] {
  const sorted = [...new Set(sizes)].filter((s) => Number.isInteger(s) && s > 0).sort((a, b) => b - a)
  const out: number[] = []
  let left = Math.max(0, Math.floor(total))
  for (const size of sorted) {
    while (left >= size) {
      out.push(size)
      left -= size
    }
  }
  return out
}

/** `ratio` items of a kind become one `to` (9 emeralds → 1 emerald block). */
export interface Conversion {
  readonly to: Goods
  readonly ratio: number
}

/**
 * The inventory after `ratio` of `from` became one `to` as many times as possible (Essentials /condense, a crafting
 * table). Throws when the result does not fit, as a full inventory would make the server drop it.
 */
export function condense(inventory: Inventory, from: Goods, convert: Conversion): { inventory: Inventory; made: number } {
  const made = Math.floor(countOf(inventory, from) / convert.ratio)
  if (made === 0) return { inventory, made }
  return { inventory: add(remove(inventory, from, made * convert.ratio), convert.to, made), made }
}

function fitsConverted(inventory: Inventory, from: Goods, convert: Conversion): boolean {
  try {
    condense(inventory, from, convert)
    return true
  } catch {
    return false
  }
}
