// The faction plugin and the shop of the BloodSymphony network (play.bloodsymphony.com, play.sunaria.fr), read from
// chat lines and item lore without colours, as surveyed live on 2026-10-27:
//   /f show  « --------------------< Emperer >---------------------- », « ----------------< Aucune faction >--------- »
//   /f map   « --------------< (-297,-156) Emperer >---------------- » then a grid of « ▉ » that only colours tell
//            apart: the title is the one thing read, and it names the owner of the chunk the bot stands in only.
//   /shop    lore « Acheter » $4,500 (Clic-gauche) » / « Vendre » $1,800 (Clic-droit) » (a right click sells).
import { parseAmount } from './money.ts'

const plain = (line: string) => line.replace(/§./g, '').trim()
/** A whole line « ---< text >--- »: a player's chat line has its rank and name first. */
const TITLE = /^-{3,}<\s*(.+?)\s*>-{3,}$/
const MAP_TITLE = /^\((-?\d+),\s*(-?\d+)\)\s+(.+)$/
const NO_FACTION = /^(aucune faction|sans faction|wilderness|zone libre)$/i

/** The faction of /f show's title; null without one, and when the answer holds two different titles. */
export function factionFromTitle(lines: readonly string[]): string | null {
  const names = new Set<string>()
  for (const line of lines) {
    const title = TITLE.exec(plain(line))?.[1]
    if (title && !MAP_TITLE.test(title)) names.add(title)
  }
  if (names.size !== 1) return null
  const name = [...names][0]!
  return NO_FACTION.test(name) ? null : name
}

export interface ChunkOwner {
  readonly cx: number
  readonly cz: number
  /** As the title writes it: a faction, or the server's name for land nobody holds (« BloodSymphony »). */
  readonly owner: string
}

/** The chunk and its owner from /f map's title; null without one, and when the answer holds two different ones. */
export function chunkFromMap(lines: readonly string[]): ChunkOwner | null {
  const found = new Map<string, ChunkOwner>()
  for (const line of lines) {
    const title = TITLE.exec(plain(line))?.[1]
    const match = title ? MAP_TITLE.exec(title) : null
    if (match) found.set(title!, { cx: Number(match[1]), cz: Number(match[2]), owner: match[3]!.trim() })
  }
  return found.size === 1 ? [...found.values()][0]! : null
}

/**
 * The chunks whose owner the bot has read, standing in them. Every other chunk is unknown, never ours. Immutable:
 * `withChunk` returns a new book.
 */
export interface ClaimBook {
  readonly owners: ReadonlyMap<string, string>
}

export const EMPTY_BOOK: ClaimBook = { owners: new Map() }
const chunkKey = (cx: number, cz: number) => `${cx},${cz}`

export function withChunk(book: ClaimBook, chunk: ChunkOwner): ClaimBook {
  return { owners: new Map(book.owners).set(chunkKey(chunk.cx, chunk.cz), chunk.owner) }
}

export function ownerIn(book: ClaimBook, cx: number, cz: number): string {
  return book.owners.get(chunkKey(cx, cz)) ?? 'unknown'
}

/** The price the confirmation menu (« Acheter Emerald Block ») shows on its item: « Acheter » $4,500 ». */
export function confirmPrice(lore: readonly string[]): number | null {
  for (const line of lore) {
    const match = /^acheter\s*»\s*([^()]+)$/i.exec(plain(line))
    const price = match ? parseAmount(match[1]!) : null
    if (price !== null && price > 0) return price
  }
  return null
}

/** A bulk button of « Acheter en grande quantité »: « Acheter 3 stacks » with lore « Prix : $864,000 ». */
export function stackButton(name: string, lore: readonly string[]): { stacks: number; price: number } | null {
  const stacks = /^acheter (\d) stacks?$/i.exec(plain(name))
  if (!stacks) return null
  for (const line of lore) {
    const match = /^prix\s*:\s*(.+)$/i.exec(plain(line))
    const price = match ? parseAmount(match[1]!) : null
    if (price !== null && price > 0) return { stacks: Number(stacks[1]), price }
  }
  return null
}

/**
 * What one left click buys, from a shop item's lore: the price of the stack shown (the item's count). Null when the
 * lore has no left-click buy line (an item only sold, a category, a decoration).
 */
export function leftClickPrice(lore: readonly string[]): number | null {
  for (const line of lore) {
    const match = /^acheter\s*»\s*(.+?)\s*\(clic[- ]gauche\)$/i.exec(plain(line))
    if (!match) continue
    const price = parseAmount(match[1]!)
    return price !== null && price > 0 ? price : null
  }
  return null
}
