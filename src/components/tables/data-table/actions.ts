/**
 * Actions in `<lintje-data-table>`: a menu at the end of every row (`rowActions`) and a bar of
 * actions on the checked rows (`bulkActions`).
 *
 * A row choice is `lintje-row-action` `{ id, action }`, a bar choice `lintje-bulk-action`
 * `{ ids, action }`. The table does not confirm: the host does before a destructive action.
 */
import { html, nothing, type TemplateResult } from 'lit'
import '../../actions/menu-button/menu-button'
import '../../../primitives/button/button'
import type { TableAction } from '../../../types'

/** The rows a Shift+click checks: `anchor` to `target` inclusive; only `target` without an anchor. */
export function rangeIds(
  order: readonly string[],
  anchor: string | null,
  target: string,
): string[] {
  const to = order.indexOf(target)
  const from = anchor == null ? -1 : order.indexOf(anchor)
  if (to < 0) return []
  if (from < 0) return [target]
  const [start, end] = from < to ? [from, to] : [to, from]
  return order.slice(start, end + 1)
}

export function withRange(checked: readonly string[], range: readonly string[]): string[] {
  const known = new Set(checked)
  return [...checked, ...range.filter((id) => !known.has(id))]
}

export function renderRowActions(
  actions: (TableAction | 'separator')[],
  name: string,
  onAction: (action: string) => void,
): TemplateResult {
  // Flat: a box in every row would weigh more than the data beside it.
  return html`<lintje-menu-button
    icon
    variant="tertiary"
    placement="bottom-end"
    label=${`Acties voor ${name}`}
    .items=${actions}
    @lintje-action=${(event: CustomEvent<string>) => {
      event.stopPropagation()
      onAction(event.detail)
    }}
  ></lintje-menu-button>`
}

export function renderSelectionBar(
  actions: TableAction[],
  count: number,
  mobile: boolean,
  onAction: (action: string) => void,
  onClear: () => void,
): TemplateResult {
  const buttons = mobile
    ? actions.length > 0
      ? html`<lintje-menu-button
          label="Acties"
          .items=${actions}
          @lintje-action=${(event: CustomEvent<string>) => {
            event.stopPropagation()
            onAction(event.detail)
          }}
        ></lintje-menu-button>`
      : nothing
    : actions.map(
        (action) =>
          html`<lintje-button
            variant=${action.danger ? 'danger-secondary' : 'secondary'}
            size="compact"
            icon=${action.icon ?? nothing}
            ?disabled=${Boolean(action.disabled)}
            @click=${() => onAction(action.value)}
            >${action.label}</lintje-button
          >`,
      )
  return html`<div
    class="lintje-data-table__selection ${mobile ? 'lintje-data-table__selection--mobile' : ''}"
    role="toolbar"
    aria-label="Acties op de selectie"
  >
    <!-- The table's own status region reads the count: one inserted with its bar would not be. -->
    <strong class="lintje-data-table__selection-count">${count} geselecteerd</strong>
    ${buttons}
    <lintje-button
      class="lintje-data-table__selection-clear"
      variant="tertiary"
      size="compact"
      @click=${onClear}
      >Selectie opheffen</lintje-button
    >
  </div>`
}
