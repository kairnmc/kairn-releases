// Which chests around the home may receive the blocks, and in which order. Only a chest (or trapped chest) standing
// in a chunk the faction map gives to the bot's own faction; never an ender chest (it is the bot's own, not the
// base's), never a chest outside the map or in an unknown chunk. The two halves of a double chest are one container.

export interface Point {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface ChestBlock {
  readonly position: Point
  readonly name: string
  /** A full block above it: Minecraft refuses to open the chest. */
  readonly blockedAbove: boolean
}

export interface ChestTarget {
  /** The half the bot opens. */
  readonly position: Point
  /** Both halves for a double chest. */
  readonly halves: readonly Point[]
  readonly double: boolean
}

export interface ChestChoice {
  readonly usable: readonly ChestTarget[]
  /** Chests left out, with why (for the log). */
  readonly refused: readonly { readonly position: Point; readonly why: string }[]
}

const STORAGE = new Set(['chest', 'trapped_chest'])
const key = (p: Point) => `${p.x},${p.y},${p.z}`
const chunkOf = (p: Point) => ({ cx: Math.floor(p.x) >> 4, cz: Math.floor(p.z) >> 4 })

/**
 * The chests the bot may fill, nearest in height first (each block of climbing costs scaffolding), then nearest.
 * `owner(cx, cz)` says who holds a chunk; `faction` is the bot's own faction name, compared exactly.
 */
export function chooseChests(blocks: readonly ChestBlock[], from: Point, faction: string, owner: (cx: number, cz: number) => string): ChestChoice {
  const refused: { position: Point; why: string }[] = []
  const byKey = new Map(blocks.filter((b) => STORAGE.has(b.name)).map((b) => [key(b.position), b]))
  for (const block of blocks) if (!STORAGE.has(block.name)) refused.push({ position: block.position, why: `${block.name} : pas un coffre de la base` })
  const seen = new Set<string>()
  const usable: ChestTarget[] = []
  for (const block of byKey.values()) {
    if (seen.has(key(block.position))) continue
    seen.add(key(block.position))
    const p = block.position
    // A double chest: a same-type chest right next to it, on x or z.
    const partner = [
      { x: p.x + 1, y: p.y, z: p.z },
      { x: p.x - 1, y: p.y, z: p.z },
      { x: p.x, y: p.y, z: p.z + 1 },
      { x: p.x, y: p.y, z: p.z - 1 },
    ]
      .map((q) => byKey.get(key(q)))
      .find((q) => q !== undefined && q.name === block.name && !seen.has(key(q.position)))
    if (partner) seen.add(key(partner.position))
    const halves = partner ? [block, partner] : [block]
    if (!faction) {
      refused.push({ position: p, why: 'faction du compte inconnue' })
      continue
    }
    const owners = halves.map((h) => owner(chunkOf(h.position).cx, chunkOf(h.position).cz))
    const foreign = owners.find((o) => o !== faction)
    if (foreign !== undefined) {
      refused.push({ position: p, why: `hors du claim de ${faction} (${foreign})` })
      continue
    }
    const open = halves.find((h) => !h.blockedAbove)
    if (!open) {
      refused.push({ position: p, why: 'un bloc plein au-dessus empêche de l’ouvrir' })
      continue
    }
    usable.push({ position: open.position, halves: halves.map((h) => h.position), double: halves.length === 2 })
  }
  const dy = (t: ChestTarget) => Math.max(0, t.position.y - Math.floor(from.y))
  const dist = (t: ChestTarget) => Math.hypot(t.position.x + 0.5 - from.x, t.position.y + 0.5 - from.y, t.position.z + 0.5 - from.z)
  usable.sort((a, b) => dy(a) - dy(b) || dist(a) - dist(b) || key(a.position).localeCompare(key(b.position)))
  return { usable, refused }
}
