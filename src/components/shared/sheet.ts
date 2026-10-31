/**
 * The sheet on a phone (`sheet.css`): its head, and the time it stays drawn while it goes down.
 */
import {
  html,
  nothing,
  type ReactiveController,
  type ReactiveControllerHost,
  type TemplateResult,
} from 'lit'
import { renderIcon } from '../../icons/render'

/** Covers a missing `animationend`: reduced motion, or a page in the background. */
const LEAVE_MS = 600

/**
 * Keeps a closed sheet drawn while it goes down: `leaving` from the render after `open()` turns
 * false until the sheet's animation ends (`end`). Only while `sheet()`: a popover leaves at once.
 */
export class SheetLeave implements ReactiveController {
  leaving: boolean = false
  #was: boolean = false
  #timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly host: ReactiveControllerHost,
    private readonly open: () => boolean,
    private readonly sheet: () => boolean = () => true,
  ) {
    host.addController(this)
  }

  hostUpdate(): void {
    const open = this.open()
    if (this.#was && !open && this.sheet()) {
      this.#clear()
      this.leaving = true
      this.#timer = setTimeout(() => this.done(), LEAVE_MS)
    } else if (open && this.leaving) {
      this.#clear()
      this.leaving = false
    }
    this.#was = open
  }

  hostDisconnected(): void {
    this.#clear()
    this.leaving = false
    this.#was = false
  }

  /** On the sheet's `animationend`: an animation inside it does not count. */
  end = (event: AnimationEvent): void => {
    if (event.target === event.currentTarget && this.leaving) this.done()
  }

  done(): void {
    this.#clear()
    if (!this.leaving) return
    this.leaving = false
    this.host.requestUpdate()
  }

  #clear(): void {
    if (this.#timer) clearTimeout(this.#timer)
    this.#timer = null
  }
}

export interface SheetHeadOptions {
  title: string
  onClose: () => void
  /** Its own classes beside the shared ones, for what is its own (BEM mix). */
  className?: string
  closeClass?: string
  /** The close button's name, when "<title> sluiten" does not say it. */
  closeLabel?: string
  titleId?: string
  /** Between the name and the close button. */
  extra?: TemplateResult | typeof nothing
}

/** The head of every sheet: its name and a close button that says what it closes. */
export function renderSheetHead(options: SheetHeadOptions): TemplateResult {
  return html`<div class="lintje-sheet__head ${options.className ?? ''}">
    <h2 class="lintje-sheet__title" id=${options.titleId ?? nothing}>${options.title}</h2>
    ${options.extra ?? nothing}
    <button
      type="button"
      class="lintje-dialog-close lintje-sheet__close ${options.closeClass ?? ''}"
      aria-label=${options.closeLabel ?? `${options.title} sluiten`}
      @click=${options.onClose}
    >
      ${renderIcon('functioneel-kruis', { size: 16 })}
    </button>
  </div>`
}
