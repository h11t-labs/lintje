import { afterEach, describe, expect, it } from 'vitest'
import { lockScroll } from './host-config'

/** happy-dom draws no scrollbar; this gives the viewport one of `width` px. */
function scrollbar(width: number): void {
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    get: () => window.innerWidth - width,
  })
}

afterEach(() => {
  delete (document.documentElement as { clientWidth?: number }).clientWidth
  document.documentElement.style.scrollbarGutter = ''
})

describe('lockScroll', () => {
  it('keeps the room of a scrollbar that takes room, so the page does not widen', () => {
    scrollbar(15)
    const release = lockScroll()
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.documentElement.style.scrollbarGutter).toBe('stable')
    // A second overlay shares the lock; the last release gives the gutter back.
    const second = lockScroll()
    release()
    expect(document.documentElement.style.scrollbarGutter).toBe('stable')
    second()
    expect(document.body.style.overflow).toBe('')
    expect(document.documentElement.style.scrollbarGutter).toBe('')
  })

  it('reserves nothing for an overlay scrollbar or a short page', () => {
    scrollbar(0)
    const release = lockScroll()
    expect(document.documentElement.style.scrollbarGutter).toBe('')
    release()
  })

  it('gives back the gutter the host set itself', () => {
    scrollbar(15)
    document.documentElement.style.scrollbarGutter = 'stable both-edges'
    lockScroll()()
    expect(document.documentElement.style.scrollbarGutter).toBe('stable both-edges')
  })
})
