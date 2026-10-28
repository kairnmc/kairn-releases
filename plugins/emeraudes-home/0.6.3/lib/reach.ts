// A mineflayer-pathfinder goal (heuristic / isEnd / hasChanged / isValid, the shape its goto() takes): stand where the
// chest is within reach of the eyes. Plugins get bot.pathfinder but not its goal classes, hence this small one.
import type { Point } from './chests.ts'

/** Eye height of a standing player. */
const EYES = 1.62
/** The 1.8 server accepts a click up to 8 blocks from the block centre (squared distance 64); survival reach is 4.5. */
export const REACH = 4.2

export interface ReachGoal {
  heuristic(node: Point): number
  isEnd(node: Point): boolean
  hasChanged(): boolean
  isValid(): boolean
}

/** Distance from the eyes of a player standing at `feet` (a block position) to the centre of `block`. */
export function eyeDistance(feet: Point, block: Point): number {
  return Math.hypot(feet.x + 0.5 - (block.x + 0.5), feet.y + EYES - (block.y + 0.5), feet.z + 0.5 - (block.z + 0.5))
}

/**
 * Stand anywhere inside chunk (cx, cz): the faction plugin of the BloodSymphony network names only the chunk the bot
 * stands in. The heuristic is the straight distance to the chunk's nearest column, never more than the real path.
 */
export function chunkGoal(cx: number, cz: number): ReachGoal {
  const gap = (v: number, c: number) => Math.max(0, c * 16 - v, v - (c * 16 + 15))
  return {
    heuristic: (n) => Math.hypot(gap(Math.floor(n.x), cx), gap(Math.floor(n.z), cz)),
    isEnd: (n) => Math.floor(n.x) >> 4 === cx && Math.floor(n.z) >> 4 === cz,
    hasChanged: () => false,
    isValid: () => true,
  }
}

/**
 * Stand where a click on the chest is accepted (withinReach) and, when `seen` is given, where the eyes see it directly:
 * the BloodSymphony network refuses a click on a block the player cannot see (« Tu ne peux pas interagir avec ce bloc
 * sans le voir directement. »), which a vanilla server never checks.
 */
export function reachGoal(chest: Point, seen?: (feet: Point) => boolean): ReachGoal {
  return {
    heuristic: (n) => Math.hypot(n.x - chest.x, n.z - chest.z) + Math.abs(n.y - chest.y),
    isEnd: (n) => withinReach(eyesAt(n, true), chest) && (seen?.(n) ?? true),
    hasChanged: () => false,
    isValid: () => true,
  }
}

/**
 * The click distance as the server measures it: eyes to the block's corner (x, y, z), not its centre (CraftBukkit 1.8,
 * SURVIVAL_PLACE_DISTANCE_SQUARED = 36). Measured live on play.bloodsymphony.com, 2026-10-29: opened up to 5.78,
 * refused without a word from 6.39. 5.8 keeps to what was seen accepted.
 */
export const CLICK_REACH = 5.8

/**
 * Whether the server takes a click on the chest from these eyes, distance and height: within CLICK_REACH of its corner,
 * the eyes not under the chest (measured: every click with the eyes below the chest's bottom was refused, every one
 * accepted had them above its middle; the middle is the line kept).
 */
export function withinReach(eyes: Point, chest: Point): boolean {
  return Math.hypot(eyes.x - chest.x, eyes.y - chest.y, eyes.z - chest.z) <= CLICK_REACH && eyes.y >= chest.y + 0.5
}

/** The game's block faces (raycast and the block placement packet): 0 down, 1 up, 2 north, 3 south, 4 west, 5 east. */
const FACES: readonly Point[] = [
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: -1 },
  { x: 0, y: 0, z: 1 },
  { x: -1, y: 0, z: 0 },
  { x: 1, y: 0, z: 0 },
]

/** The outward normal of a face number; null for anything else. */
export function faceVector(face: number): Point | null {
  return FACES[face] ?? null
}

/** Where the eyes are for feet at `feet` (an entity position, or a pathfinder node: a block, its centre then). */
export function eyesAt(feet: Point, node = false): Point {
  return node ? { x: feet.x + 0.5, y: feet.y + EYES, z: feet.z + 0.5 } : { x: feet.x, y: feet.y + EYES, z: feet.z }
}

/** The point the bot looks at on a chest: the block's centre, as mineflayer's activateBlock looks at it (inside the box). */
export const chestAim = (chest: Point): Point => ({ x: chest.x + 0.5, y: chest.y + 0.5, z: chest.z + 0.5 })

/** The block name at a position, null when it is not loaded (counts as blocking). */
export type BlockNameAt = (x: number, y: number, z: number) => string | null

/** Blocks that never stand in the way of the eyes (every other one does, with a collision box or not). */
const SEE_THROUGH = new Set(['air'])

/**
 * The face and the point on it a click sends when the eyes see the chest directly, as a vanilla client builds them from
 * its look; null when something stands in between. The server's « voir directement » goes cell by cell: measured live
 * (play.bloodsymphony.com, 2026-10-29), a line through a tuft of tall grass or through the other half of a double
 * chest was refused, where mineflayer's raycast (collision boxes) saw nothing. So every cell the line crosses before
 * the chest must be air.
 */
export function sightOf(eyes: Point, chest: Point, blockAt: BlockNameAt): { face: Point; cursor: Point } | null {
  const aim = chestAim(chest)
  const d = { x: aim.x - eyes.x, y: aim.y - eyes.y, z: aim.z - eyes.z }
  if (d.x === 0 && d.y === 0 && d.z === 0) return null
  // Voxel traversal (Amanatides & Woo): the cells the segment eyes → aim crosses, in order.
  const cell = { x: Math.floor(eyes.x), y: Math.floor(eyes.y), z: Math.floor(eyes.z) }
  const step = { x: Math.sign(d.x), y: Math.sign(d.y), z: Math.sign(d.z) }
  const tDelta = { x: Math.abs(1 / d.x), y: Math.abs(1 / d.y), z: Math.abs(1 / d.z) }
  const boundary = (v: number, c: number, s: number) => (s > 0 ? c + 1 - v : v - c)
  const tMax = { x: d.x === 0 ? Infinity : boundary(eyes.x, cell.x, step.x) * tDelta.x, y: d.y === 0 ? Infinity : boundary(eyes.y, cell.y, step.y) * tDelta.y, z: d.z === 0 ? Infinity : boundary(eyes.z, cell.z, step.z) * tDelta.z }
  for (let guard = 0; guard < 64; guard++) {
    if (cell.x === chest.x && cell.y === chest.y && cell.z === chest.z) return null // the eyes inside the chest
    const name = blockAt(cell.x, cell.y, cell.z)
    if (name === null || !SEE_THROUGH.has(name)) return null
    // The next cell, across the nearest boundary; t is where on the segment (0 eyes, 1 aim).
    let axis: 'x' | 'y' | 'z' = 'x'
    if (tMax.y < tMax[axis]) axis = 'y'
    if (tMax.z < tMax[axis]) axis = 'z'
    const t = tMax[axis]
    if (t > 1) return null
    cell[axis] += step[axis]
    tMax[axis] += tDelta[axis]
    if (cell.x === chest.x && cell.y === chest.y && cell.z === chest.z) {
      const face = { x: 0, y: 0, z: 0 }
      face[axis] = -step[axis]
      const at = { x: eyes.x + d.x * t, y: eyes.y + d.y * t, z: eyes.z + d.z * t }
      const clamp = (v: number) => Math.min(1, Math.max(0, v))
      return { face, cursor: { x: clamp(at.x - chest.x), y: clamp(at.y - chest.y), z: clamp(at.z - chest.z) } }
    }
  }
  return null
}
