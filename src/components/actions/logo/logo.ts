/**
 * `<lintje-logo>` — the theme's emblem: the ribbon, with the organisation's name as text.
 *
 * Every emblem file stands on `viewBox="0 0 346 75"` with the 38 × 75 ribbon at x 154…192;
 * the element changes only how much of it is in frame, so the ribbon never moves. A file on any
 * other viewBox is drawn whole. The name is text (`aria-hidden`); the drawing carries `alt`, and
 * the byline after a comma wherever the byline is drawn.
 */
import { html, nothing, svg, type PropertyDeclarations, type TemplateResult } from 'lit'
import { unsafeSVG } from 'lit/directives/unsafe-svg.js'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { styleProps } from '../../../core/style-props'
import { iconGlyph } from '../../../icons/render'
import { onIconChange, requestIcon } from '../../../icons/loader'
import logoCss from './logo.css?inline'

/** The ribbon's box inside the emblem's drawing, in the file's own units. */
const RIBBON = { x: 154, width: 38, height: 75 }
const FULL_WIDTH = 192
const EMBLEM_VIEW_BOX = '0 0 346 75'
const EMBLEM_WIDTH = 346

export class LintjeLogo extends LintjeElement {
  static override styles = shadowCss(logoCss)

  static override properties: PropertyDeclarations = {
    width: { type: Number },
    src: { type: String },
    alt: { type: String },
    name: { type: String },
    byline: { type: String },
    open: { type: Boolean },
    full: { type: Boolean },
  }

  /**
   * The ribbon's width in pixels; the height follows the emblem's own ratio. A surrounding element
   * that sets `--lintje-logo-ribbon` (a CSS length) wins over it, as the logo bar does with
   * `--w-ribbon`.
   */
  width: number = 44
  /** URL of an emblem the host resolved itself. Wins over `name`. */
  declare src?: string
  /** The organisation, as the emblem's text alternative. */
  alt: string = ''
  /** The ribbon-only emblem, by file name. */
  declare name?: string
  /** A second line under the organisation's name, e.g. the ministry a service belongs to. */
  declare byline?: string
  /** The menu is expanded: the name stands beside the ribbon. */
  open: boolean = false
  /** The whole emblem drawing is in frame: the ribbon in the middle of its box. */
  full: boolean = false

  #unwatch: (() => void) | null = null

  override connectedCallback(): void {
    super.connectedCallback()
    this.#unwatch = onIconChange(() => this.requestUpdate())
  }

  override disconnectedCallback(): void {
    this.#unwatch?.()
    this.#unwatch = null
    super.disconnectedCallback()
  }

  /** The name beside the ribbon is `aria-hidden`, so the drawing says what it shows. */
  get #drawnLabel(): string {
    const named = (this.full || this.open) && this.alt
    return named && this.byline ? `${this.alt}, ${this.byline}` : this.alt
  }

  /** `ribbonEnd` is where the ribbon ends inside `drawing`, as a CSS length. */
  #withName(drawing: TemplateResult, ribbonEnd: string): TemplateResult {
    if (!(this.full || this.open) || !this.alt) return drawing
    return html`<span class="lintje-logo__lockup">
      ${drawing}
      <span
        class="lintje-logo__name"
        aria-hidden="true"
        ${styleProps({ left: ribbonEnd })}
        ><span class="lintje-logo__name-line">${this.alt}</span>${
          this.byline ? html`<span class="lintje-logo__byline">${this.byline}</span>` : nothing
        }</span
      >
    </span>`
  }

  /** `units` of the drawing as a CSS length, `per` units being one ribbon width. */
  #length(units: number, per = RIBBON.width): string {
    // A length in CSS, not px: in the logo bar the ribbon grows with the reader's text size.
    const ribbon = `var(--lintje-logo-ribbon, ${this.width}px)`
    return units === per ? ribbon : `calc(${ribbon} * ${units} / ${per})`
  }

  protected override render(): TemplateResult {
    const height = this.#length(RIBBON.height)
    const fullWidth = this.#length(FULL_WIDTH)
    const emblemWidth = this.#length(EMBLEM_WIDTH)
    const boxWidth = this.full ? emblemWidth : this.open ? fullWidth : this.#length(RIBBON.width)

    if (this.src) {
      return html`<img
        class="lintje-logo"
        ${styleProps({ width: this.#length(RIBBON.width), height })}
        src=${this.src}
        alt=${this.alt}
      />`
    }

    const name = this.name
    const glyph = iconGlyph(name)
    if (!glyph) {
      if (name) requestIcon(name)
      // The box the emblem will fill, so the header does not move when it lands.
      return html`<span
        class="lintje-logo lintje-logo--pending"
        ${styleProps({ width: boxWidth, height })}
        role=${name && this.alt ? 'img' : nothing}
        aria-label=${name && this.alt ? this.alt : nothing}
      ></span>`
    }

    if (glyph.viewBox !== EMBLEM_VIEW_BOX) {
      const [, , ownWidth, ownHeight] = glyph.viewBox.split(/\s+/).map(Number)
      return this.#withName(
        html`<svg
          class="lintje-logo"
          xmlns="http://www.w3.org/2000/svg"
          ${styleProps({
            width: this.#length(RIBBON.width),
            height: this.#length(ownHeight, ownWidth),
          })}
          viewBox=${glyph.viewBox}
          role=${this.alt ? 'img' : nothing}
          aria-hidden=${this.alt ? nothing : 'true'}
          aria-label=${this.#drawnLabel || nothing}
          fill=${glyph.attributes.fill ?? 'currentColor'}
        >
          ${svg`${unsafeSVG(glyph.body)}`}
        </svg>`,
        this.#length(RIBBON.width),
      )
    }

    // The frame narrows to the ribbon and widens beside it; its width animates (`logo.css`).
    const framed = html`<span
      class="lintje-logo__frame"
      ${styleProps({ width: boxWidth, height })}
    >
      <svg
        class="lintje-logo"
        xmlns="http://www.w3.org/2000/svg"
        ${styleProps({ width: this.full ? emblemWidth : fullWidth, height })}
        viewBox=${this.full ? EMBLEM_VIEW_BOX : `${RIBBON.x} 0 ${FULL_WIDTH} ${RIBBON.height}`}
        preserveAspectRatio="xMinYMin meet"
        role=${this.alt ? 'img' : nothing}
        aria-hidden=${this.alt ? nothing : 'true'}
        aria-label=${this.#drawnLabel || nothing}
        fill=${glyph.attributes.fill ?? 'currentColor'}
      >
        ${svg`${unsafeSVG(glyph.body)}`}
      </svg>
    </span>`
    const ribbonEnd = this.#length(this.full ? RIBBON.x + RIBBON.width : RIBBON.width)
    return this.#withName(framed, ribbonEnd)
  }
}

define('lintje-logo', LintjeLogo)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-logo': LintjeLogo
  }
}
