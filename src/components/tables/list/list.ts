/**
 * `<lintje-list>` — rows for what needs no columns: title, a muted line, a fact or actions. It is
 * also the work list: what someone made or had made, in progress or done, with the kind as an
 * icon, the state as a word, the progress as a bar, and rows grouped under a moment ("Vandaag").
 * A row's title is one line, cut with an ellipsis; it wraps where no pointer shows its tooltip:
 * below 768 px, without hover, and under the keyboard's focus. A run's moment is a heading at
 * `heading-level`.
 *
 * The whole row is clickable but the title is the one tab stop; a row with `clickable: false` opens
 * nothing, and its title is plain text or, with an `href`, only a link. It does not navigate: a plain
 * click is cancelled and sent as `lintje-row-click`; a modifier click on a title link is the
 * browser's. A menu's `lintje-action` is stopped and sent again with its row. When the focused
 * control leaves with an update (a row removed, an action replaced), the focus goes to the same
 * row's other control, else the next row, the previous one, or the list itself. A rename that ends
 * gives the focus to its row's first control, found by its id or, saved under a new one, its place.
 *
 * A row with `rename` turns its title into a field in place, with its save and cancel: renaming
 * needs no dialog. The host keeps the state, as it does for every row.
 *
 * Events: `lintje-row-click` `{ id, label, href? }`, `lintje-row-action` `{ id, label, value }`
 * (every chosen menu row, a link row included, and the row's own `action`), `lintje-navigate` `{ href }` (from a link row in a
 * menu, after its `lintje-row-action`), `lintje-row-rename` `{ id, value }` and
 * `lintje-row-rename-cancel` `{ id }` (Enter and Escape too).
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type ReactiveElement,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { repeat } from 'lit/directives/repeat.js'
import { LintjeElement, define } from '../../../core/element'
import { styleProps } from '../../../core/style-props'
import { deepActiveElement, holdsFocus } from '../../../core/focus'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import '../../feedback/empty-state/empty-state'
import '../../actions/menu-button/menu-button'
import '../../inputs/text-input/text-input'
import type { LintjeTextInput } from '../../inputs/text-input/text-input'
import '../../../primitives/badge/badge'
import '../../../primitives/button/button'
import '../../../primitives/progress-bar/progress-bar'
import type { MenuEntry } from '../../actions/menu-button/menu-button'
import type { BadgeTone } from '../../../primitives/badge/badge'
import listCss from './list.css?inline'
import { isPlainClick } from '../../../core/links'
import { focusTarget } from '../../shared/focus-trap'
import { MediaController } from '../../../core/media'

export interface ListItem {
  id: string
  title: string
  /** Makes the title a link. */
  href?: string
  /** The muted line under the title: "47:12 · 3 sprekers". */
  sub?: string
  /** The fact on the right: "vandaag". */
  meta?: string
  /** The row's menu: the rows of a `lintje-menu-button`. */
  actions?: MenuEntry[]
  /**
   * The title as a field in place: `save` names the button ("Overal wijzigen (3)"), `error` stands
   * under the field.
   */
  rename?: { save: string; error?: string }
  /** One action in plain sight ("Annuleren"), sent as `lintje-row-action`; `href` makes it a link. */
  action?: { label: string; value: string; href?: string }
  /** The kind of work, as an icon file name, before the title. */
  icon?: string
  /** A data colour as a bar along the row (`sky-blue`): a speaker, as in the player and transcript. */
  swatch?: string
  /** The state as a word ("Bezig"), drawn as a badge in the badge's tone. */
  status?: { label: string; tone?: BadgeTone }
  /** 0–100 while the work runs: a bar under the muted line, held (muted) when the status warns. */
  progress?: number | null
  /** The heading that consecutive rows with the same value stand under ("Vandaag"). */
  group?: string
  /** `false`: the row opens nothing — no row click, no hover; work that is still running. */
  clickable?: boolean
}

/** Consecutive items with the same `group` as one run; items without one form a run without a heading. */
export function groupRuns(items: ListItem[]): { label: string; items: ListItem[] }[] {
  const runs: { label: string; items: ListItem[] }[] = []
  for (const item of items) {
    const label = item.group ?? ''
    const last = runs[runs.length - 1]
    if (last && last.label === label) last.items.push(item)
    else runs.push({ label, items: [item] })
  }
  return runs
}

/** The row and control that held the focus before an update. */
interface HeldFocus {
  items: ListItem[]
  index: number
  control: HTMLElement
  onTitle: boolean
  /** The focus was in a rename row, whose field and buttons go when the rename ends. */
  renaming?: boolean
}

export interface RowClickDetail {
  id: string
  label: string
  href?: string
}

export class LintjeList extends LintjeElement {
  static override styles = [iconStyles, shadowCss(listCss)]
  /** Below 768 px the title wraps; read in script, as WebKit does not re-apply a shadow root's
      media query when the viewport narrows. */
  readonly #mobile = new MediaController(this)

  static override properties: PropertyDeclarations = {
    items: { attribute: false },
    selectedId: { type: String, attribute: 'selected-id' },
    emptyText: { type: String, attribute: 'empty-text' },
    label: { type: String },
    headingLevel: { type: Number, attribute: 'heading-level' },
  }

  items: ListItem[] = []
  /** The row whose detail stands open beside the list. */
  declare selectedId?: string
  emptyText: string = 'Er is hier nog niets.'
  declare label?: string
  /** The level of a run's heading ("Vandaag"): one below the heading the list stands under. */
  headingLevel: 2 | 3 | 4 | 5 | 6 = 3

  private held: HeldFocus | null = null

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    this.held = changed.has('items') ? this.heldFocus(changed.get('items') ?? []) : null
  }

  private rowElements(): HTMLElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('.lintje-list__row')]
  }

  /** A row's controls: its title when it is one, and its action and menu. */
  private controls(row: Element, titleFirst = true): HTMLElement[] {
    const title = row.querySelector<HTMLElement>('a.lintje-list__title, button.lintje-list__title')
    const actions = [...row.querySelectorAll<HTMLElement>('[data-part="action"]')]
    return (titleFirst ? [title, ...actions] : [...actions, title]).filter(
      (control): control is HTMLElement => control !== null,
    )
  }

  private heldFocus(items: ListItem[]): HeldFocus | null {
    const rows = this.rowElements()
    const index = rows.findIndex((row) => holdsFocus(row))
    const row = rows[index]
    if (row?.classList.contains('is-renaming')) {
      return { items, index, control: row, onTitle: true, renaming: true }
    }
    const control = row && this.controls(row).find((candidate) => holdsFocus(candidate))
    if (!row || !control) return null
    return { items, index, control, onTitle: control.classList.contains('lintje-list__title') }
  }

  /** Where the focus goes when its control left: the same row, the next, the previous, the list. */
  private landing(held: HeldFocus): HTMLElement | null {
    const rows = this.rowElements()
    const rowOf = (id: string | undefined): HTMLElement | undefined =>
      rows[this.items.findIndex((item) => item.id === id)]
    // A row saved under a new id stands in the old one's place.
    const same = rowOf(held.items[held.index]?.id) ?? (held.renaming ? rows[held.index] : undefined)
    if (same) {
      const [first] = this.controls(same, held.onTitle)
      if (first) return first
    }
    const after = held.items.slice(held.index + 1)
    const before = held.items.slice(0, held.index).reverse()
    for (const item of [...after, ...before]) {
      const row = rowOf(item.id)
      const [first] = row ? this.controls(row) : []
      if (first) return first
    }
    const whole = this.renderRoot.querySelector<HTMLElement>(
      'lintje-empty-state, .lintje-list__group, ul.lintje-list',
    )
    if (whole) whole.tabIndex = -1
    return whole
  }

  private async refocus(held: HeldFocus): Promise<void> {
    const target = this.landing(held)
    if (!target) return
    // A control that has just been drawn has no shadow root to focus into yet.
    await (target as Partial<ReactiveElement>).updateComplete
    const active = deepActiveElement()
    if (active && active !== document.body && active.isConnected) return
    focusTarget(target).focus()
  }

  private renaming: string | null = null

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    const held = this.held
    this.held = null
    if (held && !(held.control.isConnected && holdsFocus(held.control)) && !holdsFocus(this)) {
      void this.refocus(held)
    }
    // A row that just turned into a field takes the focus, with its name selected to type over.
    const id = this.items.find((item) => item.rename)?.id ?? null
    if (id === this.renaming) return
    this.renaming = id
    if (!id) return
    const field = this.renderRoot.querySelector<LintjeTextInput>(
      '.lintje-list__rename lintje-text-input',
    )
    void field?.updateComplete.then(() => {
      const input = field.shadowRoot?.querySelector('input')
      input?.focus()
      input?.select()
    })
  }

  private saveRename(item: ListItem): void {
    const field = this.renderRoot.querySelector<LintjeTextInput>(
      '.lintje-list__rename lintje-text-input',
    )
    this.emit('lintje-row-rename', { id: item.id, value: String(field?.value ?? '').trim() })
  }

  private renderRename(item: ListItem): TemplateResult {
    return html`<li
      class=${classMap({
        'lintje-list__row': true,
        'is-static': true,
        'is-renaming': true,
        'has-swatch': Boolean(item.swatch),
      })}
      ${styleProps({ '--lintje-swatch': item.swatch ? `var(--color-chart-${item.swatch})` : null })}
    >
      <div
        class="lintje-list__rename"
        @keydown=${(event: KeyboardEvent) => {
          // Enter on "Annuleren" is that button's click, not a save.
          const field = (event.currentTarget as HTMLElement).querySelector('lintje-text-input')
          if (!field || !event.composedPath().includes(field)) return
          if (event.key === 'Enter') {
            event.preventDefault()
            this.saveRename(item)
          } else if (event.key === 'Escape') {
            // The cancel is the Escape's answer: a dialog or drawer around the list stays open.
            event.preventDefault()
            event.stopPropagation()
            this.emit('lintje-row-rename-cancel', { id: item.id })
          }
        }}
      >
        <lintje-text-input
          label=${`Nieuwe naam voor ${item.title}`}
          hide-label
          value=${item.title}
          error=${item.rename?.error || nothing}
        ></lintje-text-input>
        <div class="lintje-list__rename-actions">
          <lintje-button variant="primary" size="compact" @click=${() => this.saveRename(item)}
            >${item.rename?.save}</lintje-button
          >
          <lintje-button
            variant="link"
            size="compact"
            @click=${() => this.emit('lintje-row-rename-cancel', { id: item.id })}
            >Annuleren</lintje-button
          >
        </div>
      </div>
    </li>`
  }

  private detail(item: ListItem): RowClickDetail {
    return item.href
      ? { id: item.id, label: item.title, href: item.href }
      : { id: item.id, label: item.title }
  }

  private onRowClick(event: MouseEvent, item: ListItem): void {
    const path = event.composedPath()
    if (path.some((node) => node instanceof HTMLElement && node.dataset.part === 'action')) return
    const onLink = item.href && path.some((node) => node instanceof HTMLAnchorElement)
    if (onLink && !isPlainClick(event)) return
    // On the title link the browser follows the href unless the host cancels the event.
    if (!this.emit('lintje-row-click', this.detail(item)) || !onLink) event.preventDefault()
  }

  private onAction(event: CustomEvent<string>, item: ListItem): void {
    event.stopPropagation()
    this.emit('lintje-row-action', { id: item.id, label: item.title, value: event.detail })
  }

  // Where the title is cut to one line, the whole of it stands in the tooltip. The chosen row is
  // said on its title: that is where the focus lands, not on the row.
  private renderTitle(item: ListItem): TemplateResult {
    const current = item.id === this.selectedId ? 'true' : nothing
    if (item.href) {
      return html`<a
        class="lintje-list__title"
        href=${item.href}
        title=${item.title}
        aria-current=${current}
        >${item.title}</a
      >`
    }
    if (item.clickable === false) {
      return html`<span class="lintje-list__title" title=${item.title} aria-current=${current}
        >${item.title}</span
      >`
    }
    return html`<button
      type="button"
      class="lintje-list__title"
      title=${item.title}
      aria-current=${current}
    >
      ${item.title}
    </button>`
  }

  private renderAction(item: ListItem): TemplateResult | typeof nothing {
    const action = item.action
    if (!action) return nothing
    const name = html`${action.label}<span class="visually-hidden"> ${item.title}</span>`
    if (action.href) {
      return html`<a class="lintje-list__link" data-part="action" href=${action.href}>${name}</a>`
    }
    return html`<lintje-button
      variant="link"
      size="compact"
      data-part="action"
      @click=${() => this.emit('lintje-row-action', { id: item.id, label: item.title, value: action.value })}
      >${name}</lintje-button
    >`
  }

  private row(item: ListItem): TemplateResult {
    if (item.rename) return this.renderRename(item)
    const selected = item.id === this.selectedId
    const clickable = item.clickable !== false
    const actions = (item.actions?.length ?? 0) > 0
    const measured = typeof item.progress === 'number' && !Number.isNaN(item.progress)
    return html`<li
      class=${classMap({
        'lintje-list__row': true,
        'is-selected': selected,
        'is-static': !clickable,
        'has-icon': Boolean(item.icon),
        'has-actions': actions,
        'has-swatch': Boolean(item.swatch),
        'is-narrow': this.#mobile.matches,
      })}
      ${styleProps({ '--lintje-swatch': item.swatch ? `var(--color-chart-${item.swatch})` : null })}
      @click=${clickable ? (event: MouseEvent) => this.onRowClick(event, item) : nothing}
    >
      ${item.icon ? renderIcon(item.icon, { size: 24, className: 'lintje-list__icon' }) : nothing}
      <div class="lintje-list__main">
        ${this.renderTitle(item)}
        ${item.sub ? html`<span class="lintje-list__sub">${item.sub}</span>` : nothing}
        ${
          measured
            ? html`<lintje-progress-bar
                class="lintje-list__progress"
                hide-label
                label=${`Voortgang ${item.title}`}
                .value=${item.progress}
                tone=${item.status?.tone === 'warning' ? 'paused' : 'run'}
              ></lintje-progress-bar>`
            : nothing
        }
      </div>
      ${
        item.status || item.meta
          ? html`<div class="lintje-list__facts">
              ${
                item.status
                  ? html`<lintje-badge tone=${item.status.tone ?? 'neutral'}>${item.status.label}</lintje-badge>`
                  : nothing
              }
              ${item.meta ? html`<span class="lintje-list__meta">${item.meta}</span>` : nothing}
            </div>`
          : nothing
      }
      ${
        item.action || actions
          ? html`<div class="lintje-list__actions">
              ${this.renderAction(item)}
              ${
                actions
                  ? html`<lintje-menu-button
                      class="lintje-list__action"
                      data-part="action"
                      icon
                      placement="bottom-end"
                      label=${`Acties voor ${item.title}`}
                      .items=${item.actions ?? []}
                      @lintje-action=${(event: CustomEvent<string>) => this.onAction(event, item)}
                    ></lintje-menu-button>`
                  : nothing
              }
            </div>`
          : nothing
      }
    </li>`
  }

  private renderRun(
    run: { label: string; items: ListItem[] },
    index: number,
    label?: string,
  ): TemplateResult {
    // Keyed, so a row's focus stays with its own item when the host reorders or drops rows.
    const rows = repeat(
      run.items,
      (item) => item.id,
      (item) => this.row(item),
    )
    if (!run.label) return html`<ul class="lintje-list" aria-label=${label ?? nothing}>${rows}</ul>`
    return html`<div
        class="lintje-list__group"
        id="lintje-list-group-${index}"
        role="heading"
        aria-level=${this.headingLevel}
        >${run.label}</div
      >
      <ul class="lintje-list" aria-labelledby="lintje-list-group-${index}">${rows}</ul>`
  }

  protected override render(): TemplateResult {
    if (!this.items.length) {
      return html`<lintje-empty-state compact text=${this.emptyText}
        ><slot name="empty"></slot
      ></lintje-empty-state>`
    }
    const runs = groupRuns(this.items)
    const [only] = runs
    if (runs.length === 1 && only && !only.label) return this.renderRun(only, 0, this.label)
    // With headings the host's label names the whole, and each run is named by its heading.
    return html`<div role="group" aria-label=${this.label ?? nothing}>
      ${runs.map((run, index) => this.renderRun(run, index))}
    </div>`
  }
}

define('lintje-list', LintjeList)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-list': LintjeList
  }
}
