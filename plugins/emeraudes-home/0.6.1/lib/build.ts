// Scaffolding to reach a high chest: the pathfinder towers and bridges with dirt only (never digs: a broken block of
// the base could not always be put back as it was, glass and stone do not drop themselves). Every block it places is
// written in a ledger at the moment it is placed, and the ledger is undone afterwards, top first, so the base is left
// as it was found. Pure helpers; the plugin wraps bot.placeBlock to feed the ledger.
import type { Point } from './chests.ts'

const key = (p: Point) => `${p.x},${p.y},${p.z}`

/** Where scaffolding was placed, in the order it was placed. Immutable: record() returns a new ledger. */
export interface Ledger {
  readonly placed: readonly Point[]
}

export const EMPTY_LEDGER: Ledger = { placed: [] }

/** The ledger with one more placed block (the same position twice counts once). */
export function record(ledger: Ledger, at: Point): Ledger {
  const p = { x: Math.floor(at.x), y: Math.floor(at.y), z: Math.floor(at.z) }
  if (ledger.placed.some((q) => key(q) === key(p))) return ledger
  return { placed: [...ledger.placed, p] }
}

/** The block a placement fills: the reference block's neighbour on the clicked face. */
export function placedAt(reference: Point, face: Point): Point {
  return { x: reference.x + face.x, y: reference.y + face.y, z: reference.z + face.z }
}

/**
 * The order to break the scaffolding back: highest first (a pillar is taken down from its top, the bot standing on
 * it), then the last placed first among blocks at the same height (a bridge is taken back toward where it started).
 */
export function cleanupOrder(ledger: Ledger): Point[] {
  const order = new Map(ledger.placed.map((p, i) => [key(p), i]))
  return [...ledger.placed].sort((a, b) => b.y - a.y || order.get(key(b))! - order.get(key(a))!)
}

/**
 * Cost the pathfinder adds to placing a block at `p` (100 or more forbids it): never right above a chest (it could no
 * longer be opened), never outside the faction's claim (not ours to build on).
 */
export function placeCost(p: Point, chestHalves: readonly Point[], ours: (cx: number, cz: number) => boolean): number {
  if (chestHalves.some((c) => c.x === p.x && c.z === p.z && c.y + 1 === p.y)) return 100
  if (!ours(Math.floor(p.x) >> 4, Math.floor(p.z) >> 4)) return 100
  return 0
}

/**
 * Dirt to carry for one chest: one block per level to climb, plus a short bridge and a margin for the pathfinder's
 * detours, at most `cap`. A chest at or below the bot needs none.
 */
export function scaffoldFor(from: Point, chest: Point, cap = 64): number {
  const climb = chest.y - Math.floor(from.y)
  if (climb <= 1) return 0
  return Math.min(cap, climb + 8)
}

/** The ledger's blocks that are still not air, from `blockAt` (name of the block there, null when not loaded). */
export function leftovers(ledger: Ledger, blockAt: (p: Point) => string | null): Point[] {
  return ledger.placed.filter((p) => blockAt(p) !== 'air')
}
