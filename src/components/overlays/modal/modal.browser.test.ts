/** The modal in a browser: as high as its content, and the room a chart in it may fill. */
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import './modal'
import type { LintjeModal } from './modal'

async function open(content: HTMLElement): Promise<LintjeModal> {
  const modal = Object.assign(document.createElement('lintje-modal'), { heading: 'Vergroot' })
  modal.append(content)
  document.body.append(modal)
  modal.open = true
  await modal.updateComplete
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  return modal
}

const dialog = (modal: LintjeModal): HTMLElement =>
  modal.shadowRoot!.querySelector<HTMLElement>('.lintje-modal')!
const scrim = (modal: LintjeModal): HTMLElement =>
  modal.shadowRoot!.querySelector<HTMLElement>('.lintje-modal__scrim')!

afterEach(() => {
  document.body.replaceChildren()
})

describe('lintje-modal', () => {
  it('is as high as content of its own height, and gives a chart the whole room', async () => {
    await page.viewport(1280, 900)
    // A drawing with a height of its own, such as a dumbbell's rows.
    const short = document.createElement('div')
    short.style.height = '200px'
    const low = await open(short)
    const room = scrim(low).clientHeight
    expect(dialog(low).getBoundingClientRect().height).toBeLessThan(room / 2)
    // What the body may take: the chart's height token, measured from the room, not the body.
    const body = low.shadowRoot!.querySelector<HTMLElement>('.lintje-modal__body')!
    const expanded = parseFloat(body.style.getPropertyValue('--chart-h-expanded'))
    expect(expanded).toBeGreaterThan(400)
    low.remove()

    // A chart that takes the room it is given fills the dialog to the scrim's padding.
    const filling = document.createElement('div')
    filling.style.height = 'var(--chart-h-main)'
    const full = await open(filling)
    const padding = parseFloat(getComputedStyle(scrim(full)).paddingTop) * 2
    expect(dialog(full).getBoundingClientRect().height).toBeCloseTo(room - padding, -1)
  })
})
