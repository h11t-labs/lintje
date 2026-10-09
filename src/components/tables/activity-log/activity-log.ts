/**
 * `<lintje-activity-log>` — a timeline of what happened to one item, newest first.
 *
 * Shows `limit` entries and "Toon eerdere" for ten more; when that press removes the button,
 * focus moves to the first new entry. The host sends the entries in order with `when` already
 * written in Dutch.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import '../../../primitives/button/button'
import activityLogCss from './activity-log.css?inline'

export interface ActivityEntry {
  /** A name, or "Systeem". */
  who: string
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
    const text = this.heading
    const id = 'lintje-activity-log-heading'
    switch (this.level) {
      case 2:
        return html`<h2 id=${id} class="lintje-activity-log__heading">${text}</h2>`
      case 4:
        return html`<h4 id=${id} class="lintje-activity-log__heading">${text}</h4>`
      case 5:
        return html`<h5 id=${id} class="lintje-activity-log__heading">${text}</h5>`
      case 6:
        return html`<h6 id=${id} class="lintje-activity-log__heading">${text}</h6>`
      default:
        return html`<h3 id=${id} class="lintje-activity-log__heading">${text}</h3>`
    }
  }

  private entry(entry: ActivityEntry, index: number, last: boolean): TemplateResult {
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
          <strong class="lintje-activity-log__who">${entry.who}</strong> ${entry.what}
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
    return html`<section class="lintje-activity-log">
      ${this.renderHeading()}
      <ol
        class="lintje-activity-log__list"
        aria-labelledby=${this.heading ? 'lintje-activity-log-heading' : nothing}
      >
        ${shown.map((entry, index) => this.entry(entry, index, index === shown.length - 1))}
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
