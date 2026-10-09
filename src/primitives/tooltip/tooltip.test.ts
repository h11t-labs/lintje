/** The tooltip: at once on focus, after a pause on the pointer, hoverable, gone on Escape. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './tooltip'
import '../button/button'
import '../icon-button/icon-button'
import { TOOLTIP_DELAY, TOOLTIP_LINGER, type LintjeTooltip } from './tooltip'

async function mount(props: Record<string, unknown> = {}): Promise<LintjeTooltip> {
  const element = Object.assign(document.createElement('lintje-tooltip'), {
    text: 'Talen omwisselen',
    ...props,
  })
  element.innerHTML = '<button type="button">Wissel</button>'
  document.body.append(element)
  await element.updateComplete
  return element
}

const bubble = (element: HTMLElement): HTMLElement | null =>
  element.shadowRoot!.querySelector('[role="tooltip"]')

describe('lintje-tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows at once on focus and hides on Escape', async () => {
    const element = await mount()
    expect(bubble(element)).toBeNull()

    element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await element.updateComplete
    expect(bubble(element)!.textContent).toBe('Talen omwisselen')

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await element.updateComplete
    expect(bubble(element)).toBeNull()
  })

  it('waits for the pointer to rest', async () => {
    const element = await mount()
    element.dispatchEvent(new MouseEvent('mouseenter'))
    await element.updateComplete
    expect(bubble(element)).toBeNull()

    vi.advanceTimersByTime(TOOLTIP_DELAY)
    await element.updateComplete
    expect(bubble(element)).not.toBeNull()

    element.dispatchEvent(new MouseEvent('mouseleave'))
    vi.advanceTimersByTime(TOOLTIP_LINGER)
    await element.updateComplete
    expect(bubble(element)).toBeNull()
  })

  it('stays while the pointer crosses onto the bubble', async () => {
    const element = await mount()
    element.dispatchEvent(new MouseEvent('mouseenter'))
    vi.advanceTimersByTime(TOOLTIP_DELAY)
    await element.updateComplete
    element.dispatchEvent(new MouseEvent('mouseleave'))
    vi.advanceTimersByTime(TOOLTIP_LINGER / 2)
    // The bubble is in the host's shadow root: entering it enters the host again.
    element.dispatchEvent(new MouseEvent('mouseenter'))
    vi.advanceTimersByTime(TOOLTIP_LINGER * 2)
    await element.updateComplete
    expect(bubble(element)).not.toBeNull()
  })

  it('hides on an Escape pressed anywhere, the focus elsewhere', async () => {
    const element = await mount()
    element.dispatchEvent(new MouseEvent('mouseenter'))
    vi.advanceTimersByTime(TOOLTIP_DELAY)
    await element.updateComplete
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await element.updateComplete
    expect(bubble(element)).toBeNull()
  })

  it('describes the wrapped element, unless the text is already its name', async () => {
    const described = await mount()
    expect(described.firstElementChild!.getAttribute('aria-description')).toBe('Talen omwisselen')
    const named = await mount({ noDescribe: true })
    expect(named.firstElementChild!.hasAttribute('aria-description')).toBe(false)
  })

  it('describes the control inside a button host, through its description', async () => {
    for (const markup of [
      '<lintje-button>Wissel</lintje-button>',
      '<lintje-icon-button icon="functioneel-pijlen" label="Wissel"></lintje-icon-button>',
    ]) {
      const element = Object.assign(document.createElement('lintje-tooltip'), {
        text: 'Talen omwisselen',
      })
      element.innerHTML = markup
      document.body.append(element)
      await element.updateComplete
      const host = element.firstElementChild as HTMLElement & {
        description?: string
        updateComplete: Promise<boolean>
      }
      await host.updateComplete
      const control = host.shadowRoot!.querySelector('button')!
      expect(host.hasAttribute('aria-description')).toBe(false)
      expect(control.getAttribute('aria-description')).toBe('Talen omwisselen')

      element.noDescribe = true
      await element.updateComplete
      await host.updateComplete
      expect(control.hasAttribute('aria-description')).toBe(false)
      element.remove()
    }
  })
})
