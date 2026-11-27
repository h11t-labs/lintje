/**
 * The title the windows share: one colour in the dialog and the modal, in both house styles,
 * light and dark.
 */
import { afterEach, describe, expect, it } from 'vitest'
import '../overlays/dialog/dialog'
import '../overlays/modal/modal'

type Window = HTMLElement & { open: boolean; updateComplete: Promise<unknown> }

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))

async function mount(tag: string, props: Partial<Window> = {}): Promise<Window> {
  const element = Object.assign(document.createElement(tag) as Window, {
    heading: 'Aanvraag',
    ...props,
  })
  document.body.append(element)
  element.open = true
  await element.updateComplete
  await frame()
  return element
}

/** The colour a token resolves to inside the element's own root. */
function token(element: HTMLElement, name: string): string {
  const probe = document.createElement('i')
  probe.style.color = `var(${name})`
  element.shadowRoot!.append(probe)
  const colour = getComputedStyle(probe).color
  probe.remove()
  return colour
}

const shadow = (element: HTMLElement, selector: string): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>(selector)!

afterEach(() => {
  document.body.replaceChildren()
  delete document.documentElement.dataset.styleVersion
  document.documentElement.dataset.mode = 'light'
})

describe('the title of a window', () => {
  it.each(
    (['classic', 'new'] as const).flatMap((style) =>
      (['light', 'dark'] as const).map((mode) => [style, mode] as const),
    ),
  )('is one colour in the dialog and the modal, %s %s', async (style, mode) => {
    document.documentElement.dataset.mode = mode
    if (style === 'new') document.documentElement.dataset.styleVersion = 'new'
    const dialog = await mount('lintje-dialog')
    const modal = await mount('lintje-modal')
    const colour = getComputedStyle(shadow(modal, '.lintje-modal__title')).color
    expect(getComputedStyle(shadow(dialog, '.lintje-dialog__heading')).color).toBe(colour)
    expect(colour).toBe(
      token(modal, style === 'new' ? '--color-accent-text' : '--color-text-primary'),
    )
  })
})
