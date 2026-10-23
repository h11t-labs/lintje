/**
 * The toast's live region: drawn empty, filled on the next frame, so a screen
 * reader announces the message of a toast that was just added.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'lit'
import { renderIcon } from '../../../icons/render'
import './toast'
import type { LintjeToast } from './toast'

const nextFrame = (): Promise<unknown> => new Promise((resolve) => requestAnimationFrame(resolve))

afterEach(() => {
  vi.useRealTimers()
  document.body.replaceChildren()
})

async function mount(
  action?: string,
  kind: LintjeToast['kind'] = 'ok',
): Promise<{ toast: LintjeToast; closed: () => number }> {
  const toast = document.createElement('lintje-toast') as LintjeToast
  toast.kind = kind
  if (action) toast.action = action
  toast.textContent = 'Melding gearchiveerd'
  let count = 0
  toast.addEventListener('lintje-close', () => count++)
  document.body.append(toast)
  await toast.updateComplete
  return { toast, closed: () => count }
}

const statusOf = (toast: LintjeToast): HTMLElement =>
  toast.shadowRoot!.querySelector<HTMLElement>('[role="status"]')!

describe('lintje-toast', () => {
  it('receives the shell kind and resets to ok for the next default toast', async () => {
    await import('../../frame/shell/shell')
    const shell = document.createElement('lintje-shell')
    shell.data = { name: 'Voorbeeld', navigation: [] }
    document.body.append(shell)
    await shell.updateComplete
    shell.showToast('Controleer je wijzigingen', 'warning')
    await shell.updateComplete
    const toast = shell.shadowRoot!.querySelector('lintje-toast')!
    await toast.updateComplete
    expect(toast.kind).toBe('warning')
    shell.requestUpdate()
    await shell.updateComplete
    expect(toast.kind).toBe('warning')
    shell.showToast('Opgeslagen')
    await shell.updateComplete
    await toast.updateComplete
    expect(toast.kind).toBe('ok')
  })

  it.each(['error', 'warning'] as const)('keeps a %s toast until closed', async (kind) => {
    vi.useFakeTimers()
    const { toast, closed } = await mount(undefined, kind)
    vi.advanceTimersByTime(60_000)
    expect(closed()).toBe(0)
    toast.filled = true
    await toast.updateComplete
    toast.shadowRoot!.querySelector<HTMLButtonElement>('.lintje-toast__close')!.click()
    expect(closed()).toBe(1)
  })

  it.each([
    ['ok', 'functioneel-cirkel-vinkje', 'functioneel-cirkel-vinkje-gekleurd'],
    ['error', 'functioneel-foutmelding', 'functioneel-foutmelding-gekleurd'],
    ['info', 'functioneel-info', 'functioneel-info-gekleurd'],
    ['warning', 'functioneel-waarschuwing', 'functioneel-waarschuwing-gekleurd'],
  ] as const)(
    'draws the shared glyph for %s, coloured in the new style',
    async (kind, icon, coloured) => {
      const glyph = async (): Promise<string> => {
        const { toast } = await mount(undefined, kind)
        toast.filled = true
        await toast.updateComplete
        return toast.shadowRoot!.querySelector('.lintje-toast__icon svg')!.innerHTML
      }
      const drawn = (name: string): string => {
        const expected = document.createElement('div')
        render(renderIcon(name), expected)
        return expected.querySelector('svg')!.innerHTML
      }
      expect(await glyph()).toBe(drawn(icon))
      document.documentElement.dataset.style = 'new'
      try {
        expect(await glyph()).toBe(drawn(coloured))
      } finally {
        delete document.documentElement.dataset.style
      }
    },
  )

  it('puts its content into a status region that is already there', async () => {
    const toast = document.createElement('lintje-toast') as LintjeToast
    toast.textContent = 'Selectie gekopieerd'
    document.body.append(toast)
    await toast.updateComplete
    const region = toast.shadowRoot!.querySelector('[role="status"]') as HTMLElement
    expect(region).not.toBeNull()
    expect(region.children).toHaveLength(0)
    await nextFrame()
    await toast.updateComplete
    expect(toast.shadowRoot!.querySelector('[role="status"]')).toBe(region)
    expect(region.querySelector('slot')).not.toBeNull()
    expect(region.querySelector('.lintje-toast__close')).not.toBeNull()
  })

  it('does not empty the region again when its kind changes', async () => {
    const toast = document.createElement('lintje-toast') as LintjeToast
    document.body.append(toast)
    await toast.updateComplete
    await nextFrame()
    await toast.updateComplete
    toast.kind = 'error'
    await toast.updateComplete
    expect(toast.shadowRoot!.querySelector('[role="status"] slot')).not.toBeNull()
  })

  it.each(['ok', 'info'] as const)('closes a %s toast after six seconds', async (kind) => {
    vi.useFakeTimers()
    const { closed } = await mount(undefined, kind)
    vi.advanceTimersByTime(5999)
    expect(closed()).toBe(0)
    vi.advanceTimersByTime(1)
    expect(closed()).toBe(1)
  })

  it('keeps a toast with an action until it is closed', async () => {
    vi.useFakeTimers()
    const { closed } = await mount('Ongedaan maken')
    vi.advanceTimersByTime(60_000)
    expect(closed()).toBe(0)
  })

  it('holds while the pointer is on it and starts its six seconds again after', async () => {
    vi.useFakeTimers()
    const { toast, closed } = await mount()
    vi.advanceTimersByTime(5000)
    statusOf(toast).dispatchEvent(new MouseEvent('mouseenter'))
    vi.advanceTimersByTime(20_000)
    expect(closed()).toBe(0)
    statusOf(toast).dispatchEvent(new MouseEvent('mouseleave'))
    vi.advanceTimersByTime(5999)
    expect(closed()).toBe(0)
    vi.advanceTimersByTime(1)
    expect(closed()).toBe(1)
  })

  it('holds while the focus is in it, and gives the focus back when it closes', async () => {
    vi.useFakeTimers()
    const before = document.createElement('button')
    document.body.append(before)
    before.focus()
    const { toast, closed } = await mount()
    toast.filled = true
    await toast.updateComplete
    const close = toast.shadowRoot!.querySelector<HTMLButtonElement>('.lintje-toast__close')!
    close.focus()
    vi.advanceTimersByTime(20_000)
    expect(closed()).toBe(0)
    let focusAtClose: Element | null = null
    toast.addEventListener('lintje-close', () => (focusAtClose = document.activeElement))
    close.click()
    expect(closed()).toBe(1)
    expect(focusAtClose).toBe(before)
  })

  it.each([
    ['error', undefined],
    ['warning', undefined],
    ['ok', 'Ongedaan maken'],
  ] as const)('stays open on an Escape elsewhere: %s', async (kind, action) => {
    const elsewhere = document.createElement('button')
    document.body.append(elsewhere)
    const { toast, closed } = await mount(action, kind)
    toast.filled = true
    await toast.updateComplete
    elsewhere.focus()
    elsewhere.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
    )
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(closed()).toBe(0)
  })

  it.each(['.lintje-toast__close', '.lintje-toast__action'])(
    'closes on an Escape from %s, and the Escape goes no further',
    async (selector) => {
      const { toast, closed } = await mount('Ongedaan maken', 'error')
      toast.filled = true
      await toast.updateComplete
      let heard = 0
      const listen = (): number => heard++
      document.addEventListener('keydown', listen)
      const button = toast.shadowRoot!.querySelector<HTMLButtonElement>(selector)!
      button.focus()
      button.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
      )
      document.removeEventListener('keydown', listen)
      expect(closed()).toBe(1)
      expect(heard).toBe(0)
    },
  )

  it('gives the focus to the main region when the earlier element is gone', async () => {
    const main = document.createElement('main')
    main.tabIndex = -1
    const before = document.createElement('button')
    document.body.append(main, before)
    before.focus()
    const { toast } = await mount()
    toast.filled = true
    await toast.updateComplete
    const close = toast.shadowRoot!.querySelector<HTMLButtonElement>('.lintje-toast__close')!
    close.focus()
    before.remove()
    close.click()
    expect(document.activeElement).toBe(main)
  })
})
