/**
 * The loader: one request per name, one 404 per name, and a redraw when a glyph
 * lands.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  iconIsMissing,
  loadIcon,
  loadedIcon,
  onIconChange,
  requestIcon,
  resetIcons,
  setIconSource,
} from './loader'

const ICON = '<?xml version="1.0"?><svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>'

function serve(bodies: Record<string, string | number>) {
  return vi.fn(async (url: string) => {
    const name = new URL(url, 'http://host').pathname.replace(/^.*\//, '').replace(/\.svg$/, '')
    const body = bodies[name]
    if (typeof body !== 'string') return { ok: false, status: 404, text: async () => '' }
    return { ok: true, status: 200, text: async () => body }
  })
}

beforeEach(() => {
  resetIcons()
  setIconSource({ base: '/icons/' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the icon loader', () => {
  it('fetches a name once, however many icons ask for it', async () => {
    const fetcher = serve({ 'functioneel-klok': ICON })
    vi.stubGlobal('fetch', fetcher)
    requestIcon('functioneel-klok')
    requestIcon('functioneel-klok')
    await loadIcon('functioneel-klok')
    requestIcon('functioneel-klok')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(loadedIcon('functioneel-klok')?.body).toContain('<path')
  })

  it('remembers a name the host has no file for, and asks only once', async () => {
    const fetcher = serve({})
    vi.stubGlobal('fetch', fetcher)
    await loadIcon('bestaat-niet')
    expect(iconIsMissing('bestaat-niet')).toBe(true)
    requestIcon('bestaat-niet')
    await loadIcon('bestaat-niet')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(loadedIcon('bestaat-niet')).toBeUndefined()
  })

  it('tells the page to redraw, both when a glyph lands and when it does not', async () => {
    vi.stubGlobal('fetch', serve({ 'functioneel-klok': ICON }))
    const redraw = vi.fn()
    const off = onIconChange(redraw)
    await loadIcon('functioneel-klok')
    expect(redraw).toHaveBeenCalledTimes(1)
    await loadIcon('bestaat-niet')
    expect(redraw).toHaveBeenCalledTimes(2)
    off()
    await loadIcon('ook-niet')
    expect(redraw).toHaveBeenCalledTimes(2)
  })

  it('asks the new source again for a name the old one had no file for', async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.startsWith('/dist-icons/')
        ? { ok: true, status: 200, text: async () => ICON }
        : { ok: false, status: 404, text: async () => '' },
    )
    vi.stubGlobal('fetch', fetcher)
    await loadIcon('functioneel-klok')
    expect(iconIsMissing('functioneel-klok')).toBe(true)
    const redraw = vi.fn()
    const off = onIconChange(redraw)
    setIconSource({ base: '/dist-icons/' })
    off()
    expect(redraw).toHaveBeenCalledWith(undefined)
    expect(iconIsMissing('functioneel-klok')).toBe(false)
    expect((await loadIcon('functioneel-klok'))?.body).toContain('<path')
  })

  it('does not count a 404 from a source replaced while it was on its way', async () => {
    let answer: (value: unknown) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise((resolve) => (answer = resolve))),
    )
    const asked = loadIcon('functioneel-klok')
    setIconSource({ base: '/dist-icons/' })
    answer({ ok: false, status: 404, text: async () => '' })
    await asked
    expect(iconIsMissing('functioneel-klok')).toBe(false)
  })

  it('puts the build on the URL so the answer can be cached by release', async () => {
    const fetcher = serve({ 'functioneel-klok': ICON })
    vi.stubGlobal('fetch', fetcher)
    setIconSource({ base: '/assets', version: 'abc123' })
    await loadIcon('functioneel-klok')
    expect(fetcher).toHaveBeenCalledWith('/assets/functioneel-klok.svg?b=abc123')
  })

  it('normalises what it fetched the way the build does', async () => {
    vi.stubGlobal(
      'fetch',
      serve({
        'dieren-kikker':
          '<svg viewBox="0 0 48 48"><path style="fill:none;stroke:#000" d="M0 0"/></svg>',
        'embleem-marechaussee':
          '<svg viewBox="0 0 346 75"><path fill="#E17000" d="M0 0"/><path d="M1 1" fill="#000"/></svg>',
      }),
    )
    const frog = await loadIcon('dieren-kikker')
    expect(frog?.body).not.toContain('style=')
    expect(frog?.viewBox).toBe('0 0 48 48')
    const emblem = await loadIcon('embleem-marechaussee')
    expect(emblem?.body).toContain('fill="#E17000"')
    expect(emblem?.body).toContain('fill="currentColor"')
  })
})
