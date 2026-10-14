/**
 * The announcement as a render function, so a tile draws its error with the same block as
 * `<lintje-announcement>` draws itself. The element adds dismissal and focus; a tile adds
 * nothing. A live block is drawn empty until `filled`: a region that arrives with its words is
 * not announced.
 */
import { html, nothing, type CSSResult, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { shadowCss } from '../../core/styles'
import { renderIcon } from '../../icons/render'
import { TONE_ICON, type Tone } from './tone'
import announcementBlockCss from './announcement-block.css?inline'

/** `outage` interrupts and cannot be closed; `error` is a failure the reader may put away. */
export type AnnouncementKind = 'warning' | 'outage' | 'error' | 'info' | 'ok'

/** A message's kind in the one tone set: a warning is drawn in the attention tone. */
export const ANNOUNCEMENT_TONE: Record<AnnouncementKind, Tone> = {
  warning: 'attention',
  outage: 'error',
  error: 'error',
  info: 'info',
  ok: 'success',
}

/** Only an outage interrupts the reader; the others wait their turn. */
export const ANNOUNCEMENT_ROLE: Record<AnnouncementKind, 'alert' | 'status'> = {
  warning: 'status',
  outage: 'alert',
  error: 'status',
  info: 'status',
  ok: 'status',
}

/** The word a screen reader hears before the text, since the tint says nothing to it. */
export const ANNOUNCEMENT_PREFIX: Record<AnnouncementKind, string> = {
  warning: 'Waarschuwing',
  outage: 'Storing',
  error: 'Fout',
  info: 'Informatie',
  ok: 'Gelukt',
}

export const announcementBlockStyles: CSSResult = shadowCss(announcementBlockCss)

export interface AnnouncementBlockOptions {
  kind?: AnnouncementKind
  title?: string
  text?: string
  meta?: string
  link?: { label: string; href: string }
  /** A live region: `role` from the kind, drawn empty until `filled`. */
  live?: boolean
  /** Whether a live block shows its words yet; ignored when not live. */
  filled?: boolean
  /** What stands under or beside the text: the element's `action` slot. */
  action?: TemplateResult | typeof nothing
  /** What stands beside the body: the element's `media` slot. */
  media?: TemplateResult | typeof nothing
  /** With a handler the block draws its close button. */
  onClose?: () => void
}

export function renderAnnouncementBlock(options: AnnouncementBlockOptions): TemplateResult {
  const kind = options.kind ?? 'warning'
  const live = options.live === true
  const empty = live && !options.filled
  return html`<div
    class=${classMap({
      'lintje-announcement': true,
      [`lintje-announcement--${kind}`]: true,
    })}
    role=${live ? ANNOUNCEMENT_ROLE[kind] : nothing}
  >
    <div class="lintje-announcement__inner">
      ${empty ? html`<div class="lintje-announcement__body"><div class="lintje-announcement__lead">${mark(kind)}</div></div>` : content(kind, options)}
    </div>
  </div>`
}

/** The glyph stands from the first frame, so the block keeps its size when the words arrive. */
function mark(kind: AnnouncementKind): TemplateResult {
  const icon = TONE_ICON[ANNOUNCEMENT_TONE[kind]]
  return html`<span class="lintje-announcement__icon" aria-hidden="true"
    >${icon ? renderIcon(icon, { size: 16 }) : nothing}</span
  >`
}

// The glyph stands with the words, so the pair is centred against an action beside it as one.
function content(kind: AnnouncementKind, options: AnnouncementBlockOptions): TemplateResult {
  const { title, text, meta, link } = options
  const prefix = html`<span class="visually-hidden">${ANNOUNCEMENT_PREFIX[kind]}: </span>`
  return html`<div class="lintje-announcement__body">
      <div class="lintje-announcement__lead">
      ${mark(kind)}
      <div class="lintje-announcement__content">
        ${title ? html`<p class="lintje-announcement__title">${prefix}${title}</p>` : nothing}
        ${
          text
            ? html`<p class="lintje-announcement__text">${title ? nothing : prefix}${text}</p>`
            : nothing
        }
        ${
          meta || link
            ? html`<p class="lintje-announcement__meta">
              ${meta ?? nothing}${meta && link ? ' · ' : nothing}${
                link
                  ? html`<a class="lintje-announcement__link" href=${link.href}>${link.label}</a>`
                  : nothing
              }
            </p>`
            : nothing
        }
      </div>
      </div>
      ${options.action ?? nothing}
    </div>
    ${options.media ?? nothing}
    ${
      options.onClose
        ? html`<button
          type="button"
          class="lintje-announcement__close"
          aria-label="Mededeling sluiten"
          @click=${options.onClose}
        >
          ${renderIcon('functioneel-kruis', { size: 16 })}
        </button>`
        : nothing
    }`
}
