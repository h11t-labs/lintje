/**
 * The downloads a tile offers: the numbers as CSV (semicolons, decimal comma and a byte order
 * mark, so a Dutch spreadsheet opens columns) and the chart's `<svg>` as PNG.
 * A missing value is an empty cell, never 0 (rule 15).
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

/** The chart's `<svg>` as a PNG, twice its size. The web font is not embedded: the system face. */
export async function downloadPng(filename: string, svg: SVGSVGElement): Promise<void> {
  const name = filename.toLowerCase().endsWith('.png') ? filename : `${filename}.png`
  const box = svg.getBoundingClientRect()
  const width = Math.max(1, Math.round(box.width))
  const height = Math.max(1, Math.round(box.height))

  const copy = svg.cloneNode(true) as SVGSVGElement
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  copy.setAttribute('width', String(width))
  copy.setAttribute('height', String(height))
  inlinePaint(svg, copy)

  // The page's background, so dark mode is not black text on transparent.
  const background = surfaceColour(svg)

  const source = new XMLSerializer().serializeToString(copy)
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
  if (!context) return
  if (background) {
    context.fillStyle = background
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (blob) save(blob, name)
}
