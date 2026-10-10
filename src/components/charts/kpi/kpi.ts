/**
 * `<lintje-kpi>` — the KPI tile: one figure, or several of the same variable (`items`). Rich
 * values go in as properties. The value counts up from zero once 35 % of the tile is in view,
 * and not under `prefers-reduced-motion`. A single figure can stand on its scale (`gauge`): a
 * half circle around the value or a bar under it, with the target dashed; the trend or note says
 * in words how the figure stands to the target. Events: none.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { styleProps } from '../../../core/style-props'
import { define } from '../../../core/element'
import { durationMs, prefersReducedMotion } from '../../../core/motion'
import { shadowCss } from '../../../core/styles'
import { LintjeGridItemElement, spanStyles } from '../../../primitives/shared/grid-item-element'
import { iconStyles, renderIcon } from '../../../icons/render'
import '../../../primitives/status-dot/status-dot'
import '../../../primitives/skeleton/skeleton'
import skeletonCss from '../../../primitives/skeleton/skeleton.css?inline'
import kpiCss from './kpi.css?inline'
import { renderGauge } from './gauge'
import { DATA_COLORS, chartToken, type DataColor } from '../../../tokens/colors'
import type {
  KpiGauge,
  KpiItem,
  KpiState,
  KpiTrend,
  KpiVariable,
  TrendDirection,
} from '../../../types'

// A single-`value` KPI has no `KpiItem` and its value may be missing, so a figure is looser.
type Figure = Partial<KpiItem>

// A variable's accent is its own chart token; `coverage` is a role, not a variable, and gray.
const ACCENT: Record<KpiVariable, string> = {
  ...(Object.fromEntries(DATA_COLORS.map((color) => [color, chartToken(color)])) as Record<
    DataColor,
    string
  >),
  coverage: 'var(--color-text-muted)',
}

const GLYPH: Record<TrendDirection, string> = { up: '▲', down: '▼', flat: '●' }

// Share of the tile, or of the viewport for a taller tile, that must show.
const VISIBLE_SHARE = 0.35
const STEPS = Array.from({ length: 21 }, (_, i) => i / 20)

interface Counted {
  before: string
  after: string
  target: number
  decimals: number
  grouped: boolean
}

function parseCount(value: string | number | undefined): Counted | null {
  const text = value === undefined ? null : String(value)
  const match = text?.match(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/)
  if (text == null || !match || match.index == null) return null
  const raw = match[0]
  return {
    before: text.slice(0, match.index),
    after: text.slice(match.index + raw.length),
    target: Number(raw.replace(/\./g, '').replace(',', '.')),
    decimals: raw.split(',')[1]?.length ?? 0,
    grouped: raw.includes('.'),
  }
}

function formatCount(count: Counted, n: number): string {
  return (
    count.before +
    n.toLocaleString('nl-NL', {
      minimumFractionDigits: count.decimals,
      maximumFractionDigits: count.decimals,
      useGrouping: count.grouped,
    }) +
    count.after
  )
}

export class LintjeKpi extends LintjeGridItemElement {
  static override styles = [spanStyles, iconStyles, shadowCss(skeletonCss), shadowCss(kpiCss)]

  static override properties: PropertyDeclarations = {
    label: { type: String },
    icon: { type: String },
    value: { type: String },
    suffix: { type: String },
    items: { attribute: false },
    layout: { type: String },
    emphasis: { type: String },
    dividers: { type: Boolean },
    trend: { attribute: false },
    gauge: { attribute: false },
    note: { type: String },
    detail: { type: String },
    variable: { type: String, reflect: true },
    state: { type: String, reflect: true },
    index: { type: Number },
    counting: { state: true },
    drawn: { state: true },
  }

  label: string = ''
  /** An icon file name, drawn before the label. Decorative; it stays in every state. */
  declare icon?: string
  /** A string or number with one number in it counts up when the tile comes into view. */
  declare value?: string | number
  declare suffix?: string
  /** One to three figures of the same variable, the current one first. Wins over `value`. */
  declare items?: KpiItem[]
  /** `row`: side by side, stacked below 360 px. `column`: stacked, period beside the value. */
  layout: 'row' | 'column' = 'row'
  /** `primary`: the first figure at full size, the others smaller below a line. */
  emphasis: 'equal' | 'primary' = 'equal'
  /** Default `true`: bind as `.dividers=${false}`, an attribute cannot turn it off. */
  dividers: boolean = true
  declare trend?: KpiTrend
  /** The single figure on its scale, as a half circle (`arc`) or a bar (`linear`); not with `items`. */
  declare gauge?: KpiGauge
  /** A line without an arrow, for when there is no direction. */
  declare note?: string
  declare detail?: string
  /** A data colour's name (`DataColor`); `coverage` is the gray one. */
  variable: KpiVariable = 'sky-blue'
  state: KpiState = 'ready'
  index: number = 0

  counting: (string | null)[] = []
  drawn = false

  #counts: (Counted | null)[] = []
  #signature = ''
  #observer: IntersectionObserver | null = null
  #frame = 0
  #played = false
  #inView = false

  private get figures(): KpiItem[] | null {
    return this.items?.length ? this.items : null
  }

  private get reduced(): boolean {
    return prefersReducedMotion()
  }

  override connectedCallback(): void {
    super.connectedCallback()
    if (typeof IntersectionObserver === 'undefined') {
      this.#inView = true
      this.drawn = true
      return
    }
    this.#observer = new IntersectionObserver(
      ([entry]) => {
        const viewport = entry.rootBounds?.height ?? window.innerHeight
        if (
          entry.intersectionRatio >= VISIBLE_SHARE ||
          entry.intersectionRect.height >= viewport * VISIBLE_SHARE
        ) {
          this.#inView = true
          this.drawn = true
          this.#observer?.disconnect()
          this.startCount()
        }
      },
      { threshold: STEPS },
    )
    this.#observer.observe(this)
  }

  override disconnectedCallback(): void {
    this.#observer?.disconnect()
    cancelAnimationFrame(this.#frame)
    super.disconnectedCallback()
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    const values =
      this.state !== 'ready'
        ? []
        : this.figures
          ? this.figures.map((item) => item.value)
          : [this.value]
    const signature = JSON.stringify(values)
    if (signature === this.#signature) return
    this.#signature = signature
    this.#counts = values.map(parseCount)
    cancelAnimationFrame(this.#frame)
    this.#played = false
    this.counting = this.reduced
      ? this.#counts.map(() => null)
      : this.#counts.map((count) => (count ? formatCount(count, 0) : null))
    if (this.#inView) this.startCount()
  }

  private startCount(): void {
    if (this.#played || this.reduced || !this.#counts.some(Boolean)) return
    this.#played = true
    const duration = durationMs(this, '--dur-draw')
    const start = performance.now() + this.index * 40
    const tick = (now: number) => {
      const t = duration > 0 ? Math.min(1, Math.max(0, (now - start) / duration)) : 1
      if (t === 1) {
        this.counting = this.#counts.map(() => null)
        return
      }
      const eased = 1 - Math.pow(1 - t, 3)
      this.counting = this.#counts.map((count) =>
        count ? formatCount(count, count.target * eased) : null,
      )
      this.#frame = requestAnimationFrame(tick)
    }
    this.#frame = requestAnimationFrame(tick)
  }

  protected override render(): TemplateResult {
    const figures = this.figures
    const primary = figures != null && this.emphasis === 'primary'
    return html`<div
      class=${classMap({
        'lintje-kpi': true,
        'lintje-kpi--primary': primary,
        'lintje-kpi--icon': Boolean(this.icon),
      })}
      ${styleProps({
        borderTopColor: ACCENT[this.variable],
        animationDelay: `${this.index * 40}ms`,
      })}
    >
      ${
        this.icon
          ? html`<span class="lintje-kpi__icon">${renderIcon(this.icon, { size: 20 })}</span>`
          : nothing
      }
      <p class="lintje-kpi__label">${this.label}</p>
      ${this.body(figures, primary)}
    </div>`
  }

  private body(figures: KpiItem[] | null, primary: boolean): TemplateResult {
    const loading = this.state === 'loading'
    const ready = this.state === 'ready'
    if (!figures && this.gauge) return this.gauged(this.gauge)
    if (!figures) {
      return loading
        ? html`<div class="lintje-kpi__skeleton">
            <lintje-skeleton height="34" width="70%"></lintje-skeleton>
            <lintje-skeleton height="13" width="90%"></lintje-skeleton>
            <lintje-skeleton height="12" width="55%"></lintje-skeleton>
          </div>`
        : html`${this.figure(0, { value: this.value, suffix: this.suffix })}${this.lines(true)}`
    }
    if (primary) {
      const [first, ...rest] = figures
      const standaloneDetail = this.detail && (ready || this.state === 'empty')
      return html`
        ${
          loading
            ? html`<lintje-skeleton height="34" width="70%"></lintje-skeleton>`
            : this.figure(0, first)
        }
        ${
          loading
            ? html`<lintje-skeleton height="13" width="90%"></lintje-skeleton>`
            : this.lines(false)
        }
        ${
          rest.length > 0 && this.dividers
            ? html`<span class="lintje-kpi__divider" aria-hidden="true"></span>`
            : nothing
        }
        ${rest.length > 0 ? this.itemList(rest, true, false, 1) : nothing}
        ${
          loading
            ? html`<lintje-skeleton height="12" width="55%"></lintje-skeleton>`
            : standaloneDetail
              ? html`<p class="lintje-kpi__detail">${this.detail}</p>`
              : nothing
        }
      `
    }
    return html`
      ${this.itemList(figures, false, this.dividers && figures.length > 1, 0)}
      ${
        loading
          ? html`<div class="lintje-kpi__skeleton">
            <lintje-skeleton height="13" width="90%"></lintje-skeleton>
            <lintje-skeleton height="12" width="55%"></lintje-skeleton>
          </div>`
          : this.lines(true)
      }
    `
  }

  /** The single figure on its scale; while loading the track stands and the text is a skeleton. */
  private gauged(gauge: KpiGauge): TemplateResult {
    const loading = this.state === 'loading'
    const value = gauge.value !== undefined ? gauge.value : (parseCount(this.value)?.target ?? null)
    const figure = loading
      ? html`<lintje-skeleton class="lintje-gauge__skeleton" height="34" width="40%"></lintje-skeleton>`
      : this.figure(0, { value: this.value, suffix: this.suffix })
    return html`
      ${renderGauge(
        {
          gauge,
          value,
          ready: this.state === 'ready',
          loading,
          drawn: this.drawn || this.reduced,
          color: ACCENT[this.variable],
        },
        figure,
      )}
      ${
        loading
          ? html`<div class="lintje-kpi__skeleton">
            <lintje-skeleton height="13" width="90%"></lintje-skeleton>
            <lintje-skeleton height="12" width="55%"></lintje-skeleton>
          </div>`
          : this.lines(true)
      }
    `
  }

  /** Trend, note or state message, then the detail line; with `primary` the detail stands apart. */
  private lines(withDetail: boolean): TemplateResult {
    const ready = this.state === 'ready'
    return html`
      ${ready && this.trend ? this.trendLine(withDetail) : nothing}
      ${ready && !this.trend && this.note ? html`<p class="lintje-kpi__note">${this.note}</p>` : nothing}
      ${this.state === 'empty' ? html`<p class="lintje-kpi__note">Geen gegevens</p>` : nothing}
      ${
        this.state === 'error'
          ? html`<p class="lintje-kpi__note lintje-kpi__note--error">
            <span class="lintje-kpi__dot" aria-hidden="true"></span>Niet geladen
          </p>`
          : nothing
      }
      ${
        withDetail && this.detail && ((ready && !this.trend) || this.state === 'empty')
          ? html`<p class="lintje-kpi__detail">${this.detail}</p>`
          : nothing
      }
    `
  }

  private trendLine(withDetail: boolean): TemplateResult {
    const { direction, sentence, inverted = false } = this.trend!
    let tone: 'good' | 'bad' | 'neutral' = 'neutral'
    if (direction !== 'flat') {
      const good = inverted ? direction === 'down' : direction === 'up'
      tone = good ? 'good' : 'bad'
    }
    return html`
      <p class="lintje-trend"><span
          class="lintje-trend__glyph lintje-trend__glyph--${tone}"
          aria-hidden="true"
          >${GLYPH[direction]}</span
        >${
          // The glyph shows the direction; whether that is good is only its colour, so say it.
          tone === 'neutral'
            ? nothing
            : html`<span class="visually-hidden">${tone === 'good' ? 'gunstig' : 'ongunstig'}: </span>`
        }<span>${sentence}</span></p>
      ${
        withDetail && this.detail
          ? html`<p class="lintje-trend__detail">${this.detail}</p>`
          : nothing
      }
    `
  }

  /** The comparison figures of `primary` always form a row. */
  private itemList(
    list: KpiItem[],
    secondary: boolean,
    divided: boolean,
    offset: number,
  ): TemplateResult {
    const loading = this.state === 'loading'
    return html`<div class="lintje-kpi__figures">
      <div
        class=${classMap({
          'lintje-kpi__items': true,
          [`lintje-kpi__items--${secondary ? 'row' : this.layout}`]: true,
          'lintje-kpi__items--divided': divided,
        })}
      >
        ${list.map(
          (item, i) => html`
            ${
              i > 0 && divided
                ? html`<span class="lintje-kpi__divider" aria-hidden="true"></span>`
                : nothing
            }
            <div
              class=${classMap({
                'lintje-kpi__item': true,
                'lintje-kpi__item--comparison': !secondary && i > 0,
              })}
            >
              ${
                loading
                  ? html`<lintje-skeleton
                    height=${secondary ? 20 : 34}
                    width="70%"
                  ></lintje-skeleton>`
                  : this.figure(offset + i, item, secondary)
              }
              ${item.period ? html`<p class="lintje-kpi__period">${item.period}</p>` : nothing}
            </div>
          `,
        )}
      </div>
    </div>`
  }

  private figure(index: number, item: Figure, secondary = false): TemplateResult {
    const ready = this.state === 'ready'
    const counting = this.counting[index] ?? null
    const primaryPeriod = this.emphasis === 'primary' && index === 0 ? item.period : undefined
    const tail = [ready ? item.suffix : undefined, primaryPeriod].filter(Boolean).join(' · ')
    return html`<p class=${secondary ? 'lintje-kpi__secondary-value' : 'lintje-kpi__value'}>
      ${
        !ready
          ? '—'
          : counting == null
            ? item.value
            : // The final value stays readable for screen readers; the counting copy lies over it.
              html`<span class="lintje-kpi__count">
              <span class="lintje-kpi__count-final">${item.value}</span>
              <span class="lintje-kpi__count-live" aria-hidden="true">${counting}</span>
            </span>`
      }${tail ? html`<span class="lintje-kpi__suffix">${tail}</span>` : nothing}
    </p>`
  }
}

define('lintje-kpi', LintjeKpi)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-kpi': LintjeKpi
  }
}
