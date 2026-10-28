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

export function reachGoal(chest: Point, reach = REACH): ReachGoal {
  return {
    heuristic: (n) => Math.hypot(n.x - chest.x, n.z - chest.z) + Math.abs(n.y - chest.y),
    isEnd: (n) => eyeDistance(n, chest) <= reach,
    hasChanged: () => false,
    isValid: () => true,
  }
}
