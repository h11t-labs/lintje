/** The copy button: what it copies, the two seconds of "Gekopieerd", and a refusal. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './copy-button'
import type { LintjeCopyButton } from './copy-button'
import { ANNOUNCE_GAP, COPIED_FOR } from '../../shared/copied'

const writeText = vi.fn<(text: string) => Promise<void>>()

async function mount(props: Record<string, unknown>): Promise<LintjeCopyButton> {
  const element = Object.assign(document.createElement('lintje-copy-button'), props)
  document.body.append(element)
  await element.updateComplete
  return element
}

const status = (element: LintjeCopyButton): string =>
  element.shadowRoot!.querySelector('[role="status"]')!.textContent!.trim()

/** Presses the button and waits for the clipboard and the render. */
async function press(element: LintjeCopyButton): Promise<void> {
  const button = element.shadowRoot!.querySelector<HTMLElement>(
    'lintje-button, lintje-icon-button',
  )!
  button.click()
  await Promise.resolve()
  await Promise.resolve()
  await element.updateComplete
}

describe('lintje-copy-button', () => {
  beforeEach(() => {
    writeText.mockReset().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('copies its text, says so for two seconds and sends lintje-copy', async () => {
    const element = await mount({ text: 'https://intranet.example/opname/4821' })
    const copied = vi.fn()
    element.addEventListener('lintje-copy', (event) => copied((event as CustomEvent).detail))

    await press(element)
    expect(writeText).toHaveBeenCalledWith('https://intranet.example/opname/4821')
    expect(copied).toHaveBeenCalledWith('https://intranet.example/opname/4821')
    expect(status(element)).toBe('Gekopieerd')
    const hidden = element.shadowRoot!.querySelector('.lintje-copy-button__label.is-hidden')!
    expect(hidden.textContent).toBe('Kopiëren')

    vi.advanceTimersByTime(COPIED_FOR)
    await element.updateComplete
    expect(status(element)).toBe('')
  })

  it('copies the text of the element named in for', async () => {
    document.body.innerHTML = '<p id="transcript">  De aanvrager kwam uit Utrecht.  </p>'
    const element = await mount({})
    element.setAttribute('for', 'transcript')
    await element.updateComplete
    await press(element)
    expect(writeText).toHaveBeenCalledWith('De aanvrager kwam uit Utrecht.')
  })

  it('is disabled with nothing to copy', async () => {
    const element = await mount({})
    const button = element.shadowRoot!.querySelector('lintje-button')!
    expect(button.disabled).toBe(true)
  })

  it('is disabled while its for target is missing, and not when it appears', async () => {
    const element = await mount({})
    element.setAttribute('for', 'verslag')
    await element.updateComplete
    const failed = vi.fn()
    element.addEventListener('lintje-copy-error', failed)
    const button = element.shadowRoot!.querySelector('lintje-button')!
    expect(button.disabled).toBe(true)
    await press(element)
    expect(failed).not.toHaveBeenCalled()
    expect(element.shadowRoot!.querySelector('lintje-toast')).toBeNull()

    document.body.insertAdjacentHTML('afterbegin', '<p id="verslag">Opname 4821</p>')
    await Promise.resolve()
    await element.updateComplete
    expect(button.disabled).toBe(false)
  })

  it('says "Gekopieerd" again on a second copy: empties the status first', async () => {
    const element = await mount({ text: 'abc' })
    await press(element)
    expect(status(element)).toBe('Gekopieerd')
    await press(element)
    expect(status(element)).toBe('')
    vi.advanceTimersByTime(ANNOUNCE_GAP)
    await element.updateComplete
    expect(status(element)).toBe('Gekopieerd')
  })

  it('swaps the icon button label in the icon-only form', async () => {
    const element = await mount({ text: 'abc', iconOnly: true })
    const button = element.shadowRoot!.querySelector('lintje-icon-button')!
    expect(button.label).toBe('Kopiëren')
    await press(element)
    expect(button.label).toBe('Gekopieerd')
    expect(button.icon).toBe('functioneel-vinkje')
  })

  it('draws the labelled form primary and compact where copying is the goal', async () => {
    const element = await mount({ text: 'abc', variant: 'primary', size: 'compact' })
    const button = element.shadowRoot!.querySelector('lintje-button')!
    expect(button.getAttribute('variant')).toBe('primary')
    expect(button.getAttribute('size')).toBe('compact')
  })

  it('draws the icon-only form flat beside other quiet tools', async () => {
    const element = await mount({ text: 'abc', iconOnly: true, variant: 'flat' })
    expect(element.shadowRoot!.querySelector('lintje-icon-button')!.variant).toBe('flat')
  })

  it('shows an error toast and sends lintje-copy-error when the browser refuses', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    const element = await mount({ text: 'abc' })
    const failed = vi.fn()
    element.addEventListener('lintje-copy-error', failed)
    await press(element)
    await element.updateComplete
    expect(failed).toHaveBeenCalledOnce()
    const toast = element.shadowRoot!.querySelector('lintje-toast')!
    expect(toast.getAttribute('kind')).toBe('error')
    expect(toast.textContent).toContain('Kopiëren is niet gelukt')

    const outside = vi.fn()
    document.addEventListener('lintje-close', outside)
    toast.dispatchEvent(new CustomEvent('lintje-close', { bubbles: true, composed: true }))
    await element.updateComplete
    document.removeEventListener('lintje-close', outside)
    expect(outside).not.toHaveBeenCalled()
    expect(element.shadowRoot!.querySelector('lintje-toast')).toBeNull()
  })
})
