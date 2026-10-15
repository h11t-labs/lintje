/**
 * The downloads a tile offers: the numbers as CSV (semicolons, decimal comma and a byte order
 * mark, so a Dutch spreadsheet opens columns) and the image of a chart as PNG.
 * A missing value is an empty cell, never 0 (rule 15).
 *
 * The image is what the chart shows on screen without its controls, composed as one `<svg>`
 * (`chartImage`) before it becomes a PNG. Every part is drawn where the screen has it, in plain
 * SVG: HTML in a `<foreignObject>` does not reliably reach a canvas, in WebKit least of all.
 */

export type CsvCell = string | number | null | undefined

function csvCell(value: CsvCell): string {
  if (value == null) return ''
  const text = typeof value === 'number' ? String(value).replace('.', ',') : value
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows: CsvCell[][]): string {
  return rows.map((row) => row.map(csvCell).join(';')).join('\r\n')
}

function save(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Any other text, as a file of its own type (`text/plain`, `application/json`). */
export function downloadText(name: string, text: string, type: string): void {
  save(new Blob([text], { type: `${type};charset=utf-8` }), name)
}

export function downloadCsv(filename: string, rows: CsvCell[][]): void {
  const name = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`
  save(new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8' }), name)
}

/** A serialised `<svg>` has no stylesheet or custom properties: the computed paint is inlined. */
const PAINT = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'visibility',
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
  'letter-spacing',
] as const

function inlinePaint(source: Element, copy: Element): void {
  const computed = getComputedStyle(source)
  const style = (copy as SVGElement).style
  for (const property of PAINT) style.setProperty(property, computed.getPropertyValue(property))
  const sourceChildren = source.children
  const copyChildren = copy.children
  for (let i = 0; i < sourceChildren.length; i += 1) {
    const child = copyChildren[i]
    if (child) inlinePaint(sourceChildren[i], child)
  }
}

/** The surface a PNG is drawn on; an empty string leaves the PNG transparent. */
export function surfaceColour(svg: Element): string {
  const token = (element: Element): string =>
    getComputedStyle(element).getPropertyValue('--color-bg-surface').trim()
  return token(svg) || token(document.documentElement)
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Controls and what only a pointer or a screen reader meets; a legend button draws as its content. */
const CONTROL = '.lintje-chart-tooltip, .visually-hidden, [role="status"]'

/** In a drawing: the hover's marks, the pointer's targets, and what the legend switched off. */
const DRAWING_CONTROL = [
  '.lintje-chart__hover-point',
  '.lintje-chart__hover-casing',
  '.lintje-chart__hit',
  '.lintje-chart__bar--lifted',
  '.lintje-pie-chart__lift',
  '.lintje-radar__lift',
  '.lintje-chart__series.is-off',
  '.lintje-chart__point.is-off',
].join(', ')

type Attributes = Record<string, string | number>

function create(name: string, attributes: Attributes, parent: Element): SVGElement {
  const element = document.createElementNS(SVG_NS, name)
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value))
  parent.append(element)
  return element
}

function transparent(colour: string): boolean {
  return colour === '' || colour === 'transparent' || /[,/]\s*0\)$/.test(colour)
}

/** What the image is measured from, the chart's top left corner, and how far its paint reaches. */
interface Origin {
  left: number
  top: number
  reach: { left: number; top: number; right: number; bottom: number }
}

const SIDES = ['top', 'right', 'bottom', 'left'] as const

/** A box's fill, its borders and an outline that marks a choice; a focus ring is no part of it. */
function paintBox(
  element: Element,
  style: CSSStyleDeclaration,
  origin: Origin,
  out: Element,
): void {
  // A button and a row under the pointer have a state of their own, not one the reader chose.
  if (element.localName === 'button' || element.classList.contains('is-hovered')) return
  const box = element.getBoundingClientRect()
  const x = box.left - origin.left
  const y = box.top - origin.top
  const { width, height } = box
  if (!transparent(style.backgroundColor)) {
    create('rect', { x, y, width, height, fill: style.backgroundColor }, out)
  }
  for (const side of SIDES) {
    const weight = parseFloat(style.getPropertyValue(`border-${side}-width`))
    const kind = style.getPropertyValue(`border-${side}-style`)
    if (!weight || kind === 'none' || kind === 'hidden') continue
    const half = weight / 2
    const [x1, y1, x2, y2] = {
      top: [x, y + half, x + width, y + half],
      right: [x + width - half, y, x + width - half, y + height],
      bottom: [x, y + height - half, x + width, y + height - half],
      left: [x + half, y, x + half, y + height],
    }[side]
    const dashed = kind === 'dashed' || kind === 'dotted'
    create(
      'line',
      {
        x1,
        y1,
        x2,
        y2,
        stroke: style.getPropertyValue(`border-${side}-color`),
        'stroke-width': weight,
        ...(dashed ? { 'stroke-dasharray': `${2 * weight} ${weight}` } : {}),
      },
      out,
    )
  }
  const outline = parseFloat(style.outlineWidth)
  if (outline && style.outlineStyle !== 'none' && !element.matches(':focus')) {
    const grow = (parseFloat(style.outlineOffset) || 0) + outline / 2
    create(
      'rect',
      {
        x: x - grow,
        y: y - grow,
        width: width + 2 * grow,
        height: height + 2 * grow,
        fill: 'none',
        stroke: style.outlineColor,
        'stroke-width': outline,
      },
      out,
    )
  }
}

/**
 * A text node as a `<text>` per line it takes on screen: its words are measured one by one, so a
 * label that wraps wraps in the image too. A line keeps its width on screen: the image is set in
 * the system face (the web font is not embedded), and its neighbours must not run into it.
 */
function paintText(
  node: Text,
  style: CSSStyleDeclaration,
  struck: boolean,
  origin: Origin,
  out: Element,
): void {
  const range = document.createRange()
  const lines: { words: string[]; left: number; right: number; top: number; bottom: number }[] = []
  for (const word of node.data.matchAll(/\S+/g)) {
    range.setStart(node, word.index)
    range.setEnd(node, word.index + word[0].length)
    const { left, right, top, bottom, width, height } = range.getBoundingClientRect()
    if (!width) continue
    const line = lines[lines.length - 1]
    if (line && Math.abs(top - line.top) < height / 2) {
      line.words.push(word[0])
      line.right = right
      line.bottom = Math.max(line.bottom, bottom)
    } else {
      lines.push({ words: [word[0]], left, right, top, bottom })
    }
  }
  for (const line of lines) {
    const words = line.words.join(' ')
    const text = create(
      'text',
      {
        x: line.left - origin.left,
        y: (line.top + line.bottom) / 2 - origin.top,
        'dominant-baseline': 'central',
        textLength: line.right - line.left,
        lengthAdjust: 'spacingAndGlyphs',
        fill: style.color,
        'font-family': style.fontFamily,
        'font-size': style.fontSize,
        'font-weight': style.fontWeight,
        ...(struck ? { 'text-decoration': 'line-through' } : {}),
      },
      out,
    )
    // SVG text has no text-transform of its own in every engine.
    text.textContent =
      style.textTransform === 'uppercase'
        ? words.toUpperCase()
        : style.textTransform === 'lowercase'
          ? words.toLowerCase()
          : words
  }
}

/** A drawing as it stands, its paint inlined, without what only the pointer brings up. */
function paintDrawing(drawing: SVGSVGElement, origin: Origin, out: Element): void {
  const box = drawing.getBoundingClientRect()
  const x = box.left - origin.left
  const y = box.top - origin.top
  const overflow = getComputedStyle(drawing).overflow
  const copy = drawing.cloneNode(true) as SVGSVGElement
  // First: the paint is copied child by child, by position.
  inlinePaint(drawing, copy)
  for (const control of copy.querySelectorAll(DRAWING_CONTROL)) control.remove()
  copy.setAttribute('x', String(x))
  copy.setAttribute('y', String(y))
  copy.setAttribute('width', String(box.width))
  copy.setAttribute('height', String(box.height))
  copy.setAttribute('overflow', overflow)
  out.append(copy)
  // A last x label may stand past the drawing's edge, as it does on screen.
  if (overflow !== 'visible') return
  const { reach } = origin
  for (const text of drawing.querySelectorAll('text')) {
    if (text.closest(DRAWING_CONTROL)) continue
    const bounds = text.getBoundingClientRect()
    reach.left = Math.min(reach.left, bounds.left - origin.left)
    reach.top = Math.min(reach.top, bounds.top - origin.top)
    reach.right = Math.max(reach.right, bounds.right - origin.left)
    reach.bottom = Math.max(reach.bottom, bounds.bottom - origin.top)
  }
}

function paint(element: Element, origin: Origin, struck: boolean, out: Element): void {
  if (element.matches(CONTROL)) return
  if (element instanceof SVGSVGElement) {
    if (element.getClientRects().length) paintDrawing(element, origin, out)
    return
  }
  const style = getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden') return
  const group = style.opacity === '1' ? out : create('g', { opacity: style.opacity }, out)
  paintBox(element, style, origin, group)
  const strike = struck || style.textDecorationLine.includes('line-through')
  for (const child of element.childNodes) {
    if (child instanceof Text) paintText(child, style, strike, origin, group)
    else if (child instanceof Element) paint(child, origin, strike, group)
  }
}

/**
 * The chart in `root` as one `<svg>` as wide as it is on screen, on the surface of the mode the
 * reader looks in: legend, axis titles, drawing, events and legend table where they stand.
 */
export function chartImage(root: Element): SVGSVGElement {
  const box = root.getBoundingClientRect()
  const reach = { left: 0, top: 0, right: box.width, bottom: box.height }
  const image = document.createElementNS(SVG_NS, 'svg')
  paint(root, { left: box.left, top: box.top, reach }, false, image)
  const left = Math.floor(reach.left)
  const top = Math.floor(reach.top)
  const width = Math.max(1, Math.ceil(reach.right) - left)
  const height = Math.max(1, Math.ceil(reach.bottom) - top)
  image.setAttribute('xmlns', SVG_NS)
  image.setAttribute('width', String(width))
  image.setAttribute('height', String(height))
  image.setAttribute('viewBox', `${left} ${top} ${width} ${height}`)
  const surface = surfaceColour(root)
  if (surface)
    image.prepend(create('rect', { x: left, y: top, width, height, fill: surface }, image))
  return image
}

/** An `<svg>` with its own `width`, `height` and surface (`chartImage`) as a PNG, twice its size. */
async function pngOf(svg: SVGSVGElement): Promise<Blob | null> {
  const width = Math.max(1, Number(svg.getAttribute('width')))
  const height = Math.max(1, Number(svg.getAttribute('height')))
  const source = new XMLSerializer().serializeToString(svg)
  const image = new Image()
  image.decoding = 'sync'
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('svg'))
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`
  })

  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const context = canvas.getContext('2d')
  if (!context) return null
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
}

/**
 * An image of `chartImage` as a PNG. A drawing still on the page is made one first, alone. The
 * web font is not embedded: the image is set in the system face.
 */
export async function downloadPng(filename: string, svg: SVGSVGElement): Promise<void> {
  const name = filename.toLowerCase().endsWith('.png') ? filename : `${filename}.png`
  const blob = await pngOf(svg.isConnected ? chartImage(svg) : svg)
  if (blob) save(blob, name)
}
