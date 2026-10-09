/**
 * The shapes a map point may take, one per data colour.
 *
 * Colour is never the only carrier of meaning (rule 13), so a series is a colour
 * *and* a shape. What has to hold for that to work: as many distinct shapes as colours, and
 * all of them the same visual area — otherwise a series reads as louder than its
 * neighbour at the same value, and the map would be lying about the figures.
 */
import { describe, expect, it } from 'vitest'
import {
  SERIES_KEYS,
  isSeriesKey,
  markPath,
  seriesShape,
  seriesShapePath,
  seriesShapePoints,
} from './series-shapes'
import { chartColor, seriesColor } from './colors'

/** Shoelace: the area a closed polygon encloses. */
function area(points: [number, number][]): number {
  let sum = 0
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    sum += x1 * y2 - x2 * y1
  }
  return Math.abs(sum) / 2
}

describe('series shapes', () => {
  it('has one shape per data colour, all seventeen different', () => {
    expect(SERIES_KEYS).toHaveLength(17)
    const shapes = SERIES_KEYS.map(seriesShape)
    expect(new Set(shapes).size).toBe(17)
    expect(shapes.every((shape) => shape != null)).toBe(true)
  })

  it('gives every polygon the area of the circle it stands in for', () => {
    for (const key of SERIES_KEYS) {
      const points = seriesShapePoints(seriesShape(key), 10)
      if (!points) continue // the circle itself
      expect(area(points)).toBeCloseTo(Math.PI * 100, 4)
    }
  })

  it('scales with the radius, so a point still sizes by its value', () => {
    const small = seriesShapePoints('square', 5)!
    const large = seriesShapePoints('square', 10)!
    expect(area(large) / area(small)).toBeCloseTo(4, 6)
  })

  it('draws the circle as arcs of the given radius, centred where it is put', () => {
    expect(seriesShapePath('circle', 8, 100, 50)).toContain('M 92 50 a 8 8')
  })

  it('centres a polygon on the point it is drawn at', () => {
    const points = seriesShapePoints('diamond', 6)!
    const path = seriesShapePath('diamond', 6, 100, 50)
    for (const [x, y] of points) {
      expect(path).toContain(`${Number((100 + x).toFixed(3))} ${Number((50 + y).toFixed(3))}`)
    }
  })

  it('falls back to a circle for a point without a series', () => {
    expect(markPath(undefined, 4)).toBe(seriesShapePath('circle', 4))
  })

  it('recognises the colour names and nothing else', () => {
    expect(SERIES_KEYS.every(isSeriesKey)).toBe(true)
    expect(isSeriesKey('a')).toBe(false)
    expect(isSeriesKey('blue')).toBe(false)
    expect(isSeriesKey('Sky-Blue')).toBe(false)
  })
})

describe('seriesColor', () => {
  it('maps the names onto their variable tokens, in the canonical order', () => {
    expect(SERIES_KEYS.map(seriesColor)).toEqual([
      'var(--color-chart-sky-blue)',
      'var(--color-chart-dark-yellow)',
      'var(--color-chart-red)',
      'var(--color-chart-green)',
      'var(--color-chart-mint-green)',
      'var(--color-chart-violet)',
      'var(--color-chart-orange)',
      'var(--color-chart-pink)',
      'var(--color-chart-dark-green)',
      'var(--color-chart-purple)',
      'var(--color-chart-ruby-red)',
      'var(--color-chart-yellow)',
      'var(--color-chart-dark-brown)',
      'var(--color-chart-brown)',
      'var(--color-chart-dark-blue)',
      'var(--color-chart-light-blue)',
      'var(--color-chart-moss-green)',
    ])
  })

  it('is the same table `chartColor` uses, so a series and a spec colour agree', () => {
    for (const key of SERIES_KEYS) expect(seriesColor(key)).toBe(chartColor(key))
  })

  it('has no colour for a letter that is not a series', () => {
    expect(seriesColor('i')).toBeUndefined()
    expect(seriesColor(undefined)).toBeUndefined()
  })
})
