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
    const range = document.createRange()
    range.selectNodeContents(label)
    const lines = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0)
    expect(lines.length).toBeGreaterThan(1)
    const first = lines[0]
    const swatch = marker.getBoundingClientRect()
    expect(swatch.width).toBeGreaterThan(0)
    expect(swatch.top).toBeGreaterThanOrEqual(first.top)
    expect(swatch.bottom).toBeLessThanOrEqual(first.bottom)
    for (const line of lines.slice(1)) expect(line.left).toBeGreaterThanOrEqual(swatch.right)
  })
})
