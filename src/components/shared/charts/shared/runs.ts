/** A known value with a missing value on both sides is a point of this radius, in its line's colour. */
export const LONE_POINT_RADIUS = 2.5

/**
 * The unbroken runs of known values, each as its points: a missing value ends a run, so no
 * segment bridges it as if it were known (rule 15).
 */
export function knownRuns<P>(
  values: readonly (number | null | undefined)[],
  point: (value: number, index: number) => P,
): P[][] {
  const runs: P[][] = []
  let run: P[] = []
  values.forEach((value, i) => {
    if (value == null) {
      if (run.length) runs.push(run)
      run = []
      return
    }
    run.push(point(value, i))
  })
  if (run.length) runs.push(run)
  return runs
}
