/** A busy form disables its fields natively; the field that had the focus gets it back after. */
import { describe, expect, it } from 'vitest'
import { deepActiveElement } from '../../../core/focus'
import './form'
import '../../inputs/text-input/text-input'
import type { LintjeForm } from './form'

const settle = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)))

describe('lintje-form while busy', () => {
  it('gives the focus back to the field that submitted, once the save is done', async () => {
    const form = document.createElement('lintje-form') as LintjeForm
    form.innerHTML = '<lintje-text-input name="titel" label="Titel"></lintje-text-input>'
    document.body.append(form)
    await form.updateComplete
    const host = form.querySelector('lintje-text-input')!
    await (host as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
    const input = host.shadowRoot!.querySelector('input')!
    input.focus()
    expect(deepActiveElement()).toBe(input)

    form.busy = true
    await settle()
    expect(input.disabled).toBe(true)
    form.busy = false
    await settle()
    await settle()
    expect(input.disabled).toBe(false)
    expect(deepActiveElement()).toBe(input)
    form.remove()
  })
})
