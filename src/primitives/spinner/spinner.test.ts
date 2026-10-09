/** The spinner: the ring is decoration, the label is the status. */
import { describe, expect, it } from 'vitest'
import './spinner'
import type { LintjeSpinner } from './spinner'

const nextFrame = (): Promise<unknown> => new Promise((resolve) => requestAnimationFrame(resolve))

async function mount(props: Record<string, unknown> = {}): Promise<HTMLElement> {
  const element = Object.assign(document.createElement('lintje-spinner'), props)
  document.body.append(element)
  await element.updateComplete
  return element.shadowRoot!.querySelector<HTMLElement>('.lintje-spinner')!
}

describe('lintje-spinner', () => {
  it('is a status with its label, and nothing to a screen reader without one', async () => {
    const labelled = await mount({ label: 'Locaties ophalen' })
    expect(labelled.getAttribute('role')).toBe('status')
    // The region stands empty first and is filled a frame later, so the label is announced.
    expect(labelled.textContent?.trim()).toBe('')
    await nextFrame()
    await (document.body.lastElementChild as LintjeSpinner).updateComplete
    expect(labelled.textContent).toContain('Locaties ophalen')
    expect(labelled.querySelector('.lintje-spinner__ring')!.getAttribute('aria-hidden')).toBe(
      'true',
    )

    const bare = await mount()
    expect(bare.hasAttribute('role')).toBe(false)
  })

  it('takes its size and its layout as classes', async () => {
    const block = await mount({ size: 40, stacked: true, label: 'Laden' })
    expect(block.classList.contains('lintje-spinner--40')).toBe(true)
    expect(block.classList.contains('lintje-spinner--stacked')).toBe(true)
  })
})
