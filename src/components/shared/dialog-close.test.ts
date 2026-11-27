/**
 * One close button for the dialogs: the dialog, the modal, the drawer and the filter sheet draw
 * their ✕ with the shared block `lintje-dialog-close`, and none of them keeps a copy
 * of its box or its hit area; the toast and the announcement draw the same one. (The app search's and the notifications sheet's appear
 * only below 768 px; their own tests check the class.)
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import '../overlays/dialog/dialog'
import '../overlays/modal/modal'
import '../overlays/drawer/drawer'
import '../filters/filter-sheet/filter-sheet'
import '../feedback/toast/toast'
import '../feedback/announcement/announcement'

// Read from disk, not imported: vitest does not run the CSS pipeline, so an
// `?inline` import comes back empty.
const read = (path: string): string =>
  readFileSync(resolvePath(`src/components/${path}`), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

const DIALOGS: [string, string, string][] = [
  ['lintje-dialog', 'lintje-dialog__close', 'overlays/dialog/dialog.css'],
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
    // Its own rule may place it, never size it again.
    expect(css).not.toMatch(new RegExp(`\\.${element}\\s*\\{[^}]*(width|height|transition):`))
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
  // Neither opens: the toast draws its ✕ always, the announcement when it may be put away.
  const MESSAGES: [string, string, string, (element: HTMLElement) => void][] = [
    [
      'lintje-toast',
      'lintje-toast__close',
      'feedback/toast/toast.css',
      (element) => {
        element.textContent = 'Melding gearchiveerd'
        // Filled at once, not on the next frame: the region's words, not the timing, are elsewhere.
        Object.assign(element, { filled: true })
      },
    ],
    [
      'lintje-announcement',
      'lintje-announcement__close',
      'shared/announcement-block.css',
      (element) => {
        Object.assign(element, {
          data: { kind: 'info', text: 'Onderhoud vannacht.', dismissible: true },
        })
      },
    ],
  ]

  it.each(MESSAGES)('%s draws it and keeps no copy of it', async (tag, element, file, fill) => {
    const css = read(file)
    expect(css).not.toMatch(new RegExp(`\\.${element}\\s*\\{[^}]*(width|height|transition):`))
    expect(css).not.toContain(`.${element}::after`)
    const message = document.createElement(tag) as HTMLElement & {
      updateComplete: Promise<unknown>
    }
    fill(message)
    document.body.append(message)
    await message.updateComplete
    const close = message.shadowRoot!.querySelector(`.${element}`)
    expect(close?.classList.contains('lintje-dialog-close')).toBe(true)
  })
})
