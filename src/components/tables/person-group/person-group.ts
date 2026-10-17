/**
 * `<lintje-person-group>` — a row of overlapping circles with "+n", that opens a list of everyone.
 *
 * It shows no names, so it is always a button with a panel: a disclosure, not a menu. It opens and
 * closes itself, as the user menu does, and says so; a host may set `open`. The list holds the
 * people in the host's order, each with name and role; a name with `href` is a link there.
 *
 * Events: `lintje-toggle` `{ open }`, `lintje-navigate` `{ href }` (from a name in the list).
 */
import { html, type PropertyDeclarations, type PropertyValues, type TemplateResult } from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles } from '../../../icons/render'
import { avatarStyles, renderAvatar } from '../../shared/avatar'
import '../person/person'
import '../../overlays/popover/popover'
import type { Person } from '../../../types'
import personGroupCss from './person-group.css?inline'
import { uniqueId } from '../../../core/id'

/** "1 persoon", "6 personen". */
const count = (n: number): string => `${n} ${n === 1 ? 'persoon' : 'personen'}`

/** The names a reader sees, then how many more stand in "+n": "A, B en 3 anderen". */
export function spoken(names: string[], more: number): string {
  if (more > 0) return `${names.join(', ')} en ${more} ${more === 1 ? 'ander' : 'anderen'}`
  if (names.length < 2) return names.join('')
  return `${names.slice(0, -1).join(', ')} en ${names.at(-1)}`
}

export class LintjePersonGroup extends LintjeElement {
  static override styles = [iconStyles, avatarStyles, shadowCss(personGroupCss)]

  static override properties: PropertyDeclarations = {
    people: { attribute: false },
    label: { type: String },
    max: { type: Number },
    size: { type: String, reflect: true },
    empty: { type: String },
    open: { type: Boolean, reflect: true },
  }

  people: Person[] = []
  /** What the row is ("Meelezers"): the list's heading and the start of the button's name. */
  label: string = 'Personen'
  /** The number of circles, "+n" included; at least 2. With more people, `max − 1` and "+n". */
  max: number = 4
  /** 24 or 32 px. */
  size: 'small' | 'medium' = 'small'
  /** The word where nobody is. */
  empty: string = 'Niemand'
  /** Whether the list stands open. */
  open: boolean = false

  readonly #listId = uniqueId('lintje-person-group')

  /** Where two circles overlap; the button keeps the room they take when they spread. */
  #overlaps = 0

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.trigger?.style.setProperty('--lintje-person-group-overlaps', String(this.#overlaps))
  }

  private get trigger(): HTMLButtonElement | null {
    return this.renderRoot.querySelector<HTMLButtonElement>('.lintje-person-group__button')
  }

  private setOpen(open: boolean): void {
    if (this.open === open) return
    this.open = open
    this.emit('lintje-toggle', { open })
  }

  private onPopoverClose(event: CustomEvent<{ reason: string }>): void {
    event.stopPropagation()
    this.setOpen(false)
    if (event.detail?.reason === 'escape') this.trigger?.focus()
  }

  protected override render(): TemplateResult {
    const people = this.people ?? []
    const size = this.size
    if (people.length === 0) {
      return html`<span class="lintje-person-group is-empty"
        >${renderAvatar(null, { size })}<span class="lintje-person-group__empty"
          >${this.empty}</span
        ></span
      >`
    }
    const max = Math.max(2, Math.floor(Number(this.max) || 0))
    const shown = people.length > max ? people.slice(0, max - 1) : people
    const more = people.length - shown.length
    this.#overlaps = shown.length + (more > 0 ? 1 : 0) - 1
    const label = this.label || 'Personen'
    // The name starts with what the button shows, so a reader who speaks it is understood (2.5.3).
    const seen = [
      ...shown.flatMap((person) => (person.initials ? [person.initials] : [])),
      ...(more > 0 ? [`+${more}`] : []),
    ].join(' ')
    const named = `${label}: ${spoken(
      shown.map((person) => person.name),
      more,
    )}`
    const name = seen ? `${seen}, ${named}` : named
    const headingId = `${this.#listId}-heading`
    return html`<span class="lintje-person-group">
      <button
        type="button"
        class="lintje-person-group__button lintje-person-group__button--${size}"
        aria-label=${name}
        aria-expanded=${String(this.open)}
        aria-controls=${this.#listId}
        @click=${() => this.setOpen(!this.open)}
      >
        <!-- A space between the circles, which the flex row drops: the initials read as words. -->
        ${shown.map((person) => html`${renderAvatar(person, { size })} `)}
        ${
          more > 0
            ? renderAvatar(
                { name: count(more), initials: `+${more}` },
                { size, className: 'lintje-person-group__more' },
              )
            : ''
        }
      </button>
      <lintje-popover
        id=${this.#listId}
        placement="bottom-end"
        ?open=${this.open}
        @lintje-close=${this.onPopoverClose}
      >
        <div class="lintje-person-group__panel">
          <p class="lintje-person-group__heading" id=${headingId}>
            <span class="lintje-person-group__label">${label}</span>
            <span class="lintje-person-group__count">${count(people.length)}</span>
          </p>
          <ul class="lintje-person-group__list" aria-labelledby=${headingId}>
            ${people.map(
              (person) =>
                html`<li class="lintje-person-group__item">
                  <lintje-person size="medium" .person=${person}></lintje-person>
                </li>`,
            )}
          </ul>
        </div>
      </lintje-popover>
    </span>`
  }
}

define('lintje-person-group', LintjePersonGroup)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-person-group': LintjePersonGroup
  }
}
