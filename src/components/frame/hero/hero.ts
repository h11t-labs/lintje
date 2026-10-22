/**
 * `<lintje-hero>` — the opening band of a start page: a large title, a line of introduction and
 * one way onward, on the theme's wash.
 *
 * It runs from edge to edge, its text in the content column; in `lintje-shell` it goes in the
 * `full` slot. The title is an h2: the page's h1 is the shell's `name`. The default slot takes a
 * search field or a short form under the introduction, `aside` one picture beside the text (left
 * out below 1024 px), `panel` content beside the text, and `overlap` what stands half over the
 * band's lower edge, such as a panel of tabs. With `tone="primary"` it is the page's head: the
 * `breadcrumbs` slot takes the trail above the title, and the band draws the host's corner
 * (`--lintje-radius-corner` on the page, 0 by default). In a shell whose menu is light
 * (`nav-tone="light"`) a hero without a `tone` is primary by itself; `tone="wash"` keeps the wash.
 *
 * Events: `lintje-navigate` `{ href }` (the action).
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { isPlainClick } from '../../../core/links'
import { iconStyles, renderIcon } from '../../../icons/render'
import heroCss from './hero.css?inline'

export class LintjeHero extends LintjeElement {
  static override styles = [iconStyles, shadowCss(heroCss)]

  static override properties: PropertyDeclarations = {
    heading: { type: String },
    tone: { type: String, reflect: true },
    band: { state: true },
    description: { type: String },
    action: { type: String },
    href: { type: String },
    hasOverlap: { state: true },
    hasAside: { state: true },
    hasPanel: { state: true },
  }

  heading: string = ''
  /**
   * `wash`: the start page's band in the primary's wash. `primary`: the page's head in the
   * primary colour itself, white text and the host's one corner (`--lintje-radius-corner`) top right.
   */
  /** Unset, the hero is on the wash, or primary under a light menu: only a chosen tone reflects. */
  declare tone?: 'wash' | 'primary'
  /** In a shell with a light menu: primary unless the host chose a tone, read from the shell's attribute. */
  band: boolean = false
  /** Watches the shell's `nav-tone`, so the band follows a change of the menu's tone. */
  #tone: MutationObserver | null = null

  override connectedCallback(): void {
    super.connectedCallback()
    const shell = this.closest('lintje-shell')
    if (!shell) return
    const read = (): void => {
      this.band = shell.getAttribute('nav-tone') === 'light'
    }
    read()
    this.#tone = new MutationObserver(read)
    this.#tone.observe(shell, { attributes: true, attributeFilter: ['nav-tone'] })
  }

  override disconnectedCallback(): void {
    this.#tone?.disconnect()
    this.#tone = null
    super.disconnectedCallback()
  }
  declare description?: string
  /** The one link onward under the introduction; drawn only with `href`. */
  declare action?: string
  declare href?: string
  protected hasOverlap: boolean = false
  protected hasAside: boolean = false
  protected hasPanel: boolean = false

  private onOverlapChange(event: Event): void {
    this.hasOverlap = (event.target as HTMLSlotElement).assignedElements().length > 0
  }

  private onAsideChange(event: Event): void {
    this.hasAside = (event.target as HTMLSlotElement).assignedElements().length > 0
  }

  private onPanelChange(event: Event): void {
    this.hasPanel = (event.target as HTMLSlotElement).assignedElements().length > 0
  }

  private onAction(event: MouseEvent): void {
    if (this.href && isPlainClick(event)) this.followLink(this.href, event)
  }

  protected override render(): TemplateResult {
    return html`<div
      class=${classMap({
        'lintje-hero': true,
        'lintje-hero--primary': this.tone === 'primary' || (this.band && !this.tone),
        'has-overlap': this.hasOverlap,
        'has-aside': this.hasAside,
        'has-panel': this.hasPanel,
      })}
    >
      <div class="lintje-hero__band">
        <div class="lintje-hero__body">
          <slot name="breadcrumbs"></slot>
          <slot name="status"></slot>
          <div class="lintje-hero__heading">
            <h2 class="lintje-hero__title">${this.heading}</h2>
            ${
              this.description
                ? html`<p class="lintje-hero__description">${this.description}</p>`
                : nothing
            }
          </div>
          <slot></slot>
          ${
            this.action && this.href
              ? html`<a class="lintje-hero__action" href=${this.href} @click=${this.onAction}
                >${this.action}${renderIcon('functioneel-delta-rechts', { size: 16 })}</a
              >`
              : nothing
          }
        </div>
        <div class="lintje-hero__aside">
          <slot name="aside" @slotchange=${this.onAsideChange}></slot>
        </div>
        <div class="lintje-hero__panel">
          <slot name="panel" @slotchange=${this.onPanelChange}></slot>
        </div>
      </div>
      <div class="lintje-hero__overlap">
        <slot name="overlap" @slotchange=${this.onOverlapChange}></slot>
      </div>
    </div>`
  }
}

define('lintje-hero', LintjeHero)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-hero': LintjeHero
  }
}
