/**
 * The segmented control's markup: which option is pressed, what a choice tells, and that an
 * error marks the frame. Whether the row fits its room is measured in headless Chrome.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import './segmented'
import type { LintjeSegmented } from './segmented'

const OPTIONS = [
  { value: 'week', label: 'Week' },
  { value: 'maand', label: 'Maand' },
]

async function mount(props: Partial<LintjeSegmented> = {}): Promise<LintjeSegmented> {
  const element = document.createElement('lintje-segmented') as LintjeSegmented
  Object.assign(element, { label: 'Periode', options: OPTIONS, value: 'week' }, props)
  document.body.append(element)
  await element.updateComplete
  return element
}

const frame = (element: LintjeSegmented): HTMLElement =>
  element.renderRoot.querySelector<HTMLElement>('.lintje-segmented')!

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('lintje-segmented', () => {
  it('presses the chosen option and commits a click on another', async () => {
    const element = await mount()
    const changes: unknown[] = []
    element.addEventListener('lintje-change', (event) =>
      changes.push((event as CustomEvent).detail),
    )
    const options = frame(element).querySelectorAll<HTMLButtonElement>('.lintje-segmented__option')
    expect([...options].map((option) => option.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
    ])
    options[1].click()
    await element.updateComplete
    expect(changes).toEqual(['maand'])
    expect(options[1].getAttribute('aria-pressed')).toBe('true')
  })

  it('marks the frame with an error, as the message under it says', async () => {
    const element = await mount({ error: 'Kies een periode.' })
    expect(frame(element).classList.contains('is-error')).toBe(true)
    expect(frame(element).getAttribute('aria-invalid')).toBe('true')
    element.error = undefined
    await element.updateComplete
    expect(frame(element).classList.contains('is-error')).toBe(false)
  })
})
