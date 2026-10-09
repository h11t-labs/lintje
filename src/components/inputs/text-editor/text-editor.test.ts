/**
 * The text editor: the toolbar's structure and keys, the surface's ARIA, and the value in and
 * out as markdown. happy-dom has no editing commands, so a format is not applied here: that
 * is the browser's, and the markdown both ways is `markdown.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import './text-editor'
import type { LintjeTextEditor } from './text-editor'

async function mount(props: Partial<LintjeTextEditor> = {}): Promise<LintjeTextEditor> {
  const element = Object.assign(document.createElement('lintje-text-editor'), {
    label: 'Toelichting',
    ...props,
  })
  document.body.append(element)
  await element.updateComplete
  return element
}

const surface = (element: LintjeTextEditor): HTMLElement =>
  element.shadowRoot!.querySelector('.lintje-text-editor__surface')!
const tools = (element: LintjeTextEditor): HTMLButtonElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLButtonElement>('.lintje-text-editor__tool'),
]

/** The focus leaves the element: what a reader does when they are done. */
function leave(element: LintjeTextEditor): void {
  surface(element).dispatchEvent(
    new FocusEvent('focusout', { bubbles: true, composed: true, relatedTarget: null }),
  )
}

describe('lintje-text-editor', () => {
  it('draws the markdown value in the surface', async () => {
    const element = await mount({ value: 'De omgeving is **afgezet**.\n\n- eerste\n- tweede' })
    expect(surface(element).innerHTML).toBe(
      '<p>De omgeving is <strong>afgezet</strong>.</p><ul><li>eerste</li><li>tweede</li></ul>',
    )
    element.value = '### Kop'
    await element.updateComplete
    expect(surface(element).innerHTML).toBe('<h3>Kop</h3>')
  })

  it('is a multi-line textbox named by its label', async () => {
    const element = await mount()
    const label = element.shadowRoot!.querySelector('.lintje-label')!
    expect(surface(element).getAttribute('role')).toBe('textbox')
    expect(surface(element).getAttribute('aria-multiline')).toBe('true')
    expect(surface(element).getAttribute('aria-labelledby')).toBe(label.id)
    expect(surface(element).getAttribute('contenteditable')).toBe('true')
  })

  it('has a toolbar of five named toggle buttons, B, I and H as letters, and one tab stop', async () => {
    const element = await mount()
    const toolbar = element.shadowRoot!.querySelector('[role="toolbar"]')!
    expect(toolbar.getAttribute('aria-label')).toBe('Opmaak')
    expect(tools(element).map((tool) => tool.getAttribute('aria-label'))).toEqual([
      'Vet',
      'Cursief',
      'Kop',
      'Opsomming',
      'Link',
    ])
    expect(
      tools(element)
        .map((tool) => tool.textContent!.trim())
        .slice(0, 3),
    ).toEqual(['B', 'I', 'H'])
    expect(tools(element).every((tool) => tool.getAttribute('aria-pressed') === 'false')).toBe(true)
    expect(tools(element).map((tool) => tool.getAttribute('tabindex'))).toEqual([
      '0',
      '-1',
      '-1',
      '-1',
      '-1',
    ])
  })

  it('moves the tab stop with the arrow keys, round the ends, and with Home and End', async () => {
    const element = await mount()
    const toolbar = element.shadowRoot!.querySelector('[role="toolbar"]')!
    const stop = () => tools(element).findIndex((tool) => tool.getAttribute('tabindex') === '0')
    const press = async (key: string) => {
      toolbar.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      await element.updateComplete
    }
    await press('ArrowRight')
    expect(stop()).toBe(1)
    await press('ArrowLeft')
    await press('ArrowLeft')
    expect(stop()).toBe(4)
    await press('Home')
    expect(stop()).toBe(0)
    await press('End')
    expect(stop()).toBe(4)
  })

  it('has Link unavailable without a selection', async () => {
    const element = await mount()
    const link = tools(element)[4]
    expect(link.getAttribute('aria-disabled')).toBe('true')
    link.click()
    await element.updateComplete
    expect(element.shadowRoot!.querySelector('lintje-popover')!.open).toBe(false)
  })

  it('commits the edited surface as markdown when the focus leaves, once', async () => {
    const element = await mount({ name: 'p.toelichting', value: 'oud' })
    const local: unknown[] = []
    const values: unknown[] = []
    element.addEventListener('lintje-change', (event) => local.push((event as CustomEvent).detail))
    element.addEventListener('lintje-values-change', (event) =>
      values.push((event as CustomEvent).detail),
    )
    // What the browser leaves after an edit: its own tags, a stray style.
    surface(element).innerHTML =
      'Nieuw <b>vet</b><div><span style="color:red">en verder</span></div>'
    leave(element)
    await element.updateComplete
    expect(local).toEqual(['Nieuw **vet**\n\nen verder'])
    expect(values).toEqual([{ 'p.toelichting': 'Nieuw **vet**\n\nen verder' }])
    // Redrawn from the markdown it sent.
    expect(surface(element).innerHTML).toBe('<p>Nieuw <strong>vet</strong></p><p>en verder</p>')
    leave(element)
    expect(local).toHaveLength(1)
  })

  it('is out of the tab order and commits nothing while disabled', async () => {
    const element = await mount({ disabled: true, value: 'tekst' })
    expect(surface(element).getAttribute('contenteditable')).toBe('false')
    expect(surface(element).getAttribute('tabindex')).toBe('-1')
    expect(tools(element).every((tool) => tool.disabled)).toBe(true)
    const local: unknown[] = []
    element.addEventListener('lintje-change', (event) => local.push((event as CustomEvent).detail))
    surface(element).innerHTML = '<p>anders</p>'
    leave(element)
    expect(local).toEqual([])
  })

  it('draws the error on the frame and ties it to the surface', async () => {
    const element = await mount({ error: 'Vul een toelichting in' })
    expect(element.shadowRoot!.querySelector('.lintje-text-editor.is-error')).not.toBeNull()
    const error = element.shadowRoot!.querySelector('.lintje-field__error')!
    expect(surface(element).getAttribute('aria-describedby')).toBe(error.id)
    expect(surface(element).getAttribute('aria-invalid')).toBe('true')
  })
})
