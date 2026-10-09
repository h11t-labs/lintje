/**
 * The action bar: the status per state, and the busy state handed to its buttons and back.
 */
import { describe, expect, it } from 'vitest'
import './form-actions'
import { clockTime, type LintjeFormActions } from './form-actions'
import type { LintjeButton } from '../../../primitives/button/button'

async function mount(
  state: LintjeFormActions['state'],
  savedAt?: string,
): Promise<LintjeFormActions> {
  const element = document.createElement('lintje-form-actions')
  element.state = state
  if (savedAt) element.savedAt = savedAt
  element.innerHTML = `
    <lintje-button variant="tertiary">Annuleren</lintje-button>
    <lintje-button variant="secondary" disabled>Concept opslaan</lintje-button>
    <lintje-button variant="primary" type="submit">Versturen</lintje-button>`
  document.body.append(element)
  await element.updateComplete
  return element
}

const status = (element: LintjeFormActions): string =>
  element.shadowRoot!.querySelector('[role="status"]')!.textContent!.replace(/\s+/g, ' ').trim()

describe('lintje-form-actions', () => {
  it('prints hours and minutes, whatever it is given', () => {
    expect(clockTime('10:42')).toBe('10:42')
    expect(clockTime(new Date(2026, 9, 4, 9, 5))).toBe('09:05')
    expect(clockTime(new Date(2026, 9, 4, 14, 30).toISOString())).toBe('14:30')
    expect(clockTime('gisteren')).toBe('')
  })

  it('says the state in a status region', async () => {
    const dirty = await mount('dirty')
    expect(status(dirty)).toBe('Wijzigingen nog niet opgeslagen')
    expect(dirty.shadowRoot!.querySelector('.lintje-form-actions__dot')).not.toBeNull()
    expect(status(await mount('saved', '10:42'))).toBe('Opgeslagen om 10:42')
    expect(status(await mount('draft', '10:42'))).toBe('Concept opgeslagen om 10:42')
    expect(status(await mount(''))).toBe('')
  })

  it('while busy marks the primary busy and the others disabled, and hands it all back', async () => {
    const element = await mount('busy')
    const [cancel, draft, send] = Array.from(
      element.querySelectorAll<LintjeButton>('lintje-button'),
    )
    expect(status(element)).toBe('Bezig met opslaan')
    expect(send.busy).toBe(true)
    expect(cancel.disabled).toBe(true)
    expect(draft.disabled).toBe(true)

    element.state = 'dirty'
    await element.updateComplete
    expect(send.busy).toBe(false)
    expect(cancel.disabled).toBe(false)
    // It was disabled before the bar touched it, and it stays so.
    expect(draft.disabled).toBe(true)
  })
})
