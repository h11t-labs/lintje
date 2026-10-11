/**
 * The empty state as a render function, so a tile draws "nothing here" with the same block as
 * `<lintje-empty-state>`. With `status` it is a region drawn empty until `filled`: a region that
 * arrives with its words is not announced.
 */
import { html, nothing, type CSSResult, type TemplateResult } from 'lit'
import { shadowCss } from '../../core/styles'
import { renderIcon } from '../../icons/render'
import emptyStateBlockCss from './empty-state-block.css?inline'

export type HeadingLevel = 2 | 3 | 4 | 5 | 6

export const emptyStateBlockStyles: CSSResult = shadowCss(emptyStateBlockCss)

export interface EmptyStateBlockOptions {
  /** Not drawn when `compact`. */
  heading?: string
  /** The one sentence below the heading, or the whole line when `compact`. */
  text?: string
  /** An icon file name. Not drawn when `compact`. */
  icon?: string
  level?: HeadingLevel
  /** One muted line with what follows it, for inside content. */
  compact?: boolean
  /** A `role="status"` region, drawn empty until `filled`. */
  status?: boolean
  filled?: boolean
  /** What the reader can do next: the element's default slot. Hidden while `actionShown` is off. */
  action?: TemplateResult | typeof nothing
  actionShown?: boolean
}

function heading(text: string, level: HeadingLevel): TemplateResult {
  switch (level) {
    case 2:
      return html`<h2 class="lintje-empty-state__heading">${text}</h2>`
    case 4:
      return html`<h4 class="lintje-empty-state__heading">${text}</h4>`
    case 5:
      return html`<h5 class="lintje-empty-state__heading">${text}</h5>`
    case 6:
      return html`<h6 class="lintje-empty-state__heading">${text}</h6>`
    default:
      return html`<h3 class="lintje-empty-state__heading">${text}</h3>`
  }
}

export function renderEmptyStateBlock(options: EmptyStateBlockOptions): TemplateResult {
  const role = options.status ? 'status' : nothing
  // The same region either way: only what is inside it waits for `filled`.
  const empty = Boolean(options.status) && !options.filled
  if (options.compact) {
    return html`<div class="lintje-empty-state lintje-empty-state--compact" role=${role}>
      ${empty ? nothing : html`${options.text ?? nothing} ${options.action ?? nothing}`}
    </div>`
  }
  return html`<div class="lintje-empty-state" role=${role}>
    ${empty ? nothing : content(options)}
  </div>`
}

function content(options: EmptyStateBlockOptions): TemplateResult {
  return html`${
    options.icon
      ? renderIcon(options.icon, { size: 40, className: 'lintje-empty-state__icon' })
      : nothing
  }
    ${options.heading ? heading(options.heading, options.level ?? 3) : nothing}
    ${options.text ? html`<p class="lintje-empty-state__text">${options.text}</p>` : nothing}
    ${
      options.action === undefined
        ? nothing
        : html`<div class="lintje-empty-state__action" ?hidden=${!options.actionShown}>
          ${options.action}
        </div>`
    }`
}
