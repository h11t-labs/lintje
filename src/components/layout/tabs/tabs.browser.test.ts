/** The tabs in a browser: the scroll shadows of a row that overflows on a phone. */
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import './tabs'
import type { LintjeTabs, TabItem } from './tabs'

const MANY: TabItem[] = [
  { value: 'overzicht', label: 'Overzicht' },
  { value: 'aanvragen', label: 'Aanvragen', count: 12 },
  { value: 'documenten', label: 'Documenten' },
  { value: 'berichten', label: 'Berichten' },
  { value: 'instellingen', label: 'Instellingen' },
  { value: 'geschiedenis', label: 'Geschiedenis' },
]

async function mount(tabs: TabItem[], variant: 'line' | 'panel' = 'line'): Promise<LintjeTabs> {
  const element = Object.assign(document.createElement('lintje-tabs'), {
    tabs,
    variant,
    label: 'Onderdelen',
  })
  document.body.append(element)
  await element.updateComplete
  return element
}

async function phone(): Promise<void> {
  await page.viewport(390, 844)
  // WebKit resizes the frame after `viewport()` resolves.
  await expect.poll(() => window.innerWidth).toBe(390)
}

const list = (element: LintjeTabs): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('.lintje-tabs__list')!
const edges = (element: LintjeTabs): string =>
  ['is-scroll-start', 'is-scroll-end']
    .filter((name) => list(element).classList.contains(name))
    .join(' ')

// WebKit keeps the media queries of a sheet that no connected element adopts as they were, so
// every resize happens with the element in place.
afterEach(async () => {
  await page.viewport(1440, 900)
  await expect.poll(() => window.innerWidth).toBe(1440)
  document.body.replaceChildren()
})

describe('lintje-tabs scroll shadows', () => {
  it('wraps the row on a wide screen, with no shadow', async () => {
    const element = await mount(MANY)
    element.style.width = '320px'
    await element.updateComplete
    expect(list(element).scrollWidth).toBe(list(element).clientWidth)
    await expect.poll(() => edges(element)).toBe('')
  })

  it('shades the side with more tabs behind it as the row scrolls on a phone', async () => {
    const element = await mount(MANY)
    await phone()
    const row = list(element)
    await expect.poll(() => row.scrollWidth > row.clientWidth).toBe(true)
    await expect.poll(() => edges(element)).toBe('is-scroll-end')
    expect(getComputedStyle(row).boxShadow).not.toBe('none')

    row.scrollLeft = 40
    await expect.poll(() => edges(element)).toBe('is-scroll-start is-scroll-end')

    row.scrollLeft = row.scrollWidth
    await expect.poll(() => edges(element)).toBe('is-scroll-start')
    expect(getComputedStyle(row).boxShadow).not.toBe('none')

    row.scrollLeft = 0
    await expect.poll(() => edges(element)).toBe('is-scroll-end')
  })

  it('scrolls the chosen tab into sight', async () => {
    const element = await mount(MANY)
    await phone()
    element.value = 'geschiedenis'
    await element.updateComplete
    const row = list(element).getBoundingClientRect()
    const tab = element.shadowRoot!.querySelector('#tab-5')!.getBoundingClientRect()
    expect(tab.right).toBeLessThanOrEqual(row.right + 1)
    await expect.poll(() => edges(element)).toBe('is-scroll-start')
  })
})
