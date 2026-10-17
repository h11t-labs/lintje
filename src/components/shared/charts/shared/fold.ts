/**
 * The parts of a stack past the ladder's five. Each part of one variable takes its own rung, so
 * a sixth would repeat one: the largest four keep their place and their tint, and the rest fold
 * into one grey "Overig" on top, as the pie folds. The CSV keeps every part; the tooltip names
 * the folded ones under "Overig".
 */

/** The rungs of a ladder: more parts than this in one colour fold. */
export const LADDER_PARTS = 5

/** The part the smallest fold into: grey, not clickable, its parts named in the tooltip. */
export interface OtherPart<S> {
  label: string
  values: (number | null)[]
  color: 'other'
  folded: S[]
}

const total = (values: readonly (number | null)[]): number =>
  values.reduce<number>((sum, value) => sum + (value ?? 0), 0)

export const isOtherPart = <S>(row: S | OtherPart<S>): row is OtherPart<S> =>
  Array.isArray((row as OtherPart<S>).folded)

/** A part the host already calls "Overig": no rung of its own, and what folds joins it. */
const isOther = (row: { label: string }): boolean => row.label.toLowerCase().startsWith('overig')

/**
 * `series` with the parts that take a rung (`takesTint`) folded past five, into the host's own
 * "Overig" where it sent one, as the pie does. A missing value in a folded part leaves "Overig"
 * missing there too, never the sum of the rest (rule 15).
 */
export function foldStack<S extends { label: string; values: readonly (number | null)[] }>(
  series: readonly S[],
  takesTint: (row: S) => boolean,
): (S | OtherPart<S>)[] {
  const ladder = series.filter((row) => takesTint(row) && !isOther(row))
  if (ladder.length <= LADDER_PARTS) return [...series]
  const kept = new Set(
    [...ladder].sort((a, b) => total(b.values) - total(a.values)).slice(0, LADDER_PARTS - 1),
  )
  const folded = ladder.filter((row) => !kept.has(row))
  const own = series.find(isOther)
  const joined = own ? [own, ...folded] : folded
  const values = folded[0].values.map((_, i) =>
    joined.some((row) => row.values[i] == null)
      ? null
      : joined.reduce((sum, row) => sum + (row.values[i] as number), 0),
  )
  const other: OtherPart<S> = { label: own?.label ?? 'Overig', values, color: 'other', folded }
  const rest = series.filter((row) => !folded.includes(row))
  return own ? rest.map((row) => (row === own ? other : row)) : [...rest, other]
}
