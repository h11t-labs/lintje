/**
 * One SVG file → one drawable glyph; shared by `scripts/build-icons.mjs` and the run-time loader.
 * The body has no `style`, `<style>`, `<script>` or `on…` handler (CSP `style-src 'self'`). A fill
 * in the file is kept. Black becomes `currentColor` only in a raw export (root `fill="none"`,
 * only black paths) and in an emblem; elsewhere it can be a knocked-out mark.
 */

/** Root attributes worth keeping: they make an outline icon an outline. */
export const KEEP = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']

const BLACK = /(fill|stroke)="(#000|#000000|black)"/g
const COLOUR = /\s(?:fill|stroke)="(?!none")[^"]*"/

export const isEmblem = (name) => name.startsWith('embleem-')

export const attributeOf = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`))?.[1]

/** `fill="none"` on the root and nothing but black inside; every path is filled explicitly. */
export function isRawExport(rootAttributes, body) {
  if (rootAttributes.fill !== 'none') return false
  return !COLOUR.test(body.replace(BLACK, ''))
}

function strip(body) {
  return body
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style)\b[^>]*\/>/gi, '')
    .replace(/\sstyle\s*=\s*"[^"]*"/gi, '')
    .replace(/\sstyle\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normaliseRootAttributes(name, rootTag, rawBody) {
  const attributes = {}
  for (const attribute of KEEP) {
    const value = attributeOf(rootTag, attribute)
    if (value !== undefined) attributes[attribute] = value
  }
  if (isRawExport(attributes, strip(rawBody))) delete attributes.fill
  for (const [attribute, value] of Object.entries(attributes)) {
    if (/^(#000|#000000|black)$/.test(value)) attributes[attribute] = 'currentColor'
  }
  return attributes
}

export function normaliseBody(name, rootTag, rawBody) {
  const body = strip(rawBody)
  const attributes = {}
  for (const attribute of KEEP) {
    const value = attributeOf(rootTag, attribute)
    if (value !== undefined) attributes[attribute] = value
  }
  const recolour = isEmblem(name) || isRawExport(attributes, body)
  return recolour ? body.replace(BLACK, '$1="currentColor"') : body
}

/** A root without a viewBox draws in its width and height (RVO's 48), else in 24. */
function sizeBox(rootTag) {
  const width = attributeOf(rootTag, 'width')
  const height = attributeOf(rootTag, 'height')
  return width && height ? `0 0 ${parseFloat(width)} ${parseFloat(height)}` : '0 0 24 24'
}

/** One SVG file's text → `{ viewBox, attributes, body }`. */
export function normaliseSvg(name, svg) {
  const open = svg.indexOf('<svg')
  const close = svg.indexOf('>', open)
  const rootTag = svg.slice(open, close + 1)
  const rawBody = svg.slice(close + 1, svg.lastIndexOf('</svg>'))
  return {
    viewBox: attributeOf(rootTag, 'viewBox') ?? sizeBox(rootTag),
    attributes: normaliseRootAttributes(name, rootTag, rawBody),
    body: normaliseBody(name, rootTag, rawBody),
  }
}
