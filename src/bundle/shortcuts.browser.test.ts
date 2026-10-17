/**
 * The shortcut overview as the recipe builds it (`examples/_shared/shortcuts.js`): its switch for
 * the one-character keys (WCAG 2.1.4) sits in the dialog's footer, turns those keys off and on,
 * is kept in the browser, and does not take the first focus.
 */
import axe from 'axe-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { deepActiveElement } from '../core/focus'
import { characterKeys, registerShortcut, setCharacterKeys } from '../core/shortcuts'
import '../components/overlays/dialog/dialog'
import '../components/tables/description-list/description-list'
import '../components/inputs/toggle/toggle'
import type { LintjeDialog } from '../components/overlays/dialog/dialog'
import type { LintjeToggle } from '../components/inputs/toggle/toggle'

interface Recipe {
  shortcutOverview(dialog: HTMLElement): () => void
}

const [recipe] = Object.values(
  import.meta.glob<Recipe>('../../examples/_shared/shortcuts.js', { eager: true }),
) as Recipe[]

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]

const pressed = { character: 0, modified: 0 }

/** Puts a fresh overview on the page, as a page does on every load. */
function build(): { dialog: LintjeDialog; toggle: LintjeToggle; open: () => void } {
  document.body.replaceChildren()
  const dialog = document.createElement('lintje-dialog')
  document.body.append(dialog)
  const open = recipe!.shortcutOverview(dialog)
  return { dialog, toggle: dialog.querySelector('lintje-toggle')!, open }
}

async function closed(dialog: LintjeDialog): Promise<void> {
  dialog.open = false
  await dialog.updateComplete
  ;(document.activeElement as HTMLElement | null)?.blur()
}

async function audit(): Promise<string[]> {
  const { violations } = await axe.run(document.body, {
    runOnly: { type: 'tag', values: WCAG },
    resultTypes: ['violations'],
  })
  return violations.flatMap((violation) =>
    violation.nodes.map((node) => `${violation.id} @ ${node.target.join(' >> ')}`),
  )
}

beforeAll(() => {
  document.documentElement.lang = 'nl'
  document.documentElement.dataset.theme = 'rijksoverheid'
  document.body.style.background = 'var(--color-bg-page)'
  registerShortcut({ keys: 'n', description: 'Nieuwe melding', handler: () => pressed.character++ })
  registerShortcut({
    keys: 'Ctrl+S',
    description: 'Opslaan',
    handler: () => pressed.modified++,
  })
})

afterAll(() => {
  setCharacterKeys(true)
  delete document.documentElement.dataset.mode
  document.body.replaceChildren()
})

describe('the shortcut overview', () => {
  it('opens on ? with the switch in its footer, on, and the focus on the close button', async () => {
    const { dialog, toggle } = build()
    await userEvent.keyboard('?')
    await expect.poll(() => dialog.open).toBe(true)
    expect(toggle.slot).toBe('footer')
    expect(toggle.assignedSlot?.name).toBe('footer')
    await toggle.updateComplete
    expect(toggle.checked).toBe(true)
    const close = dialog.shadowRoot!.querySelector('.lintje-dialog__close')
    await expect.poll(() => deepActiveElement()).toBe(close)
    expect(
      toggle.contains(deepActiveElement()) || toggle.shadowRoot!.contains(deepActiveElement()),
    ).toBe(false)
  })

  it.each(['light', 'dark'])('passes axe open, in %s, at 1440 and 390 px', async (mode) => {
    document.documentElement.dataset.mode = mode
    const { dialog, open } = build()
    for (const { width, height } of VIEWPORTS) {
      await page.viewport(width, height)
      open()
      await dialog.updateComplete
      await expect.poll(() => deepActiveElement()).not.toBe(document.body)
      expect(await audit()).toEqual([])
      await closed(dialog)
    }
    await page.viewport(1440, 900)
    delete document.documentElement.dataset.mode
  })

  it('turns the one-character keys off and on, and keeps the choice', async () => {
    const { dialog, toggle, open } = build()
    open()
    await dialog.updateComplete
    toggle.shadowRoot!.querySelector<HTMLInputElement>('input')!.click()
    expect(toggle.checked).toBe(false)
    expect(characterKeys()).toBe(false)
    expect(localStorage.getItem('lintje-character-keys')).toBe('off')
    await closed(dialog)

    pressed.character = 0
    pressed.modified = 0
    await userEvent.keyboard('?')
    await userEvent.keyboard('n')
    await userEvent.keyboard('{Control>}s{/Control}')
    expect(dialog.open).toBe(false)
    expect(pressed.character).toBe(0)
    expect(pressed.modified).toBe(1)

    // Built again, as after a reload: the switch shows the choice the reader left.
    const again = build()
    await again.toggle.updateComplete
    expect(again.toggle.checked).toBe(false)
    again.open()
    await again.dialog.updateComplete
    // The list still names every key, also the ones that are off.
    const list = again.dialog.querySelector('lintje-description-list')!
    expect(list.items.map((item) => item.label)).toContain('Nieuwe melding')

    again.toggle.shadowRoot!.querySelector<HTMLInputElement>('input')!.click()
    expect(characterKeys()).toBe(true)
    expect(localStorage.getItem('lintje-character-keys')).toBeNull()
    await closed(again.dialog)
    await userEvent.keyboard('n')
    expect(pressed.character).toBe(1)
    await userEvent.keyboard('?')
    await expect.poll(() => again.dialog.open).toBe(true)
  })
})
