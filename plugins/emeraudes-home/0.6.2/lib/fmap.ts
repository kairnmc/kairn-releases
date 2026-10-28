// The ASCII map of Factions (/f map, FactionsUUID and its forks) read from chat lines without colours:
//   ______.[ (12,-5) Wilderness ]._______
//   \N/-------------------/////----
//   W+E---------------+---/////----
//   /S\-------------------------###
//   ...
//   /: Kairnistes  #: Voisins
// Rows go north to south (z), columns west to east (x), the bot's chunk is the « + » in the middle. The compass
// drawn over the first three columns of the first three rows hides those chunks: they read as unknown, never as
// claimed. A chunk is « ours » only when its letter's legend names our faction exactly.

export interface FactionMap {
  /** Grid rows, north first; each cell is one chunk's letter. */
  readonly rows: readonly string[]
  /** Letter → faction name, from the legend. */
  readonly legend: ReadonlyMap<string, string>
  /** Where the bot's own chunk (« + ») is in the grid. */
  readonly center: { readonly row: number; readonly col: number }
}

const GRID = /^[-+\\/#$%&=?!@*~^<>0-9A-Za-z]{15,}$/
/** « /: Name », « #: Other Name », possibly several on one line. */
const LEGEND = /(?:^|\s)(\S): ([^:]+?)(?=\s+\S: |$)/g
/** A legend line is made of entries only, from its first character: a player's chat line has its name first. */
const LEGEND_LINE = /^\S: [^:]+?(?:\s+\S: [^:]+?)*$/
const COMPASS_ROWS = 3
const COMPASS_COLS = 3

/** Reads a /f map answer; null when the lines hold no map (another plugin, an error message). */
export function parseFactionMap(lines: readonly string[]): FactionMap | null {
  const trimmed = lines.map((line) => line.replace(/§./g, '').trim())
  const start = trimmed.findIndex((line) => GRID.test(line))
  if (start < 0) return null
  const rows: string[] = []
  for (let i = start; i < trimmed.length && GRID.test(trimmed[i]!) && trimmed[i]!.length === trimmed[start]!.length; i++) rows.push(trimmed[i]!)
  // The « + » of the compass (« W+E ») is not the bot: look for the one outside the compass corner.
  let center: { row: number; col: number } | null = null
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) if (row[c] === '+' && !(r < COMPASS_ROWS && c < COMPASS_COLS)) center ??= { row: r, col: c }
  })
  if (!center) return null
  // The legend is the lines right under the grid, up to the first line that is not one: anything later in the chat
  // (a player typing « #: OurFaction ») is not read. A letter given twice makes the whole map untrusted.
  const legend = new Map<string, string>()
  for (const line of trimmed.slice(start + rows.length)) {
    if (!LEGEND_LINE.test(line)) break
    for (const match of line.matchAll(LEGEND)) {
      if (legend.has(match[1]!)) return null
      legend.set(match[1]!, match[2]!.trim())
    }
  }
  return { rows, legend, center }
}

/**
 * The faction that holds chunk (cx, cz) as the map shows it, seen from the bot's chunk (botCx, botCz): a name,
 * 'wilderness', or null (outside the map, under the compass, the bot's own cell, a letter without legend).
 */
export function ownerOf(map: FactionMap, botCx: number, botCz: number, cx: number, cz: number): string | null {
  const row = map.center.row + (cz - botCz)
  const col = map.center.col + (cx - botCx)
  if (row < 0 || row >= map.rows.length || col < 0 || col >= map.rows[row]!.length) return null
  if (row < COMPASS_ROWS && col < COMPASS_COLS) return null
  const cell = map.rows[row]![col]!
  if (cell === '-') return 'wilderness'
  if (cell === '+') return null
  return map.legend.get(cell) ?? null
}

/**
 * The bot's own chunk owner, from the map's title « ___.[ (12,-5) Name ].___ » (the « + » cell hides it): only the
 * line right above the grid, and only when the whole line is that title.
 */
export function hereFromTitle(lines: readonly string[]): string | null {
  const trimmed = lines.map((line) => line.replace(/§./g, '').trim())
  const start = trimmed.findIndex((line) => GRID.test(line))
  if (start < 1) return null
  const match = /^_*\.?\[\s*\(-?\d+,\s*-?\d+\)\s*(.+?)\s*\]\.?_*$/.exec(trimmed[start - 1]!)
  return match ? match[1]! : null
}
