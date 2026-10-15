/**
 * `<lintje-person>` — one person: a circle with photo, initials or icon, and the name beside it.
 *
 * A person is a value: in a table cell, a row, a card or a log entry it reads in the letter of
 * where it stands. Without `person` it is the empty place, read as its word. With `href` circle
 * and name are one link; a table, list or card that opens itself passes the person without one.
 *
 * Events: `lintje-navigate` `{ href }` (a plain click on a name with `href`).
 */
import { html, type PropertyDeclarations, type TemplateResult } from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { isPlainClick } from '../../../core/links'
import { shadowCss } from '../../../core/styles'
import { iconStyles } from '../../../icons/render'
import { avatarStyles, renderAvatar, type AvatarSize } from '../../shared/avatar'
import type { SpeakerColour } from '../../content/shared/playback'
import type { Person } from '../../../types'
import personCss from './person.css?inline'

export class LintjePerson extends LintjeElement {
  static override styles = [iconStyles, avatarStyles, shadowCss(personCss)]

  static override properties: PropertyDeclarations = {
    person: { attribute: false },
    size: { type: String, reflect: true },
    empty: { type: String },
    color: { type: String },
  }

  /** Without a person, the empty place with `empty`. */
  person: Person | null = null
  /** 24, 32 or 40 px. `small` shows no second line: it does not fit beside 24 px in a row. */
  size: AvatarSize = 'medium'
  /** The word where nobody is ("Nog niemand"). */
  empty: string = 'Niet toegewezen'
  /** A speaker's colour, only where the people are the variable, as the speakers of a recording. */
  declare color?: SpeakerColour

  private onClick(href: string, event: MouseEvent): void {
    if (isPlainClick(event)) this.followLink(href, event)
  }

  protected override render(): TemplateResult {
    const person = this.person
    const size = this.size
    if (!person) {
      return html`<span class="lintje-person lintje-person--${size} is-empty"
        >${renderAvatar(null, { size })}<span class="lintje-person__name">${this.empty}</span></span
      >`
    }
    const role = size === 'small' ? undefined : person.role
    const content = html`${renderAvatar(person, { size, color: this.color })}${
      role
        ? html`<span class="lintje-person__names"
            ><span class="lintje-person__name is-strong">${person.name}</span
            ><span class="lintje-person__role">${role}</span></span
          >`
        : html`<span class="lintje-person__name">${person.name}</span>`
    }`
    if (person.href) {
      const href = person.href
      return html`<a
        class="lintje-person lintje-person--${size} lintje-person--link"
        href=${href}
        @click=${(event: MouseEvent) => this.onClick(href, event)}
        >${content}</a
      >`
    }
    return html`<span class="lintje-person lintje-person--${size}">${content}</span>`
  }
}

define('lintje-person', LintjePerson)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-person': LintjePerson
  }
}
