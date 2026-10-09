/**
 * The session warning: the phase arithmetic and the per-minute title, the window opening and
 * closing on the injected clock, the expired state, the events, and the restored-draft notice.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './session-expiry'
import { clockTime, sessionPhase, warningTitle, type LintjeSessionExpiry } from './session-expiry'

const START = new Date('2026-10-04T10:40:00').getTime()
let time = START

beforeEach(() => {
  vi.useFakeTimers()
  time = START
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

async function mount(attributes: Record<string, string>): Promise<LintjeSessionExpiry> {
  const element = document.createElement('lintje-session-expiry')
  element.now = () => time
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
  document.body.append(element)
  await element.updateComplete
  return element
}

const dialog = (element: LintjeSessionExpiry): HTMLElement | null =>
  element.shadowRoot!.querySelector('[role="alertdialog"]')

/** Moves the clock and lets the element's one-second tick see it. */
async function advance(element: LintjeSessionExpiry, ms: number): Promise<void> {
  time += ms
  vi.advanceTimersByTime(1000)
  await element.updateComplete
}

describe('arithmetic', () => {
  it('knows the phase and counts the title down per minute', () => {
    expect(sessionPhase(null, 0, 120)).toBe('active')
    expect(sessionPhase(1_000_000, 1_000_000 - 121_000, 120)).toBe('active')
    expect(sessionPhase(1_000_000, 1_000_000 - 120_000, 120)).toBe('warning')
    expect(sessionPhase(1_000_000, 1_000_000, 120)).toBe('expired')
    expect(sessionPhase(null, 0, 120, true)).toBe('expired')
    expect(warningTitle(120_000)).toBe('Je sessie verloopt over 2 minuten')
    expect(warningTitle(61_000)).toBe('Je sessie verloopt over 2 minuten')
    expect(warningTitle(59_000)).toBe('Je sessie verloopt over 1 minuut')
    expect(clockTime('2026-10-04T10:42:00')).toBe('10:42')
    expect(clockTime('morgen')).toBeNull()
  })
})

describe('lintje-session-expiry', () => {
  it('opens the warning no later than twenty seconds before the end', async () => {
    const element = await mount({
      'expires-at': new Date(START + 60_000).toISOString(),
      'warn-before': '5',
    })
    expect(dialog(element)).toBeNull()
    await advance(element, 40_000)
    expect(dialog(element)).not.toBeNull()
  })

  it('opens the warning two minutes before the end, as an alertdialog', async () => {
    const end = new Date(START + 3 * 60_000).toISOString()
    const element = await mount({ 'expires-at': end })
    expect(dialog(element)).toBeNull()

    await advance(element, 60_000)
    const window = dialog(element)!
    expect(window.getAttribute('aria-labelledby')).toBe('lintje-session-expiry-heading')
    expect(window.querySelector('h2')!.textContent!.trim()).toBe(
      'Je sessie verloopt over 2 minuten',
    )
    const labels = [...window.querySelectorAll('lintje-button')].map((b) => b.textContent!.trim())
    expect(labels).toEqual(['Afmelden', 'Aangemeld blijven'])

    await advance(element, 70_000)
    expect(dialog(element)!.querySelector('h2')!.textContent!.trim()).toBe(
      'Je sessie verloopt over 1 minuut',
    )
  })

  it('sends the two requests and closes when the host moves the end forward', async () => {
    const element = await mount({ 'expires-at': new Date(START + 60_000).toISOString() })
    const sent: string[] = []
    for (const name of ['lintje-session-extend', 'lintje-logout'])
      element.addEventListener(name, () => sent.push(name))
    const buttons = dialog(element)!.querySelectorAll('lintje-button')
    buttons[0].click()
    buttons[1].click()
    expect(sent).toEqual(['lintje-logout', 'lintje-session-extend'])

    element.busy = true
    await element.updateComplete
    expect(
      dialog(element)!.querySelector('.lintje-session-expiry__primary')!.hasAttribute('busy'),
    ).toBe(true)

    element.busy = false
    element.expiresAt = new Date(START + 30 * 60_000).toISOString()
    await element.updateComplete
    expect(dialog(element)).toBeNull()
  })

  it('holds the focus on its buttons and gives it back when the session is extended', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const element = await mount({ 'expires-at': new Date(START + 60_000).toISOString() })
    await Promise.resolve()
    const primary = dialog(element)!.querySelector('.lintje-session-expiry__primary')!
    expect(primary.shadowRoot!.activeElement).toBe(primary.shadowRoot!.querySelector('button'))
    const tab = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      composed: true,
      cancelable: true,
    })
    primary.shadowRoot!.querySelector('button')!.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')

    element.expiresAt = new Date(START + 30 * 60_000).toISOString()
    await element.updateComplete
    expect(document.activeElement).toBe(opener)
    expect(document.body.style.overflow).toBe('')
  })

  it('turns into "Je bent afgemeld" with one button when the end passes or the host says so', async () => {
    const element = await mount({ 'expires-at': new Date(START + 60_000).toISOString() })
    await advance(element, 61_000)
    const window = dialog(element)!
    expect(window.querySelector('h2')!.textContent!.trim()).toBe('Je bent afgemeld')
    const buttons = window.querySelectorAll('lintje-button')
    expect(buttons).toHaveLength(1)
    let logins = 0
    element.addEventListener('lintje-login', () => logins++)
    buttons[0].click()
    expect(logins).toBe(1)

    const told = await mount({ expired: '' })
    expect(dialog(told)!.querySelector('h2')!.textContent!.trim()).toBe('Je bent afgemeld')
  })

  it('swallows Escape: only the buttons answer', async () => {
    const element = await mount({ 'expires-at': new Date(START + 60_000).toISOString() })
    let heard = 0
    document.addEventListener('keydown', () => heard++)
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(heard).toBe(0)
    expect(dialog(element)).not.toBeNull()
  })

  it('shows the restored draft with the time and a discard action, as part of the page', async () => {
    const element = await mount({ 'restored-at': '2026-10-04T10:42:00' })
    const notice = element.shadowRoot!.querySelector('lintje-announcement')!
    await notice.updateComplete
    expect(notice.compact).toBe(true)
    // Not live: the notice is there when the page loads (an announcement is a live region
    // only with `live: true`).
    const status = notice.shadowRoot!.querySelector('.lintje-announcement')!
    expect(status.hasAttribute('role')).toBe(false)
    expect(status.textContent).toContain('Je concept is teruggezet.')
    expect(status.textContent).toContain('Het is van 10:42')
    let discards = 0
    element.addEventListener('lintje-draft-discard', () => discards++)
    notice.querySelector<HTMLElement>('lintje-button[slot="action"]')!.click()
    expect(discards).toBe(1)
    expect(dialog(element)).toBeNull()
  })

  it('after a plain reload says when the draft is from, not that it predates a logout', async () => {
    const element = await mount({
      'restored-at': '2026-10-04T10:42:00',
      'restored-reason': 'reload',
    })
    const notice = element.shadowRoot!.querySelector('lintje-announcement')!
    await notice.updateComplete
    const status = notice.shadowRoot!.querySelector('.lintje-announcement')!
    expect(status.textContent).toContain('Je concept van 10:42 is teruggezet.')
    expect(status.textContent).not.toContain('afmelden')
  })

  it('does not tick without an end, and does once there is one', async () => {
    await mount({})
    expect(vi.getTimerCount()).toBe(0)
    const element = document.querySelector('lintje-session-expiry')!
    element.setAttribute('expires-at', '2026-10-04T10:44:00')
    await element.updateComplete
    expect(vi.getTimerCount()).toBe(1)
    element.removeAttribute('expires-at')
    await element.updateComplete
    expect(vi.getTimerCount()).toBe(0)
  })
})
