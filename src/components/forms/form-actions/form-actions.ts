/**
 * `<lintje-form-actions>` — the sticky action bar of a form: the draft status on the left, the
 * slotted `lintje-button`s on the right, the last one primary.
 *
 * While connected it reserves its height as the page scroller's `scroll-padding-bottom`, so a
 * field the focus scrolls to is not hidden behind it. While the form scrolls behind it, it casts
 * its shadow upward.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { scrollRoot } from '../../../core/host-config'
import { MediaController, MOBILE } from '../../../core/media'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { AttributeHold, PropertyHold } from '../../shared/controls'
import '../../actions/button/button'
import formActionsCss from './form-actions.css?inline'
import screenOnlyCss from '../../shared/screen-only.css?inline'

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

/** The bars on the page, each with its height; the scroller keeps room for the tallest. */
const reserved = new Map<LintjeFormActions, number>()
let padded: { element: HTMLElement; before: string } | null = null

function reserve(): void {
  const room = Math.max(0, ...reserved.values())
  if (reserved.size === 0) {
    if (padded) padded.element.style.scrollPaddingBottom = padded.before
    padded = null
    return
  }
  const root = scrollRoot()
  if (!root) return
  if (padded?.element !== root) {
    if (padded) padded.element.style.scrollPaddingBottom = padded.before
    padded = { element: root, before: root.style.scrollPaddingBottom }
  }
  root.style.scrollPaddingBottom = `${room}px`
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
  }

  /**
   * Set by the surrounding `lintje-form` (with `saved-at`); standing alone, the host sets it. On
   * `busy` the primary button turns `busy` and the others `disabled`; after, each has what it had.
   */
  state: FormActionsState = ''
  /** When it was saved: "10:42" or anything `Date` parses. */
  declare savedAt?: string
  protected stuck = false

  readonly #mobile = new MediaController(this, MOBILE)
  readonly #busy = new PropertyHold('busy')
  readonly #disabled = new PropertyHold('disabled')
  readonly #block = new AttributeHold('block')
  #resize: ResizeObserver | null = null
  #scroller: HTMLElement | Window | null = null
  #stuckFrame = 0

  // Measured once a frame at most, on scroll and on resize.
  readonly #watch = (): void => {
    if (this.#stuckFrame) return
    this.#stuckFrame = requestAnimationFrame(() => {
      this.#stuckFrame = 0
      const root = scrollRoot()
      this.stuck = root != null && this.isConnected && stuckIn(this, root)
    })
  }

  override connectedCallback(): void {
    super.connectedCallback()
    reserved.set(this, this.offsetHeight)
    reserve()
    const root = scrollRoot()
    if (root && typeof requestAnimationFrame !== 'undefined') {
      this.#scroller = scrollTarget(root)
      this.#scroller.addEventListener('scroll', this.#watch, { passive: true })
      window.addEventListener('resize', this.#watch)
      this.#watch()
    }
    if (typeof ResizeObserver === 'undefined') return
    this.#resize = new ResizeObserver(() => {
      if (!this.isConnected) return
      reserved.set(this, this.offsetHeight)
      reserve()
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
    if (this.#stuckFrame) cancelAnimationFrame(this.#stuckFrame)
    this.#stuckFrame = 0
    reserved.delete(this)
    reserve()
    this.#busy.release()
    this.#disabled.release()
    this.#block.release()
    super.disconnectedCallback()
  }

  protected override updated(): void {
    this.#hold()
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
    return html`<div class=${classMap({ 'lintje-form-actions': true, 'is-stuck': this.stuck })}>
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
