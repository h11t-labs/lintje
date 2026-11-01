/** The filter bar says the new "Je ziet" once the host answers a change it committed. */
import { afterEach, describe, expect, it } from 'vitest'
import './filter-bar'
import type { LintjeFilterBar } from './filter-bar'
import type { FilterBarData, FilterDefinition } from '../../../types'

const REGION: FilterDefinition = {
  key: 'regio',
  label: 'Regio',
  kind: 'segmented',
  options: [
    { value: 'alle', label: 'Alle regio’s' },
    { value: 'noord', label: 'Noord' },
  ],
  value: 'noord',
  default: 'alle',
}

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))

async function mount(): Promise<LintjeFilterBar> {
  const element = document.createElement('lintje-filter-bar')
  element.data = { filters: [REGION], standalone: true } satisfies FilterBarData
  // As a host does: it keeps the values and sends them back.
  element.addEventListener('lintje-values-change', (event) => {
    const values = (event as CustomEvent<Record<string, string>>).detail
    element.data = {
      ...element.data!,
      filters: element.data!.filters.map((filter) => ({ ...filter, value: values[filter.key] })),
    }
  })
  document.body.append(element)
  await element.updateComplete
  return element
}

const region = (element: LintjeFilterBar): string =>
  element.shadowRoot!.querySelector('[role="status"]')?.textContent?.trim() ?? 'geen regio'

async function said(element: LintjeFilterBar): Promise<string> {
  await element.updateComplete
  await frame()
  await element.updateComplete
  return region(element)
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('lintje-filter-bar', () => {
  it('says the new sentence once the host sent the data back, and again the next time', async () => {
    const element = await mount()
    expect(region(element)).toBe('')
    const zone = element.shadowRoot!.querySelector('lintje-filter-zone')!
    zone.dispatchEvent(new CustomEvent('lintje-filters-reset', { bubbles: true }))
    expect(await said(element)).toBe('Je ziet: Regio Alle regio’s.')
    zone.dispatchEvent(new CustomEvent('lintje-filters-reset', { bubbles: true }))
    await element.updateComplete
    expect(region(element)).toBe('')
    expect(await said(element)).toBe('Je ziet: Regio Alle regio’s.')
  })

  it('keeps quiet about data the host sends of itself', async () => {
    const element = await mount()
    element.data = { ...element.data!, filters: [{ ...REGION, value: 'alle' }] }
    expect(await said(element)).toBe('')
  })
})
