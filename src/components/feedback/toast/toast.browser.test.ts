/** A toast in a browser: its bar in the line colour of its status, light and dark, and its close under the pointer. */
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import './toast'
import type { LintjeToast, ToastKind } from './toast'

const LINE: Record<ToastKind, string> = {
  ok: '--color-success-line',
  error: '--color-error-line',
  info: '--color-info-line',
  warning: '--color-alert-warning-line',
}

/** A token's colour as the browser computes it on the page. */
function resolved(token: string): string {
  const probe = document.createElement('span')
  probe.style.color = `var(${token})`
  document.body.append(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}

afterEach(() => {
  document.body.replaceChildren()
  document.documentElement.removeAttribute('data-style-version')
  document.documentElement.removeAttribute('data-mode')
})

for (const mode of ['light', 'dark'] as const) {
  describe(`a toast's bar in the new style, ${mode}`, () => {
    it.each(Object.keys(LINE) as ToastKind[])('%s takes its line colour', async (kind) => {
      document.documentElement.dataset.styleVersion = 'new'
      document.documentElement.dataset.mode = mode
      const toast = Object.assign(document.createElement('lintje-toast'), { kind })
      toast.textContent = 'De melding is opgeslagen.'
      document.body.append(toast)
      await (toast as LintjeToast).updateComplete
      const box = toast.shadowRoot!.querySelector<HTMLElement>('.lintje-toast')!
      const style = getComputedStyle(box)
      expect(parseFloat(style.borderLeftWidth)).toBeGreaterThan(0)
      expect(style.borderLeftColor).toBe(resolved(LINE[kind]))
      expect(style.borderLeftColor).not.toBe(style.color)
    })
  })
}

describe("a toast's bar in the classic style", () => {
  it('is not drawn', async () => {
    const toast = Object.assign(document.createElement('lintje-toast'), { kind: 'ok' as const })
    document.body.append(toast)
    await toast.updateComplete
    const box = toast.shadowRoot!.querySelector<HTMLElement>('.lintje-toast')!
    expect(parseFloat(getComputedStyle(box).borderLeftWidth)).toBe(0)
  })
})

describe("a toast's close button", () => {
  it("takes the text colour under the pointer, as a dialog's does", async () => {
    const toast = Object.assign(document.createElement('lintje-toast'), { kind: 'error' as const })
    document.body.append(toast)
    await toast.updateComplete
    // The buttons draw a frame after the toast arrives.
    await expect.poll(() => toast.shadowRoot!.querySelector('.lintje-toast__close')).toBeTruthy()
    const close = toast.shadowRoot!.querySelector<HTMLElement>('.lintje-toast__close')!
    const muted = getComputedStyle(close).color
    expect(muted).toBe(resolved('--color-text-muted'))
    await userEvent.hover(close)
    await expect.poll(() => getComputedStyle(close).color).toBe(resolved('--color-text-primary'))
  })
})
