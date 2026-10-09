/**
 * The one filter toggle.
 *
 * What is checked here is what the button *is*: one class in both states, the
 * right label and `aria-expanded`, and a click that asks for the other state.
 * happy-dom has no layout, so that the box does not move is proven where it
 * runs, in headless Chrome.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import './filter-zone'
import type { LintjeFilterZone } from './filter-zone'

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

  it('says which state it is in, in Dutch', async () => {
    expect(toggle(await mount(true))?.getAttribute('aria-expanded')).toBe('true')
    expect(toggle(await mount(true))?.getAttribute('aria-label')).toBe('Filters verbergen')
    expect(toggle(await mount(false))?.getAttribute('aria-expanded')).toBe('false')
    expect(toggle(await mount(false))?.getAttribute('aria-label')).toBe('Filters tonen')
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
