/**
 * One icon, fetched the first time a name needs it. The bundle carries only the chrome
 * (`register.ts`); any other name is fetched once from `source.base` and the icons waiting for it
 * redraw. The store remembers glyphs, requests in flight and names answered 404 (drawn as nothing,
 * one console line).
 */
import { normaliseSvg } from './normalise.mjs'
import type { IconGlyph } from './register'

/** Where a single icon is fetched from, and under which build. */
export interface IconSource {
  base: string
  /** The build id, appended as `?b=…` so a hard cache follows a release. */
  version?: string
}

const glyphs = new Map<string, IconGlyph>()
const missing = new Set<string>()
const inflight = new Map<string, Promise<void>>()
const listeners = new Set<(name?: string) => void>()

let source: IconSource = { base: '/icons/' }

/** Where the loader fetches names it lacks; `base` is the folder `dist-icons/` is served from. */
export function setIconSource(next: IconSource): void {
  const previous = source
  source = { ...next, base: next.base.endsWith('/') ? next.base : `${next.base}/` }
  // A tag that drew before this call asked the old source; its 404s are retried at the new one.
  if (source.base === previous.base && source.version === previous.version) return
  if (!missing.size) return
  missing.clear()
  notify()
}

export function iconSource(): IconSource {
  return source
}

export function loadedIcon(name: string | undefined): IconGlyph | undefined {
  return name ? glyphs.get(name) : undefined
}

export function iconIsMissing(name: string | undefined): boolean {
  return name ? missing.has(name) : false
}

export function loadedIconNames(): string[] {
  return [...glyphs.keys()]
}

/** Puts glyphs in the store directly (a host that has them; tests). Notifies once per batch. */
export function putIcons(entries: Iterable<[string, IconGlyph]>): void {
  let added = false
  for (const [name, glyph] of entries) {
    glyphs.set(name, glyph)
    missing.delete(name)
    added = true
  }
  if (added) notify()
}

/**
 * Called whenever a glyph arrives or a name turns out not to exist. The callback gets the name
 * when the change was about one, nothing for a batch (`putIcons`), so a listener can ignore others.
 */
export function onIconChange(redraw: (name?: string) => void): () => void {
  listeners.add(redraw)
  return () => listeners.delete(redraw)
}

function notify(name?: string): void {
  for (const redraw of listeners) redraw(name)
}

/** Asks for one icon and returns at once; icons waiting for the name redraw when it lands. */
export function requestIcon(name: string | undefined): void {
  if (!name || glyphs.has(name) || missing.has(name) || inflight.has(name)) return
  if (typeof fetch !== 'function') return
  const asked = source
  const url = `${asked.base}${encodeURIComponent(name)}.svg${asked.version ? `?b=${asked.version}` : ''}`
  const work = fetch(url)
    .then(async (response) => {
      if (!response.ok) throw new Error(`${response.status}`)
      const glyph = normaliseSvg(name, await response.text())
      if (!glyph.body) throw new Error('empty')
      glyphs.set(name, glyph)
    })
    .catch(() => {
      // A miss at a source since replaced is not a miss: the redraw below asks the new one.
      if (asked === source) missing.add(name)
    })
    .finally(() => {
      inflight.delete(name)
      notify(name)
    })
  inflight.set(name, work)
}

/** Resolves with the glyph, or `undefined` when the name has no file. */
export async function loadIcon(name: string): Promise<IconGlyph | undefined> {
  requestIcon(name)
  await inflight.get(name)
  return glyphs.get(name)
}

export function resetIcons(): void {
  glyphs.clear()
  missing.clear()
  inflight.clear()
}
