/** The empty state: a real heading at its level, the action only when there is one. */
import { describe, expect, it } from 'vitest'
import './empty-state'
import type { LintjeEmptyState } from './empty-state'

async function mount(props: Partial<LintjeEmptyState>, child = ''): Promise<LintjeEmptyState> {
  const element = Object.assign(document.createElement('lintje-empty-state'), props)
  document.body.append(element)
  await element.updateComplete
  // happy-dom fires `slotchange` only for content that arrives after the first render.
  element.innerHTML = child
  await new Promise((resolve) => setTimeout(resolve))
  await element.updateComplete
  return element
}

describe('lintje-empty-state', () => {
  it('draws the heading as a real heading at its level', async () => {
    const element = await mount({ heading: 'Nog geen opnames', text: 'Upload een opname.' })
    const root = element.shadowRoot!
    expect(root.querySelector('h3')!.textContent).toBe('Nog geen opnames')
    expect(root.querySelector('.lintje-empty-state__text')!.textContent).toBe('Upload een opname.')

    const deeper = await mount({ heading: 'Geen toegang', level: 4 })
    expect(deeper.shadowRoot!.querySelector('h4')).not.toBeNull()
    expect(deeper.shadowRoot!.querySelector('h3')).toBeNull()
  })

  it('hides the action wrapper without an action and shows it with one', async () => {
    const bare = await mount({ heading: 'Je hebt geen toegang tot dit dossier' })
    expect(
      bare.shadowRoot!.querySelector('.lintje-empty-state__action')!.hasAttribute('hidden'),
    ).toBe(true)
    const withAction = await mount(
      { heading: 'Nog geen opnames' },
      '<button>Opname uploaden</button>',
    )
    expect(
      withAction.shadowRoot!.querySelector('.lintje-empty-state__action')!.hasAttribute('hidden'),
    ).toBe(false)
  })

  it('is one line without heading or icon when compact, and a status on request', async () => {
    const element = await mount({
      compact: true,
      status: true,
      heading: 'Niet getoond',
      icon: 'functioneel-zoek',
      text: 'Geen resultaten voor “roostermaaker”.',
    })
    const block = element.shadowRoot!.querySelector('.lintje-empty-state')!
    expect(block.classList.contains('lintje-empty-state--compact')).toBe(true)
    expect(block.getAttribute('role')).toBe('status')
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await element.updateComplete
    expect(block.querySelector('h3')).toBeNull()
    expect(block.querySelector('svg')).toBeNull()
    expect(block.textContent).toContain('Geen resultaten')
  })

  it('draws a status region empty and fills that same region on the next frame', async () => {
    const element = Object.assign(document.createElement('lintje-empty-state'), {
      status: true,
      heading: 'Geen resultaten',
      text: 'Pas de filters aan.',
    })
    document.body.append(element)
    await element.updateComplete
    const region = element.shadowRoot!.querySelector('[role="status"]')!
    expect(region.textContent!.trim()).toBe('')
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await element.updateComplete
    expect(element.shadowRoot!.querySelector('[role="status"]')).toBe(region)
    expect(region.querySelector('h3')!.textContent).toBe('Geen resultaten')
  })
})
