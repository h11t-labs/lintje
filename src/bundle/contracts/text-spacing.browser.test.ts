/**
 * The reader's own text spacing and default font (WCAG 1.4.12, 1.4.4): with line height 1.5,
 * paragraph spacing 2 em, letter spacing 0.12 em and word spacing 0.16 em, no text is cut off and
 * none lies over other text. A style sheet in the document does not reach a shadow root, so the
 * spacing is adopted in every root, as a reader's own sheet reaches every element.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import '../../components/charts/chart/chart'
import '../../components/content/log-viewer/log-viewer'
import '../../components/forms/stepper/stepper'
import '../../components/frame/shell/shell'
import '../../components/inputs/time-input/time-input'
import '../../components/tables/sortable-list/sortable-list'
import type { ChartData, ChartSpec } from '../../types'

const SPACING = new CSSStyleSheet()
SPACING.replaceSync(`
  * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
  p { margin-bottom: 2em !important; }
`)

/** The spacing in `root` and in every open shadow root under it, once. */
function space(root: Document | ShadowRoot = document): void {
  if (!root.adoptedStyleSheets.includes(SPACING)) {
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, SPACING]
  }
  for (const element of root.querySelectorAll('*')) {
    if (element.shadowRoot) space(element.shadowRoot)
  }
}

interface Row {
  name: string
  /** The element with its data, not yet on the page, and the block it stands in. */
  create: () => { element: HTMLElement; room?: HTMLElement }
  /**
   * The spacing is there before the element first draws, as a reader's own style sheet is: what
   * the element measures as it draws takes it in. Otherwise it comes after, as a bookmarklet's.
   */
  early?: boolean
  /** Waits for the element's own layout before the faults are read. */
  settle?: (element: HTMLElement, room: HTMLElement) => Promise<void>
  /** What is cut off or lies over other text; empty while the text stays whole. */
  faults: (element: HTMLElement) => string[]
}

/* Helpers ----------------------------------------------------------------- */

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))

/** A block on the page for an element to sit in. */
function room(width: number): HTMLElement {
  const block = document.createElement('div')
  block.style.width = `${width}px`
  return block
}

/** Every match under a root, through each open shadow root. */
function all(root: ParentNode, selector: string, found: Element[] = []): Element[] {
  for (const element of root.querySelectorAll('*')) {
    if (element.matches(selector)) found.push(element)
    if (element.shadowRoot) all(element.shadowRoot, selector, found)
  }
  return found
}

const box = (element: Element): DOMRect => element.getBoundingClientRect()

const cut = (text: Element): boolean => text.scrollWidth > text.clientWidth

/** Within `outer`, to half a pixel; `sides` picks which edges count. */
function within(element: Element, outer: Element, sides: 'x' | 'y' | 'xy' = 'xy'): boolean {
  const a = box(element)
  const b = box(outer)
  const x = a.left >= b.left - 0.5 && a.right <= b.right + 0.5
  const y = a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5
  return sides === 'x' ? x : sides === 'y' ? y : x && y
}

/** Texts side by side that touch or cross, by the text of the first. */
function overlapping(texts: Element[]): string[] {
  const sorted = [...texts].sort((a, b) => box(a).left - box(b).left)
  return sorted.flatMap((text, i) => {
    const next = sorted[i + 1]
    return next && box(text).right > box(next).left + 0.5 ? [text.textContent!.trim()] : []
  })
}

/** Waits for a chart to draw inside its room: its first drawing is at a default width. */
async function drawn(element: HTMLElement, block: HTMLElement): Promise<void> {
  await expect
    .poll(() => all(element.shadowRoot!, '.lintje-chart__svg')[0]?.getBoundingClientRect().width)
    .toBeLessThanOrEqual(block.clientWidth)
  await frame()
}

function chart(spec: ChartSpec, width: number): () => { element: HTMLElement; room: HTMLElement } {
  return () => {
    const data: ChartData = {
      title: 'Aanvragen',
      description: 'Aanvragen van een fictieve dienst.',
      state: 'ready',
      chart: spec,
    }
    return {
      element: Object.assign(document.createElement('lintje-chart'), { data }),
      room: room(width),
    }
  }
}

const MONTHS = [
  'januari',
  'februari',
  'maart',
  'april',
  'mei',
  'juni',
  'juli',
  'augustus',
  'september',
  'oktober',
  'november',
  'december',
].map((month) => `${month} 2026`)

/** Makes the room of a stepper as wide as its row needs, lines at their least. */
async function fitStepper(element: HTMLElement, block: HTMLElement): Promise<void> {
  const list = all(element.shadowRoot!, '.lintje-stepper__list')[0] as HTMLElement
  let slack = 0
  for (const line of all(list, '.lintje-stepper__line') as HTMLElement[]) {
    slack += line.offsetWidth - (parseFloat(getComputedStyle(line).minWidth) || 0)
  }
  block.style.width = `${Math.ceil(list.scrollWidth - slack) + 2}px`
  await frame()
  await frame()
  expect(list.classList.contains('lintje-stepper__list--row'), 'a row without the spacing').toBe(
    true,
  )
  expect(within(list.lastElementChild!, list, 'x'), 'whole without the spacing').toBe(true)
}

/* Rows -------------------------------------------------------------------- */

const ROWS: Row[] = [
  {
    name: 'lintje-sortable-list :: a row with a checkbox',
    create: () => ({
      element: Object.assign(document.createElement('lintje-sortable-list'), {
        label: 'Kolommen',
        checkable: true,
        items: [
          { id: 'a', label: 'Datum van de laatste wijziging door de behandelaar', checked: true },
          { id: 'b', label: 'Loket', checked: true },
          { id: 'c', label: 'Status van de aanvraag bij het loket', checked: false },
        ],
      }),
      room: room(280),
    }),
    faults: (element) => {
      const rows = all(element.shadowRoot!, '.lintje-sortable-list__row')
      return rows.flatMap((row, i) => {
        const label = all(row, '.lintje-choice__label')[0]!
        const next = rows[i + 1]
        return [
          ...(within(label, row, 'y') ? [] : [`label ${i + 1} outside its row`]),
          ...(next && box(row).bottom > box(next).top + 0.5 ? [`row ${i + 1} over the next`] : []),
        ]
      })
    },
  },
  {
    name: 'lintje-shell :: group heading in the open side menu',
    create: () => ({
      element: Object.assign(document.createElement('lintje-shell'), {
        data: {
          name: 'Vergunningen',
          layout: 'side',
          menu: 'pinned',
          navigation: [
            { label: 'Overzicht', href: '#overzicht', icon: 'functioneel-home' },
            {
              label: 'Instellingen van de organisatie',
              links: [{ label: 'Gebruikers', href: '#gebruikers', icon: 'functioneel-document' }],
            },
          ],
        },
      }),
    }),
    faults: (element) => {
      const nav = all(element.shadowRoot!, '.lintje-nav')[0]!
      return all(nav, '.lintje-nav__section-label').flatMap((label) =>
        cut(label) || !within(label, nav, 'x') ? [label.textContent!.trim()] : [],
      )
    },
  },
  {
    name: 'lintje-log-viewer :: source of a line',
    create: () => ({
      element: Object.assign(document.createElement('lintje-log-viewer'), {
        data: {
          title: 'Importlog',
          entries: [
            {
              id: 'a',
              time: '14:03:27.118',
              level: 'info',
              source: 'scheduler',
              message: 'Import gestart',
            },
          ],
        },
      }),
      room: room(900),
    }),
    faults: (element) =>
      all(element.shadowRoot!, '.lintje-log-viewer__source').flatMap((source) =>
        cut(source) ? [source.textContent!.trim()] : [],
      ),
  },
  {
    name: 'lintje-chart :: axes of a line chart',
    early: true,
    settle: drawn,
    create: chart(
      {
        kind: 'line',
        labels: MONTHS,
        unit: 'aanvragen',
        series: [
          {
            label: 'Aanvragen',
            values: [
              1_180_000, 1_204_000, 1_236_000, 1_198_000, 1_250_000, 1_221_000, 1_174_000,
              1_163_000, 1_241_000, 1_247_000, 1_212_000, 1_189_000,
            ],
          },
        ],
      },
      640,
    ),
    faults: (element) => {
      const svg = all(element.shadowRoot!, '.lintje-chart__svg')[0]!
      const x = [...svg.querySelectorAll(':scope > text.lintje-chart__axis-label')]
      const y = [...svg.querySelectorAll(':scope > g > text.lintje-chart__axis-label')]
      return [
        ...overlapping(x).map((label) => `x label "${label}" over the next`),
        ...y
          .filter((label) => !within(label, svg, 'x'))
          .map((label) => `y label "${label.textContent!.trim()}" outside the chart`),
      ]
    },
  },
  {
    name: 'lintje-chart :: names of a sankey',
    early: true,
    settle: drawn,
    create: chart(
      {
        kind: 'sankey',
        label: 'Aanvragen',
        steps: [
          { label: 'Ingediend', nodes: [{ id: 'in', label: 'Aanvragen' }] },
          {
            label: 'Volledigheid',
            nodes: [
              { id: 'compleet', label: 'Compleet' },
              { id: 'onvolledig', label: 'Onvolledig' },
            ],
          },
          {
            label: 'Uitkomst',
            nodes: [
              { id: 'toegekend', label: 'Toegekend' },
              { id: 'afgewezen', label: 'Afgewezen' },
              { id: 'ingetrokken', label: 'Ingetrokken' },
            ],
          },
        ],
        flows: [
          { from: 'in', to: 'compleet', value: 7400 },
          { from: 'in', to: 'onvolledig', value: 2600 },
          { from: 'compleet', to: 'toegekend', value: 5200 },
          { from: 'compleet', to: 'afgewezen', value: 1300 },
          { from: 'compleet', to: 'ingetrokken', value: 900 },
          { from: 'onvolledig', to: 'afgewezen', value: 700 },
          { from: 'onvolledig', to: 'ingetrokken', value: 1300 },
        ],
      },
      560,
    ),
    faults: (element) => {
      const svg = all(element.shadowRoot!, '.lintje-chart__svg')[0]!
      return [...svg.querySelectorAll('.lintje-sankey__label text')]
        .filter((text) => !within(text, svg, 'x'))
        .map((text) => `"${text.textContent!.trim()}" outside the drawing`)
    },
  },
  {
    name: 'lintje-chart :: labels in a treemap',
    early: true,
    settle: drawn,
    create: chart(
      {
        kind: 'treemap',
        label: 'Uitgaven',
        unit: 'mld euro',
        parts: [
          { label: 'Sociale zekerheid', value: 110.7 },
          { label: 'Zorg', value: 98.4 },
          { label: 'Onderwijs', value: 48.6 },
          { label: 'Gemeenten', value: 38.2 },
          { label: 'Economie', value: 22.3 },
          { label: 'Infrastructuur', value: 16.9 },
          { label: 'Klimaat', value: 12.5 },
          { label: 'Wonen', value: 10.3 },
        ],
      },
      560,
    ),
    faults: (element) => {
      const areas = all(element.shadowRoot!, '.lintje-treemap__group .lintje-treemap__area')
      const labels = all(element.shadowRoot!, '.lintje-treemap__labels .lintje-treemap__label')
      return labels.flatMap((label) => {
        const x = Number(label.getAttribute('x'))
        const y = Number(label.getAttribute('y'))
        const area = areas.find((rect) => {
          const left = Number(rect.getAttribute('x'))
          const top = Number(rect.getAttribute('y'))
          const right = left + Number(rect.getAttribute('width'))
          const bottom = top + Number(rect.getAttribute('height'))
          return x >= left && x < right && y > top && y <= bottom
        })
        return area && within(label, area) ? [] : [`"${label.textContent!.trim()}" over its edge`]
      })
    },
  },
  {
    name: 'lintje-stepper :: the last step',
    create: () => ({
      element: Object.assign(document.createElement('lintje-stepper'), {
        label: 'Stappen van de aanvraag',
        steps: [
          { label: 'Gegevens', state: 'done' },
          { label: 'Bijlagen toevoegen', state: 'current' },
          { label: 'Controleren', state: 'next' },
          { label: 'Versturen', state: 'next' },
        ],
      }),
      room: room(1200),
    }),
    // Just wide enough for the row: the spacing then makes the labels wider, not the element.
    settle: fitStepper,
    faults: (element) => {
      const list = all(element.shadowRoot!, '.lintje-stepper__list')[0]!
      const last = list.lastElementChild!
      return list.classList.contains('lintje-stepper__list--row') && !within(last, list, 'x')
        ? ['the last step cut off']
        : []
    },
  },
]

/* The contract ------------------------------------------------------------ */

beforeAll(async () => {
  document.documentElement.lang = 'nl'
  document.body.style.margin = '0'
  // The side menu stands pinned open from 1440 px.
  await page.viewport(1440, 900)
  // WebKit resizes the frame after `viewport()` resolves.
  while (window.innerWidth !== 1440) await frame()
  // A chart measures its labels in the font as loaded; before that, in the fallback.
  await Promise.all(
    ['400 12px RijksSans', '700 12px RijksSans'].map((font) => document.fonts.load(font)),
  )
})

afterEach(() => {
  document.adoptedStyleSheets = document.adoptedStyleSheets.filter((sheet) => sheet !== SPACING)
  document.documentElement.style.fontSize = ''
  document.body.replaceChildren()
})

describe('text with the reader’s spacing', () => {
  for (const row of ROWS) {
    it(row.name, async () => {
      const { element, room: block = document.body } = row.create()
      if (block !== document.body) document.body.append(block)
      block.append(element)
      if (row.early) space()
      await (element as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete
      await frame()
      await row.settle?.(element, block)
      // Again once the element has drawn: its parts have their own roots by now.
      space()
      await expect.poll(() => row.faults(element), { timeout: 2000 }).toEqual([])
    })
  }
})

describe('text at a larger default font', () => {
  it('lintje-time-input holds a time at 20 px', async () => {
    document.documentElement.style.fontSize = '20px'
    const input = Object.assign(document.createElement('lintje-time-input'), {
      label: 'Tijd',
      value: '14:35',
    })
    document.body.append(input)
    await input.updateComplete
    const control = input.shadowRoot!.querySelector<HTMLInputElement>(
      '.lintje-time-input__control',
    )!
    const style = getComputedStyle(control)
    const room =
      control.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    const context = document.createElement('canvas').getContext('2d')!
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    expect(context.measureText(control.value).width).toBeLessThanOrEqual(available)
  })
})
