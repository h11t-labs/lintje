/**
 * `renderIcon()` — one icon as a template in the calling component's own root, so a glyph costs
 * no nested shadow root. `<lintje-icon>` draws through it too.
 *
 * Sources in order: `src` (a mask in the text colour); the register; the loader (names from
 * data); `nothing`. A name without a file draws nothing: compare the result with `nothing` and
 * show the Dutch label instead.
 */
import { html, nothing, type CSSResult, type TemplateResult } from 'lit'
import { unsafeSVG } from 'lit/directives/unsafe-svg.js'
import { styleProps } from '../core/style-props'
import { redrawAllElements } from '../core/element'
import { shadowCss } from '../core/styles'
import { ICONS, type IconGlyph } from './register'
import { iconIsMissing, loadedIcon, loadedIconNames, onIconChange, requestIcon } from './loader'
import glyphCss from './glyph.css?inline'

export const iconStyles: CSSResult = shadowCss(glyphCss)

export interface IconOptions {
  size?: number
  label?: string
  /** An SVG file the host resolved, as a URL or data URI. Wins over the name. */
  src?: string
  className?: string
  /** A quarter turn of the drawing, as a CSS transform. */
  rotate?: 90 | 180 | 270
  flip?: 'horizontal' | 'vertical'
  /** Draws the box but does not ask for the file yet (`<lintje-icon lazy>`). */
  defer?: boolean
}

const noted = new Set<string>()
const missed = new Set<string>()
let watchingStore = false

/** Says once, in dev, which name found no file: `info`, since a missing chrome icon is expected. */
function noteOnce(name: string | undefined): void {
  if (!name || !import.meta.env?.DEV || noted.has(name)) return
  noted.add(name)
  const hint = loadedIconNames().length ? '' : ' Is setIconSource() pointing at the icon route?'
  console.info(`lintje-icon: no icon named "${name}"; the label shows as text.${hint}`)
}

/** Arms the redraw on the first miss, once per frame: an icon is a template with no subscription. */
function rememberMiss(name: string | undefined): void {
  if (!name) return
  missed.add(name)
  if (watchingStore) return
  watchingStore = true
  let scheduled = false
  onIconChange(() => {
    if (!missed.size || scheduled) return
    scheduled = true
    nextFrame(() => {
      scheduled = false
      if (!missed.size) return
      missed.clear()
      redrawAllElements()
    })
  })
}

function nextFrame(run: () => void): void {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run)
  else void Promise.resolve().then(run)
}

export function iconGlyph(name: string | undefined): IconGlyph | undefined {
  return (name ? ICONS[name] : undefined) ?? loadedIcon(name)
}

/** An icon before a line of text: one wrapper for tile title, KPI label and disclosure (rule 2). */
export function renderLeadingIcon(
  name: string | undefined,
  className: string,
): TemplateResult | typeof nothing {
  if (!name) return nothing
  return html`<span class="lintje-leading-icon ${className}"
    >${renderIcon(name, { size: 20 })}</span
  >`
}

export function renderIcon(
  name: string | undefined,
  options: IconOptions = {},
): TemplateResult | typeof nothing {
  const { size = 16, label, src, className, rotate, flip, defer } = options
  const role = label ? 'img' : nothing
  const ariaLabel = label ?? nothing
  const ariaHidden = label ? nothing : 'true'
  const classes = [
    'lintje-icon',
    rotate ? `lintje-icon--rotate-${rotate}` : '',
    flip ? `lintje-icon--flip-${flip === 'horizontal' ? 'x' : 'y'}` : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  if (src) {
    const box = `${size}px`
    const mask = `url("${src}") center / contain no-repeat`
    return html`<span
      class="${classes} lintje-icon--file"
      ${styleProps({ width: box, height: box, mask, webkitMask: mask })}
      role=${role}
      aria-label=${ariaLabel}
      aria-hidden=${ariaHidden}
    ></span>`
  }

  const glyph = iconGlyph(name)
  if (!glyph) {
    // An empty box of the right size, so nothing shifts when the file lands.
    const box = html`<svg
      class="${classes} lintje-icon--pending"
      xmlns="http://www.w3.org/2000/svg"
      width=${size}
      height=${size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    ></svg>`
    // Deferred: not near the screen yet, so not a miss and no redraw.
    if (defer && name) return box
    rememberMiss(name)
    if (name && !iconIsMissing(name)) {
      requestIcon(name)
      return box
    }
    noteOnce(name)
    return nothing
  }

  return html`<svg
    class=${classes}
    xmlns="http://www.w3.org/2000/svg"
    width=${size}
    height=${size}
    viewBox=${glyph.viewBox}
    fill=${glyph.attributes.fill ?? 'currentColor'}
    stroke=${glyph.attributes.stroke ?? nothing}
    stroke-width=${glyph.attributes['stroke-width'] ?? nothing}
    stroke-linecap=${glyph.attributes['stroke-linecap'] ?? nothing}
    stroke-linejoin=${glyph.attributes['stroke-linejoin'] ?? nothing}
    role=${role}
    aria-label=${ariaLabel}
    aria-hidden=${ariaHidden}
  >${unsafeSVG(glyph.body)}</svg>`
}
