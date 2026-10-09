/**
 * The filter zone and the focus: the row is drawn with another template open and closed, and a
 * reset leaves with its count, so where the focus goes needs a real browser. And pinning, which
 * changes the height of the page.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { deepActiveElement } from '../../../core/focus'
import './filter-zone'
import type { LintjeFilterZone } from './filter-zone'

const settle = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)))

/** A zone whose owner answers every request, as the filter bar does. */
async function mount(open: boolean, modified = 0): Promise<LintjeFilterZone> {
  const element = document.createElement('lintje-filter-zone') as LintjeFilterZone
  element.total = 4
  element.open = open
  element.modified = modified
  element.sentence = [{ text: 'Je ziet: alles', emphasis: false }]
  element.innerHTML = '<input aria-label="Periode" />'
  element.addEventListener('lintje-zone-open-change', (event) => {
    element.open = (event as CustomEvent<boolean>).detail
  })
  element.addEventListener('lintje-filters-reset', () => {
    element.modified = 0
  })
  document.body.append(element)
  await element.updateComplete
  return element
}

const toggle = (element: LintjeFilterZone): HTMLButtonElement =>
  element.shadowRoot!.querySelector<HTMLButtonElement>('.lintje-filter-toggle')!

afterEach(() => {
  document.body.replaceChildren()
  document.body.style.height = ''
  window.scrollTo(0, 0)
})

describe('the focus in the filter zone', () => {
  it('stays on the toggle when it opens and closes the zone', async () => {
    const element = await mount(false)
    toggle(element).focus()
    toggle(element).click()
    await settle()
    expect(deepActiveElement()).toBe(toggle(element))
    expect(toggle(element).getAttribute('aria-expanded')).toBe('true')
    toggle(element).click()
    await settle()
    expect(deepActiveElement()).toBe(toggle(element))
    expect(toggle(element).getAttribute('aria-expanded')).toBe('false')
  })

  it('goes from "Herstel standaard" to the toggle when the reset leaves', async () => {
    const element = await mount(true, 2)
    const reset = element.shadowRoot!.querySelector<HTMLButtonElement>('.lintje-filter-bar__reset')!
    reset.focus()
    reset.click()
    await settle()
    expect(element.shadowRoot!.querySelector('.lintje-filter-bar__reset')).toBeNull()
    expect(deepActiveElement()).toBe(toggle(element))
  })

  it('keeps the controls open while the page scrolls under a focused control', async () => {
    document.body.style.height = '4000px'
    const element = await mount(true)
    const asked: boolean[] = []
    element.addEventListener('lintje-zone-open-change', (event) =>
      asked.push((event as CustomEvent<boolean>).detail),
    )
    element.querySelector('input')!.focus()
    window.scrollTo(0, 200)
    await settle()
    expect(asked).toEqual([])

    toggle(element).focus()
    window.scrollTo(0, 400)
    await settle()
    expect(asked).toEqual([false])
  })
})

describe('pinning the zone', () => {
  /** A pinned zone as the filter bar owns it, `gap` px below the top, on a page `extra` px
   *  taller than the window; the reader works in the open controls, so they stay open. */
  async function pinnable(gap: number, extra: number): Promise<boolean[]> {
    const above = document.createElement('div')
    above.style.height = `${gap}px`
    document.body.append(above)
    const element = await mount(true)
    element.stick = 'fixed'
    const reports: boolean[] = []
    element.addEventListener('lintje-zone-scrolled-change', (event) => {
      reports.push((event as CustomEvent<boolean>).detail)
      element.scrolled = (event as CustomEvent<boolean>).detail
    })
    const below = document.createElement('div')
    document.body.append(below)
    await settle()
    below.style.height = `${window.innerHeight + extra - below.getBoundingClientRect().top}px`
    element.querySelector('input')!.focus()
    await settle()
    reports.length = 0
    window.scrollTo(0, extra)
    for (let i = 0; i < 6; i++) await settle()
    return reports
  }

  afterEach(() => {
    document.body.style.margin = ''
  })

  it('stays in the page where pinning would take the page back above the threshold', async () => {
    document.body.style.margin = '0'
    const reports = await pinnable(200, 200)
    // Pinned, the open zone would leave 48 px of its height: the page could scroll only to 110.
    expect(reports).not.toContain(true)
    expect(window.scrollY).toBe(200)
  })

  it('pins on a page that keeps the reader past the threshold', async () => {
    document.body.style.margin = '0'
    const reports = await pinnable(200, 2000)
    expect(reports).toEqual([true])
  })
})
