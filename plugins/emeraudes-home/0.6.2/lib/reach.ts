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
 * Stand where the chest is within reach of the eyes and, when `seen` is given, where the eyes see it directly: the
 * BloodSymphony network refuses a click on a block the player cannot see (« Tu ne peux pas interagir avec ce bloc sans
 * le voir directement. »), which a vanilla server never checks.
 */
export function reachGoal(chest: Point, reach = REACH, seen?: (feet: Point) => boolean): ReachGoal {
  return {
    heuristic: (n) => Math.hypot(n.x - chest.x, n.z - chest.z) + Math.abs(n.y - chest.y),
    isEnd: (n) => eyeDistance(n, chest) <= reach && (seen?.(n) ?? true),
    hasChanged: () => false,
    isValid: () => true,
  }
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

/** What a ray from the eyes hits first: its block, the face it enters by and where. Null when nothing within range. */
export type RayHit = { readonly position: Point; readonly face: number; readonly intersect: Point } | null

/**
 * The face and the point on it a click sends when the eyes see the chest directly (the first block on the ray from the
 * eyes to the chest is the chest), as a vanilla client builds them from its own look; null when something stands in
 * between. `ray(from, direction, range)` is the world's raycast.
 */
export function sightOf(eyes: Point, chest: Point, ray: (from: Point, direction: Point, range: number) => RayHit): { face: Point; cursor: Point } | null {
  const aim = chestAim(chest)
  const d = { x: aim.x - eyes.x, y: aim.y - eyes.y, z: aim.z - eyes.z }
  const length = Math.hypot(d.x, d.y, d.z)
  if (length === 0) return null
  const hit = ray(eyes, { x: d.x / length, y: d.y / length, z: d.z / length }, length + 1)
  if (!hit || hit.position.x !== chest.x || hit.position.y !== chest.y || hit.position.z !== chest.z) return null
  const face = faceVector(hit.face)
  if (!face) return null
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  return { face, cursor: { x: clamp(hit.intersect.x - chest.x), y: clamp(hit.intersect.y - chest.y), z: clamp(hit.intersect.z - chest.z) } }
}
