/** Draw-in stagger, returned in the shape `styleProps` (`core/style-props.ts`) takes. */

export type StyleInfo = Record<string, string>

/** Place of a mark in the staggered draw-in: 0 for the first, 1 for the last. */
export function staggerStyle(index: number, count: number): StyleInfo {
  return { '--lintje-stagger': String(count > 1 ? index / (count - 1) : 0) }
}

/** Place of a cell in a grid's draw-in: columns weigh 0.7, rows 0.3, so the columns lead. */
export function gridStaggerStyle(
  column: number,
  row: number,
  columns: number,
  rows: number,
): StyleInfo {
  const k = columns > 1 ? column / (columns - 1) : 0
  const r = rows > 1 ? row / (rows - 1) : 0
  return { '--lintje-stagger': String(0.7 * k + 0.3 * r) }
}
