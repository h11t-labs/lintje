/**
 * The tints the parts of one variable are drawn in, darkest first.
 *
 * Two neighbouring steps of the ladder read as one colour side by side (100 % against 75 % of
 * the sky blue is 1.49:1), so the steps spread over the ladder with the number of parts: two
 * parts take 100 and 45 %, five the whole ladder down to 30 %. Never lighter than the count
 * needs, so the lightest part still reads as the same colour.
 *
 * A figure that brings a variable's colour brings its ladder; without one, or with a colour
 * that is not a variable, the default ladder applies. Beyond five parts the steps clamp to the
 * five-step spread: the pie folds before that, the stacked bar keeps its last tint.
 */
import { isDataColor } from '../../../../tokens/colors'

const STEPS: readonly (readonly number[])[] = [
  [1],
  [1, 4],
  [1, 2, 4],
  [1, 2, 3, 4],
  [1, 2, 3, 4, 5],
]

/** The tint tokens for `n` parts of one variable, darkest first. */
export function tintsFor(n: number, color?: string): string[] {
  if (n < 1) return []
  const steps = STEPS[Math.min(n, STEPS.length) - 1]
  if (isDataColor(color)) {
    return steps.map((step) =>
      step === 1 ? `var(--color-chart-${color})` : `var(--color-chart-${color}-tint-${step})`,
    )
  }
  return steps.map((step) => `var(--color-chart-tint-${step})`)
}
