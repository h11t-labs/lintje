/** The pagination: which pages stand there, what they are called, what a choice sends, where the focus goes. */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { describe, expect, it } from 'vitest'
import './pagination'
import { pageRange, parsePageSizes, rangeText, type LintjePagination } from './pagination'

async function mount(props: Partial<LintjePagination>): Promise<LintjePagination> {
  const element = Object.assign(document.createElement('lintje-pagination'), props)
  document.body.append(element)
  await element.updateComplete
  return element
}

const pages = (element: LintjePagination): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>('.lintje-pagination__page'),
]

const named = (element: LintjePagination, name: string): HTMLButtonElement =>
  element.shadowRoot!.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`)!

const step = (element: LintjePagination, which: 'previous' | 'next'): HTMLButtonElement =>
  element.shadowRoot!.querySelector<HTMLButtonElement>(`[data-step="${which}"]`)!

const focused = (element: LintjePagination): Element | null => element.shadowRoot!.activeElement

/** Two renders: the choice's, and the focus that follows it. */
async function settle(element: LintjePagination): Promise<void> {
  await element.updateComplete
  await element.updateComplete
}

function collect(element: EventTarget, name: string): unknown[] {
  const details: unknown[] = []
  element.addEventListener(name, (event) => details.push((event as CustomEvent).detail))
  return details
}

describe('pageRange()', () => {
  /** What the row shows, as a reader counts: `…` for a gap. */
  const shown = (page: number, count: number): string[] =>
    pageRange(page, count).map((slot) => (slot === 'gap' ? '…' : String(slot)))

  it('shows every page up to seven', () => {
    expect(pageRange(1, 1)).toEqual([1])
    expect(pageRange(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('keeps exactly seven slots on every page of twenty', () => {
    for (const page of [1, 2, 3, 4])
      expect(shown(page, 20)).toEqual(['1', '2', '3', '4', '5', '…', '20'])
    expect(shown(5, 20)).toEqual(['1', '…', '4', '5', '6', '…', '20'])
    expect(shown(10, 20)).toEqual(['1', '…', '9', '10', '11', '…', '20'])
    expect(shown(16, 20)).toEqual(['1', '…', '15', '16', '17', '…', '20'])
    for (const page of [17, 18, 19, 20])
      expect(shown(page, 20)).toEqual(['1', '…', '16', '17', '18', '19', '20'])
    for (let page = 1; page <= 20; page++) expect(pageRange(page, 20)).toHaveLength(7)
  })

  it('never hides a single page behind an ellipsis', () => {
    for (const count of [8, 9, 10, 20]) {
      for (let page = 1; page <= count; page++) {
        const slots = pageRange(page, count)
        expect(slots).toHaveLength(7)
        slots.forEach((slot, at) => {
          if (slot !== 'gap') return
          const before = slots[at - 1] as number
          const after = slots[at + 1] as number
          expect(after - before, `page ${page} of ${count}`).toBeGreaterThan(2)
        })
      }
    }
  })

  it('clamps a page outside the range', () => {
    expect(pageRange(99, 10)).toEqual([1, 'gap', 6, 7, 8, 9, 10])
    expect(pageRange(0, 10)).toEqual([1, 2, 3, 4, 5, 'gap', 10])
    expect(pageRange(1, 0)).toEqual([])
  })
})

describe('rangeText()', () => {
  it('writes the rows on the page with what they are, and nothing without a total', () => {
    expect(rangeText(2, 20, 131)).toBe('21–40 van 131 resultaten')
    expect(rangeText(7, 20, 131)).toBe('121–131 van 131 resultaten')
    expect(rangeText(2, 5, 14, { many: 'documenten', one: 'document' })).toBe(
      '6–10 van 14 documenten',
    )
    expect(rangeText(1, 20)).toBeNull()
  })

  it('names one row once, and only the total when everything fits on a page', () => {
    const unit = { many: 'documenten', one: 'document' }
    expect(rangeText(3, 5, 11, unit)).toBe('11 van 11 documenten')
    expect(rangeText(1, 20, 14, unit)).toBe('14 documenten')
    expect(rangeText(1, 20, 1, unit)).toBe('1 document')
    expect(rangeText(1, 20, 0, unit)).toBe('Geen documenten')
  })
})

describe('parsePageSizes()', () => {
  it('reads whole, positive sizes once, in the given order', () => {
    expect(parsePageSizes('10, 20,50')).toEqual([10, 20, 50])
    expect(parsePageSizes('20,10,20,0,-5,x,2.5')).toEqual([20, 10])
    expect(parsePageSizes('')).toBeUndefined()
    expect(parsePageSizes(null)).toBeUndefined()
  })
})

describe('lintje-pagination', () => {
  it('is a named navigation with the current page marked and the ends disabled', async () => {
    const element = await mount({ page: 1, pageCount: 7, total: 131, pageSize: 20 })
    const root = element.shadowRoot!
    expect(root.querySelector('nav')!.getAttribute('aria-label')).toBe('Paginering')
    const [first, second] = pages(element)
    expect(first!.getAttribute('aria-label')).toBe('Pagina 1, huidige pagina')
    expect(first!.getAttribute('aria-current')).toBe('page')
    expect(second!.getAttribute('aria-label')).toBe('Ga naar pagina 2')
    expect(second!.hasAttribute('aria-current')).toBe(false)
    expect(step(element, 'previous').disabled).toBe(true)
    expect(step(element, 'previous').classList.contains('is-disabled')).toBe(true)
    expect(step(element, 'next').disabled).toBe(false)
    expect(root.querySelector('.lintje-pagination__count')!.textContent).toBe(
      '1–20 van 131 resultaten',
    )
    expect(root.querySelector('.lintje-pagination__where')!.textContent).toBe('Pagina 1 van 7')
  })

  it('sends the chosen page, without a template no navigate', async () => {
    const element = await mount({ page: 2, pageCount: 7 })
    const changes = collect(element, 'lintje-page-change')
    const navigations = collect(element, 'lintje-navigate')
    pages(element)[4]!.click()
    expect(changes).toEqual([{ page: 5 }])
    expect(navigations).toEqual([])
    await element.updateComplete
    expect(pages(element)[4]!.getAttribute('aria-current')).toBe('page')
  })

  it('keeps every button on the page it goes to: the DOM is keyed by page', async () => {
    const element = await mount({ page: 1, pageCount: 20 })
    const twenty = named(element, 'Ga naar pagina 20')
    const four = named(element, 'Ga naar pagina 4')
    const five = named(element, 'Ga naar pagina 5')
    five.click()
    await element.updateComplete
    // 1 2 3 4 5 … 20 became 1 … 4 5 6 … 20: what stayed is the same button.
    expect(named(element, 'Ga naar pagina 20')).toBe(twenty)
    expect(named(element, 'Ga naar pagina 4')).toBe(four)
    expect(named(element, 'Pagina 5, huidige pagina')).toBe(five)
  })

  it('leaves the focus on the number that was used', async () => {
    const element = await mount({ page: 1, pageCount: 20 })
    const five = named(element, 'Ga naar pagina 5')
    five.focus()
    five.click()
    await settle(element)
    expect(focused(element)).toBe(five)
    expect(five.getAttribute('aria-current')).toBe('page')
  })

  it('leaves the focus on Vorige and Volgende while they can still be used', async () => {
    const element = await mount({ page: 1, pageCount: 20 })
    const next = step(element, 'next')
    next.focus()
    for (let count = 0; count < 6; count++) {
      next.click()
      await settle(element)
      expect(focused(element)).toBe(next)
    }
    const previous = step(element, 'previous')
    previous.focus()
    previous.click()
    await settle(element)
    expect(focused(element)).toBe(previous)
  })

  it('moves the focus to the current page when the step used turns disabled', async () => {
    const element = await mount({ page: 19, pageCount: 20 })
    const next = step(element, 'next')
    next.focus()
    next.click()
    await settle(element)
    expect(next.disabled).toBe(true)
    expect(focused(element)).toBe(named(element, 'Pagina 20, huidige pagina'))
  })

  it('counts the pages from the total when the host gives none', async () => {
    const element = await mount({ page: 1, total: 14, pageSize: 5 })
    expect(pages(element)).toHaveLength(3)
  })

  it('names the unit in the count', async () => {
    const element = await mount({ page: 2, total: 14, pageSize: 5, unit: 'documenten' })
    const count = element.shadowRoot!.querySelector('.lintje-pagination__count')!
    expect(count.textContent).toBe('6–10 van 14 documenten')
  })

  it('draws no size choice without page-sizes', async () => {
    const element = await mount({ page: 1, total: 14, pageSize: 5 })
    expect(element.shadowRoot!.querySelector('lintje-menu-button')).toBeNull()
  })

  it('offers the sizes, the chosen one selected, named after the unit', async () => {
    const element = document.createElement('lintje-pagination')
    element.setAttribute('page-sizes', '5, 10, 20')
    Object.assign(element, { page: 1, total: 14, pageSize: 10, unit: 'documenten' })
    document.body.append(element)
    await element.updateComplete
    const menu = element.shadowRoot!.querySelector('lintje-menu-button')!
    expect(menu.label).toBe('10 per pagina')
    expect(menu.accessibleLabel).toBe('Documenten: 10 per pagina')
    expect(menu.variant).toBe('flat')
    const items = menu.items as { value: string; checked: boolean; radio: boolean }[]
    expect(items.map((item) => item.value)).toEqual(['5', '10', '20'])
    expect(items.map((item) => item.checked)).toEqual([false, true, false])
    expect(items.every((item) => item.radio)).toBe(true)
  })

  it('sends the new size with the page that keeps the first row in view', async () => {
    const element = await mount({ page: 3, total: 131, pageSize: 20, pageSizes: [10, 20, 50] })
    const sent = collect(element, 'lintje-page-size-change')
    const outside = collect(document.body, 'lintje-action')
    const menu = element.shadowRoot!.querySelector('lintje-menu-button')!
    menu.dispatchEvent(
      new CustomEvent('lintje-action', { detail: '50', bubbles: true, composed: true }),
    )
    await element.updateComplete
    // Row 41 was first on page 3 of 20; of 50 it stands on page 1.
    expect(sent).toEqual([{ pageSize: 50, page: 1 }])
    expect(outside).toEqual([])
    expect(element.pageSize).toBe(50)
    expect(element.page).toBe(1)
    expect(pages(element)).toHaveLength(3)
  })

  it('draws links from the template and hands a plain click to the host', async () => {
    const element = await mount({ page: 2, pageCount: 3, hrefTemplate: '?pagina={page}' })
    const changes = collect(element, 'lintje-page-change')
    const navigations = collect(element, 'lintje-navigate')
    const third = pages(element)[2]!
    expect(third.tagName).toBe('A')
    expect(third.getAttribute('href')).toBe('?pagina=3')

    const click = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true })
    third.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(false)
    expect(changes).toEqual([{ page: 3 }])
    expect(navigations).toEqual([{ href: '?pagina=3' }])

    // Volgende on the last page is a disabled button, not a link.
    await element.updateComplete
    const next = step(element, 'next')
    expect(next.tagName).toBe('BUTTON')
    expect(next.disabled).toBe(true)
  })

  it('leaves a click with a modifier key to the browser', async () => {
    const element = await mount({ page: 1, pageCount: 3, hrefTemplate: '?pagina={page}' })
    const changes = collect(element, 'lintje-page-change')
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true })
    pages(element)[1]!.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(false)
    expect(changes).toEqual([])
  })

  it('keeps a step its word as name when only the chevron shows', async () => {
    const element = await mount({ page: 2, pageCount: 7 })
    Reflect.set(element, 'compact', true)
    await element.updateComplete
    const previous = step(element, 'previous')
    expect(previous.textContent!.trim()).toBe('Vorige')
    expect(previous.querySelector('.lintje-pagination__word')!.classList).toContain(
      'visually-hidden',
    )
    expect(element.shadowRoot!.querySelector('.is-compact')).not.toBeNull()
  })

  it('draws a page flat in the link colour, sizes it to the target and lays out three zones', () => {
    // Read from disk, not imported: vitest does not run the CSS pipeline.
    const css = readFileSync(
      resolvePath('src/components/tables/pagination/pagination.css'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).toMatch(/\.lintje-pagination__page\s*\{[^}]*border: 1px solid transparent;/)
    expect(css).toMatch(/\.lintje-pagination__page\s*\{[^}]*color: var\(--color-link\);/)
    expect(css).toMatch(/\.lintje-pagination__page\s*\{[^}]*height: var\(--h-target\);/)
    expect(css).toMatch(/\.lintje-pagination\s*\{[^}]*grid-template-areas: "count nav size";/)
    expect(css).toMatch(/\.is-stacked\s*\{[^}]*grid-template-areas: "nav nav" "count size";/)
    expect(css).not.toMatch(/font-size:\s*\d+px/)
  })
})
