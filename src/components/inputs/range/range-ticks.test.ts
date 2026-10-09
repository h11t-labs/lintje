/**
 * The range scale's arithmetic: which steps keep a label and which keep a mark.
 * The element itself is checked in headless Chrome.
 */
import { describe, expect, it } from 'vitest'
import { niceStride, planTicks } from './range-ticks'

describe('niceStride', () => {
  it('counts in the strides a reader counts in', () => {
    expect(niceStride(1)).toBe(1)
    expect(niceStride(1.2)).toBe(2)
    expect(niceStride(3)).toBe(5)
    expect(niceStride(6)).toBe(10)
    expect(niceStride(11)).toBe(20)
    expect(niceStride(21)).toBe(25)
    expect(niceStride(26)).toBe(50)
    expect(niceStride(51)).toBe(100)
  })
})

describe('planTicks', () => {
  const at = (count: number, width: number, labelWidth = 14) =>
    planTicks({ count, width, labelWidth })

  it('shows only the two ends before anything is measured', () => {
    expect(at(31, 0)).toEqual({ labels: [0, 30], marks: [0, 30] })
  })

  it('has nothing to thin at one step or none', () => {
    expect(at(0, 180)).toEqual({ labels: [], marks: [] })
    expect(at(1, 180)).toEqual({ labels: [0], marks: [0] })
    expect(at(2, 180)).toEqual({ labels: [0, 1], marks: [0, 1] })
  })

  it('labels every step when they are far enough apart', () => {
    expect(at(6, 600).labels).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('thins 31 steps in a 180 px control to every fifth label', () => {
    const scale = at(31, 180)
    expect(scale.labels).toEqual([0, 5, 10, 15, 20, 25, 30])
    // 6 px apart is closer than a mark may stand, so every mark carries a label.
    expect(scale.marks).toEqual(scale.labels)
  })

  it('keeps every label clear of its neighbour, the anchored ends included', () => {
    const width = 180
    const labelWidth = 14
    const { labels } = planTicks({ count: 31, width, labelWidth })
    const pitch = width / 30
    for (let i = 1; i < labels.length; i += 1) {
      // The end labels are anchored, so a pair costs one and a half label.
      expect((labels[i] - labels[i - 1]) * pitch).toBeGreaterThanOrEqual(labelWidth * 1.5 + 8)
    }
  })

  it('thins the marks less than the labels when the pixels allow it', () => {
    const scale = planTicks({ count: 31, width: 300, labelWidth: 14 })
    expect(scale.labels).toEqual([0, 5, 10, 15, 20, 25, 30])
    expect(scale.marks).toHaveLength(31)
  })

  it('thins the marks too when the steps outnumber the pixels', () => {
    const scale = planTicks({ count: 51, width: 120, labelWidth: 14 })
    expect(scale.marks.length).toBeLessThan(51)
  })

  it('leaves every label standing on a mark', () => {
    for (const count of [7, 12, 31, 41, 51]) {
      for (const width of [90, 120, 180, 240, 360, 720]) {
        const scale = planTicks({ count, width, labelWidth: 14 })
        for (const label of scale.labels) expect(scale.marks).toContain(label)
      }
    }
  })

  it('always keeps the first and the last step', () => {
    for (const count of [3, 8, 31, 50]) {
      for (const width of [40, 180, 900]) {
        const { labels } = planTicks({ count, width, labelWidth: 20 })
        expect(labels[0]).toBe(0)
        expect(labels.at(-1)).toBe(count - 1)
      }
    }
  })

  it('drops the step before the end rather than crowd the last label', () => {
    // 32 steps over 186 px: the stride is 5 and 30 lands one step from the end,
    // so the end wins and 30 goes.
    const { labels } = planTicks({ count: 32, width: 186, labelWidth: 14 })
    expect(labels).toEqual([0, 5, 10, 15, 20, 25, 31])
    expect(labels).not.toContain(30)
  })

  it('falls back to the two ends when not even one stride fits', () => {
    expect(planTicks({ count: 50, width: 40, labelWidth: 20 }).labels).toEqual([0, 49])
  })
})
