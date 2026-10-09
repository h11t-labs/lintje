/**
 * `<lintje-chat-strip>`: a value says by its form whether the reader can change
 * it, and the strip keeps nothing but whether its details are open.
 */
import { describe, expect, it } from 'vitest'
import './chat-strip'
import type { LintjeChatStrip } from './chat-strip'
import type { ChatStripItem } from '../../../types'

const ITEMS: ChatStripItem[] = [
  { key: 'source', label: 'Bron', value: 'Aanvragen en wachttijden' },
  {
    key: 'period',
    label: 'Periode',
    value: 'week',
    options: [
      { value: 'week', label: '1 t/m 7 sep' },
      { value: 'month', label: 'afgelopen 30 dagen' },
    ],
  },
  { key: 'compare', label: 'Vergelijken', value: 'met 25 t/m 31 aug', pressed: false },
]

async function strip(props: Partial<LintjeChatStrip>): Promise<LintjeChatStrip> {
  const element = document.createElement('lintje-chat-strip')
  Object.assign(element, { items: ITEMS }, props)
  document.body.append(element)
  await element.updateComplete
  return element
}

function changes(): unknown[] {
  const details: unknown[] = []
  document.addEventListener('lintje-strip-change', (event) =>
    details.push((event as CustomEvent).detail),
  )
  return details
}

describe('lintje-chat-strip', () => {
  it('is a description list: a term and a value per item', async () => {
    const element = await strip({})
    const terms = [...element.renderRoot.querySelectorAll('dt')].map((node) => node.textContent)
    expect(terms).toEqual(['Bron', 'Periode', 'Vergelijken'])
    expect(element.renderRoot.querySelectorAll('dd')).toHaveLength(3)
  })

  it('draws a fixed value as text, a changeable one as a term, a suggestion as a toggle', async () => {
    const element = await strip({})
    expect(element.renderRoot.querySelector('.lintje-chat-strip__text')?.textContent).toBe(
      'Aanvragen en wachttijden',
    )
    const term = element.renderRoot.querySelector('.lintje-chat-strip__term')
    expect(term?.querySelector('.lintje-chat-strip__term-text')?.textContent).toBe('1 t/m 7 sep')
    const select = term?.querySelector('select')
    expect(select?.getAttribute('aria-label')).toBe('Periode')
    expect(select?.value).toBe('week')
    const toggle = element.renderRoot.querySelector('.lintje-chat-strip__suggestion')
    expect(toggle?.getAttribute('aria-pressed')).toBe('false')
    expect(toggle?.classList.contains('is-pressed')).toBe(false)
  })

  it('announces a choice and leaves the value to the host', async () => {
    const element = await strip({ turnId: 't2' })
    const details = changes()
    const select = element.renderRoot.querySelector('select') as HTMLSelectElement
    select.value = 'month'
    select.dispatchEvent(new Event('change'))
    expect(details).toEqual([{ turnId: 't2', key: 'period', value: 'month' }])
    expect(select.value).toBe('week')
  })

  it('announces a suggestion switched on', async () => {
    const element = await strip({ turnId: 't2' })
    const details = changes()
    element.renderRoot.querySelector<HTMLButtonElement>('.lintje-chat-strip__suggestion')?.click()
    expect(details).toEqual([{ turnId: 't2', key: 'compare', value: true }])
  })

  it('shows only text when disabled, and drops a suggestion nobody took', async () => {
    const element = await strip({ disabled: true })
    expect(element.renderRoot.querySelector('select')).toBeNull()
    expect(element.renderRoot.querySelector('button')).toBeNull()
    const values = [...element.renderRoot.querySelectorAll('.lintje-chat-strip__text')].map(
      (node) => node.textContent,
    )
    expect(values).toEqual(['Aanvragen en wachttijden', '1 t/m 7 sep'])
  })

  it('opens its details from a toggle that says so', async () => {
    const element = await strip({ details: [{ term: 'Berekening', description: 'som per dag' }] })
    const toggle = element.renderRoot.querySelector<HTMLButtonElement>('.lintje-chat-strip__toggle')
    expect(toggle?.textContent).toContain('Berekening')
    expect(toggle?.getAttribute('aria-expanded')).toBe('false')
    toggle?.click()
    await element.updateComplete
    expect(toggle?.getAttribute('aria-expanded')).toBe('true')
    expect(
      element.renderRoot.querySelector('.lintje-chat-strip')?.classList.contains('is-open'),
    ).toBe(true)
    expect(
      element.renderRoot.querySelector(`#${toggle?.getAttribute('aria-controls')}`),
    ).not.toBeNull()
  })
})
