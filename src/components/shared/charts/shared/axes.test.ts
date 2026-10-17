import { describe, expect, it } from 'vitest'
import { render, svg } from 'lit'
import { renderAsOfMarker, renderLegend, thinLabels, type LegendItem } from './axes'
import { DEFAULT_PLOT_AREA } from './scale'

// Without a canvas a character measures 6.5 px, so "wo 2 sep" is 52 px.
const days = ['wo 2 sep', 'do 3 sep', 'vr 4 sep', 'za 5 sep', 'zo 6 sep', 'ma 7 sep', 'di 8 sep']
const at = (slot: number) => days.map((label, i) => ({ label, x: 40 + i * slot }))

describe('thinLabels', () => {
  it('keeps every label when the widest fits its slot', () => {
    expect(thinLabels(at(80))).toHaveLength(7)
  })

  it('keeps every second label, from the first on, when neighbours would touch', () => {
    expect(thinLabels(at(38)).map((label) => label.label)).toEqual([
      'wo 2 sep',
      'vr 4 sep',
      'zo 6 sep',
      'di 8 sep',
    ])
  })

  it('keeps a long name beside a short one when the pair has room', () => {
    // 19 characters ≈ 118 px: wider than the 93 px slot, but not into its 9-character neighbour.
    const names = [
      'Loket Utrecht A',
      'Loket Utrecht B',
      'Loket Utrecht C',
      'Eindhoven',
      'Rotterdam The Hague',
    ]
    expect(thinLabels(names.map((label, i) => ({ label, x: 60 + i * 110 })))).toHaveLength(5)
  })

  it('leaves a single label alone', () => {
    expect(thinLabels(at(10).slice(0, 1))).toHaveLength(1)
  })

  it('measures a label where its anchor puts it', () => {
    // "0" is 6.5 px and "30.000" 39 px: centred they clear each other, but a last label that
    // ends at its tick reaches back into the first.
    const ticks = (anchor?: 'end') => [
      { label: '0', x: 0 },
      { label: '30.000', x: 40, anchor },
    ]
    expect(thinLabels(ticks())).toHaveLength(2)
    expect(thinLabels(ticks('end'))).toHaveLength(1)
  })
})

describe('the legend', () => {
  const host = (items: LegendItem[], onToggle?: (key: string) => void) => {
    const element = document.createElement('div')
    render(renderLegend({ items, onToggle }), element)
    return element
  }

  it('switches every item but a fixed one, a reference too', () => {
    const element = host(
      [
        { label: 'Aanvragen' },
        { label: 'Norm', shape: 'dashed' },
        { label: 'geen gegevens', shape: 'hatch', fixed: true },
      ],
      () => {},
    )
    const buttons = [...element.querySelectorAll('.lintje-legend__button')]
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Aanvragen', 'Norm'])
  })

  it('edges the shape of a light colour in its dark edge, and not a dark one', () => {
    const element = host([
      {
        label: 'Licht',
        color: 'var(--color-chart-mint-green)',
        symbol: 'mint-green',
        shape: 'point',
      },
      { label: 'Donker', color: 'var(--color-chart-sky-blue)', symbol: 'sky-blue', shape: 'point' },
    ])
    const shapes = [...element.querySelectorAll('.lintje-legend__marker--symbol path')]
    expect(shapes.map((shape) => shape.getAttribute('stroke'))).toEqual([
      'var(--color-chart-mint-green-edge)',
      null,
    ])
  })
})

describe('the boundary of a forecast', () => {
  const area = { ...DEFAULT_PLOT_AREA, width: 600, top: 32 }
  const draw = (x: number) => {
    const host = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    render(svg`${renderAsOfMarker({ mode: 'forecast', area, x, label: 'Raming' })}`, host)
    return [...host.querySelectorAll('text')].map((text) => ({
      text: text.textContent,
      x: Number(text.getAttribute('x')),
      y: Number(text.getAttribute('y')),
      anchor: text.getAttribute('text-anchor'),
    }))
  }

  it('says "Gemeten" left of the line and the forecast right of it, above the plot', () => {
    const [measured, forecast] = draw(300)
    expect(measured).toMatchObject({ text: 'Gemeten', anchor: 'end' })
    expect(forecast).toMatchObject({ text: 'Raming', anchor: 'start' })
    expect(measured.x).toBeLessThan(300)
    expect(forecast.x).toBeGreaterThan(300)
    expect(measured.y).toBeLessThan(area.top)
  })

  it('ends the forecast word at the edge of the plot where it would run past it', () => {
    const [, forecast] = draw(580)
    expect(forecast).toMatchObject({ anchor: 'end', x: area.width - area.right })
  })
})
