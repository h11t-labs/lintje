/**
 * A label that turns bold when chosen keeps its bold width free (`bold-room`): choosing another
 * option, tab, page or menu item leaves every label as wide as it was, so nothing beside it moves.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import '../../components/frame/sub-nav/sub-nav'
import '../../components/inputs/segmented/segmented'
import '../../components/layout/tabs/tabs'
import '../../components/tables/pagination/pagination'

interface Row {
  name: string
  mount: () => HTMLElement
  /** Makes the label at `index` the chosen one. */
  choose: (element: HTMLElement, index: number) => void
  /** The boxes whose widths must hold, in a fixed order. */
  boxes: (element: HTMLElement) => Element[]
  /** How many labels there are to choose. */
  count: number
}

const OPTIONS = ['Alle', 'Balie', 'Servicepunt']
const all = (element: HTMLElement, selector: string): Element[] => [
  ...element.shadowRoot!.querySelectorAll(selector),
]

const ROWS: Row[] = [
  {
    name: 'lintje-segmented',
    mount: () =>
      Object.assign(document.createElement('lintje-segmented'), {
        label: 'Soort loket',
        options: OPTIONS.map((label, index) => ({ value: label, label, count: index * 4 })),
        value: OPTIONS[0],
      }),
    choose: (element, index) => Object.assign(element, { value: OPTIONS[index] }),
    boxes: (element) => all(element, '.lintje-segmented, .lintje-segmented__option'),
    count: OPTIONS.length,
  },
  ...(['line', 'panel'] as const).map((variant): Row => ({
    name: `lintje-tabs :: ${variant}`,
    mount: () =>
      Object.assign(document.createElement('lintje-tabs'), {
        label: 'Onderdelen',
        variant,
        tabs: OPTIONS.map((label, index) => ({ value: label, label, count: index ? 3 : null })),
        value: OPTIONS[0],
      }),
    choose: (element, index) => Object.assign(element, { value: OPTIONS[index] }),
    boxes: (element) => all(element, '.lintje-tabs__tab'),
    count: OPTIONS.length,
  })),
  {
    name: 'lintje-sub-nav',
    mount: () =>
      Object.assign(document.createElement('lintje-sub-nav'), {
        label: 'In dit onderdeel',
        groups: [
          { items: OPTIONS.map((label, index) => ({ label, href: `#${index}`, active: !index })) },
        ],
      }),
    choose: (element, index) =>
      Object.assign(element, {
        groups: [
          { items: OPTIONS.map((label, i) => ({ label, href: `#${i}`, active: i === index })) },
        ],
      }),
    boxes: (element) => all(element, '.lintje-sub-nav__label'),
    count: OPTIONS.length,
  },
  {
    // Five digits outgrow the square a number stands in. The house font draws bold digits as wide
    // as regular ones; the room holds for a fallback font that does not.
    name: 'lintje-pagination',
    mount: () =>
      Object.assign(document.createElement('lintje-pagination'), {
        pageCount: 20000,
        page: 12345,
      }),
    choose: (element, index) => Object.assign(element, { page: 12345 + index }),
    boxes: (element) => all(element, '[data-page="12345"]'),
    count: 2,
  },
]

beforeEach(async () => {
  await page.viewport(1280, 800)
})

afterEach(() => {
  document.body.replaceChildren()
})

describe('bold room: choosing moves nothing', () => {
  for (const row of ROWS) {
    it(row.name, async () => {
      const element = row.mount()
      document.body.append(element)
      await (element as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
      const widths = (): number[] =>
        row.boxes(element).map((box) => box.getBoundingClientRect().width)
      const first = widths()
      expect(first.length).toBeGreaterThan(0)
      for (let index = 1; index < row.count; index++) {
        row.choose(element, index)
        await (element as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
        expect(widths()).toEqual(first)
      }
    })
  }
})
