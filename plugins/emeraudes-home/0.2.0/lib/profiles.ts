// What differs from one server to the other: how money is read, how the shop sells, how emeralds become blocks, and
// the faction commands. Everything else (room, chests, scaffolding, the loop) is common.
import type { Bot, ScriptContext } from '../../kairn'
import { echoppe } from './echoppe.ts'
import type { Offer } from './space.ts'

export type Ware = 'emerald' | 'emerald_block' | 'dirt'

export interface Shop {
  /** What one item of `ware` costs and how it lands in the inventory; null when the shop does not sell it. */
  offer(ctx: ScriptContext, bot: Bot, ware: Ware): Promise<Offer | null>
  /** Quantities one purchase can take (e.g. 1, 8, 16, 32, 64). */
  readonly sizes: readonly number[]
  /** Buys exactly `size` of `ware` (one of `sizes`). Returns how many arrived in the inventory. */
  buy(ctx: ScriptContext, bot: Bot, ware: Ware, size: number): Promise<number>
  /** Closes the shop's menu left open between purchases. */
  close?(bot: Bot): void
}

export interface ServerProfile {
  readonly id: string
  readonly label: string
  /** Lower-case words that show this server in the tab list, the scoreboard or the first chat lines. */
  readonly marks: readonly string[]
  readonly money: { readonly command: string; readonly label?: RegExp }
  /**
   * How the faction plugin answers: « factionsuuid » (lettered map and legend, lib/fmap.ts) or « blood » (the
   * BloodSymphony network's plugin: /f map's title gives the owner of the bot's own chunk only, lib/blood.ts).
   */
  readonly faction: { readonly show: string; readonly map: string; readonly format: 'factionsuuid' | 'blood' }
  /** How 9 emeralds become a block: a command (Essentials /condense), or the shop sells blocks directly. */
  readonly convert: { readonly kind: 'command'; readonly command: string } | { readonly kind: 'shop' }
  /** A new shop session per account (it keeps its menu open between purchases); null until the shop is surveyed. */
  readonly shop: (() => Shop) | null
}

export const PROFILES: readonly ServerProfile[] = [
  {
    id: 'sunaria',
    label: 'Sunaria',
    marks: ['sunaria'],
    money: { command: '/money', label: /solde/i },
    faction: { show: '/f show', map: '/f map', format: 'blood' },
    // No /condense for the ranks surveyed (« Vous n'avez pas accès à cette commande. »); a block costs 9 emeralds.
    convert: { kind: 'shop' },
    shop: echoppe,
  },
  {
    id: 'bloodsymphony',
    label: 'BloodSymphony',
    marks: ['bloodsymphony', 'blood symphony'],
    money: { command: '/money', label: /solde/i },
    faction: { show: '/f show', map: '/f map', format: 'blood' },
    // No /condense for the ranks surveyed (« Vous n'avez pas accès à cette commande. »); a block costs 9 emeralds.
    convert: { kind: 'shop' },
    shop: echoppe,
  },
]

/** The profile named in the settings, else the one whose mark the server shows. */
export function pickProfile(setting: string, shown: string): ServerProfile | null {
  const named = PROFILES.find((p) => p.id === setting.toLowerCase() || p.label.toLowerCase() === setting.toLowerCase())
  if (named) return named
  const text = shown.toLowerCase()
  return PROFILES.find((p) => p.marks.some((m) => text.includes(m))) ?? null
}

/**
 * The bot's faction from FactionsUUID's /f show: its title line « ____.[ Name ].____ » (the whole line: a player's
 * chat line has its rank and name first). Null for none (Wilderness, « not in a faction »), and when the answer holds
 * two different titles (one of them is not the server's).
 */
export function factionFromShow(lines: readonly string[]): string | null {
  const names = new Set<string>()
  for (const raw of lines) {
    const match = /^_{3,}\.\[\s*([^[\]]+?)\s*\]\._{3,}$/.exec(raw.replace(/§./g, '').trim())
    if (match) names.add(match[1]!)
  }
  if (names.size !== 1) return null
  const name = [...names][0]!
  return /^(wilderness|nature|zone libre|sans faction)$/i.test(name) ? null : name
}
