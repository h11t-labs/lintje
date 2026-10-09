/**
 * `<lintje-session-expiry>` — the warning before the session runs out, the notice after it, and
 * the "Je concept is teruggezet" announcement (`restored-at`).
 *
 * The window is a `role="alertdialog"` in `<lintje-confirm-dialog>`'s frame (its stylesheet).
 * Escape and the scrim do nothing, because the session runs out either way. The element never
 * calls a server: the host sets `busy`, moves `expires-at` or sets `expired`.
 *
 * Events: `lintje-session-extend`, `lintje-logout`, `lintje-login`, `lintje-draft-discard`.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { lockScroll } from '../../../core/host-config'
import { MediaController, MOBILE } from '../../../core/media'
import { shadowCss } from '../../../core/styles'
import { FocusTrap, focusTarget } from '../../shared/focus-trap'
import '../../feedback/announcement/announcement'
import '../../../primitives/button/button'
import type { LintjeButton } from '../../../primitives/button/button'
import type { AnnouncementViewData } from '../../../types'
import confirmDialogCss from '../../overlays/confirm-dialog/confirm-dialog.css?inline'
import sessionExpiryCss from './session-expiry.css?inline'

export type SessionPhase = 'active' | 'warning' | 'expired'

export type RestoredReason = 'logout' | 'reload'

/** The shortest warning, in seconds: time to read the question and answer it. */
export const MIN_WARNING = 20

/** Where the session stands at `now`. Without an `expiresAt` it is active, unless `expired`. */
export function sessionPhase(
  expiresAt: number | null,
  now: number,
  warnBeforeSeconds: number,
  expired = false,
): SessionPhase {
  if (expired) return 'expired'
  if (expiresAt === null || Number.isNaN(expiresAt)) return 'active'
  const remaining = expiresAt - now
  if (remaining <= 0) return 'expired'
  return remaining <= warnBeforeSeconds * 1000 ? 'warning' : 'active'
}

export function warningTitle(remainingMs: number): string {
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000))
  return `Je sessie verloopt over ${minutes} ${minutes === 1 ? 'minuut' : 'minuten'}`
}

/** "10:42", or null for a moment that does not parse. */
export function clockTime(moment: string): string | null {
  const date = new Date(moment)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

export class LintjeSessionExpiry extends LintjeElement {
  static override styles = [shadowCss(confirmDialogCss), shadowCss(sessionExpiryCss)]

  static override properties: PropertyDeclarations = {
    expiresAt: { type: String, attribute: 'expires-at' },
    warnBefore: { type: Number, attribute: 'warn-before' },
    restoredAt: { type: String, attribute: 'restored-at' },
    restoredReason: { type: String, attribute: 'restored-reason' },
    busy: { type: Boolean, reflect: true },
    expired: { type: Boolean, reflect: true },
    now: { attribute: false },
    clock: { state: true },
  }

  /** When the session ends, as an ISO moment. */
  declare expiresAt?: string
  /** Seconds before the end that the warning opens; at least `MIN_WARNING`. */
  warnBefore: number = 120
  /** When the restored draft was saved; set, the announcement shows. */
  declare restoredAt?: string
  /** Why the draft came back; it picks the announcement's words. */
  restoredReason: RestoredReason = 'logout'
  busy: boolean = false
  /** The host's word that the session is gone (extending failed). */
  expired: boolean = false
  /** The clock, read once a second while there is an `expires-at`. A test replaces it. */
  now: () => number = Date.now
  protected clock: number = 0

  readonly #mobile = new MediaController(this, MOBILE)
  #timer: ReturnType<typeof setInterval> | null = null
  #released: (() => void) | null = null
  readonly #trap = new FocusTrap()
  #focusedPhase: SessionPhase | null = null

  /** The session runs out either way: only the buttons answer the question. */
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.#trap.isTopmost()) return
    event.stopPropagation()
    event.preventDefault()
  }

  get phase(): SessionPhase {
    const end = this.expiresAt ? new Date(this.expiresAt).getTime() : null
    const warn = Number.isFinite(this.warnBefore) ? this.warnBefore : 120
    return sessionPhase(end, this.clock, Math.max(MIN_WARNING, warn), this.expired)
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.clock = this.now()
    this.#tick()
  }

  override disconnectedCallback(): void {
    this.#stopTicking()
    this.#release()
    super.disconnectedCallback()
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('expiresAt') || changed.has('now')) this.clock = this.now()
  }

  #tick(): void {
    if (!this.expiresAt || !this.isConnected) return this.#stopTicking()
    if (this.#timer !== null) return
    this.#timer = setInterval(() => (this.clock = this.now()), 1000)
  }

  #stopTicking(): void {
    if (this.#timer !== null) clearInterval(this.#timer)
    this.#timer = null
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (changed.has('expiresAt')) this.#tick()
    const phase = this.phase
    if (phase === 'active') {
      this.#release()
      return
    }
    if (!this.#released) {
      this.#released = lockScroll()
      document.addEventListener('keydown', this.#onKeyDown, true)
      const frame = this.renderRoot.querySelector<HTMLElement>('.lintje-session-expiry')
      // Activated now so the opener is what has the focus; the primary button takes it later.
      if (frame) this.#trap.activate(frame, { focus: false })
    }
    if (this.#focusedPhase !== phase) {
      this.#focusedPhase = phase
      const primary = this.renderRoot.querySelector<LintjeButton>('.lintje-session-expiry__primary')
      if (primary) {
        void primary.updateComplete.then(() => {
          if (this.#trap.isTopmost()) focusTarget(primary).focus()
        })
      }
    }
  }

  #release(): void {
    this.#focusedPhase = null
    if (!this.#released) return
    document.removeEventListener('keydown', this.#onKeyDown, true)
    this.#released()
    this.#released = null
    this.#trap.deactivate()
  }

  private renderRestored(): TemplateResult | typeof nothing {
    if (!this.restoredAt) return nothing
    const time = clockTime(this.restoredAt)
    const data: AnnouncementViewData =
      this.restoredReason === 'reload'
        ? {
            kind: 'ok',
            text: time ? `Je concept van ${time} is teruggezet.` : 'Je concept is teruggezet.',
          }
        : {
            kind: 'ok',
            title: 'Je concept is teruggezet.',
            text: time
              ? `Het is van ${time}, van voor het afmelden.`
              : 'Het is van voor het afmelden.',
          }
    return html`<lintje-announcement compact .data=${data}>
      <lintje-button slot="action" variant="link" @click=${() => this.emit('lintje-draft-discard')}
        >Concept weggooien</lintje-button
      >
    </lintje-announcement>`
  }

  private renderDialog(phase: SessionPhase): TemplateResult | typeof nothing {
    if (phase === 'active') return nothing
    const block = this.#mobile.matches
    const expired = phase === 'expired'
    const end = this.expiresAt ? new Date(this.expiresAt).getTime() : this.clock
    return html`<div class="lintje-confirm-dialog__scrim">
      <div
        class="lintje-confirm-dialog lintje-session-expiry"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="lintje-session-expiry-heading"
        tabindex="-1"
        aria-describedby="lintje-session-expiry-text"
      >
        <h2 id="lintje-session-expiry-heading" class="lintje-confirm-dialog__heading">
          ${expired ? 'Je bent afgemeld' : warningTitle(end - this.clock)}
        </h2>
        <div id="lintje-session-expiry-text" class="lintje-confirm-dialog__text">
          ${
            expired
              ? html`<slot name="expired"
                  >Je sessie is verlopen. Meld je opnieuw aan; je komt terug op deze pagina.</slot
                >`
              : html`<slot
                  >Je invoer wordt bewaard in deze browser. Blijf aangemeld om door te werken.</slot
                >`
          }
        </div>
        <div class="lintje-confirm-dialog__actions">
          ${
            expired
              ? html`<lintje-button
                class="lintje-session-expiry__primary"
                variant="primary"
                ?block=${block}
                @click=${() => this.emit('lintje-login')}
                >Opnieuw aanmelden</lintje-button
              >`
              : html`<lintje-button
                  class="lintje-session-expiry__logout"
                  variant="tertiary"
                  ?block=${block}
                  ?disabled=${this.busy}
                  @click=${() => this.emit('lintje-logout')}
                  >Afmelden</lintje-button
                >
                <lintje-button
                  class="lintje-session-expiry__primary"
                  variant="primary"
                  ?block=${block}
                  ?busy=${this.busy}
                  @click=${() => {
                    if (!this.busy) this.emit('lintje-session-extend')
                  }}
                  >Aangemeld blijven</lintje-button
                >`
          }
        </div>
      </div>
    </div>`
  }

  protected override render(): TemplateResult {
    return html`${this.renderRestored()}${this.renderDialog(this.phase)}`
  }
}

define('lintje-session-expiry', LintjeSessionExpiry)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-session-expiry': LintjeSessionExpiry
  }
}
