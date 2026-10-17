/**
 * `<lintje-activity-log>` — a timeline of what happened to one item, newest first.
 *
 * The host sends the entries in order, with `when` already written in Dutch. "Toon eerdere" shows
 * ten more.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { renderHeading } from '../../shared/heading'
import '../../actions/button/button'
import '../person/person'
import type { Person } from '../../../types'
import activityLogCss from './activity-log.css?inline'

export interface ActivityEntry {
  /**
   * Someone, with the circle before the name and a link with `href`; or a text that is no person
   * ("Systeem"), as the bold name alone.
   */
  who: string | Person
  /** The rest of the sentence: "wijzigde de omschrijving". */
  what: string
  /** The moment as the host wrote it, in Dutch. */
  when: string
  /** The same moment as ISO 8601, for `<time datetime>`. */
  at?: string
}

const STEP = 10

export class LintjeActivityLog extends LintjeElement {
  static override styles = shadowCss(activityLogCss)

  static override properties: PropertyDeclarations = {
    entries: { attribute: false },
    heading: { type: String },
    level: { type: Number },
    limit: { type: Number },
  }

  entries: ActivityEntry[] = []
  declare heading?: string
  /** The heading's level on the page. */
  level: 2 | 3 | 4 | 5 | 6 = 3
  /** How many entries show before "Toon eerdere". */
  limit: number = STEP

  private async showMore(): Promise<void> {
    const first = this.limit
    this.limit += STEP
    await this.updateComplete
    if (this.renderRoot.querySelector('.lintje-activity-log__more')) return
    const entry = this.renderRoot.querySelectorAll<HTMLElement>('.lintje-activity-log__entry')[
      first
    ]
    if (!entry) return
    entry.tabIndex = -1
    entry.focus()
  }

  private renderHeading(): TemplateResult | typeof nothing {
    if (!this.heading) return nothing
    return renderHeading(
      this.level,
      'lintje-activity-log__heading',
      this.heading,
      'lintje-activity-log-heading',
    )
  }

  /** A person's circle before the name; a text keeps the circle's room empty where others have one. */
  private who(who: string | Person, people: boolean): TemplateResult {
    if (typeof who !== 'string') {
      return html`<strong class="lintje-activity-log__who"
        ><lintje-person class="lintje-activity-log__person" size="small" .person=${who}></lintje-person
      ></strong>`
    }
    return html`${
      people ? html`<span class="lintje-activity-log__space" aria-hidden="true"></span>` : nothing
    }<strong class="lintje-activity-log__who">${who}</strong>`
  }

  private entry(
    entry: ActivityEntry,
    index: number,
    last: boolean,
    people: boolean,
  ): TemplateResult {
    return html`<li
      class=${classMap({
        'lintje-activity-log__entry': true,
        'is-newest': index === 0,
        'is-last': last,
      })}
    >
      <span class="lintje-activity-log__rail" aria-hidden="true">
        <span class="lintje-activity-log__mark"></span>
        <span class="lintje-activity-log__line"></span>
      </span>
      <div class="lintje-activity-log__body">
        <p class="lintje-activity-log__what">
          ${this.who(entry.who, people)} ${entry.what}
        </p>
        ${
          entry.at
            ? html`<time class="lintje-activity-log__when" datetime=${entry.at}>${entry.when}</time>`
            : html`<span class="lintje-activity-log__when">${entry.when}</span>`
        }
      </div>
    </li>`
  }

  protected override render(): TemplateResult {
    const shown = this.entries.slice(0, Math.max(0, this.limit))
    const hidden = this.entries.length - shown.length
    const people = this.entries.some((entry) => typeof entry.who !== 'string')
    return html`<section class="lintje-activity-log">
      ${this.renderHeading()}
      <ol
        class=${classMap({ 'lintje-activity-log__list': true, 'has-people': people })}
        role="list"
        aria-labelledby=${this.heading ? 'lintje-activity-log-heading' : nothing}
      >
        ${shown.map((entry, index) => this.entry(entry, index, index === shown.length - 1, people))}
      </ol>
      ${
        hidden > 0
          ? html`<lintje-button
              class="lintje-activity-log__more"
              variant="link"
              @click=${() => void this.showMore()}
              >Toon eerdere</lintje-button
            >`
          : nothing
      }
    </section>`
  }
}

define('lintje-activity-log', LintjeActivityLog)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-activity-log': LintjeActivityLog
  }
}
