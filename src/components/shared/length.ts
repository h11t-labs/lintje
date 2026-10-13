const NUMERIC = /^-?\d+(?:\.\d+)?$/

/** A CSS length: a number or numeric string (an attribute arrives as text) is pixels. */
export function length(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'number') return `${value}px`
  return NUMERIC.test(value) ? `${value}px` : value
}
