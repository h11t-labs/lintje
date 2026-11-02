/**
 * One SVG file → one drawable glyph; shared by `scripts/build-icons.mjs` and the run-time loader.
 * The body has no `style`, `<style>`, `<script>` or `on…` handler (CSP `style-src 'self'`). A fill
 * in the file is kept. Black becomes `currentColor` only in a raw export (root `fill="none"`,
 * only black paths) and in an emblem; elsewhere it can be a knocked-out mark. A drawing in one
 * colour, near-black or white, becomes `currentColor` too: RVO draws some in #1d1d1b or in white.
 */

/** Root attributes worth keeping: they make an outline icon an outline. */
export const KEEP = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']

const BLACK = /(fill|stroke)="(#000|#000000|black|#1d1d1b)"/gi
const COLOUR = /\s(?:fill|stroke)="(?!none")[^"]*"/
/** The inks of a one-colour drawing that follow the text: near-black and white. */
const INK = /^(#000|#000000|black|#1d1d1b|#fff|#ffffff|white)$/i
const SHAPES = new Set([
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'use',
])
/** What is not drawn where it stands: a clip, a mask, a pattern, a definition. */
const UNDRAWN = new Set([
  'defs',
  'clipPath',
  'mask',
  'pattern',
  'symbol',
  'marker',
  'filter',
  'linearGradient',
  'radialGradient',
])

export const isEmblem = (name) => name.startsWith('embleem-')

export const attributeOf = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`))?.[1]

/** `fill="none"` on the root and nothing but black inside; every path is filled explicitly. */
export function isRawExport(rootAttributes, body) {
  if (rootAttributes.fill !== 'none') return false
  return !COLOUR.test(body.replace(BLACK, ''))
}

/**
 * The one colour every drawn shape is painted in, own or from a group around it, when it is an
 * ink; else `undefined`. A shape that inherits the root's `currentColor` is a second colour, so a
 * black mark knocked into it stays.
 */
function singleInk(rootAttributes, body) {
  const paints = new Set()
  const stack = [
    {
      fill: rootAttributes.fill ?? 'currentColor',
      stroke: rootAttributes.stroke ?? 'none',
      undrawn: false,
    },
  ]
  for (const [, close, tag, rest, selfClosing] of body.matchAll(
    /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g,
  )) {
    if (close) {
      if (stack.length > 1) stack.pop()
      continue
    }
    const parent = stack[stack.length - 1]
    const own = {
      fill: attributeOf(` ${rest}`, 'fill') ?? parent.fill,
      stroke: attributeOf(` ${rest}`, 'stroke') ?? parent.stroke,
      undrawn: parent.undrawn || UNDRAWN.has(tag),
    }
    if (SHAPES.has(tag) && !own.undrawn) {
      for (const paint of [own.fill, own.stroke])
        if (paint !== 'none') paints.add(paint.toLowerCase())
    }
    if (!selfClosing) stack.push(own)
  }
  const [only] = paints
  return paints.size === 1 && INK.test(only) ? only : undefined
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

function rootAttributesOf(rootTag) {
  const attributes = {}
  for (const attribute of KEEP) {
    const value = attributeOf(rootTag, attribute)
    if (value !== undefined) attributes[attribute] = value
  }
  return attributes
}

/** The one ink of a drawing that is not an emblem, which keeps its colours. */
const inkOf = (name, attributes, body) => (isEmblem(name) ? undefined : singleInk(attributes, body))

const sameColour = (value, ink) => value.toLowerCase() === ink

export function normaliseRootAttributes(name, rootTag, rawBody) {
  const attributes = rootAttributesOf(rootTag)
  const body = strip(rawBody)
  const ink = inkOf(name, attributes, body)
  if (isRawExport(attributes, body)) delete attributes.fill
  for (const [attribute, value] of Object.entries(attributes)) {
    if (/^(#000|#000000|black|#1d1d1b)$/i.test(value) || (ink && sameColour(value, ink))) {
      attributes[attribute] = 'currentColor'
    }
  }
  return attributes
}

export function normaliseBody(name, rootTag, rawBody) {
  const body = strip(rawBody)
  const attributes = rootAttributesOf(rootTag)
  const ink = inkOf(name, attributes, body)
  if (ink) {
    return body.replace(/(fill|stroke)="([^"]*)"/g, (whole, attribute, value) =>
      sameColour(value, ink) ? `${attribute}="currentColor"` : whole,
    )
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
