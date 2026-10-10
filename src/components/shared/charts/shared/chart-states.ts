/**
 * Empty, error and loading states: the tile keeps its header, size and axes; only the data is
 * missing. This module writes the markup of `lintje-skeleton` and `lintje-announcement`, not
 * their CSS. A host with its own announcement element passes it in `announcement`.
 */
import { html, nothing, type TemplateResult } from 'lit'
import { styleProps } from '../../../../core/style-props'
import { chartIcon, ZOOM_CONTROLS } from './chart-icons'

export type ChartSkeletonKind = 'line' | 'bar' | 'pie' | 'donut' | 'heatmap' | 'map' | 'table'

function skeleton(
  width: number | string = '100%',
  height: number | string = 12,
  className = '',
): TemplateResult {
  const size = (value: number | string) => (typeof value === 'number' ? `${value}px` : value)
  return html`<span class="lintje-skeleton ${className}"
                    ${styleProps({ width: size(width), height: size(height) })} aria-hidden="true"></span>`
}

/** Loading skeleton in the shape of the chart, exactly `height` tall so the tile keeps its size. */
export function renderChartSkeleton({
  kind = 'line',
  height,
}: {
  kind?: ChartSkeletonKind
  height?: string
} = {}): TemplateResult {
  const box = height ?? (kind === 'table' ? undefined : 'var(--chart-h-main)')
  return html`
    <div class="lintje-chart-skeleton lintje-chart-skeleton--${kind}"
         ${styleProps({ height: box })}
         role="status">
      <!-- In words, not only in a label: a status region is spoken from its content. -->
      <span class="visually-hidden">Gegevens laden…</span>
      ${
        kind === 'line' || kind === 'bar'
          ? html`
        <div class="lintje-chart-skeleton__y-labels">
          ${[0, 1, 2, 3].map(() => skeleton(24, 10))}
        </div>
        <div class="lintje-chart-skeleton__x-labels">
          ${[0, 1, 2].map(() => skeleton(32, 10))}
        </div>
        <div class="lintje-chart-skeleton__plot">
          ${skeleton('100%', '100%', 'lintje-chart-skeleton__fill')}
        </div>
      `
          : nothing
      }
      ${
        kind === 'pie' || kind === 'donut'
          ? html`
        <!-- Sized by the skeleton's own box, so it always fits beside its lines. -->
        ${skeleton('min(100cqh, 60cqw, 200px)', 'auto', 'lintje-chart-skeleton__disc')}
        <div class="lintje-chart-skeleton__lines">
          ${['80%', '64%', '48%'].map((width) => skeleton(width, 13))}
        </div>
      `
          : nothing
      }
      ${kind === 'heatmap' ? Array.from({ length: 35 }, () => skeleton('100%', '100%')) : nothing}
      ${
        kind === 'map'
          ? html`
        ${skeleton('100%', '100%', 'lintje-chart-skeleton__fill')}
        <div class="lintje-chart-skeleton__zoom" aria-hidden="true">
          ${ZOOM_CONTROLS.map(
            (control) => html`
            <span class="lintje-chart-skeleton__zoom-button">${chartIcon(control.name, control.text, 16, 'flip' in control ? control.flip : undefined)}</span>
          `,
          )}
        </div>
      `
          : nothing
      }
      ${
        kind === 'table'
          ? Array.from(
              { length: 5 },
              () => html`
        <div class="lintje-chart-skeleton__row">
          ${skeleton('32%')}
          ${skeleton('12%', 12, 'lintje-chart-skeleton__measure')}
          ${skeleton('12%')}
        </div>
      `,
            )
          : nothing
      }
    </div>
  `
}

/** Axes, grid and zero line stay; the message names the way out itself. */
export function renderChartEmpty(message: unknown, height = 'var(--chart-h-main)'): TemplateResult {
  return html`
    <div class="lintje-chart-state lintje-chart-state--empty" ${styleProps({ height })}>
      <p>${message}</p>
    </div>
  `
}

/** The error announcement for a component: `live: true`, so a screen reader speaks it. */
export function liveAnnouncement(message: unknown): TemplateResult {
  return html`<lintje-announcement
    compact
    .data=${{ kind: 'warning', text: String(message ?? ''), live: true }}
  ></lintje-announcement>`
}

/**
 * Error state: the announcement with the last known value, without "Opnieuw proberen". The
 * calling component defines the element; a host with its own announcement passes it in.
 */
export function renderChartError({
  message,
  lastKnown,
  height = 'var(--chart-h-main)',
  announcement = liveAnnouncement,
}: {
  message: unknown
  lastKnown?: unknown
  height?: string
  /** The host's own announcement; without one, `liveAnnouncement`. */
  announcement?: (message: unknown) => TemplateResult
}): TemplateResult {
  return html`
    <div class="lintje-chart-state lintje-chart-state--error" ${styleProps({ 'min-height': height })}>
      ${announcement(message)}
      ${lastKnown ? html`<div class="lintje-chart-state__last-known">${lastKnown}</div>` : nothing}
    </div>
  `
}
