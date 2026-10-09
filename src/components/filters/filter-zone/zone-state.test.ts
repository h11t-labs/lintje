/**
 * When the filter zone shows its controls: closed until the reader opens it, open where the bar
 * stands, and closed again by the toggle or by the page scrolling on.
 */
import { describe, expect, it } from 'vitest'
import {
  SCROLL_CLOSES_AFTER,
  canStayScrolled,
  zoneExpanded,
  zoneReduce,
  type ZoneState,
} from './zone-state'

const closed: ZoneState = { open: false, scrolled: false }
const at = (patch: Partial<ZoneState>): ZoneState => ({ ...closed, ...patch })

describe('zoneExpanded', () => {
  it('is the summary bar until the reader opens it, at the top and stuck', () => {
    expect(zoneExpanded(closed)).toBe(false)
    expect(zoneExpanded(at({ scrolled: true }))).toBe(false)
  })

  it('shows the controls where the bar stands once it is open', () => {
    expect(zoneExpanded(at({ open: true }))).toBe(true)
    expect(zoneExpanded(at({ open: true, scrolled: true }))).toBe(true)
  })
})

describe('zoneReduce', () => {
  it("opens and closes on the reader's say", () => {
    expect(zoneReduce(closed, { type: 'expand' })).toEqual({ open: true, scrolled: false })
    expect(zoneReduce(at({ open: true, scrolled: true }), { type: 'collapse' })).toEqual({
      open: false,
      scrolled: true,
    })
  })

  it('moves the bar, not the controls, when it reaches or leaves the top bar', () => {
    expect(zoneReduce(at({ open: true }), { type: 'scrolled', scrolled: true })).toEqual({
      open: true,
      scrolled: true,
    })
    expect(zoneReduce(at({ scrolled: true }), { type: 'scrolled', scrolled: false })).toEqual(
      closed,
    )
  })

  it('closes when the page scrolls on under the open controls, in either direction', () => {
    const open = at({ open: true, scrolled: true })
    expect(
      zoneReduce(open, { type: 'page-scrolled', distance: SCROLL_CLOSES_AFTER + 1 }).open,
    ).toBe(false)
    expect(
      zoneReduce(open, { type: 'page-scrolled', distance: -(SCROLL_CLOSES_AFTER + 1) }).open,
    ).toBe(false)
  })

  it('keeps the controls through a tremble of the hand', () => {
    const open = at({ open: true })
    expect(zoneReduce(open, { type: 'page-scrolled', distance: SCROLL_CLOSES_AFTER })).toBe(open)
    expect(zoneReduce(open, { type: 'page-scrolled', distance: -3 })).toBe(open)
  })
})

describe('canStayScrolled', () => {
  // A window of 800 px and an open zone of 460 px that pins, leaving a 48 px placeholder.
  const viewportHeight = 800
  const lost = 412

  it('pins on a long page', () => {
    expect(canStayScrolled({ scrollHeight: 5000, viewportHeight, lost, threshold: 1200 })).toBe(
      true,
    )
  })

  it('pins when the page keeps exactly the threshold as its furthest position', () => {
    // 2000 − 800 − 412 = 788: the reader stays on the threshold, nothing scrolls back.
    expect(canStayScrolled({ scrollHeight: 2000, viewportHeight, lost, threshold: 788 })).toBe(true)
  })

  it('stays in the page on a page barely taller than the window', () => {
    // 950 − 800 − 412 = −262: pinning scrolls the reader back above the threshold.
    expect(canStayScrolled({ scrollHeight: 950, viewportHeight, lost, threshold: 120 })).toBe(false)
  })

  it('stays in the page on a page that fits the window', () => {
    expect(
      canStayScrolled({ scrollHeight: viewportHeight, viewportHeight, lost, threshold: 100 }),
    ).toBe(false)
  })

  it('pins whenever pinning takes nothing out of the page', () => {
    expect(canStayScrolled({ scrollHeight: 1000, viewportHeight, lost: 0, threshold: 200 })).toBe(
      true,
    )
  })
})
