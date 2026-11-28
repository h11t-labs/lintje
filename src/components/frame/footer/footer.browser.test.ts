/** The compact foot in a browser: small and on one row, in both house styles. */
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import './footer'
import type { LintjeFooter } from './footer'

async function mount(): Promise<LintjeFooter> {
  const element = Object.assign(document.createElement('lintje-footer'), {
    variant: 'compact',
    data: {
      tagline: 'Datacatalogus — het dataplatform van de organisatie',
      links: [
        { label: 'Privacy', href: '#privacy' },
        { label: 'Toegankelijkheid', href: '#toegankelijkheid' },
      ],
    },
  }) as LintjeFooter
  // In a content column, as on the style guide's page, not across the whole window.
  const column = document.createElement('div')
  column.style.width = '800px'
  column.append(element)
  document.body.append(column)
  await element.updateComplete
  return element
}

const part = (element: LintjeFooter, selector: string): HTMLElement =>
  element.shadowRoot!.querySelector(selector)!

afterEach(async () => {
  document.body.replaceChildren()
  delete document.documentElement.dataset.styleVersion
  await page.viewport(1440, 900)
})

describe('the compact foot', () => {
  it('sets its tagline as small in the new style as in the earlier one', async () => {
    const size = async (style: string) => {
      document.documentElement.dataset.styleVersion = style
      const element = await mount()
      const font = getComputedStyle(part(element, '.lintje-footer__tagline')).fontSize
      document.body.replaceChildren()
      return font
    }
    expect(await size('new')).toBe(await size('classic'))
  })

  it.each(['classic', 'new'])(
    'has its tagline and links on one row in a column at 1440 px, in the %s style',
    async (style) => {
      document.documentElement.dataset.styleVersion = style
      const element = await mount()
      const tagline = part(element, '.lintje-footer__tagline').getBoundingClientRect()
      const links = part(element, '.lintje-footer__bottom').getBoundingClientRect()
      expect(links.left).toBeGreaterThan(tagline.right)
      expect(links.top).toBeLessThan(tagline.bottom)
    },
  )
})
