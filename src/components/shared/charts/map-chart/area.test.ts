import { describe, expect, it } from 'vitest'
import { distanceKm, idsInArea, inArea, isRect, rectRing } from './area'
import type { MapDrawing } from './drawings'

const UTRECHT: [number, number] = [5.12, 52.09]
const AMSTERDAM: [number, number] = [4.9, 52.37]

const drawing = (variant: MapDrawing['variant'], values: MapDrawing['values']): MapDrawing => ({
  variant,
  values,
  index: 0,
  name: variant,
  unit: '',
  max: 1,
  min: 1,
})

describe('an area on the map', () => {
  it('measures along the earth', () => {
    expect(distanceKm(UTRECHT, AMSTERDAM)).toBeGreaterThan(33)
    expect(distanceKm(UTRECHT, AMSTERDAM)).toBeLessThan(37)
  })

  it('holds what lies within its radius or its ring', () => {
    const circle = { kind: 'circle' as const, centre: UTRECHT, radiusKm: 40 }
    expect(inArea(circle, AMSTERDAM)).toBe(true)
    expect(inArea({ ...circle, radiusKm: 20 }, AMSTERDAM)).toBe(false)
    const ring: [number, number][] = [
      [4.5, 52.0],
      [5.5, 52.0],
      [5.5, 52.5],
      [4.5, 52.5],
    ]
    expect(inArea({ kind: 'lasso', ring }, AMSTERDAM)).toBe(true)
    expect(inArea({ kind: 'lasso', ring }, [6.5, 52.2])).toBe(false)
    expect(inArea({ kind: 'lasso', ring: ring.slice(0, 2) }, AMSTERDAM)).toBe(false)
  })

  it('chooses only what lies wholly in it: a place by its point, an outline by every corner', () => {
    const area = { kind: 'circle' as const, centre: UTRECHT, radiusKm: 60 }
    const ids = idsInArea(
      area,
      [
        drawing('points', [
          { id: 'ams', label: 'Amsterdam', value: 1, lon: AMSTERDAM[0], lat: AMSTERDAM[1] },
          { id: 'gro', label: 'Groningen', value: 1, lon: 6.57, lat: 53.22 },
          { id: 'nowhere', label: 'Zonder plaats', value: 1 },
        ]),
        drawing('polygons', [
          {
            id: 'zone',
            label: 'Zone',
            value: 1,
            polygon: [
              [5.0, 52.0],
              [5.2, 52.0],
              [5.2, 52.2],
            ],
          },
          {
            id: 'half',
            label: 'Half erin',
            value: 1,
            polygon: [
              [5.0, 52.0],
              [6.5, 52.0],
              [6.5, 52.2],
            ],
          },
        ]),
        // The country reaches far past 60 km from Utrecht.
        drawing('choropleth', [{ id: 'NL', label: 'Nederland', value: 1 }]),
      ],
      'netherlands',
    )
    expect(ids).toEqual(['ams', 'zone'])
  })

  it('leaves out an outline a lasso cuts, though its corners are all inside', () => {
    // A U-shaped lasso: the square's corners lie in its arms, its middle in the gap.
    const lasso = {
      kind: 'lasso' as const,
      ring: [
        [0, 0],
        [3, 0],
        [3, 3],
        [2, 3],
        [2, 1],
        [1, 1],
        [1, 3],
        [0, 3],
      ] as [number, number][],
    }
    const square = drawing('polygons', [
      {
        id: 'cut',
        label: 'Doorsneden',
        value: 1,
        polygon: [
          [0.5, 2],
          [2.5, 2],
          [2.5, 2.5],
          [0.5, 2.5],
        ],
      },
      {
        id: 'whole',
        label: 'Heel',
        value: 1,
        polygon: [
          [0.2, 0.2],
          [2.8, 0.2],
          [2.8, 0.8],
          [0.2, 0.8],
        ],
      },
    ])
    expect(idsInArea(lasso, [square])).toEqual(['whole'])
  })

  it('takes a flow with both its ends and its arc', () => {
    const flows: MapDrawing = {
      ...drawing('flows', [
        { id: 'near', label: 'Amsterdam', value: 1, lon: AMSTERDAM[0], lat: AMSTERDAM[1] },
      ]),
      destination: { lon: UTRECHT[0], lat: UTRECHT[1], label: 'Utrecht' },
    }
    expect(idsInArea({ kind: 'circle', centre: UTRECHT, radiusKm: 60 }, [flows])).toEqual(['near'])
    expect(idsInArea({ kind: 'circle', centre: AMSTERDAM, radiusKm: 10 }, [flows])).toEqual([])
  })

  it('draws a rectangle as a ring of four corners, and knows it again', () => {
    const ring = rectRing([4, 53], [6, 51])
    expect(ring).toEqual([
      [4, 53],
      [6, 53],
      [6, 51],
      [4, 51],
    ])
    expect(isRect(ring)).toBe(true)
    expect(
      isRect([
        [4, 53],
        [6, 53.1],
        [6, 51],
        [4, 51],
      ]),
    ).toBe(false)
    expect(inArea({ kind: 'lasso', ring }, UTRECHT)).toBe(true)
    expect(inArea({ kind: 'lasso', ring }, [3, 52])).toBe(false)
  })
})
