/**
 * The map's CSS for a host that renders into a shadow root: `[...chartStyles, ...mapStyles]`.
 * Kept apart from `chart-styles.ts` so a page without a map carries no Leaflet.
 */
import { unsafeCSS, type CSSResult } from 'lit'
import { iconStyles } from '../../../../icons/render'
import map from './map-chart.css?inline'
import leaflet from './leaflet.css?inline'
import leafletVendor from 'leaflet/dist/leaflet.css?raw'

/**
 * Leaflet's stylesheet without the three rules that reference its image files (unused here).
 * `?raw` and not `?inline`: `?inline` rewrites `url(images/…)` into ~4.6 kB of base64 that
 * would travel in every bundle.
 */
function withoutImages(css: string): string {
  return css.replace(/[^{}]*\{[^{}]*url\(images\/[^{}]*\}/g, '')
}

export const mapChartStyles: CSSResult = unsafeCSS(map)

/** `iconStyles` closes the list: Lit keeps the last place of a sheet named twice. */
export const mapStyles: CSSResult[] = [
  mapChartStyles,
  unsafeCSS(withoutImages(leafletVendor)),
  unsafeCSS(leaflet),
  iconStyles,
]
