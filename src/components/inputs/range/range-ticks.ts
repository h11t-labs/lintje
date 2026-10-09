/**
 * Which of a range's steps get a label: the two ends plus the first nice stride that keeps
 * every label `gap` px apart. Marks are thinned with a divisor of that stride, so every
 * label stands on a mark.
 */

export interface TickScale {
  /** Step indexes that get a label; the first and the last are always among them. */
  labels: number[]
  /** Step indexes that get a tick mark; a superset of `labels`. */
  marks: number[]
}

export interface TickOptions {
  count: number
  /** The control's measured width in pixels; 0 when nothing is measured yet. */
  width: number
  /** The widest label, in pixels. */
  labelWidth: number
  /** The air two labels keep between them. Default 8 px. */
  gap?: number
  /** The air two tick marks keep between them. Default 8 px. */
  markGap?: number
}

const NICE = [1, 2, 5, 10, 20, 25, 50]

export function niceStride(minimum: number): number {
  const wanted = Math.max(1, Math.ceil(minimum))
  for (let decade = 1; decade <= 1e6; decade *= 10) {
    for (const stride of NICE) {
      if (stride * decade >= wanted) return stride * decade
    }
  }
  return wanted
}

function divisors(stride: number): number[] {
  const found: number[] = []
  for (let candidate = 1; candidate <= stride; candidate += 1) {
    if (stride % candidate === 0) found.push(candidate)
  }
  return found
}

/** 0, stride, 2·stride … and the last index; a step too close to the end is dropped. */
function series(last: number, stride: number): number[] {
  const indexes = [0]
  for (let index = stride; index < last; index += stride) {
    if (last - index >= stride) indexes.push(index)
  }
  indexes.push(last)
  return indexes
}

export function planTicks({
  count,
  width,
  labelWidth,
  gap = 8,
  markGap = 8,
}: TickOptions): TickScale {
  const last = count - 1
  if (last < 0) return { labels: [], marks: [] }
  if (last === 0) return { labels: [0], marks: [0] }
  if (width <= 0) return { labels: [0, last], marks: [0, last] }

  const pitch = width / last
  // The end labels are anchored to the track edges, so each eats half a label inwards;
  // the end pair is the narrowest and sets the stride (hence 1.5).
  const labelStride = niceStride((labelWidth * 1.5 + gap) / pitch)
  const markStride =
    divisors(labelStride).find((stride) => stride * pitch >= markGap) ?? labelStride
  return { labels: series(last, labelStride), marks: series(last, markStride) }
}
