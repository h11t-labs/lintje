/** The zoom: fitting, zooming round a point, the form of a node at each zoom, the overview. */
import { describe, expect, it } from 'vitest'
import { boundsOf, centreOn, fit, fits, levelAt, overview, zoomAt, ZOOM } from './view'

const area = { width: 800, height: 400 }

describe('the zoom', () => {
  it('draws a card from 0.7, a mark with its name from 0.35, and only the mark below', () => {
    expect(levelAt(1)).toBe('card')
    expect(levelAt(0.7)).toBe('card')
    expect(levelAt(0.5)).toBe('mark')
    expect(levelAt(0.2)).toBe('icon')
  })

  it('finds the box round nodes of their own size', () => {
    const sizes = new Map([
      ['a', { width: 100, height: 40 }],
      ['b', { width: 100, height: 40 }],
    ])
    expect(boundsOf({ a: { x: 0, y: 0 }, b: { x: 200, y: 100 } }, sizes)).toEqual({
      x: -50,
      y: -20,
      width: 300,
      height: 140,
    })
  })

  it('fits the box in the middle of the area, never closer than its largest fit', () => {
    const big = fit({ x: 0, y: 0, width: 1600, height: 400 }, area)
    expect(big.k).toBeCloseTo((800 - 48) / 1600)
    expect(fits({ x: 0, y: 0, width: 1600, height: 400 }, big, area)).toBe(true)
    expect(fit({ x: 0, y: 0, width: 10, height: 10 }, area).k).toBe(ZOOM.fit)
  })

  it('keeps a strip clear for the zoom buttons', () => {
    const view = fit({ x: 0, y: 0, width: 1600, height: 100 }, area, 56)
    expect(1600 * view.k + view.x).toBeLessThanOrEqual(800 - 56)
  })

  it('zooms round a point, which stays where it is', () => {
    const view = zoomAt({ k: 1, x: 0, y: 0 }, { x: 100, y: 50 }, 2)
    expect(view).toEqual({ k: 2, x: -100, y: -50 })
    expect(zoomAt(view, { x: 0, y: 0 }, 100).k).toBe(ZOOM.max)
  })

  it('centres a point of the graph', () => {
    const view = centreOn({ k: 2, x: 0, y: 0 }, { x: 10, y: 10 }, area)
    expect(10 * view.k + view.x).toBe(400)
    expect(10 * view.k + view.y).toBe(200)
  })

  it('scales the whole drawing into the overview', () => {
    const map = overview({ x: 0, y: 0, width: 1000, height: 500 }, { width: 180, height: 100 })
    expect(map.scale).toBeCloseTo(164 / 1000)
  })
})
