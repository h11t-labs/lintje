/**
 * The data-colour names: the one runtime list.
 *
 * The values live in `tokens.css` and only the browser resolves them; what crosses between
 * modules and from a host is the NAME. The map's series keys, the charts' colour table, the
 * KPI's accents and the unions of the contract derive from this array, so a colour is added
 * here and in `tokens.css`.
 *
 * The order is canonical: the map's shapes stand beside it position for position. A colour is
 * appended, never inserted, or every series after it changes shape. The tests beside the list
 * restate the names instead of reading them from here: a test that takes its expectation from
 * what it guards guards nothing.
 */
export const DATA_COLORS = [
  'sky-blue',
  'dark-yellow',
  'red',
  'green',
  'mint-green',
  'violet',
  'orange',
  'pink',
  'dark-green',
  'purple',
  'ruby-red',
  'yellow',
  'dark-brown',
  'brown',
  'dark-blue',
  'light-blue',
  'moss-green',
] as const

/** One variable's colour, named after the Rijkshuisstijl colour it is (rule 10). */
export type DataColor = (typeof DATA_COLORS)[number]

export function isDataColor(value: unknown): value is DataColor {
  return typeof value === 'string' && (DATA_COLORS as readonly string[]).includes(value)
}

/** The component token a data colour draws: `sky-blue` → `var(--color-chart-sky-blue)`. */
export function chartToken(color: DataColor): string {
  return `var(--color-chart-${color})`
}
