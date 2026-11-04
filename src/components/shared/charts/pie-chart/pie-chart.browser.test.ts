/**
 * The legend table under a pie keeps its columns: the row header is a table cell, so the head and
 * the body share one grid. In Edge a `display: flex` on the `<th>` drifted the figures under the
 * wrong heading; headless Chromium aligns them either way, so the `table-cell` assertion is the
 * guard, not the measurement. A label that wraps indents under its first line, with the swatch on
 * that line. happy-dom lays nothing out.
 */
import { afterEach, describe, expect, it } from 'vitest'
import '../../../charts/chart/chart'
import type { ChartData } from '../../../../types'

type ChartElement = HTMLElement & {
  data: ChartData
  renderRoot: DocumentFragment | HTMLElement
  updateComplete: Promise<unknown>
}

async function mount(width?: string): Promise<ChartElement> {
  const element = document.createElement('lintje-chart') as ChartElement
  if (width) element.style.width = width
  element.data = {
    chart: {
      kind: 'pie',
      legendTable: true,
      labelHeader: 'status',
      segments: [
        { id: 'geldig', label: 'Geldig', value: 597 },
        { id: 'verlopen', label: 'Verlopen', value: 51 },
        { id: 'ingetrokken', label: 'Een lang etiket dat de kolom breed maakt', value: 3 },
      ],
    },
    description: 'De status van de documenten.',
  }
  document.body.append(element)
  await element.updateComplete
  return element
}

const right = (element: Element) => element.getBoundingClientRect().right

afterEach(() => {
  document.body.innerHTML = ''
})

describe('the legend table of a pie', () => {
  it('keeps every figure under its own heading', async () => {
    const element = await mount()
    const root = element.renderRoot
    const labels = [...root.querySelectorAll<HTMLElement>('th.lintje-pie-chart__label')]
    expect(labels.length).toBe(3)
    for (const label of labels) expect(getComputedStyle(label).display).toBe('table-cell')

    const headings = [
      ...root.querySelectorAll<HTMLElement>('.lintje-pie-chart__column-label--numeric'),
    ]
    expect(headings.length).toBe(2)
    for (const row of root.querySelectorAll('.lintje-pie-chart__row')) {
      const cells = [...row.querySelectorAll<HTMLElement>('.lintje-pie-chart__value')]
      expect(cells.length).toBe(2)
      cells.forEach((cell, n) =>
        expect(Math.abs(right(cell) - right(headings[n]))).toBeLessThan(1.5),
      )
    }
  })

  it('indents a wrapped label under its first line, the swatch on that line', async () => {
    const element = await mount('360px')
    const labels = [
      ...element.renderRoot.querySelectorAll<HTMLElement>('th.lintje-pie-chart__label'),
    ]
    const label = labels[2]
    const marker = label.querySelector<HTMLElement>('.lintje-pie-chart__marker')!
    // The rects of the words themselves, one per line; the span's own box would hide a centred swatch.
    const words = [...label.querySelector('.lintje-pie-chart__label-inner')!.childNodes].find(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim(),
    )!
    const range = document.createRange()
    range.selectNodeContents(words)
    const lines = [...range.getClientRects()].filter((rect) => rect.width > 0)
    expect(lines.length).toBeGreaterThan(1)
    const first = lines[0]
    const swatch = marker.getBoundingClientRect()
    expect(swatch.width).toBeGreaterThan(0)
    expect(swatch.top).toBeGreaterThanOrEqual(first.top)
    expect(swatch.bottom).toBeLessThanOrEqual(first.bottom)
    for (const line of lines.slice(1)) expect(line.left).toBeGreaterThanOrEqual(swatch.right)
  })
})

describe('the legend table of a pie that drills', () => {
  it('opens a row as its slice does, from a link of at least 24 px', async () => {
    const element = document.createElement('lintje-chart') as ChartElement
    element.data = {
      chart: {
        kind: 'pie',
        legendTable: true,
        segments: [
          { id: 'noord', label: 'Noord', value: 12, href: '?regio=noord' },
          { id: 'zuid', label: 'Zuid', value: 1, href: '?regio=zuid' },
        ],
      },
      description: 'Aanvragen per regio.',
    }
    const picked: unknown[] = []
    element.addEventListener('lintje-mark-select', (event) => {
      event.preventDefault()
      picked.push((event as CustomEvent<{ id: string }>).detail.id)
    })
    document.body.append(element)
    await element.updateComplete
    const link = (): HTMLAnchorElement | null =>
      element.renderRoot.querySelectorAll<HTMLAnchorElement>('.lintje-pie-chart__row a')[1] ?? null
    await expect.poll(() => link()?.getClientRects().length ?? 0).toBeGreaterThan(0)
    expect(link()!.getAttribute('href')).toBe('?regio=zuid')
    expect(link()!.getBoundingClientRect().height).toBeGreaterThanOrEqual(24)
    link()!.click()
    expect(picked).toEqual(['zuid'])
  })
})
