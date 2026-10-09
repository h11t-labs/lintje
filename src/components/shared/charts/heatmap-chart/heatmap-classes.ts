/**
 * The heatmap's five classes: equal-width over the non-null cells, with rounded bounds.
 * Automatic bounds move with the data; a host that needs a stable colour passes `bounds`.
 */
import { formatNumber } from '../../../../core/format'

export interface HeatmapClass {
  /** Upper bound, exclusive; `Infinity` for the top class. */
  limit: number
  color: string
  label: string
  /**
   * The step of the sequential ramp, 0…4; not the list position. A single class takes 4,
   * because the CSS that turns the text white keys on this number.
   */
  ramp: number
}

const COLORS = [
  'var(--color-chart-seq-1)',
  'var(--color-chart-seq-2)',
  'var(--color-chart-seq-3)',
  'var(--color-chart-seq-4)',
  'var(--color-chart-seq-5)',
]

const CLASS_COUNT = COLORS.length

const STEPS = [1, 2, 2.5, 5, 10]

/**
 * The nice step nearest `raw`, nearest in the ratio and not rounded up: rounding up empties
 * the top class (a 37–183 range with a step of 50 puts the last bound at 200). With
 * `integral` only whole numbers qualify.
 */
function niceStep(raw: number, integral: boolean): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  let best = 0
  let bestDistance = Infinity
  for (const step of STEPS) {
    const candidate = step * magnitude
    if (integral && !Number.isInteger(candidate)) continue
    // Compared in the log, so 1.4 sits between 1 and 2.
    const distance = Math.abs(Math.log(candidate / raw))
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }
  return best || (integral ? 1 : magnitude)
}

/** Rounds away the float dust `floor(min / step) * step` leaves behind. */
function tidy(value: number, step: number): number {
  const decimals = Math.max(0, Math.min(10, -Math.floor(Math.log10(step)) + 1))
  return Number(value.toFixed(decimals))
}

/** The four bounds between the classes; none when empty, all-null or a single distinct value. */
export function heatmapBounds(values: readonly (readonly (number | null)[])[]): number[] {
  const numbers: number[] = []
  for (const row of values) {
    for (const value of row ?? []) {
      if (value != null && Number.isFinite(value)) numbers.push(value)
    }
  }
  if (numbers.length === 0) return []
  const min = Math.min(...numbers)
  const max = Math.max(...numbers)
  if (min === max) return []
  const integral = numbers.every(Number.isInteger)
  const step = niceStep((max - min) / CLASS_COUNT, integral)
  const start = Math.floor(min / step) * step
  const bounds: number[] = []
  for (let k = 1; k < CLASS_COUNT; k += 1) {
    const bound = tidy(start + k * step, step)
    // A bound at or above the maximum would leave its class empty.
    if (bound > max) break
    bounds.push(bound)
  }
  return bounds
}

/** A number with its unit: "87%" with no space, "11 min" with one, the bare number without. */
export function formatWithUnit(value: number, unit?: string, decimals = 0): string {
  const number = formatNumber(value, decimals)
  const suffix = unit?.trim() ?? ''
  if (!suffix) return number
  return suffix === '%' ? `${number}%` : `${number} ${suffix}`
}

function boundDecimals(bounds: readonly number[]): number {
  let decimals = 0
  for (const bound of bounds) {
    const text = String(bound)
    const dot = text.indexOf('.')
    if (dot >= 0) decimals = Math.max(decimals, text.length - dot - 1)
  }
  return Math.min(decimals, 4)
}

/**
 * The classes a heatmap draws with: colours and legend labels. `bounds` (four ascending
 * numbers) overrides the automatic ones; `unit` is written once per label.
 */
export function heatmapClasses(
  values: readonly (readonly (number | null)[])[],
  options: { bounds?: readonly number[]; unit?: string } = {},
): HeatmapClass[] {
  const given = options.bounds?.length ? options.bounds.slice(0, CLASS_COUNT - 1) : null
  const bounds = given ?? heatmapBounds(values)
  const decimals = boundDecimals(bounds)
  // "75–100 min", not "75 min–100 min", which reads as two measurements.
  const write = (value: number): string => formatWithUnit(value, options.unit, decimals)
  const plain = (value: number): string => formatNumber(value, decimals)
  if (bounds.length === 0) {
    const last = COLORS.length - 1
    return [{ limit: Infinity, color: COLORS[last], label: 'alle waarden', ramp: last }]
  }
  return [
    { limit: bounds[0], color: COLORS[0], label: `< ${write(bounds[0])}`, ramp: 0 },
    ...bounds.slice(1).map((bound, i) => ({
      limit: bound,
      color: COLORS[i + 1],
      label: `${plain(bounds[i])}–${write(bound)}`,
      ramp: i + 1,
    })),
    {
      limit: Infinity,
      color: COLORS[bounds.length],
      label: `≥ ${write(bounds[bounds.length - 1])}`,
      ramp: bounds.length,
    },
  ]
}

export function heatmapClassFor(classes: readonly HeatmapClass[], value: number): number {
  const index = classes.findIndex((klass) => value < klass.limit)
  return index === -1 ? classes.length - 1 : index
}
