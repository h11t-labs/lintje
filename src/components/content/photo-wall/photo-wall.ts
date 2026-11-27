/**
 * `<lintje-photo-wall>` — two to six photos that together show a place or a field of work, all at
 * once, each with a short caption on the photo as a label, bottom left.
 *
 * A photo is cropped to fill its place; a screenshot, which must be seen whole, belongs in
 * `lintje-gallery`. Nothing on the wall is chosen or opened: it takes no focus and sends nothing.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import photoWallCss from './photo-wall.css?inline'

export interface PhotoWallItem {
  src: string
  /** What the photo shows, for a reader who cannot see it. */
  alt: string
  /** The label on the photo: a few words, such as the place. */
  caption?: string
}

export class LintjePhotoWall extends LintjeElement {
  static override styles = shadowCss(photoWallCss)

  static override properties: PropertyDeclarations = {
    items: { attribute: false },
  }

  /** In reading order: the first stands top left, the second top right. */
  items: PhotoWallItem[] = []

  protected override render(): TemplateResult | typeof nothing {
    if (!this.items.length) return nothing
    return html`<div class="lintje-photo-wall">
      ${this.items.map(
        (item) => html`<figure class="lintje-photo-wall__item">
          <img class="lintje-photo-wall__image" src=${item.src} alt=${item.alt} />
          ${
            item.caption
              ? html`<figcaption class="lintje-photo-wall__caption">${item.caption}</figcaption>`
              : nothing
          }
        </figure>`,
      )}
    </div>`
  }
}

define('lintje-photo-wall', LintjePhotoWall)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-photo-wall': LintjePhotoWall
  }
}
