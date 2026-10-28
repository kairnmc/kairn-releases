// How many trips (buy what the inventory holds, then store it) an account makes. 0 means no limit: the account stops
// on its own when the money, the budget or the chests run out, or when a trip does nothing at all.

/** The setting « voyages » as a number of trips: a positive integer, or Infinity for 0 (and anything not a number). */
export function tripLimit(setting: unknown): number {
  const n = Math.floor(Number(setting ?? 0))
  return Number.isFinite(n) && n >= 1 ? n : Infinity
}

/**
 * A trip that bought nothing and stored nothing: the next one would do the same (inventory full and every chest
 * refusing, a server not answering clicks), so the account stops instead of looping without a limit.
 */
export function idleTrip(bought: number, deposited: number): boolean {
  return bought === 0 && deposited === 0
}
