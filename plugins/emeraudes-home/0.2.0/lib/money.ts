// Amounts as servers print them: « 1 234,56 $ », « $1,234.56 », « 12.5k », « Solde : 3 000 ». French and English
// grouping, both separators: the last « , » or « . » followed by one or two digits is the decimal point, any other is a
// thousands separator. Returns null when the text holds no amount.

const SUFFIX: Record<string, number> = { k: 1e3, m: 1e6, md: 1e9, b: 1e9, t: 1e12 }

/** The first amount found in `text` (after `label` when given: « Solde », « Money »...), or null. */
export function parseAmount(text: string, label?: RegExp): number | null {
  let rest = text.replace(/§./g, '')
  if (label) {
    const at = rest.search(label)
    if (at < 0) return null
    rest = rest.slice(at).replace(label, '')
  }
  const match = /(-?\d[\d   .,']*)\s*(md|[kmbt])?(?![a-z])/i.exec(rest)
  if (!match) return null
  const raw = match[1]!.replace(/[\s  ']/g, '').replace(/[.,]$/, '')
  const decimal = /[.,](\d{1,2})$/.exec(raw)
  const whole = (decimal ? raw.slice(0, decimal.index) : raw).replace(/[.,]/g, '')
  const value = Number(`${whole}${decimal ? `.${decimal[1]}` : ''}`)
  if (!Number.isFinite(value)) return null
  const suffix = match[2]?.toLowerCase()
  return suffix ? value * SUFFIX[suffix]! : value
}

/** How many units at `unitPrice` the money pays for, never more (floating point rounded down, never up). */
export function affordable(money: number, unitPrice: number): number {
  if (!(unitPrice > 0) || !(money > 0) || !Number.isFinite(money)) return 0
  let n = Math.floor(money / unitPrice)
  while (n > 0 && n * unitPrice > money) n--
  return n
}
