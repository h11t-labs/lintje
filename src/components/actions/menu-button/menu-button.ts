/**
 * `<lintje-menu-button>` — a button with a menu of actions.
 *
 * The trigger is a native `<button>` so `aria-haspopup`, `aria-expanded` and `aria-controls` sit
 * on the focused element; `aria-controls` names the popover because the `role="menu"` panel is
 * in the popover's shadow root. A disabled trigger is `aria-disabled`: it stays in the tab order
 * and refuses to open. Keys reach disabled rows too, so their `reason` tooltip shows on focus.
 * While `busyLabel` is set the trigger is disabled and the sentence stands beside it with a
 * spinner; the `role="status"` is always present so the sentence is read out when it appears.
 *
 * `split` makes it two halves of one button, 1 px apart: the label does the usual action
 * (`action`), the arrow beside it opens the other ways to do it. Busy, a split button keeps its
 * size and colours: only its icon turns into the spinner, and the sentence is for the screen
 * reader.
 *
 * Events: `lintje-action` (the row's value, or `action` from a split button's own half),
 * `lintje-navigate` `{ href }` for a link row.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { ifDefined } from 'lit/directives/if-defined.js'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import '../../../primitives/popover/popover'
import '../../../primitives/spinner/spinner'
import '../../../primitives/tooltip/tooltip'
import buttonCss from '../../../primitives/button/button.css?inline'
import iconButtonCss from '../../../primitives/icon-button/icon-button.css?inline'
import menuCss from '../../shared/menu.css?inline'
import menuButtonCss from './menu-button.css?inline'
import { isPlainClick } from '../../../core/links'
import { standsIn } from '../../../core/focus'

export interface MenuItem {
  /** What `lintje-action` carries. */
  value: string
  label: string
  /** An icon file name. */
  icon?: string
  /** The row is a link. */
  href?: string
  disabled?: boolean
  /** Why the row is disabled: the tooltip on it. */
  reason?: string
  /** An action that cannot be undone; the host puts it last, after a separator. */
  danger?: boolean
  /** Right-aligned mono text: a format, a size, a shortcut. */
  hint?: string
  /** A switch: the row is a `menuitemcheckbox` with a check while on. */
  checked?: boolean
  /** With `checked`: one choice of its group, a `menuitemradio`. */
  radio?: boolean
}

/** The name above a group of rows; the group runs to the next separator or heading. */
export interface MenuHeading {
  heading: string
}

/** A row, a group's heading, or the line between two groups. */
export type MenuEntry = MenuItem | MenuHeading | 'separator'

const isItem = (entry: MenuEntry): entry is MenuItem =>
  entry !== 'separator' && !('heading' in entry)

/** `flat` is the tertiary without its border, for a trigger among flat icon buttons. */
export type MenuButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'flat' | 'ellipsis'

let instances = 0

/**
 * The entries of a menu: a heading and the rows under it form a `group` named by it, since a menu
 * takes no loose text. Shared with the user menu, which draws its own rows.
 */
export function renderMenuEntries(
  entries: MenuEntry[],
  idPrefix: string,
  renderRow: (item: MenuItem) => TemplateResult,
): TemplateResult[] {
  const out: TemplateResult[] = []
  let group: { heading: string; rows: TemplateResult[] } | null = null
  const close = (): void => {
    if (!group) return
    const id = `${idPrefix}-group-${out.length}`
    out.push(html`<div class="lintje-menu__group" role="group" aria-labelledby=${id}>
      <div class="lintje-menu__heading" id=${id} role="presentation">${group.heading}</div>
      ${group.rows}
    </div>`)
    group = null
  }
  for (const entry of entries) {
    if (entry === 'separator') {
      close()
      out.push(html`<div class="lintje-menu__separator" role="separator"></div>`)
    } else if (!isItem(entry)) {
      close()
      group = { heading: entry.heading, rows: [] }
    } else if (group) {
      group.rows.push(renderRow(entry))
    } else {
      out.push(renderRow(entry))
    }
  }
  close()
  return out
}

/**
 * The next row from `from` in `direction`, wrapping; `-1` when there is none. A disabled row is
 * reached too, so its reason can be read. `from = -1` with 1 is the first row.
 */
export function nextRow(rows: MenuItem[], from: number, direction: 1 | -1): number {
  const count = rows.length
  if (count === 0) return -1
  return (((from + direction) % count) + count) % count
}

/** The next row after `from` whose label starts with `letter`; `-1` when none does. */
export function rowByLetter(rows: MenuItem[], from: number, letter: string): number {
  const wanted = letter.toLocaleLowerCase('nl')
  const count = rows.length
  for (let step = 1; step <= count; step++) {
    const index = (from + step) % count
    const row = rows[index]
    if (row && row.label.toLocaleLowerCase('nl').startsWith(wanted)) return index
  }
  return -1
}

export class LintjeMenuButton extends LintjeElement {
  static override styles = [
    iconStyles,
    shadowCss(buttonCss),
    shadowCss(iconButtonCss),
    shadowCss(menuCss),
    shadowCss(menuButtonCss),
  ]

  static override properties: PropertyDeclarations = {
    label: { type: String },
    accessibleLabel: { type: String, attribute: 'accessible-label' },
    variant: { type: String, reflect: true },
    icon: { type: Boolean, reflect: true },
    leadingIcon: { type: String, attribute: 'leading-icon' },
    disabled: { type: Boolean, reflect: true },
    busyLabel: { type: String, attribute: 'busy-label' },
    placement: { type: String },
    items: { attribute: false },
    open: { type: Boolean, reflect: true },
    split: { type: Boolean, reflect: true },
    action: { type: String },
  }

  label: string = ''
  /**
   * The trigger's and the menu's name when `label` alone does not say what it chooses ("1×").
   * It contains the label, so speech input finds the button by what it shows.
   */
  accessibleLabel: string = ''
  variant: MenuButtonVariant = 'secondary'
  /**
   * The icon-button form: `functioneel-meer`; `label` is then its accessible name. Outlined, or
   * flat with `variant="tertiary"` where it repeats, as at the end of every table row.
   */
  icon: boolean = false
  /** An icon file name before the label, saying what the label is a value of (the speed's "1×"). */
  leadingIcon: string = ''
  disabled: boolean = false
  /** An action is under way: the sentence beside the spinner. Empty when none is. */
  busyLabel: string = ''
  placement: 'bottom-start' | 'bottom-end' | 'top-end' = 'bottom-start'
  items: MenuEntry[] = []
  /** Reflected, so a sheet around it can see a menu is open and leave Escape to it. */
  open: boolean = false
  /** The label is a button of its own, and the arrow beside it opens the menu. */
  split: boolean = false
  /** What a split button's own half sends as `lintje-action`. */
  action: string = ''

  private readonly menuId = `lintje-menu-${++instances}`
  private pendingFocus: number | null = null

  private get unavailable(): boolean {
    return this.disabled || Boolean(this.busyLabel)
  }

  private get rows(): MenuItem[] {
    return this.items.filter(isItem)
  }

  private get trigger(): HTMLButtonElement | null {
    return this.renderRoot.querySelector<HTMLButtonElement>('.lintje-menu-button__trigger')
  }

  private rowElements(): HTMLElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('.lintje-menu__row')]
  }

  private show(focus: 'first' | 'last'): void {
    const rows = this.rows
    this.pendingFocus = nextRow(
      rows,
      focus === 'first' ? -1 : rows.length,
      focus === 'first' ? 1 : -1,
    )
    this.open = true
  }

  private hide(returnFocus: boolean): void {
    this.open = false
    if (returnFocus) this.trigger?.focus()
  }

  // The focus leaving the element closes the menu. A press that takes no focus blurs to nothing,
  // or to a focusable box around the element: neither is leaving.
  private readonly onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget as Node | null
    if (!this.open || !next || standsIn(next, this) || standsIn(this, next)) return
    this.hide(false)
  }

  constructor() {
    super()
    this.addEventListener('focusout', this.onFocusOut)
  }

  private focusRow(index: number): void {
    if (index < 0) return
    this.rowElements()[index]?.focus()
  }

  private currentRow(): number {
    const active = this.shadowRoot?.activeElement
    return this.rowElements().findIndex((row) => row === active)
  }

  private readonly onTriggerKeydown = (event: KeyboardEvent): void => {
    if (this.unavailable) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      this.show(event.key === 'ArrowDown' ? 'first' : 'last')
    }
  }

  private readonly onTriggerClick = (): void => {
    if (this.unavailable) return
    if (this.open) this.hide(false)
    else this.show('first')
  }

  private readonly onMenuKeydown = (event: KeyboardEvent): void => {
    const rows = this.rows
    const current = this.currentRow()
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        this.focusRow(nextRow(rows, current, 1))
        return
      case 'ArrowUp':
        event.preventDefault()
        this.focusRow(nextRow(rows, current < 0 ? rows.length : current, -1))
        return
      case 'Home':
        event.preventDefault()
        this.focusRow(nextRow(rows, -1, 1))
        return
      case 'End':
        event.preventDefault()
        this.focusRow(nextRow(rows, rows.length, -1))
        return
      case 'Tab':
        // Tab goes on from the trigger, past the menu that stands after it.
        if (!event.shiftKey) this.trigger?.focus()
        this.hide(false)
        return
      case ' ': {
        const row = this.rowElements()[current]
        if (row instanceof HTMLAnchorElement) {
          event.preventDefault()
          row.click()
        }
        return
      }
      default:
        if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey) {
          this.focusRow(rowByLetter(rows, current, event.key))
        }
    }
  }

  private onPopoverClose(event: CustomEvent<{ reason: string }>): void {
    event.stopPropagation()
    this.hide(event.detail?.reason === 'escape')
  }

  private choose(item: MenuItem, event: MouseEvent): void {
    if (item.disabled) {
      event.preventDefault()
      return
    }
    if (item.href) {
      if (!isPlainClick(event)) return
      this.hide(true)
      this.emit('lintje-action', item.value)
      this.followLink(item.href, event)
      return
    }
    this.hide(true)
    this.emit('lintje-action', item.value)
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if ((changed.has('disabled') || changed.has('busyLabel')) && this.unavailable) this.open = false
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (this.open && this.pendingFocus !== null) {
      const index = this.pendingFocus
      this.pendingFocus = null
      // The rows are the popover's slotted content: they exist once the popover has drawn.
      const popover = this.renderRoot.querySelector('lintje-popover')
      void (popover?.updateComplete ?? Promise.resolve()).then(() => this.focusRow(index))
    }
  }

  /** The usual action on the label, the arrow beside it for the rest: one group, 1 px apart. */
  private renderSplit(): TemplateResult {
    // Busy, both halves keep their colours; only `disabled` greys them.
    const disabled = this.disabled ? 'true' : nothing
    const busy = Boolean(this.busyLabel)
    const variant = this.variant === 'flat' ? 'tertiary' : this.variant
    return html`<span class="lintje-menu-button__split">
      <button
        type="button"
        class=${classMap({
          'lintje-button': true,
          [`lintje-button--${variant}`]: true,
          'lintje-menu-button__main': true,
          'is-disabled': this.disabled,
          'is-working': busy,
        })}
        aria-disabled=${this.disabled ? 'true' : nothing}
        aria-busy=${busy ? 'true' : nothing}
        @click=${() => {
          if (!this.unavailable) this.emit('lintje-action', this.action)
        }}
      >
        ${
          busy
            ? html`<span class="lintje-menu-button__busy" aria-hidden="true"></span>`
            : this.leadingIcon
              ? renderIcon(this.leadingIcon, { size: 20, className: 'lintje-button__icon' })
              : nothing
        }
        <span class="lintje-button__label">${this.label}</span>
      </button>
      <button
        type="button"
        class=${classMap({
          'lintje-button': true,
          [`lintje-button--${variant}`]: true,
          'lintje-menu-button__trigger': true,
          'lintje-menu-button__trigger--split': true,
          'is-open': this.open,
          'is-disabled': this.disabled,
          'is-working': busy,
        })}
        aria-label=${this.accessibleLabel || `Meer bij ${this.label}`}
        aria-haspopup="menu"
        aria-expanded=${String(this.open)}
        aria-controls=${this.menuId}
        aria-disabled=${disabled}
        @click=${this.onTriggerClick}
        @keydown=${this.onTriggerKeydown}
      >
        ${renderIcon('functioneel-delta-omlaag', {
          size: 20,
          rotate: this.open ? 180 : undefined,
          className: 'lintje-button__icon',
        })}
      </button>
    </span>`
  }

  private renderTrigger(): TemplateResult {
    if (this.split) return this.renderSplit()
    const common = {
      'lintje-menu-button__trigger': true,
      'is-open': this.open,
      'is-disabled': this.unavailable,
    }
    const disabled = this.unavailable ? 'true' : nothing
    if (this.icon) {
      return html`<button
        type="button"
        class=${classMap({
          ...common,
          'lintje-icon-button': true,
          'lintje-icon-button--outlined': this.variant !== 'tertiary',
          'lintje-icon-button--flat': this.variant === 'tertiary',
          'lintje-menu-button__trigger--icon': true,
        })}
        aria-label=${this.label}
        aria-haspopup="menu"
        aria-expanded=${String(this.open)}
        aria-controls=${this.menuId}
        aria-disabled=${disabled}
        @click=${this.onTriggerClick}
        @keydown=${this.onTriggerKeydown}
      >
        ${renderIcon('functioneel-meer', { size: 16 })}
      </button>`
    }
    if (this.variant === 'ellipsis') {
      return html`<button
        type="button"
        class=${classMap({ ...common, 'lintje-menu-button__trigger--ellipsis': true })}
        aria-label=${this.label}
        aria-haspopup="menu"
        aria-expanded=${String(this.open)}
        aria-controls=${this.menuId}
        aria-disabled=${disabled}
        @click=${this.onTriggerClick}
        @keydown=${this.onTriggerKeydown}
      >
        …
      </button>`
    }
    return html`<button
      type="button"
      class=${classMap({
        ...common,
        'lintje-button': true,
        [`lintje-button--${this.variant === 'flat' ? 'tertiary' : this.variant}`]: true,
        'lintje-menu-button__trigger--flat': this.variant === 'flat',
      })}
      aria-label=${this.accessibleLabel || nothing}
      aria-haspopup="menu"
      aria-expanded=${String(this.open)}
      aria-controls=${this.menuId}
      aria-disabled=${disabled}
      @click=${this.onTriggerClick}
      @keydown=${this.onTriggerKeydown}
    >
      ${
        this.leadingIcon
          ? renderIcon(this.leadingIcon, { size: 16, className: 'lintje-button__icon' })
          : nothing
      }
      <span class="lintje-button__label">${this.label}</span>
      ${renderIcon('functioneel-delta-omlaag', {
        size: 16,
        rotate: this.open ? 180 : undefined,
        className: 'lintje-button__icon',
      })}
    </button>`
  }

  private renderRow(item: MenuItem): TemplateResult {
    const classes = classMap({
      'lintje-menu__row': true,
      'focus-inset': true,
      'is-danger': Boolean(item.danger),
      'is-disabled': Boolean(item.disabled),
    })
    const switched = item.checked !== undefined
    const role = switched ? (item.radio ? 'menuitemradio' : 'menuitemcheckbox') : 'menuitem'
    let icon: TemplateResult | typeof nothing = nothing
    if (switched && item.radio) {
      // One of a choice is a radio's circle, as in a form; a switch is a check.
      icon = html`<span
        class=${classMap({ 'lintje-menu__icon': true, 'lintje-menu__radio': true, 'is-checked': Boolean(item.checked) })}
      ></span>`
    } else if (switched) {
      // An unchecked row keeps the empty slot, so the labels of a group stay in line.
      icon = item.checked
        ? renderIcon('functioneel-vinkje', {
            size: 16,
            className: 'lintje-menu__icon lintje-menu__check',
          })
        : html`<span class="lintje-menu__icon lintje-menu__slot"></span>`
    } else if (item.icon) {
      icon = renderIcon(item.icon, { size: 16, className: 'lintje-menu__icon' })
    }
    const content = html`${icon}<span class="lintje-menu__label">${item.label}</span>${
      item.hint ? html`<span class="lintje-menu__hint">${item.hint}</span>` : nothing
    }`
    const row =
      item.href && !item.disabled
        ? html`<a
            class=${classes}
            role="menuitem"
            tabindex="-1"
            href=${item.href}
            @click=${(event: MouseEvent) => this.choose(item, event)}
            >${content}</a
          >`
        : html`<button
            type="button"
            class=${classes}
            role=${role}
            tabindex="-1"
            aria-checked=${switched ? String(item.checked) : nothing}
            aria-disabled=${item.disabled ? 'true' : nothing}
            @click=${(event: MouseEvent) => this.choose(item, event)}
          >
            ${content}
          </button>`
    if (item.disabled && item.reason) {
      return html`<lintje-tooltip class="lintje-menu__tip" text=${item.reason}>${row}</lintje-tooltip>`
    }
    return row
  }

  protected override render(): TemplateResult {
    const busy = Boolean(this.busyLabel)
    // The popover stands right after the trigger: its previous sibling is what it is placed by.
    return html`${this.renderTrigger()}<lintje-popover
        id=${this.menuId}
        panel-role="menu"
        label=${ifDefined(this.accessibleLabel || this.label || undefined)}
        placement=${this.placement}
        ?open=${this.open}
        @lintje-close=${this.onPopoverClose}
      >
        <div class="lintje-menu" @keydown=${this.onMenuKeydown}>${renderMenuEntries(this.items, this.menuId, (item) => this.renderRow(item))}</div>
      </lintje-popover
      ><div
        class=${classMap({
          'lintje-menu-button__status': true,
          'is-busy': busy && !this.split,
          'visually-hidden': busy && this.split,
        })}
        role="status"
      >${
        busy ? html`<lintje-spinner></lintje-spinner><span>${this.busyLabel}</span>` : nothing
      }</div>`
  }
}

define('lintje-menu-button', LintjeMenuButton)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-menu-button': LintjeMenuButton
  }
}
