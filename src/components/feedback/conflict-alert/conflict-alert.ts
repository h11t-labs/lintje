/**
 * `<lintje-conflict-alert>` — someone else changed the item while the reader was editing it.
 *
 * A compact live warning announcement above the form with three actions. It takes the focus when
 * it appears, so the keyboard continues at its buttons. It saves nothing; the host answers the
 * events. `lintje-conflict-compare` lets a host fetch the differences only when asked.
 *
 * Events: `lintje-conflict-keep-mine`, `lintje-conflict-take-theirs`, `lintje-conflict-compare`
 * `{ open }`.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { MediaController, MOBILE } from '../../../core/media'
import { shadowCss } from '../../../core/styles'
import '../../../primitives/button/button'
import '../announcement/announcement'
import '../../content/highlight/highlight'
import type { AnnouncementViewData } from '../../../types'
import conflictAlertCss from './conflict-alert.css?inline'

/** One field both versions changed, as the host formats the texts. */
export interface ConflictChange {
  label: string
  mine: string
  theirs: string
}

export type ConflictChoice = 'mine' | 'theirs'

export function conflictText(who?: string, when?: string, item = 'dit item'): AnnouncementViewData {
  const person = who || 'Iemand anders'
  return {
    kind: 'warning',
    title: when
      ? `${person} heeft ${item} om ${when} gewijzigd.`
      : `${person} heeft ${item} gewijzigd.`,
    text: 'Jouw wijzigingen zijn nog niet opgeslagen.',
    // The conflict answers a save, so it is spoken.
    live: true,
  }
}

export class LintjeConflictAlert extends LintjeElement {
  static override styles = shadowCss(conflictAlertCss)

  static override properties: PropertyDeclarations = {
    who: { type: String },
    when: { type: String },
    item: { type: String },
    busy: { type: String, reflect: true },
    changes: { attribute: false },
    comparing: { state: true },
  }

  /** Who changed the item: "M. Jansen". */
  declare who?: string
  /** When, as the host formats it: "10:40". */
  declare when?: string
  /** What was changed, as it reads in the sentence: "deze melding". */
  item: string = 'dit item'
  /** The version being saved: that button is busy, the others disabled. */
  declare busy?: ConflictChoice | ''
  changes: ConflictChange[] = []
  comparing: boolean = false

  readonly #mobile = new MediaController(this, MOBILE)

  protected override firstUpdated(): void {
    this.renderRoot.querySelector<HTMLElement>('.lintje-conflict-alert')?.focus()
  }

  private compare(): void {
    this.comparing = !this.comparing
    this.emit('lintje-conflict-compare', { open: this.comparing })
  }

  private renderChanges(): TemplateResult | typeof nothing {
    if (!this.comparing || !this.changes?.length) return nothing
    const other = this.who ? `de versie van ${this.who}` : 'de andere versie'
    return html`<div class="lintje-conflict-alert__changes">
      ${this.changes.map(
        (change) => html`<div class="lintje-conflict-alert__change">
          <p class="lintje-conflict-alert__label">${change.label}</p>
          <p class="lintje-conflict-alert__versions">
            <lintje-highlight kind="removed" label="jouw versie">${change.mine}</lintje-highlight>
            <lintje-highlight kind="added" label=${other}>${change.theirs}</lintje-highlight>
          </p>
        </div>`,
      )}
      <p class="lintje-conflict-alert__legend">Doorgehaald: jouw versie · onderstreept: ${other}</p>
    </div>`
  }

  protected override render(): TemplateResult {
    const who = this.who || 'de ander'
    const busy = this.busy || ''
    const block = this.#mobile.matches
    return html`<div class="lintje-conflict-alert" tabindex="-1">
      <lintje-announcement compact .data=${conflictText(this.who, this.when, this.item)}>
        <div slot="action" class="lintje-conflict-alert__actions">
          <lintje-button
            variant="secondary"
            size="compact"
            ?block=${block}
            ?disabled=${Boolean(busy)}
            .expanded=${this.comparing}
            @click=${this.compare}
            >${this.comparing ? 'Verschillen verbergen' : 'Verschillen bekijken'}</lintje-button
          >
          <lintje-button
            variant="tertiary"
            size="compact"
            ?block=${block}
            ?busy=${busy === 'mine'}
            ?disabled=${busy === 'theirs'}
            @click=${() => this.emit('lintje-conflict-keep-mine')}
            >Mijn versie opslaan<span class="visually-hidden">
              en die van ${who} overschrijven</span
            ></lintje-button
          >
          <lintje-button
            variant="tertiary"
            size="compact"
            ?block=${block}
            ?busy=${busy === 'theirs'}
            ?disabled=${busy === 'mine'}
            @click=${() => this.emit('lintje-conflict-take-theirs')}
            >Hun versie laden<span class="visually-hidden"> en mijn wijzigingen weggooien</span
            ></lintje-button
          >
        </div>
      </lintje-announcement>
      ${this.renderChanges()}
    </div>`
  }
}

define('lintje-conflict-alert', LintjeConflictAlert)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-conflict-alert': LintjeConflictAlert
  }
}
