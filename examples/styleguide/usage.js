/**
 * Where an element stands in the example applications: each application's page and the scripts
 * it loads from its own folder, searched for the tag. Read in the browser, once, when a page asks,
 * so the list cannot go stale.
 */
import { APPS } from '../_shared/apps.js'

const BASE = new URL('../', import.meta.url)
const SCRIPT = /<script[^>]*\ssrc="([^"]+\.js)"/g

/** One file's lines, by its path under `examples/`; nothing when it cannot be read. */
async function linesOf(path) {
  try {
    const response = await fetch(new URL(path, BASE))
    return response.ok ? (await response.text()).split('\n') : []
  } catch {
    return []
  }
}

let sources
/** Every application with its files: the page and the scripts it names in its own folder. */
function load() {
  sources ??= Promise.all(
    APPS.map(async (app) => {
      const page = `${app.href}index.html`
      const lines = await linesOf(page)
      const scripts = [...lines.join('\n').matchAll(SCRIPT)]
        .map((match) => match[1])
        .filter((src) => !src.startsWith('.') && !src.includes('/'))
        .map((src) => `${app.href}${src}`)
      const files = [{ path: page, lines }]
      for (const path of scripts) files.push({ path, lines: await linesOf(path) })
      return { app, files }
    }),
  )
  return sources
}

/** The places a tag stands, per application: its file, line and that line's text. */
export async function usageOf(tag) {
  // An opening tag or the name in quotes (`createElement('…')`); a closing tag or a CSS rule is no place.
  const pattern = new RegExp(`(<|['"])${tag}(?![a-z-])`)
  return (await load())
    .map(({ app, files }) => ({
      app,
      places: files.flatMap(({ path, lines }) =>
        lines.flatMap((text, i) => (pattern.test(text) ? [{ path, line: i + 1, text: text.trim() }] : [])),
      ),
    }))
    .filter((entry) => entry.places.length)
}
