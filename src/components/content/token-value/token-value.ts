/**
 * `<lintje-token-value>` — what a design token computes to, here and now: a colour as a swatch
 * and hex, a length in rem also in px, a text style as weight, size and line height.
 *
 * The value is read from the computed style, since a token ends in a `color-mix()` or an
 * `oklch()` of the theme's `--primary`. A change of mode redraws it like any element; a change
 * of theme is watched on the document.
 */
import { html, type PropertyDeclarations, type TemplateResult } from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import tokenValueCss from './token-value.css?inline'

export const NO_VALUE = '—'

const NUMBER = new Intl.NumberFormat('nl', { maximumFractionDigits: 2 })

const RGB = /^rgba?\(([^)]*)\)$/i
const SRGB = /^color\(\s*srgb\s+([^)]*)\)$/i

const hex = (channels: number[]): string =>
  `#${channels
    .map((c) =>
      Math.max(0, Math.min(255, Math.round(c)))
        .toString(16)
        .padStart(2, '0')
        .toUpperCase(),
    )
    .join('')}`

/**
 * A computed sRGB colour as upper-case hex, with its alpha in percent when it is not opaque;
 * `null` for anything else. Browsers compute to `rgb(14, 61, 110)` or `color(srgb 0.05 0.24 0.43)`.
 */
export function formatColour(computed: string): string | null {
  const value = computed.trim()
  const rgb = RGB.exec(value)
  const srgb = rgb ? null : SRGB.exec(value)
  const parts = (rgb ?? srgb)?.[1]
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map(Number.parseFloat)
  if (!parts || parts.length < 3 || parts.length > 4 || parts.some(Number.isNaN)) return null
  const channels = parts.slice(0, 3).map((part) => (srgb ? part * 255 : part))
  const alpha = parts[3] ?? 1
  // A browser keeps the alpha in eight bits: 16 % computes as 16.08 %.
  return alpha < 1 ? `${hex(channels)} · ${Math.round(alpha * 100)} %` : hex(channels)
}

const px = (value: number | string): string =>
  `${NUMBER.format(Number.parseFloat(String(value)))} px`

export class LintjeTokenValue extends LintjeElement {
  static override styles = shadowCss(tokenValueCss)

  static override properties: PropertyDeclarations = {
    name: { type: String, reflect: true },
    noSwatch: { type: Boolean, attribute: 'no-swatch' },
  }

  /** The custom property to show, with its dashes: `--color-accent`. */
  declare name?: string
  /** Without the swatch, where the colour already stands beside it, larger. */
  noSwatch: boolean = false

  private observer?: MutationObserver

  override connectedCallback(): void {
    super.connectedCallback()
    if (typeof MutationObserver !== 'undefined') {
      this.observer ??= new MutationObserver(() => this.reread())
      this.observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      })
    }
  }

  override disconnectedCallback(): void {
    this.observer?.disconnect()
    super.disconnectedCallback()
  }

  protected override updated(): void {
    this.reread()
  }

  /**
   * Set on the nodes, not bound: the probe exists only after render, and a reactive property
   * set from `updated()` would schedule a second render per reading.
   */
  private reread(): void {
    const value = this.shadowRoot?.querySelector('.lintje-token-value__value')
    const swatch = this.shadowRoot?.querySelector<HTMLElement>('.lintje-token-value__swatch')
    const probe = this.shadowRoot?.querySelector<HTMLElement>('.lintje-token-value__probe')
    if (!value || !swatch || !probe) return
    const raw =
      this.name && typeof getComputedStyle === 'function'
        ? getComputedStyle(this).getPropertyValue(this.name).trim()
        : ''
    const colour = raw ? this.colourOf(raw, probe) : null
    swatch.hidden = !colour || this.noSwatch
    swatch.style.background = colour ? `var(${this.name})` : ''
    value.textContent = raw ? (colour ?? this.describe(raw, probe)) : NO_VALUE
  }

  /** The CSSOM keeps a valid declaration and drops the rest, so the probe tells what a value is. */
  private colourOf(raw: string, probe: HTMLElement): string | null {
    probe.style.color = ''
    probe.style.color = raw
    if (!probe.style.color) return null
    // An `oklch()` computes as itself; mixed in sRGB it computes as `color(srgb …)`.
    probe.style.color = `color-mix(in srgb, ${raw} 100%, transparent)`
    if (!probe.style.color) probe.style.color = raw
    return formatColour(getComputedStyle(probe).color) ?? raw
  }

  private describe(raw: string, probe: HTMLElement): string {
    probe.style.font = ''
    probe.style.font = raw
    if (probe.style.font) {
      const { fontWeight, fontSize, lineHeight } = getComputedStyle(probe)
      if (fontSize.endsWith('px')) {
        // A line height computes in px, as a bare number, or as `normal`, which has no number.
        const size = Number.parseFloat(fontSize)
        const line = Number.parseFloat(lineHeight) * (lineHeight.endsWith('px') ? 1 : size)
        const said = `${fontWeight} · ${px(size)}`
        return Number.isFinite(line) ? `${said} / ${px(line)}` : said
      }
    }
    // A relative length or a sum of them; a percentage would be of the probe, not of the use.
    if (/rem|em|calc\(/.test(raw) && !raw.includes('%')) {
      probe.style.width = ''
      probe.style.width = raw
      const width = probe.style.width ? getComputedStyle(probe).width : ''
      if (width.endsWith('px')) return `${raw} · ${px(width)}`
    }
    return raw
  }

  protected override render(): TemplateResult {
    return html`<span class="lintje-token-value">
      <span class="lintje-token-value__probe" aria-hidden="true"></span>
      <span class="lintje-token-value__swatch" aria-hidden="true" hidden></span>
      <span class="lintje-token-value__value"></span>
    </span>`
  }
}

define('lintje-token-value', LintjeTokenValue)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-token-value': LintjeTokenValue
  }
}
