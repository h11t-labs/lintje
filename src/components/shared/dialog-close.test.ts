/**
 * One close button for the dialogs: the modal, the drawer and the filter sheet draw
 * their ✕ with the shared block `lintje-dialog-close`, and none of them keeps a copy
 * of its box or its hit area. (The app search's and the notifications sheet's appear
 * only below 768 px; their own tests check the class.)
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import '../overlays/modal/modal'
import '../overlays/drawer/drawer'
import '../filters/filter-sheet/filter-sheet'

// Read from disk, not imported: vitest does not run the CSS pipeline, so an
// `?inline` import comes back empty.
const read = (path: string): string =>
  readFileSync(resolvePath(`src/components/${path}`), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

const DIALOGS: [string, string, string][] = [
  ['lintje-modal', 'lintje-modal__close', 'overlays/modal/modal.css'],
  ['lintje-drawer', 'lintje-drawer__close', 'overlays/drawer/drawer.css'],
  ['lintje-filter-sheet', 'lintje-filter-sheet__close', 'filters/filter-sheet/filter-sheet.css'],
]

afterEach(() => {
  document.body.replaceChildren()
})

describe('the dialog close button', () => {
  it('has its box and its hit area in one shared stylesheet', () => {
    const shared = read('shared/dialog-close.css')
    expect(shared).toMatch(/\.lintje-dialog-close\s*\{[^}]*width: var\(--h-icon-button\)/)
    expect(shared).toMatch(
      /\.lintje-dialog-close::after\s*\{[^}]*inset: min\(0px, calc\(\(100% - var\(--h-target\)\) \/ 2\)\)/,
    )
  })

  it.each(DIALOGS)('%s draws it and keeps no copy of it', async (tag, element, file) => {
    const css = read(file)
    expect(css).not.toContain(`.${element} {`)
    expect(css).not.toContain(`.${element}::after`)
    const dialog = document.createElement(tag) as HTMLElement & {
      open: boolean
      updateComplete: Promise<unknown>
    }
    document.body.append(dialog)
    dialog.open = true
    await dialog.updateComplete
    const close = dialog.shadowRoot!.querySelector(`.${element}`)
    expect(close?.classList.contains('lintje-dialog-close')).toBe(true)
  })
})
