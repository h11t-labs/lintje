/**
 * The one filter toggle.
 *
 * What is checked here is what the button *is*: one class in both states, the
 * word it shows as its name and `aria-expanded`, and a click that asks for the
 * other state.
 * happy-dom has no layout, so that the box does not move is proven where it
 * runs, in headless Chrome.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import './filter-zone'
import type { LintjeFilterZone } from './filter-zone'

// The page's own `scrollY` comes back afterwards: the files after this one share the window.
const scrollY = Object.getOwnPropertyDescriptor(window, 'scrollY')!
afterAll(() => {
  Object.defineProperty(window, 'scrollY', scrollY)
})

beforeAll(() => {
  // The zone observes a sentinel as soon as it renders; happy-dom has no observer.
  globalThis.IntersectionObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): [] {
      return []
    }
  } as unknown as typeof IntersectionObserver
})

async function mount(open: boolean): Promise<LintjeFilterZone> {
  const element = document.createElement('lintje-filter-zone') as LintjeFilterZone
  element.total = 4
  element.open = open
  element.sentence = [
    { text: 'Je ziet: ', emphasis: false },
    { text: 'alles', emphasis: true },
  ]
  document.body.append(element)
  await element.updateComplete
  return element
}

const toggle = (element: LintjeFilterZone): HTMLButtonElement | null =>
  element.shadowRoot?.querySelector<HTMLButtonElement>('.lintje-filter-toggle') ?? null

describe('the filter toggle', () => {
  it('is one and the same button in both states', async () => {
    const expanded = toggle(await mount(true))
    const collapsed = toggle(await mount(false))
    for (const button of [expanded, collapsed]) {
      expect(button?.textContent?.trim()).toBe('Filters')
      expect(button?.querySelector('.lintje-filter-toggle__chevron')).not.toBeNull()
    }
    // Nothing is left of the two buttons it replaced.
    expect(expanded?.closest('.lintje-filter-bar__header')).not.toBeNull()
    expect(collapsed?.closest('.lintje-summary-bar')).not.toBeNull()
  })

  it('is named by the word it shows and says its state once, in aria-expanded', async () => {
    for (const expanded of [true, false]) {
      const button = toggle(await mount(expanded))
      expect(button?.hasAttribute('aria-label')).toBe(false)
      expect(button?.textContent?.trim()).toBe('Filters')
      expect(button?.getAttribute('aria-expanded')).toBe(String(expanded))
    }
  })

  it('turns the chevron rather than swapping the glyph', async () => {
    expect(toggle(await mount(true))?.classList.contains('is-expanded')).toBe(true)
    expect(toggle(await mount(false))?.classList.contains('is-expanded')).toBe(false)
  })

  it('asks the owner for the other state, from either side', async () => {
    for (const open of [true, false]) {
      const element = await mount(open)
      const asked: boolean[] = []
      element.addEventListener('lintje-zone-open-change', (event) => {
        asked.push((event as CustomEvent<boolean>).detail)
      })
      toggle(element)?.click()
      await element.updateComplete
      expect(asked).toEqual([!open])
    }
  })
})

describe('closed until the reader opens it', () => {
  const asks = (element: LintjeFilterZone): boolean[] => {
    const asked: boolean[] = []
    element.addEventListener('lintje-zone-open-change', (event) => {
      asked.push((event as CustomEvent<boolean>).detail)
    })
    return asked
  }

  it('is the summary bar by default', async () => {
    const element = document.createElement('lintje-filter-zone')
    document.body.append(element)
    await element.updateComplete
    expect(element.open).toBe(false)
    expect(element.shadowRoot!.querySelector('.lintje-summary-bar')).not.toBeNull()
    expect(element.shadowRoot!.querySelector('.lintje-filter-bar__header')).toBeNull()
  })

  it('opens from a press anywhere on the bar, once', async () => {
    const element = await mount(false)
    const asked = asks(element)
    const bar = element.shadowRoot!.querySelector<HTMLElement>('.lintje-summary-bar')!
    bar.querySelector<HTMLElement>('.lintje-summary-bar__spacer')!.click()
    bar.querySelector<HTMLButtonElement>('.lintje-summary-bar__sentence')!.click()
    expect(asked).toEqual([true, true])
    // A press on a button asks once, through the button: the bar does not ask again for it.
    expect(asked).toHaveLength(2)
  })

  it('closes when the page scrolls on under the open controls, not on a tremble', async () => {
    Object.defineProperty(window, 'scrollY', { value: 400, configurable: true })
    const element = await mount(true)
    const asked = asks(element)
    const scrollTo = (y: number): void => {
      Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
      window.dispatchEvent(new Event('scroll'))
    }
    scrollTo(410)
    expect(asked).toEqual([])
    scrollTo(460)
    expect(asked).toEqual([false])

    // Closed, the page scrolls without the zone hearing it.
    const collapsed = await mount(false)
    const quiet = asks(collapsed)
    scrollTo(900)
    expect(quiet).toEqual([])
  })
})

describe('stuck and open over the page', () => {
  /** A zone with one control, whose owner follows what it asks, as `lintje-filter-bar` does. */
  async function stuckOpen(scrolled = true): Promise<{
    element: LintjeFilterZone
    control: HTMLButtonElement
    outside: HTMLButtonElement
    asked: boolean[]
  }> {
    const element = await mount(true)
    element.scrolled = scrolled
    const control = document.createElement('button')
    element.append(control)
    const outside = document.createElement('button')
    document.body.append(outside)
    const asked: boolean[] = []
    element.addEventListener('lintje-zone-open-change', (event) => {
      asked.push((event as CustomEvent<boolean>).detail)
      element.open = (event as CustomEvent<boolean>).detail
    })
    await element.updateComplete
    return { element, control, outside, asked }
  }

  const leave = (from: Element, to: Node | null): void => {
    from.dispatchEvent(
      new FocusEvent('focusout', { relatedTarget: to, bubbles: true, composed: true }),
    )
  }

  it('closes as the focus leaves it, and the focus stays where it went', async () => {
    const { element, control, outside, asked } = await stuckOpen()
    control.focus()
    leave(control, element.shadowRoot!.querySelector('.lintje-filter-toggle'))
    leave(control, null)
    leave(control, document.body)
    expect(asked).toEqual([])
    outside.focus()
    leave(control, outside)
    await element.updateComplete
    expect(asked).toEqual([false])
    expect(document.activeElement).toBe(outside)
  })

  it('stays open as the focus leaves it in the page, where it covers nothing', async () => {
    const { control, outside, asked } = await stuckOpen(false)
    outside.focus()
    leave(control, outside)
    expect(asked).toEqual([])
  })

  it('closes on Escape, with the focus on the toggle', async () => {
    const { element, control, asked } = await stuckOpen()
    control.focus()
    control.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
    )
    await element.updateComplete
    expect(asked).toEqual([false])
    expect(element.shadowRoot!.activeElement).toBe(toggle(element))
  })
})

describe('below 768 px, the sentence', () => {
  const viewport = (width: number): void =>
    (
      window as unknown as { happyDOM: { setViewport(size: { width: number }): void } }
    ).happyDOM.setViewport({ width })
  const sentence = (element: LintjeFilterZone): HTMLButtonElement =>
    element.shadowRoot!.querySelector<HTMLButtonElement>('.lintje-filter-bar__mobile-summary')!

  beforeAll(() => viewport(390))
  afterAll(() => viewport(1024))

  it('is the button that asks the owner for its sheet, and says whether it is open', async () => {
    const element = await mount(false)
    const button = sentence(element)
    expect(button.tagName).toBe('BUTTON')
    expect(button.getAttribute('aria-haspopup')).toBe('dialog')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    let sheetAsked = 0
    const zoneAsked: boolean[] = []
    element.addEventListener('lintje-zone-sheet-open', () => sheetAsked++)
    element.addEventListener('lintje-zone-open-change', (event) => {
      zoneAsked.push((event as CustomEvent<boolean>).detail)
    })
    button.click()
    // The sheet, not the zone: the zone's open state is the URL's and stays as it is.
    expect(sheetAsked).toBe(1)
    expect(zoneAsked).toEqual([])
    element.sheetOpen = true
    await element.updateComplete
    expect(button.getAttribute('aria-expanded')).toBe('true')
  })

  it('counts the modified filters in a badge before its triangle', async () => {
    const element = await mount(false)
    expect(sentence(element).querySelector('.lintje-badge')).toBeNull()
    element.modified = 3
    await element.updateComplete
    const end = sentence(element).querySelector('.lintje-filter-bar__mobile-end')!
    // The figure is seen, the sentence heard.
    const badge = end.querySelector('.lintje-badge--attention')!
    expect(badge.querySelector('[aria-hidden="true"]')?.textContent).toBe('3')
    expect(badge.querySelector('.visually-hidden')?.textContent).toBe('3 aangepast')
    expect(end.lastElementChild?.tagName.toLowerCase()).toBe('svg')
  })
})
