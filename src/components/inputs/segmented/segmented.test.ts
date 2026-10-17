/**
 * The segmented control's markup: which option is pressed, what a choice tells, an option's
 * count, and that an error marks the frame. Whether the row fits its room is measured in headless Chrome.
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

const optionButtons = (element: LintjeSegmented): HTMLButtonElement[] => [
  ...frame(element).querySelectorAll<HTMLButtonElement>('.lintje-segmented__option'),
]
const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()))

/** What the status region says, after its fill frame. */
async function said(element: LintjeSegmented): Promise<string> {
  await element.updateComplete
  await nextFrame()
  await element.updateComplete
  return element.renderRoot.querySelector('[role="status"]')!.textContent ?? ''
}

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

  it('stays a row when the row measures a pixel wider than its frame, and turns column past that', async () => {
    const element = await mount()
    const sizes = { clientWidth: 415, scrollWidth: 416 }
    for (const key of ['clientWidth', 'scrollWidth'] as const) {
      Object.defineProperty(frame(element), key, { get: () => sizes[key], configurable: true })
    }
    element.requestUpdate()
    await element.updateComplete
    await element.updateComplete
    expect(frame(element).classList.contains('is-column')).toBe(false)

    sizes.scrollWidth = 417
    element.requestUpdate()
    await element.updateComplete
    await element.updateComplete
    expect(frame(element).classList.contains('is-column')).toBe(true)
  })

  it('marks the frame with an error, as the message under it says', async () => {
    const element = await mount({ error: 'Kies een periode.' })
    expect(frame(element).classList.contains('is-error')).toBe(true)
    expect(frame(element).getAttribute('aria-invalid')).toBe('true')
    element.error = undefined
    await element.updateComplete
    expect(frame(element).classList.contains('is-error')).toBe(false)
  })

  it('draws a count as a badge after the label, nought included', async () => {
    const element = await mount({
      options: [
        { value: 'week', label: 'Week', count: 4 },
        { value: 'maand', label: 'Maand', count: 0 },
        { value: 'jaar', label: 'Jaar' },
      ],
    })
    const badges = [...frame(element).querySelectorAll('.lintje-segmented__option')].map(
      (option) => option.querySelector('lintje-badge[variant="count"]')?.textContent,
    )
    expect(badges).toEqual(['4', '0', undefined])
  })

  it("says the description of the reader's own choice, and nothing for one without or for the host", async () => {
    const described = [
      { value: 'week', label: 'Week' },
      { value: 'maand', label: 'Maand', description: 'Telt per kalendermaand.' },
      { value: 'jaar', label: 'Jaar' },
    ]
    const element = await mount({ options: described })
    optionButtons(element)[1]!.click()
    expect(await said(element)).toBe('Telt per kalendermaand.')
    optionButtons(element)[2]!.click()
    expect(await said(element)).toBe('')

    const quiet = await mount({ options: described })
    quiet.value = 'maand'
    expect(await said(quiet)).toBe('')
    expect(frame(quiet).getAttribute('aria-describedby')).toBe(
      quiet.renderRoot.querySelector('.lintje-segmented__description')!.id,
    )
  })
})
