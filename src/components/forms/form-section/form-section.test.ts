/**
 * The form section: a fieldset with its legend and description, and `disabled` reaching the
 * slotted controls a fieldset in a shadow root cannot reach.
 */
import { describe, expect, it } from 'vitest'
import './form-section'
import '../../inputs/text-input/text-input'
import type { LintjeFormSection } from './form-section'
import type { LintjeTextInput } from '../../inputs/text-input/text-input'

async function mount(props: Partial<LintjeFormSection>): Promise<LintjeFormSection> {
  const element = Object.assign(document.createElement('lintje-form-section'), props)
  element.innerHTML = `
    <lintje-text-input name="titel" label="Titel"></lintje-text-input>
    <lintje-text-input name="plaats" label="Plaats" disabled></lintje-text-input>`
  document.body.append(element)
  await element.updateComplete
  return element
}

const fieldset = (element: LintjeFormSection): HTMLFieldSetElement =>
  element.shadowRoot!.querySelector('fieldset')!

describe('lintje-form-section', () => {
  it('is a fieldset whose legend is the heading and whose description describes it', async () => {
    const element = await mount({ heading: 'Wat en waar', description: 'Beschrijf wat je zag.' })
    const legend = fieldset(element).querySelector('legend')!
    expect(legend.textContent!.trim()).toBe('Wat en waar')
    // A heading inside the legend: the section is in the page's outline too.
    expect(legend.querySelector('h3')!.textContent).toBe('Wat en waar')
    const id = fieldset(element).getAttribute('aria-describedby')!
    expect(element.shadowRoot!.getElementById(id)!.textContent!.trim()).toBe(
      'Beschrijf wat je zag.',
    )
  })

  it('has no description reference without a description', async () => {
    const element = await mount({ heading: 'Betrokkenen' })
    expect(fieldset(element).hasAttribute('aria-describedby')).toBe(false)
  })

  it('as a tile, draws the tile', async () => {
    const element = await mount({ heading: 'Wat en waar', variant: 'tile' })
    expect(fieldset(element).classList.contains('lintje-form-section--tile')).toBe(true)
  })

  it('disables its controls and gives each back what it had', async () => {
    const element = await mount({ heading: 'Wat en waar' })
    const [title, place] = Array.from(
      element.querySelectorAll<LintjeTextInput>('lintje-text-input'),
    )
    element.disabled = true
    await element.updateComplete
    expect(title.disabled).toBe(true)
    expect(place.disabled).toBe(true)

    element.disabled = false
    await element.updateComplete
    expect(title.disabled).toBe(false)
    expect(place.disabled).toBe(true)
  })
})
