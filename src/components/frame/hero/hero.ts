/**
 * `<lintje-hero>` — the opening band of a start page: a large title, a line of introduction and
 * one way onward, on the theme's wash. It runs from edge to edge; its text keeps to the
 * content column. In `lintje-shell` it goes in the `full` slot, above the page's content.
 *
 * The title is an h2, as the page header's: the page's h1 is the shell's `name`.
 * Slots: the default slot under the description (a search field, a short form); `status` above
 * the title (a badge); `aside` for one picture beside the text (an emblem, an illustration), left
 * out below 1024 px; `panel` for content beside the text (what is said now in a running
 * recording), half the band from 1024 px and under the text below it; `overlap` for what stands
 * half over the band's lower edge, such as a panel of tabs.
 *
 * Events: `lintje-navigate` `{ href }` for the action.
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
    description: { type: String },
    action: { type: String },
    href: { type: String },
    hasOverlap: { state: true },
    hasAside: { state: true },
    hasPanel: { state: true },
  }

  heading: string = ''
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
        'has-overlap': this.hasOverlap,
        'has-aside': this.hasAside,
        'has-panel': this.hasPanel,
      })}
    >
      <div class="lintje-hero__band">
        <div class="lintje-hero__body">
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
