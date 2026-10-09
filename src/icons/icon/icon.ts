/**
 * `<lintje-icon>` — one icon, named by its file in `dist-icons/` (without `.svg`).
 *
 * For plain HTML pages; inside a component use `renderIcon()` (`../render.ts`), which this
 * element also draws through. Resolution: `src`, the register, loaded icons, then nothing.
 * Events: none.
 */
import { nothing, type TemplateResult } from 'lit'
import { LintjeElement, define } from '../../core/element'
import { shadowCss } from '../../core/styles'
import { ICONS, type IconGlyph, type IconName } from '../register'
import { onIconChange } from '../loader'
import { iconStyles, renderIcon } from '../render'
import { observeIcon, unobserveIcon } from '../visible'
import iconCss from './icon.css?inline'

export type { IconName, IconGlyph }
export { ICONS }

/** The names the bundle carries; every other name is fetched. */
export const ICON_NAMES: readonly string[] = Object.keys(ICONS)

export class LintjeIcon extends LintjeElement {
  static override styles = [iconStyles, shadowCss(iconCss)]

  static override properties = {
    name: { type: String },
    src: { type: String },
    size: { type: Number },
    label: { type: String },
    lazy: { type: Boolean },
  }

  declare name?: string
  /** An SVG file the host resolved, as a URL or data URI. Wins over `name`. */
  declare src?: string
  /** 14 status, 16 text line, 18 button, 20 menu. */
  size: number = 16
  /** Makes the icon an image with this name; without it the icon is decorative. */
  declare label?: string
  /** Asks for the file only once the icon is near the viewport. */
  lazy: boolean = false

  #unwatch: (() => void) | null = null
  #near = false

  override connectedCallback(): void {
    super.connectedCallback()
    // A named change redraws only the icon of that name.
    this.#unwatch = onIconChange((changed) => {
      if (changed === undefined || changed === this.name) this.requestUpdate()
    })
    if (this.lazy && !this.#near) {
      observeIcon(this, () => {
        this.#near = true
        this.requestUpdate()
      })
    }
  }

  override disconnectedCallback(): void {
    this.#unwatch?.()
    this.#unwatch = null
    unobserveIcon(this)
    super.disconnectedCallback()
  }

  protected override render(): TemplateResult | typeof nothing {
    return renderIcon(this.name, {
      size: this.size,
      label: this.label,
      src: this.src,
      defer: this.lazy && !this.#near,
    })
  }
}

define('lintje-icon', LintjeIcon)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-icon': LintjeIcon
  }
}
