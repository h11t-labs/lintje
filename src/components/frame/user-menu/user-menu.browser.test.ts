/**
 * The user menu inline, in the mobile navigation: a row is a touch target with its line in the
 * middle, as every menu row centres its first line; a label that wraps grows the row.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import './user-menu'
import type { LintjeUserMenu } from './user-menu'
import type { MenuEntry } from '../../actions/menu-button/menu-button'

const ITEMS: MenuEntry[] = [
  { value: 'weergave', label: 'Weergave' },
  { value: 'sneltoetsen', label: 'Sneltoetsen', hint: '?' },
  { value: 'compact', label: 'Compacte weergave', checked: true },
  { value: 'nl', label: 'Nederlands', checked: true, radio: true },
  { value: 'en', label: 'Engels', checked: false, radio: true },
]

beforeAll(async () => {
  await page.viewport(390, 844)
})

afterEach(() => document.body.replaceChildren())

async function mount(items: MenuEntry[] = ITEMS): Promise<LintjeUserMenu> {
  const element = Object.assign(document.createElement('lintje-user-menu'), {
    inline: true,
    user: { name: 'J. de Vries', role: 'Teamleider', initials: 'JV' },
    items,
  })
  document.body.append(element)
  await element.updateComplete
  await document.fonts.ready
  return element
}

const rows = (element: LintjeUserMenu): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>('.lintje-menu__row'),
]

describe('lintje-user-menu inline', () => {
  it('draws a one-line row 48 px high with its text in the middle, with a hint, a check or a circle too', async () => {
    const element = await mount()
    const all = rows(element)
    expect(all.map((row) => row.textContent!.trim())).toEqual([
      'Weergave',
      'Sneltoetsen?',
      'Compacte weergave',
      'Nederlands',
      'Engels',
    ])
    for (const row of all) {
      const box = row.getBoundingClientRect()
      const text = row.querySelector('.lintje-menu__label')!.getBoundingClientRect()
      expect(box.height, row.textContent!).toBeCloseTo(48, 0)
      expect(
        Math.abs(text.top - box.top - (box.bottom - text.bottom)),
        row.textContent!,
      ).toBeLessThanOrEqual(1)
    }
  })

  it('grows a row whose label wraps, from its first line down', async () => {
    const element = await mount([
      {
        value: 'organisatie',
        label:
          'Wisselen naar een andere organisatie waarvoor je gemachtigd bent, met haar eigen aanvragen',
      },
    ])
    element.style.width = '240px'
    await element.updateComplete
    const [row] = rows(element)
    const box = row!.getBoundingClientRect()
    const text = row!.querySelector('.lintje-menu__label')!.getBoundingClientRect()
    expect(box.height).toBeGreaterThan(48)
    expect(text.top - box.top).toBeCloseTo(box.bottom - text.bottom, 0)
  })
})
