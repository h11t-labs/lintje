/**
 * The squarified treemap layout (Bruls, Huizing and Van Wijk): the values fill the box in rows
 * along its short side, each row as square as it can be. The first value lies top left. Pure:
 * the same values in the same box give the same rectangles.
 */

export interface TreemapRect {
  x: number
  y: number
  width: number
  height: number
}

/** The worst aspect ratio of a row of areas laid along a side of this length. */
function worst(row: number[], side: number): number {
  const sum = row.reduce((total, area) => total + area, 0)
  const largest = Math.max(...row)
  const smallest = Math.min(...row)
  const square = side * side
  return Math.max((square * largest) / (sum * sum), (sum * sum) / (square * smallest))
}

/**
 * One rectangle per value, in their order, together exactly the box. A value that is not
 * positive has no area: its rectangle is empty, at the box's corner.
 */
export function squarify(values: readonly number[], box: TreemapRect): TreemapRect[] {
  const empty = (): TreemapRect => ({ x: box.x, y: box.y, width: 0, height: 0 })
  const total = values.reduce((sum, value) => (value > 0 ? sum + value : sum), 0)
  const result: TreemapRect[] = values.map(empty)
  if (total <= 0 || box.width <= 0 || box.height <= 0) return result

  const scale = (box.width * box.height) / total
  const items = values.flatMap((value, index) =>
    value > 0 ? [{ index, area: value * scale }] : [],
  )
  let { x, y, width, height } = box
  let start = 0
  while (start < items.length) {
    const side = Math.min(width, height)
    let end = start + 1
    while (
      end < items.length &&
      worst(
        items.slice(start, end + 1).map((item) => item.area),
        side,
      ) <=
        worst(
          items.slice(start, end).map((item) => item.area),
          side,
        )
    ) {
      end += 1
    }
    const row = items.slice(start, end)
    const last = end === items.length
    const sum = row.reduce((acc, item) => acc + item.area, 0)
    if (width >= height) {
      // A column along the left; the last one takes what is left, so no rounding shows.
      const thickness = last ? width : sum / height
      let offset = y
      for (const [i, item] of row.entries()) {
        const length = i === row.length - 1 ? y + height - offset : item.area / thickness
        result[item.index] = { x, y: offset, width: thickness, height: length }
        offset += length
      }
      x += thickness
      width -= thickness
    } else {
      const thickness = last ? height : sum / width
      let offset = x
      for (const [i, item] of row.entries()) {
        const length = i === row.length - 1 ? x + width - offset : item.area / thickness
        result[item.index] = { x: offset, y, width: length, height: thickness }
        offset += length
      }
      y += thickness
      height -= thickness
    }
    start = end
  }
  return result
}
