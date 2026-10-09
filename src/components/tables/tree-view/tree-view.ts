/**
 * `<lintje-tree-view>` — a hierarchy that folds open and shut, one tab stop with roving focus.
 *
 * `expanded` is the host's: the element folds its own copy and reports each fold, so a host that
 * loads children on demand answers with `loading` and then `children`. It fetches nothing.
 *
 * Events: `lintje-node-toggle` `{ id, open }`; `lintje-change` (id, not composed);
 * `lintje-values-change` `{ [name]: id }` with a `name`.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { styleProps } from '../../../core/style-props'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import '../../../primitives/spinner/spinner'
import treeViewCss from './tree-view.css?inline'

export interface TreeNode {
  id: string
  label: string
  /** The children, when the host has them. Present (even empty) makes the node a branch. */
  children?: TreeNode[]
  /** How many children there are, for a shut branch; without `children` a count makes it one. */
  count?: number
  loading?: boolean
}

export interface VisibleRow {
  node: TreeNode
  level: number
  parentId: string | null
}

export function isBranch(node: TreeNode): boolean {
  return node.children !== undefined || (node.count ?? 0) > 0
}

export function visibleRows(
  nodes: readonly TreeNode[],
  open: ReadonlySet<string>,
  level = 1,
  parentId: string | null = null,
): VisibleRow[] {
  const rows: VisibleRow[] = []
  for (const node of nodes) {
    rows.push({ node, level, parentId })
    if (node.children && open.has(node.id)) {
      rows.push(...visibleRows(node.children, open, level + 1, node.id))
    }
  }
  return rows
}

/** The next row after `from` whose label starts with `letter`, wrapping round; or -1. */
export function typeAhead(rows: readonly VisibleRow[], from: number, letter: string): number {
  const wanted = letter.toLocaleLowerCase('nl')
  for (let step = 1; step <= rows.length; step++) {
    const index = (from + step) % rows.length
    if (rows[index]!.node.label.toLocaleLowerCase('nl').startsWith(wanted)) return index
  }
  return -1
}

export class LintjeTreeView extends LintjeElement {
  static override styles = [iconStyles, shadowCss(treeViewCss)]

  static override properties: PropertyDeclarations = {
    nodes: { attribute: false },
    expanded: { attribute: false },
    selectedId: { type: String, attribute: 'selected-id' },
    name: { type: String },
    label: { type: String },
    open: { state: true },
    focusId: { state: true },
  }

  nodes: TreeNode[] = []
  /** The host's open branches. The element folds its own copy. */
  expanded: string[] = []
  declare selectedId?: string
  /** The filter key. Without it a choice is only told to the component that drew the tree. */
  name: string = ''
  /** The tree's accessible name; without it "Boomstructuur", which says little: give one. */
  declare label?: string
  protected open: Set<string> = new Set()
  protected focusId: string | null = null

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('expanded')) this.open = new Set(this.expanded)
  }

  private get rows(): VisibleRow[] {
    return visibleRows(this.nodes, this.open)
  }

  private tabStop(rows: VisibleRow[]): string | null {
    const visible = (id: string | null | undefined): boolean =>
      Boolean(id) && rows.some((row) => row.node.id === id)
    if (visible(this.focusId)) return this.focusId
    if (visible(this.selectedId)) return this.selectedId!
    return rows[0]?.node.id ?? null
  }

  private toggle(node: TreeNode, open: boolean): void {
    if (!isBranch(node) || this.open.has(node.id) === open) return
    const next = new Set(this.open)
    if (open) next.add(node.id)
    else next.delete(node.id)
    this.open = next
    this.emit('lintje-node-toggle', { id: node.id, open })
  }

  private choose(node: TreeNode): void {
    this.selectedId = node.id
    this.emitLocal('lintje-change', node.id)
    if (this.name) this.emit('lintje-values-change', { [this.name]: node.id })
  }

  private async moveFocus(id: string): Promise<void> {
    this.focusId = id
    await this.updateComplete
    const item = [...this.renderRoot.querySelectorAll<HTMLElement>('[role="treeitem"]')].find(
      (element) => element.dataset.id === id,
    )
    item?.focus()
  }

  private onKeydown(event: KeyboardEvent): void {
    const rows = this.rows
    if (!rows.length) return
    const at = Math.max(
      0,
      rows.findIndex((row) => row.node.id === this.tabStop(rows)),
    )
    const row = rows[at]!
    const node = row.node
    const open = this.open.has(node.id)
    let target: number | null = null
    switch (event.key) {
      case 'ArrowDown':
        target = Math.min(rows.length - 1, at + 1)
        break
      case 'ArrowUp':
        target = Math.max(0, at - 1)
        break
      case 'Home':
        target = 0
        break
      case 'End':
        target = rows.length - 1
        break
      case 'ArrowRight':
        if (!isBranch(node)) break
        if (!open) this.toggle(node, true)
        else if (node.children?.length) target = at + 1
        break
      case 'ArrowLeft':
        if (isBranch(node) && open) this.toggle(node, false)
        else if (row.parentId) target = rows.findIndex((r) => r.node.id === row.parentId)
        break
      case 'Enter':
      case ' ':
        this.choose(node)
        break
      default:
        if (event.key.length === 1 && /\S/.test(event.key) && !event.ctrlKey && !event.metaKey) {
          const index = typeAhead(rows, at, event.key)
          if (index >= 0) target = index
          break
        }
        return
    }
    event.preventDefault()
    if (target !== null && target >= 0) void this.moveFocus(rows[target]!.node.id)
  }

  private arrow(node: TreeNode): TemplateResult {
    if (!isBranch(node)) return html`<span class="lintje-tree__arrow" aria-hidden="true"></span>`
    if (node.loading) {
      return html`<span class="lintje-tree__arrow" aria-hidden="true"
        ><lintje-spinner></lintje-spinner
      ></span>`
    }
    const open = this.open.has(node.id)
    return html`<span
      class="lintje-tree__arrow lintje-tree__arrow--toggle"
      aria-hidden="true"
      @click=${(event: Event) => {
        event.stopPropagation()
        this.toggle(node, !open)
      }}
      >${renderIcon(open ? 'functioneel-delta-omlaag' : 'functioneel-delta-rechts', {
        size: 16,
      })}</span
    >`
  }

  private item(node: TreeNode, level: number, tabStop: string | null): TemplateResult {
    const branch = isBranch(node)
    const open = branch && this.open.has(node.id)
    const selected = node.id === this.selectedId
    const count = node.count ?? node.children?.length
    return html`<li
      class="lintje-tree__item"
      role="treeitem"
      data-id=${node.id}
      tabindex=${node.id === tabStop ? '0' : '-1'}
      aria-level=${level}
      aria-selected=${selected ? 'true' : 'false'}
      aria-expanded=${branch ? String(open) : nothing}
      aria-busy=${node.loading ? 'true' : nothing}
      @focus=${(event: FocusEvent) => {
        if (event.target === event.currentTarget) this.focusId = node.id
      }}
    >
      <div
        class=${classMap({ 'lintje-tree__row': true, 'is-selected': selected })}
        ${styleProps({ '--lintje-tree-depth': level - 1 })}
        @click=${() => {
          this.choose(node)
          void this.moveFocus(node.id)
        }}
      >
        ${this.arrow(node)}
        <span class="lintje-tree__label">${node.label}</span>
        ${
          branch && !open && count
            ? html`<span class="lintje-tree__count">· ${count}</span>`
            : nothing
        }
      </div>
      ${
        open && node.children?.length
          ? html`<ul class="lintje-tree__group" role="group">
              ${node.children.map((child) => this.item(child, level + 1, tabStop))}
            </ul>`
          : nothing
      }
    </li>`
  }

  protected override render(): TemplateResult {
    const tabStop = this.tabStop(this.rows)
    return html`<ul
      class="lintje-tree"
      role="tree"
      aria-label=${this.label || 'Boomstructuur'}
      @keydown=${this.onKeydown}
    >
      ${this.nodes.map((node) => this.item(node, 1, tabStop))}
    </ul>`
  }
}

define('lintje-tree-view', LintjeTreeView)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-tree-view': LintjeTreeView
  }
}
