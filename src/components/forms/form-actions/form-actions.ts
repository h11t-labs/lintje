/**
 * `<lintje-form-actions>` — the sticky action bar of a form: the draft status on the left, the
 * slotted `lintje-button`s on the right, the last one primary.
 *
 * While connected it reserves its height as the page scroller's `scroll-padding-bottom`, so a
 * field the focus scrolls to is not hidden behind it, and scrolls a focused element that still
 * ends up under it clear. While the form scrolls behind it, it casts its shadow upward and, below
 * 768 px, runs from edge to edge of the screen, its buttons in line with the fields. Below a
 * viewport height of 30rem it does not stick and reserves nothing: it stands after the last field.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { scrollRoot } from '../../../core/host-config'
import { MediaController, MOBILE } from '../../../core/media'
import { keepRoom, releaseRoom, scrollFocusClear } from '../../../core/scroll-room'
import { styleProps } from '../../../core/style-props'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { AttributeHold, PropertyHold } from '../../shared/controls'
import '../../actions/button/button'
import formActionsCss from './form-actions.css?inline'
import screenOnlyCss from '../../shared/screen-only.css?inline'

/** Below this height the bar does not stick (`form-actions.css`). */
const LOW = '(height < 30rem)'

const DIRTY = 'Wijzigingen nog niet opgeslagen'
const BUSY = 'Bezig met opslaan'

export type FormActionsState = '' | 'dirty' | 'busy' | 'saved' | 'draft'

/** "10:42" from "10:42", an ISO moment or a `Date`; `''` for what is not a time. */
export function clockTime(value: string | Date | null | undefined): string {
  if (!value) return ''
  if (typeof value === 'string' && /^\d{1,2}:\d{2}$/.test(value)) return value
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** How far the bar stands in from each side of what the root shows. */
function inset(bar: HTMLElement, root: HTMLElement): [number, number] {
  const left =
    root === document.scrollingElement ? 0 : root.getBoundingClientRect().left + root.clientLeft
  const box = bar.getBoundingClientRect()
  return [Math.max(0, box.left - left), Math.max(0, left + root.clientWidth - box.right)]
}

/** What scrolls the root: the window for the page's own scroller. */
const scrollTarget = (root: HTMLElement): HTMLElement | Window =>
  root === document.scrollingElement ? window : root

/**
 * Stuck: sticking at the bottom of the root with more to scroll. At its own place after the last
 * field it may touch the bottom too, but then nothing scrolls behind it.
 */
function stuckIn(bar: HTMLElement, root: HTMLElement): boolean {
  if (getComputedStyle(bar).position !== 'sticky') return false
  const bottom =
    root === document.scrollingElement
      ? root.clientHeight
      : root.getBoundingClientRect().top + root.clientTop + root.clientHeight
  const more = root.scrollHeight - root.scrollTop - root.clientHeight > 1
  return more && bar.getBoundingClientRect().bottom >= bottom - 1
}

export class LintjeFormActions extends LintjeElement {
  static override styles = [iconStyles, shadowCss(formActionsCss), shadowCss(screenOnlyCss)]

  static override properties: PropertyDeclarations = {
    state: { type: String, reflect: true },
    savedAt: { type: String, attribute: 'saved-at' },
    stuck: { state: true },
    bleed: { state: true },
  }

  /**
   * What the status line shows: `''` nothing; `dirty` "Wijzigingen nog niet opgeslagen"; `busy`
   * "Bezig met opslaan", with the primary button `busy` and the others `disabled` (after, each
   * has what it had); `saved` "Opgeslagen om 10:42", the time from `saved-at`; `draft` "Concept
   * opgeslagen om 10:42", when `lintje-form` kept a draft in the browser (`saveDraft()`, Ctrl+S).
   * Set by the surrounding `lintje-form`, with `saved-at`; standing alone, the host sets it.
   */
  state: FormActionsState = ''
  /** When it was saved: "10:42" or anything `Date` parses. */
  declare savedAt?: string
  protected stuck = false
  /** Stuck on a phone: how far the bar reaches past its own box to the screen's left and right. */
  protected bleed: [number, number] | null = null

  readonly #mobile = new MediaController(this, MOBILE)
  readonly #low = new MediaController(this, LOW)
  readonly #busy = new PropertyHold('busy')
  readonly #disabled = new PropertyHold('disabled')
  readonly #block = new AttributeHold('block')
  #resize: ResizeObserver | null = null
  #scroller: HTMLElement | Window | null = null
  #stuckFrame = 0
  #focusFrame = 0

  // Measured once a frame at most, on scroll and on resize.
  readonly #watch = (): void => {
    if (this.#stuckFrame) return
    this.#stuckFrame = requestAnimationFrame(() => {
      this.#stuckFrame = 0
      const root = scrollRoot()
      this.stuck = root != null && this.isConnected && stuckIn(this, root)
      // Measured on the host, which keeps its own box: only the bar inside it reaches out.
      const bleed = this.stuck && this.#mobile.matches ? inset(this, root!) : null
      if (bleed?.join() !== this.bleed?.join()) this.bleed = bleed
    })
  }

  /**
   * The reserved `scroll-padding-bottom` is not always enough: WebKit scrolls a text field's text
   * into view, not its border and padding. On the document, as the bar stands beside the fields.
   */
  readonly #onFocusIn = (): void => {
    cancelAnimationFrame(this.#focusFrame)
    this.#focusFrame = requestAnimationFrame(() => {
      this.#focusFrame = 0
      this.#clearOfFocus()
    })
  }

  #clearOfFocus(): void {
    if (getComputedStyle(this).position === 'sticky') scrollFocusClear(this, this, 'bottom')
  }

  // A bar that does not stick covers nothing, so it keeps no room.
  #reserveOwn(): void {
    keepRoom(this, scrollRoot(), 'bottom', this.#low.matches ? 0 : this.offsetHeight)
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#reserveOwn()
    const root = scrollRoot()
    if (root && typeof requestAnimationFrame !== 'undefined') {
      this.#scroller = scrollTarget(root)
      this.#scroller.addEventListener('scroll', this.#watch, { passive: true })
      window.addEventListener('resize', this.#watch)
      document.addEventListener('focusin', this.#onFocusIn)
      this.#watch()
    }
    if (typeof ResizeObserver === 'undefined') return
    this.#resize = new ResizeObserver(() => {
      if (!this.isConnected) return
      this.#reserveOwn()
      this.#watch()
    })
    this.#resize.observe(this)
    // A form that grows or shrinks under a resting page moves the bar's own place.
    if (this.parentElement) this.#resize.observe(this.parentElement)
  }

  get buttons(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>('lintje-button'))
  }

  get primaryButton(): HTMLElement | null {
    const buttons = this.buttons
    const primaries = buttons.filter((button) => button.getAttribute('variant') === 'primary')
    return primaries.at(-1) ?? buttons.at(-1) ?? null
  }

  override disconnectedCallback(): void {
    this.#resize?.disconnect()
    this.#resize = null
    this.#scroller?.removeEventListener('scroll', this.#watch)
    this.#scroller = null
    window.removeEventListener('resize', this.#watch)
    document.removeEventListener('focusin', this.#onFocusIn)
    if (this.#stuckFrame) cancelAnimationFrame(this.#stuckFrame)
    if (this.#focusFrame) cancelAnimationFrame(this.#focusFrame)
    this.#stuckFrame = 0
    this.#focusFrame = 0
    releaseRoom(this)
    this.#busy.release()
    this.#disabled.release()
    this.#block.release()
    super.disconnectedCallback()
  }

  protected override updated(): void {
    this.#hold()
    // The height query may have changed sides.
    if (this.isConnected) this.#reserveOwn()
  }

  #hold(): void {
    if (this.state === 'busy') {
      const primary = this.primaryButton
      this.#busy.apply(primary ? [primary] : [], true)
      this.#disabled.apply(
        this.buttons.filter((button) => button !== primary),
        true,
      )
    } else {
      this.#busy.release()
      this.#disabled.release()
    }
    if (this.#mobile.matches) this.#block.apply(this.buttons, true)
    else this.#block.release()
  }

  private renderStatus(): TemplateResult | typeof nothing {
    const time = clockTime(this.savedAt)
    switch (this.state) {
      case 'dirty':
        return html`<span class="lintje-form-actions__dot" aria-hidden="true"></span>${DIRTY}`
      case 'busy':
        return html`${BUSY}`
      case 'saved':
      case 'draft': {
        const what = this.state === 'draft' ? 'Concept opgeslagen' : 'Opgeslagen'
        return html`${renderIcon('functioneel-vinkje', {
          size: 16,
          className: 'lintje-form-actions__check',
        })}${time ? `${what} om ${time}` : what}`
      }
      default:
        return nothing
    }
  }

  protected override render(): TemplateResult {
    const [left, right] = this.bleed ?? [0, 0]
    return html`<div
      class=${classMap({
        'lintje-form-actions': true,
        'is-stuck': this.stuck,
        'is-full': this.bleed !== null,
      })}
      ${styleProps({
        '--lintje-form-actions-left': this.bleed && `${left}px`,
        '--lintje-form-actions-right': this.bleed && `${right}px`,
      })}
    >
      <div class="lintje-form-actions__status" role="status">${this.renderStatus()}</div>
      <div class="lintje-form-actions__buttons">
        <slot @slotchange=${() => this.#hold()}></slot>
      </div>
    </div>`
  }
}

define('lintje-form-actions', LintjeFormActions)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-form-actions': LintjeFormActions
  }
}
