/**
 * The conflict alert: the sentence and its live announcement, the focus on arrival, the three
 * requests, `busy` per choice, and the differences drawn as removed and added.
 */
import { afterEach, describe, expect, it } from 'vitest'
import './conflict-alert'
import { conflictText, type LintjeConflictAlert } from './conflict-alert'
import type { LintjeButton } from '../../../primitives/button/button'

async function mount(props: Partial<LintjeConflictAlert> = {}): Promise<LintjeConflictAlert> {
  const element = Object.assign(document.createElement('lintje-conflict-alert'), {
    who: 'M. Jansen',
    when: '10:40',
    item: 'deze melding',
    ...props,
  })
  document.body.append(element)
  await element.updateComplete
  return element
}

const buttons = (element: LintjeConflictAlert): LintjeButton[] => [
  ...element.shadowRoot!.querySelectorAll('lintje-button'),
]

describe('conflictText()', () => {
  it('says who, what and when, and that nothing was saved', () => {
    expect(conflictText('M. Jansen', '10:40', 'deze melding')).toEqual({
      kind: 'warning',
      title: 'M. Jansen heeft deze melding om 10:40 gewijzigd.',
      text: 'Jouw wijzigingen zijn nog niet opgeslagen.',
      live: true,
    })
    expect(conflictText().title).toBe('Iemand anders heeft dit item gewijzigd.')
  })
})

describe('lintje-conflict-alert', () => {
  afterEach(() => (document.body.innerHTML = ''))

  it('takes the focus, with a compact live warning and three buttons', async () => {
    const element = await mount()
    const alert = element.shadowRoot!.querySelector<HTMLElement>('.lintje-conflict-alert')!
    expect(alert.getAttribute('tabindex')).toBe('-1')
    expect(element.shadowRoot!.activeElement).toBe(alert)
    // One live region only: the announcement. The wrapper — with the comparison that opens
    // in it — is not one, or the differences would be read out too.
    expect(
      element.shadowRoot!.querySelector('[role="alert"], [role="status"], [aria-live]'),
    ).toBeNull()
    const announcement = element.shadowRoot!.querySelector('lintje-announcement')!
    expect(announcement.compact).toBe(true)
    expect(announcement.data!.kind).toBe('warning')
    expect(announcement.data!.live).toBe(true)
    expect(buttons(element).map((button) => button.variant)).toEqual([
      'secondary',
      'tertiary',
      'tertiary',
    ])
    expect(buttons(element)[1].textContent!.replace(/\s+/g, ' ').trim()).toBe(
      'Mijn versie opslaan en die van M. Jansen overschrijven',
    )
  })

  it('sends the three requests', async () => {
    const element = await mount()
    const heard: string[] = []
    for (const name of [
      'lintje-conflict-compare',
      'lintje-conflict-keep-mine',
      'lintje-conflict-take-theirs',
    ]) {
      element.addEventListener(name, () => heard.push(name))
    }
    for (const button of buttons(element)) button.click()
    expect(heard).toEqual([
      'lintje-conflict-compare',
      'lintje-conflict-keep-mine',
      'lintje-conflict-take-theirs',
    ])
  })

  it('makes the chosen button busy and the others disabled', async () => {
    const element = await mount({ busy: 'mine' })
    const [compare, mine, theirs] = buttons(element)
    expect(mine.busy).toBe(true)
    expect(theirs.disabled).toBe(true)
    expect(compare.disabled).toBe(true)
  })

  it('shows the differences as the two versions with a legend', async () => {
    const element = await mount({
      changes: [{ label: 'Omschrijving', mine: 'vergaderzaal 1', theirs: 'vergaderzaal 2' }],
    })
    expect(element.shadowRoot!.querySelector('.lintje-conflict-alert__changes')).toBeNull()
    expect(buttons(element)[0].expanded).toBe(false)
    buttons(element)[0].click()
    await element.updateComplete
    expect(buttons(element)[0].expanded).toBe(true)
    const kinds = [...element.shadowRoot!.querySelectorAll('lintje-highlight')].map((h) => [
      h.kind,
      h.textContent,
      h.label,
    ])
    expect(kinds).toEqual([
      ['removed', 'vergaderzaal 1', 'jouw versie'],
      ['added', 'vergaderzaal 2', 'de versie van M. Jansen'],
    ])
    expect(element.shadowRoot!.querySelector('.lintje-conflict-alert__legend')!.textContent).toBe(
      'Doorgehaald: jouw versie · onderstreept: de versie van M. Jansen',
    )
  })
})
