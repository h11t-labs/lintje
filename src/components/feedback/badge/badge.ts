/**
 * `<lintje-badge>` — a status as a word, two words at most; the word carries the meaning, also
 * beside an `icon`.
 *
 * A root that draws a badge without the element calls `renderBadge()` and adopts `badgeStyles`,
 * as `renderIcon()` / `iconStyles` do.
 */
import { html, nothing, type CSSResult, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import type { Tone } from '../../shared/tone'
import badgeCss from './badge.css?inline'
import badgeHostCss from './badge-host.css?inline'

export type BadgeTone = Tone
export type BadgeVariant = 'label' | 'count' | 'unread'

export const badgeStyles: CSSResult = shadowCss(badgeCss)

export interface BadgeOptions {
  value: unknown
  tone?: BadgeTone
  variant?: BadgeVariant
  /** What a screen reader hears instead of a bare number: "2 opmerkingen". */
  label?: string
  /** `nav`: the badge stands on the menu's surface and takes its colours; `tone` does not apply. */
  surface?: 'nav'
  muted?: boolean
  /** BEM classes of the surrounding block, space-separated. */
  className?: string
  /** An icon file name before the word, in the word's colour; a label badge only. */
  icon?: string
}

export function renderBadge(options: BadgeOptions): TemplateResult {
  const {
    value,
    tone = 'neutral',
    variant = 'label',
    label,
    surface,
    muted,
    className,
    icon,
  } = options
  const onNav = surface === 'nav'
  const glyph =
    icon && variant === 'label'
      ? renderIcon(icon, { size: 12, className: 'lintje-badge__icon' })
      : nothing
  // With a label the figure is only seen and the label only heard.
  return html`<span
    class=${classMap({
      'lintje-badge': true,
      [`lintje-badge--${variant}`]: true,
      [`lintje-badge--${tone}`]: variant === 'label' && !onNav,
      'lintje-badge--nav': onNav,
      'is-muted': onNav && Boolean(muted),
      ...Object.fromEntries(
        (className ?? '')
          .split(/\s+/)
          .filter(Boolean)
          .map((name) => [name, true]),
      ),
    })}
    >${glyph}${
      label
        ? html`<span aria-hidden="true">${value}</span
            ><span class="visually-hidden">${label}</span>`
        : value
    }</span
  >`
}

export class LintjeBadge extends LintjeElement {
  static override styles = [iconStyles, shadowCss(badgeHostCss), badgeStyles]

  static override properties: PropertyDeclarations = {
    tone: { type: String, reflect: true },
    variant: { type: String, reflect: true },
    label: { type: String },
    icon: { type: String },
  }

  tone: BadgeTone = 'neutral'
  /** `count`: the quiet counter in a tab or button; `unread`: the round counter of the menu. */
  variant: BadgeVariant = 'label'
  declare label?: string
  /** An icon file name before the word. */
  declare icon?: string

  protected override render(): TemplateResult {
    return renderBadge({
      value: html`<slot></slot>`,
      tone: this.tone,
      variant: this.variant,
      label: this.label,
      icon: this.icon,
    })
  }
}

define('lintje-badge', LintjeBadge)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-badge': LintjeBadge
  }
}
