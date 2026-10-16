/**
 * The legend table under a pie keeps its columns: the row header is a table cell with the swatch
 * inline, so the head and the body share one grid. In Chromium a `display: flex` on the `<th>`
 * drifted the figures under the wrong heading. happy-dom lays nothing out.
 */
import { afterEach, describe, expect, it } from 'vitest'
import '../../../charts/chart/chart'
import type { ChartData } from '../../../../types'

type ChartElement = HTMLElement & {
  data: ChartData
  renderRoot: DocumentFragment | HTMLElement
  updateComplete: Promise<unknown>
}

async function mount(): Promise<ChartElement> {
  const element = document.createElement('lintje-chart') as ChartElement
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

  it('draws the swatch on the line of its words', async () => {
    const element = await mount()
    const label = element.renderRoot.querySelector<HTMLElement>('th.lintje-pie-chart__label')!
    const marker = label.querySelector<HTMLElement>('.lintje-pie-chart__marker')!
    const words = label.getBoundingClientRect()
    const swatch = marker.getBoundingClientRect()
    expect(swatch.width).toBeGreaterThan(0)
    expect(swatch.top).toBeGreaterThanOrEqual(words.top)
    expect(swatch.bottom).toBeLessThanOrEqual(words.bottom)
    expect(swatch.left).toBeLessThan(words.left + 20)
  })
})
