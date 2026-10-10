/**
 * `<lintje-map>` — a map in its tile. The map shows a new layer at once and expects the host
 * to confirm it in the next `data`. `tile.expandable` shows the same map again in the modal; the
 * modal's own events stop here.
 *
 * Events: `lintje-mark-select` `{id, label, href?}` (`href` is the one the server minted on that
 * mark) and `lintje-layer-change` (the chosen layer's `value`). Undoing a selection is
 * `lintje-mark-select` with `id: null` and `data.clearHref`, so a page that keeps the selection
 * in the URL can drop it.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { define, type FrameSettings } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { spanStyles } from '../../../primitives/shared/grid-item-element'
import { ChartController } from '../../shared/charts/shared/controller'
import { renderMap, type MapOptions } from '../../shared/charts/map-chart/map-chart'
import { mapDrawings, type MapDrawing } from '../../shared/charts/map-chart/drawings'
import {
  liveAnnouncement,
  renderChartEmpty,
  renderChartError,
  renderChartSkeleton,
} from '../../shared/charts/shared/chart-states'
import { chartStyles } from '../../shared/charts/shared/chart-styles'
import { mapStyles } from '../../shared/charts/map-chart/map-styles'
import { LintjeContentTileElement } from '../../shared/content-tile'
import { downloadCsv, downloadPng, type CsvCell } from '../../shared/download'
import { MediaController } from '../../../core/media'
import announcementCss from '../../feedback/announcement/announcement.css?inline'
import skeletonCss from '../../../primitives/skeleton/skeleton.css?inline'
import tileHostCss from '../../shared/view-tile.css?inline'
import '../../feedback/announcement/announcement'
import '../../../primitives/tile/tile'
import type { MapData } from '../../../types'

const DESKTOP_HEIGHT = 400
const MOBILE_HEIGHT = 220

export class LintjeMap extends LintjeContentTileElement {
  // `skeletonCss` carries `.lintje-skeleton`, the markup of `components/shared/charts/shared/chart-states.ts`.
  static override styles = [
    spanStyles,
    shadowCss(tileHostCss),
    shadowCss(skeletonCss),
    shadowCss(announcementCss),
    ...chartStyles,
    ...mapStyles,
  ]

  static override properties: PropertyDeclarations = {
    data: { attribute: false },
    layer: { state: true },
  }

  declare data?: MapData | null

  /** The chosen layer, shown before the host confirms it. */
  declare layer?: string

  readonly #map = new ChartController(() => this.requestUpdate())
  // A shared controller would share a hover between the tile's map and the modal's.
  #modalMap: ChartController | null = null
  readonly #mobile = new MediaController(this)
  #layerSeen: string | undefined = undefined

  protected override get dataSettings(): FrameSettings | undefined {
    return this.data ?? undefined
  }

  override disconnectedCallback(): void {
    this.#map.detach()
    this.#modalMap?.detach()
    this.#modalMap = null
    super.disconnectedCallback()
  }

  protected override expandChanged(open: boolean): void {
    if (open) {
      this.#modalMap ??= new ChartController(() => this.requestUpdate())
    } else {
      this.#modalMap?.detach()
      this.#modalMap = null
    }
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    // Watches `data.layer`, not the object: a `data` that changed for another reason must not
    // throw the reader back to the layer they switched away from.
    if (!changed.has('data')) return
    if (this.data?.layer !== this.#layerSeen) {
      this.#layerSeen = this.data?.layer
      this.layer = this.data?.layer
    }
  }

  private png(): void {
    // Both maps are light children of what they are slotted into; the tag says which one is shown.
    const scope = this.renderRoot.querySelector(this.expanded ? 'lintje-modal' : 'lintje-tile')
    const svg = scope?.querySelector<SVGSVGElement>('.lintje-map-chart__svg')
    if (svg) void downloadPng((this.data?.download || undefined)?.filename ?? 'kaart', svg)
  }

  private csv(): void {
    const data = this.data
    if (!data?.download) return
    const unit = data.unit ?? 'aantal'
    const drawings = mapDrawings(data, unit)
    // A stacked map names each row's layer in `Laag`. The header keeps the map's unit only while
    // every layer speaks it; a layer in another unit says its own after its name.
    const stacked = data.variant === 'plots'
    const shared = drawings.every((drawing) => drawing.unit === unit)
    const layerName = (drawing: MapDrawing): string =>
      shared || !drawing.unit ? drawing.name : `${drawing.name} (${drawing.unit})`
    const detailed = drawings.some((drawing) => drawing.values.some((value) => value.detail))
    downloadCsv(data.download.filename, [
      ['', shared ? unit : '', ...(stacked ? ['Laag'] : []), ...(detailed ? ['Toelichting'] : [])],
      ...drawings.flatMap((drawing) =>
        drawing.values.map((value): CsvCell[] => [
          value.label,
          value.value,
          ...(stacked ? [layerName(drawing)] : []),
          ...(detailed ? [value.detail] : []),
        ]),
      ),
    ])
  }

  protected override render(): TemplateResult | typeof nothing {
    const data = this.data
    if (!data) return nothing
    const ready = (data.state ?? 'ready') === 'ready'
    const subtitle =
      this.#mobile.matches && data.mobileSubtitle ? data.mobileSubtitle : data.subtitle
    const height = data.height ?? (this.#mobile.matches ? MOBILE_HEIGHT : DESKTOP_HEIGHT)

    return html`<lintje-tile
      id=${this.id ? `${this.id}-tile` : nothing}
      span=${data.span ?? nothing}
      heading=${data.title ?? nothing}
      icon=${data.icon ?? nothing}
      subtitle=${subtitle ?? nothing}
      intro=${data.intro ?? nothing}
      footnote=${data.footnote ?? nothing}
      ?legend-below=${Boolean(data.legendBelow)}
      ?expandable=${Boolean(data.expandable) && ready}
      ?download=${Boolean(data.download) && ready}
      @lintje-tile-expand=${(event: Event) => {
        event.stopPropagation()
        this.expand(true)
      }}
      @lintje-tile-download=${(event: Event) => {
        event.stopPropagation()
        this.csv()
      }}
    >
      ${
        data.notice
          ? html`<lintje-announcement slot="notice" compact .data=${data.notice}></lintje-announcement>`
          : nothing
      }
      ${this.content(`${height}px`)}
    </lintje-tile>

    ${this.renderExpandModal(
      this.expanded && this.#modalMap
        ? renderMap({ ...data, layer: this.layer }, this.mapOptions(this.#modalMap, true))
        : nothing,
      {
        heading: data.title,
        subtitle,
        footnote: data.footnote,
        csv: data.download ? () => this.csv() : undefined,
        // No PNG on a basemap: the only `<svg>` is the overlay, and the tiles come from another
        // origin, which taints a canvas anyway.
        png: data.basemap ? undefined : () => this.png(),
      },
    )}`
  }

  private content(height: string): TemplateResult {
    const data = this.data as MapData
    switch (data.state ?? 'ready') {
      case 'loading':
        return renderChartSkeleton({ kind: 'map', height })
      case 'empty':
        return renderChartEmpty(data.message, height)
      case 'error':
        return renderChartError({
          message: data.message,
          lastKnown: data.lastKnown,
          height,
          announcement: liveAnnouncement,
        })
      default:
        return renderMap({ ...data, layer: this.layer }, this.mapOptions(this.#map))
    }
  }

  /** Refocuses the chosen mark so clearing does not drop a keyboard user at the top; the map area
   * takes the focus when the mark is gone after a redraw. */
  private async focusMark(id: string): Promise<void> {
    await this.updateComplete
    const scope = this.renderRoot.querySelector(this.expanded ? 'lintje-modal' : 'lintje-tile')
    const mark = scope?.querySelector<SVGElement>(`[data-mark-id="${CSS.escape(id)}"]`)
    const target =
      mark ??
      scope?.querySelector<HTMLElement | SVGElement>('.lintje-map-chart__svg, .leaflet-container')
    // The map takes the focus from a script only; it does not join the tab order for it.
    if (target && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
    target?.focus()
  }

  private mapOptions(controller: ChartController, expanded = false): MapOptions {
    return {
      controller,
      description: this.data?.description,
      mobile: this.#mobile.matches,
      expanded,
      onSelect: ({ id, label, href }) => this.emit('lintje-mark-select', { id, label, href }),
      onClear: (previousId) => {
        // A selection kept in the URL is cleared by a URL change: `clearHref` undoes it.
        this.emit('lintje-mark-select', { id: null, label: null, href: this.data?.clearHref })
        void this.focusMark(previousId)
      },
      onLayerChange: (value) => {
        this.layer = value
        this.emit('lintje-layer-change', value)
      },
    }
  }
}

define('lintje-map', LintjeMap)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-map': LintjeMap
  }
}
