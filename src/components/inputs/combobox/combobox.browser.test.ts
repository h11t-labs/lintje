/** The combobox in a browser: aria-activedescendant points at a row in the popover's slot, in the field's own tree. */
import { afterEach, describe, expect, it } from 'vitest'
import { cdp, server, userEvent } from 'vitest/browser'
import './combobox'
import type { LintjeCombobox } from './combobox'
import type { FilterOption } from '../../../types'

const ZALEN: FilterOption[] = [
  { value: 'v1', label: 'Vergaderzaal 1' },
  { value: 'v2', label: 'Vergaderzaal 2' },
  { value: 'o1', label: 'Ontvangsthal' },
]

interface AXNode {
  backendDOMNodeId?: number
  role?: { value?: string }
  name?: { value?: string }
  properties?: { name: string; value: { relatedNodes?: { backendDOMNodeId: number }[] } }[]
}

/** Chromium's own accessibility tree of every frame: the test runs in an iframe. */
async function axNodes(): Promise<AXNode[]> {
  const session = cdp()
  await session.send('Accessibility.enable')
  const { frameTree } = (await session.send('Page.getFrameTree')) as {
    frameTree: { frame: { id: string }; childFrames?: unknown[] }
  }
  const ids: string[] = []
  const walk = (tree: { frame: { id: string }; childFrames?: unknown[] }): void => {
    ids.push(tree.frame.id)
    for (const child of tree.childFrames ?? []) walk(child as typeof tree)
  }
  walk(frameTree)
  const trees = await Promise.all(
    ids.map((frameId) => session.send('Accessibility.getFullAXTree', { frameId })),
  )
  return trees.flatMap((tree) => (tree as { nodes: AXNode[] }).nodes)
}

async function mount(): Promise<LintjeCombobox> {
  const element = Object.assign(document.createElement('lintje-combobox'), {
    label: 'Zaal',
    options: ZALEN,
  })
  document.body.append(element)
  await element.updateComplete
  return element
}

const field = (
  element: LintjeCombobox,
): HTMLInputElement & { ariaActiveDescendantElement?: Element | null } =>
  element.shadowRoot!.querySelector('input')!
const activeRow = (element: LintjeCombobox): HTMLElement | null =>
  element.shadowRoot!.querySelector<HTMLElement>('.lintje-combobox__option.is-active')

/** What the field's IDREF finds in its own tree, the only place a browser looks. */
function referenced(element: LintjeCombobox, attribute: string): HTMLElement | null {
  const input = field(element)
  const id = input.getAttribute(attribute)
  return id ? (input.getRootNode() as ShadowRoot).getElementById(id) : null
}

async function press(element: LintjeCombobox, key: string): Promise<void> {
  await userEvent.keyboard(key)
  await element.updateComplete
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('lintje-combobox points at its highlighted row across the popover’s slot', () => {
  it('resolves aria-activedescendant and aria-controls in the field’s own tree while the arrows move', async () => {
    const element = await mount()
    field(element).focus()
    await press(element, '{ArrowDown}')
    expect(referenced(element, 'aria-controls')?.getAttribute('role')).toBe('listbox')
    // The row sits in the popover's light DOM, which is the combobox's shadow root.
    expect(activeRow(element)?.closest('lintje-popover')).toBeTruthy()
    for (const label of ['Vergaderzaal 1', 'Vergaderzaal 2', 'Ontvangsthal']) {
      expect(referenced(element, 'aria-activedescendant')).toBe(activeRow(element))
      expect(activeRow(element)?.textContent?.trim()).toBe(label)
      expect(field(element).ariaActiveDescendantElement).toBe(activeRow(element))
      await press(element, '{ArrowDown}')
    }
    await press(element, '{ArrowUp}')
    expect(field(element).ariaActiveDescendantElement?.textContent?.trim()).toBe('Vergaderzaal 2')
  })

  it('names the list by the field’s label in the same tree', async () => {
    const element = await mount()
    field(element).focus()
    await press(element, '{ArrowDown}')
    const list = referenced(element, 'aria-controls')!
    const label = (list.getRootNode() as ShadowRoot).getElementById(
      list.getAttribute('aria-labelledby')!,
    )
    expect(label?.textContent).toContain('Zaal')
  })

  it.runIf(server.browser === 'chromium')(
    'exposes the highlighted row as the active descendant in the accessibility tree',
    async () => {
      const element = await mount()
      field(element).focus()
      await press(element, '{ArrowDown}')
      await press(element, '{ArrowDown}')
      const nodes = await axNodes()
      const combobox = nodes.find((node) => node.role?.value === 'combobox')
      const related = combobox?.properties?.find((item) => item.name === 'activedescendant')?.value
        .relatedNodes?.[0]?.backendDOMNodeId
      const row = nodes.find((node) => node.backendDOMNodeId === related)
      expect(row?.role?.value).toBe('option')
      expect(row?.name?.value).toBe('Vergaderzaal 2')
    },
  )
})
