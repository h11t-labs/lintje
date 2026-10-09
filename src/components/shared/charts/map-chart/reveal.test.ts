/** The move that clears a focused mark of the map's overlays. */
import { describe, expect, it } from 'vitest'
import { clearance, hidden, type Box } from './reveal'

const box = (left: number, top: number, right: number, bottom: number): Box => ({
  left,
  top,
  right,
  bottom,
})

const VIEW = box(0, 0, 600, 400)
// The zoom buttons top right, the layers top left.
const ZOOM = box(552, 8, 600, 152)
const LAYERS = box(8, 8, 200, 56)

describe('clearance', () => {
  it('is no move for a mark in view and clear', () => {
    expect(clearance(box(300, 200, 310, 210), VIEW, [ZOOM, LAYERS], 8)).toEqual([0, 0])
  })

  it('is the shortest move out from under an overlay, the margin off it', () => {
    expect(clearance(box(570, 20, 580, 30), VIEW, [ZOOM, LAYERS], 8)).toEqual([-36, 0])
  })

  it('brings a mark outside the view inside it', () => {
    expect(clearance(box(-40, 300, -30, 310), VIEW, [ZOOM, LAYERS], 8)).toEqual([48, 0])
  })

  it('is null for a mark that fits nowhere between the overlays', () => {
    expect(clearance(box(0, 0, 590, 390), VIEW, [ZOOM, LAYERS], 8)).toBeNull()
  })
})

describe('hidden', () => {
  it('holds for a mark under one overlay, or outside the view', () => {
    expect(hidden(box(570, 20, 580, 30), VIEW, [ZOOM])).toBe(true)
    expect(hidden(box(-40, 300, -30, 310), VIEW, [ZOOM])).toBe(true)
  })

  it('does not for a mark of which a part shows', () => {
    expect(hidden(box(540, 20, 580, 30), VIEW, [ZOOM])).toBe(false)
  })
})
