/**
 * The outlined icon button answers the pointer as the secondary button does, the flat one as
 * the tertiary: the same background under the pointer, in both house styles and both modes.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import './icon-button'
import '../button/button'

type Lit = HTMLElement & { updateComplete: Promise<unknown> }

const PAIRS = [
  { variant: 'outlined', button: 'secondary' },
  { variant: 'flat', button: 'tertiary' },
]
const STYLES = ['classic', 'new']
const MODES = ['light', 'dark']

const inner = (element: Element): HTMLElement => element.shadowRoot!.querySelector('button')!

/** The background under the pointer, once the hover's transition has landed. */
async function hovered(element: Lit): Promise<string> {
  await userEvent.hover(inner(element))
  await Promise.all(
    inner(element)
      .getAnimations()
      .map((animation) => animation.finished),
  )
  return getComputedStyle(inner(element)).backgroundColor
}

afterEach(() => {
  document.body.replaceChildren()
  delete document.documentElement.dataset.styleVersion
  delete document.documentElement.dataset.mode
})

describe.each(STYLES)('lintje-icon-button in the %s house style', (style) => {
  describe.each(MODES)('in %s', (mode) => {
    it.each(PAIRS)('$variant hovers as the $button button', async ({ variant, button }) => {
      document.documentElement.dataset.styleVersion = style
      document.documentElement.dataset.mode = mode
      document.body.innerHTML = `<lintje-icon-button icon="functioneel-kruis" label="Sluiten" variant="${variant}"></lintje-icon-button>
        <lintje-button variant="${button}">Sluiten</lintje-button>`
      const [icon, plain] = [...document.body.children] as Lit[]
      await Promise.all([icon.updateComplete, plain.updateComplete])
      expect(await hovered(icon)).toBe(await hovered(plain))
    })
  })
})
