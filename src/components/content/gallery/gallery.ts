/**
 * `<lintje-gallery>` — pictures of one thing, such as the screens of an application: one large
 * with its caption, and under it a thumbnail of each to choose another. A single picture has no
 * thumbnails. Which picture stands is the element's; every change is reported, and read out
 * from a status region: "Afbeelding 2 van 4: <alt>".
 *
 * Events: `lintje-gallery-change` `{ index }`.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import galleryCss from './gallery.css?inline'

export interface GalleryItem {
  src: string
  /** What the picture shows, for a reader who cannot see it. */
  alt: string
  /** The line under the large picture. */
  caption?: string
}

export class LintjeGallery extends LintjeElement {
  static override styles = shadowCss(galleryCss)

  static override properties: PropertyDeclarations = {
    items: { attribute: false },
    selected: { type: Number },
    label: { type: String },
    spoken: { state: true },
  }

  items: GalleryItem[] = []
  /** The picture that stands large, from 0. */
  selected: number = 0
  /** Names the row of thumbnails: "Schermafbeeldingen van Vertalen". */
  label: string = 'Afbeeldingen'
  /** What the status region says after a choice. */
  spoken: string = ''

  /** `selected` kept inside the items, as the large picture shows it. */
  private get shown(): number {
    return Math.min(Math.max(0, this.selected), this.items.length - 1)
  }

  private choose(index: number): void {
    if (index === this.shown) return
    this.selected = index
    const item = this.items[index]
    const what = item?.alt || item?.caption
    const place = `Afbeelding ${index + 1} van ${this.items.length}`
    this.spoken = what ? `${place}: ${what}` : place
    this.emit('lintje-gallery-change', { index })
  }

  protected override render(): TemplateResult | typeof nothing {
    const items = this.items
    if (!items.length) return nothing
    const index = this.shown
    const current = items[index]!
    return html`<div class="lintje-gallery">
      <figure class="lintje-gallery__figure">
        <img class="lintje-gallery__image" src=${current.src} alt=${current.alt} />
        ${current.caption ? html`<figcaption class="lintje-gallery__caption">${current.caption}</figcaption>` : nothing}
      </figure>
      ${
        items.length > 1
          ? html`<ul class="lintje-gallery__thumbs" aria-label=${this.label}>
              ${items.map(
                (item, position) => html`<li>
                  <button
                    type="button"
                    class=${classMap({ 'lintje-gallery__thumb': true, 'is-selected': position === index })}
                    aria-current=${position === index ? 'true' : nothing}
                    @click=${() => this.choose(position)}
                  >
                    <img class="lintje-gallery__thumb-image" src=${item.src} alt="" />
                    <span class="visually-hidden"
                      >Afbeelding ${position + 1} van ${items.length}: ${item.caption || item.alt}</span
                    >
                  </button>
                </li>`,
              )}
            </ul>
              <span class="visually-hidden" role="status">${this.spoken}</span>`
          : nothing
      }
    </div>`
  }
}

define('lintje-gallery', LintjeGallery)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-gallery': LintjeGallery
  }
}
