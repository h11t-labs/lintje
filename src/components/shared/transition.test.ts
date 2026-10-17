import { describe, expect, it } from 'vitest'
import { heightSettleMs, heightTransitionMs } from './transition'

describe('heightTransitionMs', () => {
  it('is 0 when only opacity transitions', () => {
    expect(heightTransitionMs('opacity', '0.08s')).toBe(0)
  })

  it('is the duration of grid-template-rows or all', () => {
    expect(heightTransitionMs('grid-template-rows', '0.2s')).toBe(200)
    expect(heightTransitionMs('all', '0.2s')).toBe(200)
  })

  it('takes the duration that belongs to grid-template-rows in a list', () => {
    expect(heightTransitionMs('opacity, grid-template-rows', '0.08s, 0.2s')).toBe(200)
    expect(heightTransitionMs('grid-template-rows, opacity', '0.2s, 0.08s')).toBe(200)
  })

  it('repeats a shorter duration list', () => {
    expect(heightTransitionMs('opacity, visibility, grid-template-rows', '0.08s, 0s')).toBe(80)
  })

  it('takes the last entry for the property', () => {
    expect(heightTransitionMs('all, grid-template-rows', '0.2s, 0s')).toBe(0)
  })

  it('reads milliseconds as well as seconds', () => {
    expect(heightTransitionMs('grid-template-rows', '200ms')).toBe(200)
  })

  it('is 0 for a transition of none', () => {
    expect(heightTransitionMs('none', '0s')).toBe(0)
  })
})

describe('heightSettleMs', () => {
  it('is 0 without a box', () => {
    expect(heightSettleMs(null)).toBe(0)
  })
})
