/**
 * The toast's live region: drawn empty, filled on the next frame, so a screen
 * reader announces the message of a toast that was just added.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import './toast'
import type { LintjeToast } from './toast'

const nextFrame = (): Promise<unknown> => new Promise((resolve) => requestAnimationFrame(resolve))

afterEach(() => {
  vi.useRealTimers()
  document.body.replaceChildren()
})

async function mount(action?: string): Promise<{ toast: LintjeToast; closed: () => number }> {
  const toast = document.createElement('lintje-toast') as LintjeToast
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

  it('closes an ok toast after six seconds', async () => {
    vi.useFakeTimers()
    const { closed } = await mount()
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
