/**
 * The one drawing of a person's circle: a photo, the initials or an icon, and dashed where nobody
 * stands. A root that draws it calls `renderAvatar()` and adopts `avatarStyles` and `iconStyles`.
 * The circle is `aria-hidden`: the name beside it is the text.
 */
import { html, nothing, type CSSResult, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { keyed } from 'lit/directives/keyed.js'
import { shadowCss } from '../../core/styles'
import { renderIcon } from '../../icons/render'
import type { SpeakerColour } from '../content/shared/playback'
import type { Person } from '../../types'
import avatarCss from './avatar.css?inline'

export type AvatarSize = 'small' | 'medium' | 'large'

export const avatarStyles: CSSResult = shadowCss(avatarCss)

export interface AvatarOptions {
  /** 24, 32 or 40 px; default `medium`. */
  size?: AvatarSize
  /** A speaker's colour, only where the people are the variable; `other` is the neutral circle. */
  color?: SpeakerColour
  /** The circle stands on the menu and takes its colours. */
  onNav?: boolean
  /** The icon without initials: the user, unless what stands there is no person. */
  icon?: string
  className?: string
}

const ICON_SIZE: Record<AvatarSize, number> = { small: 16, medium: 20, large: 24 }

// `renderAvatar()` keeps no state: a photo that fails hides itself, and a new photo is a new
// `<img>`, so the one that failed before does not stay hidden.
function hideOnError(event: Event): void {
  ;(event.target as HTMLImageElement).hidden = true
}

/** `null` is the empty place: a dashed circle with nothing in it. */
export function renderAvatar(person: Person | null, options: AvatarOptions = {}): TemplateResult {
  const { size = 'medium', color, onNav = false, className, icon = 'functioneel-user' } = options
  const colour = !onNav && color && color !== 'other' ? color : null
  const classes = classMap({
    'lintje-avatar': true,
    [`lintje-avatar--${size}`]: true,
    'lintje-avatar--nav': onNav,
    [`lintje-avatar--${colour}`]: Boolean(colour),
    'is-empty': !person,
    ...Object.fromEntries(
      (className ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .map((name) => [name, true]),
    ),
  })
  if (!person) return html`<span class=${classes} aria-hidden="true"></span>`
  // Under the photo stand the initials or the icon, so nothing jumps while it loads or if it fails.
  const under = person.initials
    ? html`<span class="lintje-avatar__initials">${person.initials}</span>`
    : renderIcon(icon, { size: ICON_SIZE[size], className: 'lintje-avatar__icon' })
  const photo = person.photo
    ? keyed(
        person.photo,
        html`<img class="lintje-avatar__photo" src=${person.photo} alt="" @error=${hideOnError} />`,
      )
    : nothing
  return html`<span class=${classes} aria-hidden="true">${under}${photo}</span>`
}
