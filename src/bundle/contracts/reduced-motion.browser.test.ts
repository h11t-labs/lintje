/**
 * Reduced motion (every browser test runs with it): only opacity moves, in 80 ms. The focus ring
 * and a colour change, also one a child inherits, stand at once.
 */
import { afterEach, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { TAB } from '../../core/test-keys'
import '../../components/actions/button/button'
import type { LintjeButton } from '../../components/actions/button/button'

afterEach(() => {
  document.body.replaceChildren()
})

it('transitions only opacity on a focused button and the label in it', async () => {
  const element = document.createElement('lintje-button') as LintjeButton
  element.textContent = 'Opslaan'
  document.body.append(element)
  await element.updateComplete
  // WebKit sends the key only to a document that holds the focus.
  const start = Object.assign(document.createElement('input'), { ariaLabel: 'Zoeken' })
  element.before(start)
  start.focus()
  await userEvent.keyboard(TAB)

  const button = element.shadowRoot!.querySelector<HTMLElement>('button')!
  expect(button.matches(':focus-visible')).toBe(true)
  const label = button.querySelector<HTMLElement>('.lintje-button__label')!
  for (const box of [button, label]) {
    const style = getComputedStyle(box)
    expect(style.transitionProperty).toBe('opacity')
    expect(style.transitionDuration).toBe('0.08s')
  }
})
