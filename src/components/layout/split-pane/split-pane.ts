/**
 * `<lintje-split-pane>` — two panels side by side with a split the reader moves.
 *
 * Without dragging (WCAG 2.5.7): a click on the strip lifts the split, and the next click places
 * it where it lands; Escape or a click outside puts it back. A double click returns to 50/50.
 *
 * Below 768 px there are never two panels: a `<lintje-segmented>` chooses which one shows. That
 * choice is `pane`; a host that keeps it in the URL sets `pane` back.
 *
 * Events: `lintje-split-change` (the percentage), `lintje-pane-change` (`'start'` | `'end'`).
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { MediaController, MOBILE } from '../../../core/media'
import { styleProps } from '../../../core/style-props'
import { shadowCss } from '../../../core/styles'
import '../../inputs/segmented/segmented'
import splitPaneCss from './split-pane.css?inline'

export type SplitPaneSide = 'start' | 'end'

export const SPLIT_STEP = 5
export const SPLIT_RESET = 50
/** How far, in px, a press may move and still be a click that lifts the split. */
const CLICK_SLOP = 3

export function clampSplit(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function splitFromPointer(
  clientX: number,
  left: number,
  width: number,
  min: number,
  max: number,
): number {
  if (width <= 0) return clampSplit(SPLIT_RESET, min, max)
  return clampSplit(Math.round(((clientX - left) / width) * 100), min, max)
}

export function splitFromKey(key: string, value: number, min: number, max: number): number | null {
  if (key === 'ArrowLeft') return clampSplit(value - SPLIT_STEP, min, max)
  if (key === 'ArrowRight') return clampSplit(value + SPLIT_STEP, min, max)
  if (key === 'Home') return min
  if (key === 'End') return max
  if (key === 'Enter') return clampSplit(SPLIT_RESET, min, max)
  return null
}

function readStored(key: string): number | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

function writeStored(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // Storage blocked or full: the split still works, it is only not remembered.
  }
}

export class LintjeSplitPane extends LintjeElement {
  static override styles = shadowCss(splitPaneCss)

  static override properties: PropertyDeclarations = {
    value: { type: Number },
    min: { type: Number },
    max: { type: Number },
    storageKey: { type: String, attribute: 'storage-key' },
    startLabel: { type: String, attribute: 'start-label' },
    endLabel: { type: String, attribute: 'end-label' },
    pane: { type: String, reflect: true },
    dragging: { state: true },
  }

  /** The first panel's share, in percent. */
  value: number = SPLIT_RESET
  min: number = 20
  max: number = 80
  /** Where the split is remembered in `localStorage`. Without it, nothing is stored. */
  declare storageKey?: string
  /** The two panels' names, for the phone's choice. */
  startLabel: string = 'Links'
  endLabel: string = 'Rechts'
  pane: SplitPaneSide = 'start'
  protected dragging: boolean = false

  #mobile = new MediaController(this, MOBILE)

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('storageKey') && this.storageKey) {
      const stored = readStored(this.storageKey)
      if (stored !== null) this.value = stored
    }
    const clamped = clampSplit(this.value, this.min, this.max)
    if (clamped !== this.value) this.value = clamped
  }

  /** The split when the drag began: a release where it began is no change. */
  #dragFrom: number = SPLIT_RESET
  #pressX = 0
  /** Lifted by a click: the split follows the pointer until the next click places it. */
  #lifted = false
  /** The click that placed the split, swallowed so it does not also press what it landed on. */
  #placed = false

  private commit(value: number, before: number = this.value): void {
    this.value = clampSplit(value, this.min, this.max)
    if (this.value === before) return
    if (this.storageKey) writeStored(this.storageKey, this.value)
    this.emit('lintje-split-change', this.value)
  }

  private get block(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.lintje-split-pane')
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    // A lifted split is placed by the block's own handler.
    if (event.button !== 0 || this.#lifted) return
    // No text selection while the grip moves.
    event.preventDefault()
    const strip = event.currentTarget as HTMLElement
    strip.setPointerCapture?.(event.pointerId)
    this.renderRoot.querySelector<HTMLElement>('.lintje-split-pane__handle')?.focus()
    this.#dragFrom = this.value
    this.#pressX = event.clientX
    this.dragging = true
  }

  private splitAt(clientX: number): number | null {
    const rect = this.block?.getBoundingClientRect()
    if (!rect) return null
    return splitFromPointer(clientX, rect.left, rect.width, this.min, this.max)
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging) return
    const next = this.splitAt(event.clientX)
    if (next !== null) this.value = next
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (!this.dragging || this.#lifted) return
    const strip = event.currentTarget as HTMLElement
    if (strip.hasPointerCapture?.(event.pointerId)) strip.releasePointerCapture(event.pointerId)
    if (Math.abs(event.clientX - this.#pressX) <= CLICK_SLOP) {
      this.#lifted = true
      document.addEventListener('pointerdown', this.onOutside, true)
      return
    }
    this.dragging = false
    this.commit(this.value, this.#dragFrom)
  }

  /** The click after the lifting one places the split where it lands. */
  private readonly onPlace = (event: PointerEvent): void => {
    if (!this.#lifted || event.button !== 0) return
    event.preventDefault()
    this.#placed = true
    const next = this.splitAt(event.clientX)
    this.#drop()
    this.commit(next ?? this.value, this.#dragFrom)
  }

  private readonly onPlacedClick = (event: Event): void => {
    if (!this.#placed) return
    this.#placed = false
    event.preventDefault()
    event.stopPropagation()
  }

  /** A press outside the element puts the split back. */
  private readonly onOutside = (event: PointerEvent): void => {
    if (!event.composedPath().includes(this)) this.cancelLift()
  }

  #drop(): void {
    this.#lifted = false
    this.dragging = false
    document.removeEventListener('pointerdown', this.onOutside, true)
  }

  private cancelLift(): void {
    if (!this.#lifted) return
    this.#drop()
    this.value = this.#dragFrom
  }

  override disconnectedCallback(): void {
    this.#drop()
    super.disconnectedCallback()
  }

  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (this.#lifted && event.key === 'Escape') {
      event.preventDefault()
      this.cancelLift()
      return
    }
    // A key ends a lift: the split moves from where it was.
    this.cancelLift()
    const next = splitFromKey(event.key, this.value, this.min, this.max)
    if (next === null) return
    event.preventDefault()
    this.commit(next)
  }

  private onPaneChange(event: CustomEvent<string>): void {
    event.stopPropagation()
    const pane: SplitPaneSide = event.detail === 'end' ? 'end' : 'start'
    if (pane === this.pane) return
    this.pane = pane
    this.emit('lintje-pane-change', pane)
  }

  protected override render(): TemplateResult {
    const phone = this.#mobile.matches
    const value = Math.round(this.value)
    return html`${
      phone
        ? html`<lintje-segmented
            class="lintje-split-pane__choice"
            label="Paneel kiezen"
            hide-label
            value=${this.pane}
            .options=${[
              { value: 'start', label: this.startLabel },
              { value: 'end', label: this.endLabel },
            ]}
            @lintje-change=${this.onPaneChange}
          ></lintje-segmented>`
        : nothing
    }<div
      class=${classMap({
        'lintje-split-pane': true,
        'lintje-split-pane--phone': phone,
        'is-dragging': this.dragging,
      })}
      ${styleProps({ '--lintje-split': String(this.value) })}
      @pointerdown=${this.onPlace}
      @pointermove=${this.onPointerMove}
      @click=${{ handleEvent: this.onPlacedClick, capture: true }}
    >
      <div
        id="start"
        class="lintje-split-pane__pane lintje-split-pane__pane--start"
        ?hidden=${phone && this.pane !== 'start'}
      >
        <slot name="start"></slot>
      </div>
      <div
        class="lintje-split-pane__strip"
        ?hidden=${phone}
        @pointerdown=${this.onPointerDown}
        @pointerup=${this.onPointerUp}
        @pointercancel=${this.onPointerUp}
        @dblclick=${() => {
          this.cancelLift()
          this.commit(SPLIT_RESET)
        }}
      >
        <div
          class="lintje-split-pane__handle"
          role="separator"
          tabindex="0"
          aria-orientation="vertical"
          aria-label="Verdeling aanpassen"
          aria-valuenow=${value}
          aria-valuemin=${this.min}
          aria-valuemax=${this.max}
          aria-controls="start"
          @keydown=${this.onKeydown}
        ></div>
      </div>
      <div
        class="lintje-split-pane__pane lintje-split-pane__pane--end"
        ?hidden=${phone && this.pane !== 'end'}
      >
        <slot name="end"></slot>
      </div>
    </div>`
  }
}

define('lintje-split-pane', LintjeSplitPane)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-split-pane': LintjeSplitPane
  }
}
