import { describe, expect, it } from 'vitest'
import { chartColor, lineCasing } from './colors'

describe('lineCasing', () => {
  it('edges each light colour in its dark edge', () => {
    const edges = ['dark-yellow', 'mint-green', 'light-blue', 'pink', 'yellow', 'orange'] as const
    for (const color of edges) {
      expect(lineCasing(chartColor(color)), color).toBe(`var(--color-chart-${color}-edge)`)
    }
  })

  it('leaves a colour that reaches 3:1 by itself, and a host’s own colour, without one', () => {
    expect(lineCasing(chartColor('sky-blue'))).toBeUndefined()
    expect(lineCasing('#76D2B6')).toBeUndefined()
    expect(lineCasing(undefined)).toBeUndefined()
  })
})
