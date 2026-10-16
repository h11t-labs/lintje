/**
 * A series' colour and shape: a colour name brings its own pair, a style sets either apart, and
 * a key that is neither draws the default and a circle.
 */
import { describe, expect, it } from 'vitest'
import { seriesColor } from '../shared/colors'
import { seriesShape } from '../shared/series-shapes'
import { NEUTRAL_SERIES_COLOR, seriesStyle } from './series-style'

describe('the style of a series', () => {
  it('a colour name is its colour and its shape', () => {
    expect(seriesStyle({}, 'dark-yellow')).toEqual({
      color: seriesColor('dark-yellow'),
      shape: seriesShape('dark-yellow'),
    })
  })

  it('a style sets the colour, the shape, or both; what it leaves out keeps the default', () => {
    const styles = {
      bron: { color: 'neutral' as const, shape: 'square' as const },
      'sky-blue': { shape: 'star' as const },
      paars: { color: 'purple' as const },
    }
    expect(seriesStyle({ seriesStyles: styles }, 'bron')).toEqual({
      color: NEUTRAL_SERIES_COLOR,
      shape: 'square',
    })
    expect(seriesStyle({ seriesStyles: styles }, 'sky-blue')).toEqual({
      color: seriesColor('sky-blue'),
      shape: 'star',
    })
    expect(seriesStyle({ seriesStyles: styles }, 'paars')).toEqual({
      color: seriesColor('purple'),
      shape: 'circle',
    })
  })

  it('a key that is no colour and has no style draws as a point without a series', () => {
    expect(seriesStyle({}, 'onbekend')).toEqual({ color: undefined, shape: 'circle' })
    expect(seriesStyle({}, undefined)).toEqual({ color: undefined, shape: 'circle' })
  })

  it('neutral is the comparison grey, never a data colour', () => {
    expect(NEUTRAL_SERIES_COLOR).toBe('var(--color-chart-secondary)')
  })
})
