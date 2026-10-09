/**
 * `<lintje-recording-status>` — how a running recording is doing, in the description list's cells:
 * how long it runs, how the sound comes in and, for a recording made elsewhere (a phone), how the
 * connection holds. Each meter has its word beside it, so the colour never speaks alone (rule 13).
 *
 * The host measures; the element only shows. A value it does not have is a dash, never zero.
 *
 * Events: none.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { levelWord } from '../level-meter/level-meter'
import '../level-meter/level-meter'
import '../../tables/description-list/description-list'
import type { DescriptionItem } from '../../tables/description-list/description-list'
import recordingStatusCss from './recording-status.css?inline'

export { levelWord }

export type RecordingConnection = 'good' | 'weak' | 'lost'

const CONNECTION_WORD: Record<RecordingConnection, string> = {
  good: 'Goed',
  weak: 'Zwak',
  lost: 'Verbroken',
}
const CONNECTION_BARS: Record<RecordingConnection, number> = { good: 4, weak: 2, lost: 0 }

/** `12:04`, or `1:02:09` from an hour on. */
export function clockOf(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const rest = String(whole % 60).padStart(2, '0')
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}

export class LintjeRecordingStatus extends LintjeElement {
  static override styles = shadowCss(recordingStatusCss)

  static override properties: PropertyDeclarations = {
    elapsed: { type: Number },
    level: { type: Number },
    connection: { type: String },
    delay: { type: Number },
  }

  /** How long it runs, in seconds. */
  declare elapsed?: number | null
  /** The sound coming in, 0 to 1. */
  declare level?: number | null
  /** Only for a recording made elsewhere; without it the connection is not shown. */
  declare connection?: RecordingConnection | null
  /** How far the text here runs behind, in seconds. */
  declare delay?: number | null

  private renderLevel(): TemplateResult | typeof nothing {
    if (this.level == null) return nothing
    return html`<lintje-level-meter slot="level" .level=${this.level}></lintje-level-meter>`
  }

  private renderConnection(connection: RecordingConnection): TemplateResult {
    const lit = CONNECTION_BARS[connection]
    const behind =
      connection === 'lost'
        ? 'Wacht op verbinding'
        : this.delay != null
          ? `${this.delay} ${this.delay === 1 ? 'seconde' : 'seconden'} achter`
          : ''
    return html`<span slot="connection" class="lintje-recording-status__connection"><span
        class=${classMap({
          'lintje-recording-status__signal': true,
          [`is-${connection}`]: true,
        })}
        aria-hidden="true"
      >
        ${[1, 2, 3, 4].map(
          (step) =>
            html`<span
              class=${classMap({ 'lintje-recording-status__step': true, 'is-lit': step <= lit })}
            ></span>`,
        )}
      </span>
      <span class="lintje-recording-status__words">
        <strong>${CONNECTION_WORD[connection]}</strong>
        ${behind ? html`<span class="lintje-recording-status__sub">${behind}</span>` : nothing}
      </span></span>`
  }

  protected override render(): TemplateResult {
    const connection = this.connection
    // A missing measure is the list's dash, never zero (rule 15).
    const items: DescriptionItem[] = [
      {
        label: 'Looptijd',
        icon: 'functioneel-klok',
        large: true,
        value: this.elapsed == null ? null : clockOf(this.elapsed),
      },
      {
        label: 'Geluid',
        icon: 'beeld-en-geluid-microfoon',
        value: null,
        slot: this.level == null ? undefined : 'level',
      },
      ...(connection
        ? [{ label: 'Verbinding', icon: 'functioneel-smartphone', value: null, slot: 'connection' }]
        : []),
    ]
    // It stands on a hero's wash or on the page: its cells are a panel of their own.
    return html`<lintje-description-list layout="grid" surface .columns=${items.length} .items=${items}>
      ${this.renderLevel()} ${connection ? this.renderConnection(connection) : nothing}
    </lintje-description-list>`
  }
}

define('lintje-recording-status', LintjeRecordingStatus)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-recording-status': LintjeRecordingStatus
  }
}
