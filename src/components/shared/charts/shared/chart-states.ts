/**
 * The loading skeleton in the shape of the chart. Empty and error are the tile's: it draws them
 * with the shared blocks. The skeleton writes the markup of `lintje-skeleton`, not its CSS.
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

/**
 * Loading skeleton in the shape of the chart, exactly `height` tall so the tile keeps its size.
 * Inside a tile's `loading` slot the tile's region speaks (`status: false`); on its own it is
 * the region, in words.
 */
export function renderChartSkeleton({
  kind = 'line',
  height,
  status = true,
}: {
  kind?: ChartSkeletonKind
  height?: string
  status?: boolean
} = {}): TemplateResult {
  const box = height ?? (kind === 'table' ? undefined : 'var(--chart-h-main)')
  return html`
    <div class="lintje-chart-skeleton lintje-chart-skeleton--${kind}"
         ${styleProps({ height: box })}
         role=${status ? 'status' : nothing}
         aria-hidden=${status ? nothing : 'true'}>
      <!-- In words, not only in a label: a status region is spoken from its content. -->
      ${status ? html`<span class="visually-hidden">Gegevens laden…</span>` : nothing}
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
