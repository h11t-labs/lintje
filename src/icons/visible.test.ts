/**
 * `lazy`: an icon asks for its file only once it is near the viewport.
 *
 * The element itself is checked in headless Chrome (`vitest.config.ts` says why);
 * what is tested here is the arithmetic of it — the observer seam
 * (`./visible.ts`) and the branch in `renderIcon` that `<lintje-icon lazy>` drives
 * (`defer`). Between them they are the whole behaviour: not requested until it
 * intersects, requested once when it does, and a bundled name drawn at once.
 */
import { nothing } from 'lit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { requestIcon, resetIcons, setIconSource } from './loader'
import { ICONS } from './register'
import { renderIcon } from './render'
import { MARGIN, observeIcon, resetIconObserver, unobserveIcon } from './visible'

const ICON = '<?xml version="1.0"?><svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>'

/** An `IntersectionObserver` the test decides the intersections of. */
class FakeObserver {
  static last: FakeObserver | null = null
  readonly targets = new Set<Element>()
  constructor(
    private readonly callback: (entries: { target: Element; isIntersecting: boolean }[]) => void,
    readonly options: { rootMargin?: string } = {},
  ) {
    FakeObserver.last = this
  }
  observe(target: Element): void {
    this.targets.add(target)
  }
  unobserve(target: Element): void {
    this.targets.delete(target)
  }
  disconnect(): void {
    this.targets.clear()
  }
  /** Scrolls the given elements into view, as the browser would report it. */
  intersect(...targets: Element[]): void {
    this.callback(targets.map((target) => ({ target, isIntersecting: true })))
  }
}

const element = (): Element => document.createElement('span')

beforeEach(() => {
  resetIcons()
  resetIconObserver()
  setIconSource({ base: '/icons/' })
  FakeObserver.last = null
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetIconObserver()
})

describe('the icon observer', () => {
  it('does not reveal an icon that has not come into view', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const reveal = vi.fn()
    observeIcon(element(), reveal)
    expect(reveal).not.toHaveBeenCalled()
    expect(FakeObserver.last?.options.rootMargin).toBe(MARGIN)
  })

  it('reveals it once, and then stops watching it', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const target = element()
    const reveal = vi.fn()
    observeIcon(target, reveal)
    FakeObserver.last?.intersect(target)
    FakeObserver.last?.intersect(target)
    expect(reveal).toHaveBeenCalledTimes(1)
    expect(FakeObserver.last?.targets.has(target)).toBe(false)
  })

  it('serves every icon from one observer', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const first = element()
    observeIcon(first, () => {})
    const made = FakeObserver.last
    observeIcon(element(), () => {})
    expect(FakeObserver.last).toBe(made)
    expect(made?.targets.size).toBe(2)
  })

  it('reveals at once where the browser cannot tell', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const reveal = vi.fn()
    observeIcon(element(), reveal)
    expect(reveal).toHaveBeenCalledTimes(1)
  })

  it('lets an icon that left the page go', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const target = element()
    observeIcon(target, () => {})
    unobserveIcon(target)
    expect(FakeObserver.last?.targets.has(target)).toBe(false)
  })
})

describe('a deferred icon', () => {
  it('draws its box without asking for the file', () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    const drawn = renderIcon('op-kantoor-vouwkaart', { size: 24, defer: true })
    expect(drawn).not.toBe(nothing)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('asks once as soon as it is no longer deferred', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => ICON,
    }))
    vi.stubGlobal('fetch', fetcher)
    renderIcon('op-kantoor-vouwkaart', { size: 24, defer: true })
    renderIcon('op-kantoor-vouwkaart', { size: 24 })
    renderIcon('op-kantoor-vouwkaart', { size: 24 })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(String((fetcher.mock.calls as unknown as unknown[][])[0]?.[0])).toContain(
      '/icons/op-kantoor-vouwkaart.svg',
    )
  })

  it('draws a name the bundle carries straight away, deferred or not', () => {
    const name = Object.keys(ICONS)[0]
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    const drawn = renderIcon(name, { size: 24, defer: true })
    expect(drawn).not.toBe(nothing)
    // The register wins over everything but `src`, so nothing is fetched and
    // the glyph — not an empty box — is what the page gets.
    expect(fetcher).not.toHaveBeenCalled()
    expect(JSON.stringify(drawn)).toContain(ICONS[name]!.viewBox)
  })

  it('an eager icon is unchanged: one request per name', () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => ICON,
    }))
    vi.stubGlobal('fetch', fetcher)
    requestIcon('op-kantoor-vouwkaart')
    renderIcon('op-kantoor-vouwkaart', { size: 24 })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
