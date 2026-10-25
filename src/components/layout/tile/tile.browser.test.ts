/** A flush tile in a browser: where its last row ends against the frame, in both house styles. */
import { afterEach, describe, expect, it } from 'vitest'
import './tile'
import '../../tables/pagination/pagination'
import type { LintjeTile } from './tile'

async function mount(
  style: 'classic' | 'new',
  last: string,
  footnote?: string,
): Promise<LintjeTile> {
  document.documentElement.dataset.styleVersion = style
  const element = Object.assign(document.createElement('lintje-tile'), {
    heading: 'Aanvragen',
    flush: true,
    footnote,
  })
  element.innerHTML = `<div style="height: 40px">Eerste rij</div>${last}`
  document.body.append(element)
  await element.updateComplete
  await expect.poll(() => element.dataset.styleVersion).toBe(style)
  return element
}

const frame = (element: LintjeTile): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('.lintje-tile')!
/** The distance from the bottom of the tile's last slotted child to the tile's outer edge. */
const strip = (element: LintjeTile): number =>
  frame(element).getBoundingClientRect().bottom -
  element.lastElementChild!.getBoundingClientRect().bottom
/** The tile's padding and border under its content. */
const padding = (element: LintjeTile): number => {
  const style = getComputedStyle(frame(element))
  return parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth)
}

afterEach(() => {
  document.body.replaceChildren()
  document.documentElement.removeAttribute('data-style-version')
})

for (const style of ['classic', 'new'] as const) {
  describe(`a flush tile in the ${style} style`, () => {
    it('ends its last row on the frame without a footnote', async () => {
      const element = await mount(style, '<div style="height: 40px">Laatste rij</div>')
      await expect.poll(() => Math.abs(strip(element))).toBeLessThan(1)
    })

    it('keeps the strip under a pager, inside the pager', async () => {
      const element = await mount(
        style,
        '<lintje-pagination page="1" total="80"></lintje-pagination>',
      )
      const pager = element.lastElementChild as HTMLElement
      await expect.poll(() => Math.abs(strip(element))).toBeLessThan(1)
      expect(parseFloat(getComputedStyle(pager).paddingBottom)).toBeCloseTo(padding(element), 0)
    })

    it('ends its last row on the footnote, which draws no rule of its own', async () => {
      const element = await mount(
        style,
        '<div style="height: 40px">Laatste rij</div>',
        'Bron: fictief',
      )
      const note = element.shadowRoot!.querySelector<HTMLElement>('.lintje-tile__footnote')!
      const row = element.lastElementChild!.getBoundingClientRect()
      expect(row.bottom).toBeLessThanOrEqual(note.getBoundingClientRect().top)
      expect(strip(element)).toBeGreaterThan(padding(element))
      expect(
        frame(element).getBoundingClientRect().bottom - note.getBoundingClientRect().bottom,
      ).toBeCloseTo(padding(element), 0)
      expect(getComputedStyle(note).borderTopWidth).toBe('0px')
    })
  })
}
