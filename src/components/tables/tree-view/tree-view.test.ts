/**
 * The tree view: its ARIA, the roving tab stop and the whole keyboard of the spec, folding and
 * choosing with the events they send. happy-dom moves the focus, so the keyboard is tested on
 * the shadow root's `activeElement`.
 */
import { describe, expect, it } from 'vitest'
import './tree-view'
import { typeAhead, visibleRows, type LintjeTreeView, type TreeNode } from './tree-view'

const NODES: TreeNode[] = [
  {
    id: 'dh',
    label: 'Den Haag',
    children: [
      {
        id: 'verdiepingen',
        label: 'Verdiepingen',
        children: [
          { id: 'v1', label: 'Verdieping 1' },
          { id: 'v2', label: 'Verdieping 2' },
          { id: 'v3', label: 'Verdieping 3' },
        ],
      },
      { id: 'zalen', label: 'Zalen', count: 4 },
    ],
  },
  { id: 'ut', label: 'Utrecht', children: [{ id: 'ut-1', label: 'Hoofdgebouw' }] },
]

async function mount(props: Partial<LintjeTreeView> = {}): Promise<LintjeTreeView> {
  const element = Object.assign(document.createElement('lintje-tree-view'), {
    nodes: NODES,
    expanded: ['dh', 'verdiepingen'],
    label: 'Eenheden',
    ...props,
  })
  document.body.append(element)
  await element.updateComplete
  return element
}

const items = (element: LintjeTreeView): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>('[role="treeitem"]'),
]
const item = (element: LintjeTreeView, id: string): HTMLElement =>
  items(element).find((node) => node.dataset.id === id)!
const focused = (element: LintjeTreeView): string | undefined =>
  (element.shadowRoot!.activeElement as HTMLElement | null)?.dataset.id

async function press(element: LintjeTreeView, key: string): Promise<void> {
  const target = (element.shadowRoot!.activeElement as HTMLElement | null) ?? items(element)[0]!
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }))
  await element.updateComplete
  await element.updateComplete
}

function collect(element: LintjeTreeView, name: string): unknown[] {
  const details: unknown[] = []
  element.addEventListener(name, (event) => details.push((event as CustomEvent).detail))
  return details
}

describe('visibleRows() and typeAhead()', () => {
  it('lists the roots and the children of open branches only, with their level', () => {
    const rows = visibleRows(NODES, new Set(['dh']))
    expect(rows.map((row) => `${row.node.id}:${row.level}`)).toEqual([
      'dh:1',
      'verdiepingen:2',
      'zalen:2',
      'ut:1',
    ])
    expect(rows[1]!.parentId).toBe('dh')
  })

  it('finds the next row with the letter, wrapping round', () => {
    const rows = visibleRows(NODES, new Set(['dh', 'verdiepingen']))
    expect(rows[typeAhead(rows, 1, 'v')]!.node.id).toBe('v1')
    expect(rows[typeAhead(rows, 4, 'V')]!.node.id).toBe('verdiepingen')
    expect(typeAhead(rows, 0, 'x')).toBe(-1)
  })
})

describe('lintje-tree-view', () => {
  it('is a named tree with levels, groups, and one tab stop on the chosen row', async () => {
    const element = await mount({ selectedId: 'v2' })
    const root = element.shadowRoot!
    expect(root.querySelector('[role="tree"]')!.getAttribute('aria-label')).toBe('Eenheden')
    expect(item(element, 'dh').getAttribute('aria-expanded')).toBe('true')
    expect(item(element, 'zalen').getAttribute('aria-expanded')).toBe('false')
    expect(item(element, 'v1').hasAttribute('aria-expanded')).toBe(false)
    expect(item(element, 'v1').getAttribute('aria-level')).toBe('3')
    expect(item(element, 'v2').getAttribute('aria-selected')).toBe('true')
    expect(item(element, 'verdiepingen').parentElement!.getAttribute('role')).toBe('group')
    expect(
      items(element)
        .filter((node) => node.tabIndex === 0)
        .map((n) => n.dataset.id),
    ).toEqual(['v2'])
    // A shut branch shows how many children it has.
    expect(item(element, 'zalen').querySelector('.lintje-tree__count')!.textContent).toBe('· 4')
  })

  it('moves down, up, Home and End over the visible rows', async () => {
    const element = await mount()
    item(element, 'dh').focus()
    await press(element, 'ArrowDown')
    expect(focused(element)).toBe('verdiepingen')
    await press(element, 'ArrowDown')
    expect(focused(element)).toBe('v1')
    await press(element, 'ArrowUp')
    expect(focused(element)).toBe('verdiepingen')
    await press(element, 'End')
    expect(focused(element)).toBe('ut')
    await press(element, 'Home')
    expect(focused(element)).toBe('dh')
  })

  it('opens with right, then goes to the first child; shuts with left, then goes to the parent', async () => {
    const element = await mount({ expanded: [] })
    const toggles = collect(element, 'lintje-node-toggle')
    item(element, 'dh').focus()
    await press(element, 'ArrowRight')
    expect(toggles).toEqual([{ id: 'dh', open: true }])
    expect(item(element, 'dh').getAttribute('aria-expanded')).toBe('true')
    await press(element, 'ArrowRight')
    expect(focused(element)).toBe('verdiepingen')
    await press(element, 'ArrowLeft')
    expect(focused(element)).toBe('dh')
    await press(element, 'ArrowLeft')
    expect(toggles).toEqual([
      { id: 'dh', open: true },
      { id: 'dh', open: false },
    ])
    expect(item(element, 'dh').getAttribute('aria-expanded')).toBe('false')
  })

  it('chooses with Enter and space: lintje-change always, lintje-values-change with a name', async () => {
    const element = await mount({ name: 'eenheid' })
    const local = collect(element, 'lintje-change')
    const values = collect(element, 'lintje-values-change')
    item(element, 'dh').focus()
    await press(element, 'ArrowDown')
    await press(element, 'Enter')
    await press(element, 'ArrowDown')
    await press(element, ' ')
    expect(local).toEqual(['verdiepingen', 'v1'])
    expect(values).toEqual([{ eenheid: 'verdiepingen' }, { eenheid: 'v1' }])
    expect(item(element, 'v1').getAttribute('aria-selected')).toBe('true')

    const unnamed = await mount()
    const escaped = collect(unnamed, 'lintje-values-change')
    item(unnamed, 'dh').focus()
    await press(unnamed, 'Enter')
    expect(escaped).toEqual([])
  })

  it('jumps to the row that starts with a typed letter', async () => {
    const element = await mount()
    item(element, 'dh').focus()
    await press(element, 'u')
    expect(focused(element)).toBe('ut')
    await press(element, 'v')
    expect(focused(element)).toBe('verdiepingen')
  })

  it('draws a spinner for a branch whose children are on their way', async () => {
    const element = await mount({
      nodes: [{ id: 'zalen', label: 'Zalen', count: 4, loading: true }],
    })
    expect(item(element, 'zalen').querySelector('lintje-spinner')).not.toBeNull()
    expect(item(element, 'zalen').getAttribute('aria-busy')).toBe('true')
  })

  it('has a name without a label, and a fold target of 24 px', async () => {
    const element = await mount({ label: undefined })
    expect(element.shadowRoot!.querySelector('[role="tree"]')!.getAttribute('aria-label')).toBe(
      'Boomstructuur',
    )
    // happy-dom has no layout: the hit area is checked as the rule that draws it.
    const { readFileSync } = await import('node:fs')
    const css = readFileSync('src/components/tables/tree-view/tree-view.css', 'utf8')
    expect(css).toMatch(
      /\.lintje-tree__arrow--toggle::after\s*\{[^}]*inset: calc\(var\(--space-1\) \* -1\);/,
    )
  })

  it('takes a new expanded list from the host', async () => {
    const element = await mount()
    element.expanded = []
    await element.updateComplete
    expect(items(element).map((node) => node.dataset.id)).toEqual(['dh', 'ut'])
  })
})
