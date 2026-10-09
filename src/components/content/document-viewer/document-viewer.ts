/**
 * `<lintje-document-viewer>` — a document page by page: leaf, zoom and download.
 *
 * Shows images only: `.pages` is one URL per page, `src` a single image. The host renders a PDF
 * to page images; no PDF library is shipped. An image is no text: give each page's text in
 * `.texts` (same order), which a screen reader reads after the page. The file behind
 * "Downloaden" is the accessible version, so it is a tagged, accessible PDF, not a scan.
 *
 * `page` (from 1) and `zoom` (50–400 in steps of 25, or `fit`) are the element's; every change
 * is reported.
 *
 * Events: `lintje-page-change` (the page, from 1), `lintje-zoom-change` (a percentage or
 * `'fit'`), `lintje-download`.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { styleProps } from '../../../core/style-props'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import iconButtonCss from '../../../primitives/icon-button/icon-button.css?inline'
import '../../../primitives/button/button'
import '../../../primitives/skeleton/skeleton'
import '../../feedback/empty-state/empty-state'
import documentViewerCss from './document-viewer.css?inline'

export type ZoomLevel = number | 'fit'

export const ZOOM_MIN = 50
export const ZOOM_MAX = 400
export const ZOOM_STEP = 25

/** An attribute's zoom: `fit`, or a number clamped to 50–400. */
export function parseZoom(value: unknown): ZoomLevel {
  if (value === 'fit' || value === null || value === undefined || value === '') return 'fit'
  const number = Number(String(value).replace('%', ''))
  if (!Number.isFinite(number)) return 'fit'
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, number))
}

/** One zoom step: the next multiple of 25 inside 50–400; from `fit` it starts at `fitPercent`. */
export function stepZoom(zoom: ZoomLevel, direction: 1 | -1, fitPercent: number): number {
  const base = zoom === 'fit' ? fitPercent : zoom
  const next =
    direction > 0
      ? Math.floor(base / ZOOM_STEP) * ZOOM_STEP + ZOOM_STEP
      : Math.ceil(base / ZOOM_STEP) * ZOOM_STEP - ZOOM_STEP
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next))
}

/** The figure between the zoom buttons; at `fit` the measured percentage, empty before that. */
export function zoomLabel(zoom: ZoomLevel, fitPercent?: number): string {
  if (zoom !== 'fit') return `${zoom}%`
  return fitPercent ? `${fitPercent}%` : ''
}

export function clampPage(page: number, count: number): number {
  if (count <= 0 || !Number.isFinite(page)) return 1
  return Math.max(1, Math.min(count, Math.round(page)))
}

export function pageLabel(page: number, count: number): string {
  return `Pagina ${page} van ${Math.max(count, 1)}`
}

export class LintjeDocumentViewer extends LintjeElement {
  static override styles = [iconStyles, shadowCss(iconButtonCss), shadowCss(documentViewerCss)]

  static override properties: PropertyDeclarations = {
    pages: { attribute: false },
    texts: { attribute: false },
    src: { type: String },
    name: { type: String },
    page: { type: Number, reflect: true },
    zoom: {
      reflect: true,
      converter: { fromAttribute: parseZoom, toAttribute: (value: ZoomLevel) => String(value) },
    },
    loaded: { state: true },
    failed: { state: true },
    naturalWidth: { state: true },
    fitPercent: { state: true },
    said: { state: true },
  }

  /** One image URL per page: the host renders a PDF to these. */
  pages: string[] = []
  /** The text of each page, in the order of `.pages` (or of `src`): the pages' text alternative. */
  declare texts?: string[]
  /** A single image, when there is no `.pages`. */
  src: string = ''
  /** The file name: the toolbar's title and part of the page's accessible name. */
  name: string = ''
  page: number = 1
  zoom: ZoomLevel = 'fit'

  protected loaded: boolean = false
  protected failed: boolean = false
  protected naturalWidth: number = 0
  protected fitPercent: number = 100
  /** What a change of page or zoom says in the status region; empty until one is made. */
  protected said: string = ''

  private shown: string | null = null

  private get urls(): string[] {
    if (this.pages && this.pages.length > 0) return this.pages
    return this.src ? [this.src] : []
  }

  private get count(): number {
    return this.urls.length
  }

  private get url(): string {
    return this.urls[clampPage(this.page, this.count) - 1] ?? ''
  }

  private goTo(page: number): void {
    const next = clampPage(page, this.count)
    if (next === this.page) return
    this.page = next
    this.said = pageLabel(next, this.count)
    this.emit('lintje-page-change', next)
  }

  private setZoom(zoom: ZoomLevel): void {
    if (zoom === this.zoom) return
    this.zoom = zoom
    this.said = zoom === 'fit' ? 'Zoom passend' : `Zoom ${zoom}%`
    this.emit('lintje-zoom-change', zoom)
  }

  private zoomBy(direction: 1 | -1): void {
    this.setZoom(stepZoom(this.zoom, direction, this.fitPercent))
  }

  private download(): void {
    this.emit('lintje-download')
  }

  private measureFit(): void {
    const view = this.renderRoot.querySelector<HTMLElement>('.lintje-document-viewer__view')
    if (!view || !this.naturalWidth) return
    const style = getComputedStyle(view)
    const room =
      view.clientWidth -
      parseFloat(style.paddingLeft || '0') -
      parseFloat(style.paddingRight || '0')
    if (room > 0) this.fitPercent = Math.round((room / this.naturalWidth) * 100)
  }

  private onLoad(event: Event): void {
    const image = event.currentTarget as HTMLImageElement
    this.naturalWidth = image.naturalWidth
    this.loaded = true
    this.failed = false
    this.measureFit()
  }

  private onError(): void {
    this.failed = true
    this.loaded = false
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const target = event.composedPath()[0] as HTMLElement | undefined
    if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return
    if (this.scrollsItself(event)) return
    let handled = true
    switch (event.key) {
      case 'PageDown':
        this.goTo(this.page + 1)
        break
      case 'PageUp':
        this.goTo(this.page - 1)
        break
      case 'Home':
        this.goTo(1)
        break
      case 'End':
        this.goTo(this.count)
        break
      case '+':
      case '=':
        this.zoomBy(1)
        break
      case '-':
        this.zoomBy(-1)
        break
      default:
        handled = false
    }
    if (handled) event.preventDefault()
  }

  /** A zoomed page that can still scroll that way keeps the page keys for scrolling. */
  private scrollsItself(event: KeyboardEvent): boolean {
    const view = this.renderRoot.querySelector<HTMLElement>('.lintje-document-viewer__view')
    if (!view || !event.composedPath().includes(view)) return false
    const up = view.scrollTop > 0
    const down = view.scrollTop + view.clientHeight < view.scrollHeight - 1
    switch (event.key) {
      case 'PageUp':
      case 'Home':
        return up
      case 'PageDown':
      case 'End':
        return down
      default:
        return false
    }
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    // A zoom set as a property is clamped like an attribute, without an event.
    if (changed.has('zoom')) {
      const zoom = parseZoom(this.zoom)
      if (zoom !== this.zoom) this.zoom = zoom
    }
    // A page that is not there is clamped, without an event: nobody chose it.
    const page = clampPage(this.page, this.count)
    if (page !== this.page) this.page = page
    const url = this.url
    if (url !== this.shown) {
      this.shown = url
      this.loaded = false
      this.failed = false
    }
  }

  private renderButton(
    icon: string,
    label: string,
    onClick: () => void,
    options: { flip?: boolean; disabled?: boolean } = {},
  ): TemplateResult {
    // `aria-disabled`, not `disabled`: the last page takes "Volgende pagina" away from under
    // the focus otherwise.
    const disabled = options.disabled ?? false
    return html`<button
      type="button"
      class=${classMap({
        'lintje-icon-button': true,
        'lintje-icon-button--flat': true,
        'lintje-document-viewer__button': true,
        'is-disabled': disabled,
      })}
      aria-label=${label}
      title=${label}
      aria-disabled=${disabled ? 'true' : nothing}
      @click=${() => {
        if (!disabled) onClick()
      }}
    >
      ${renderIcon(icon, { size: 18, flip: options.flip ? 'horizontal' : undefined })}
    </button>`
  }

  private renderToolbar(): TemplateResult {
    const count = this.count
    const page = clampPage(this.page, count)
    const zoom = this.zoom
    const current = zoom === 'fit' ? this.fitPercent : zoom
    return html`<div class="lintje-document-viewer__toolbar" role="toolbar" aria-label="Document">
      <div class="lintje-document-viewer__name">${this.name}</div>
      <div class="lintje-document-viewer__group">
        ${this.renderButton(
          'functioneel-delta-rechts',
          'Vorige pagina',
          () => this.goTo(page - 1),
          {
            flip: true,
            disabled: page <= 1,
          },
        )}
        <span class="lintje-document-viewer__figure">${pageLabel(page, count)}</span>
        ${this.renderButton(
          'functioneel-delta-rechts',
          'Volgende pagina',
          () => this.goTo(page + 1),
          {
            disabled: page >= count,
          },
        )}
      </div>
      <div class="lintje-document-viewer__group">
        ${this.renderButton('functioneel-vergrootglas-minus', 'Uitzoomen', () => this.zoomBy(-1), {
          disabled: current <= ZOOM_MIN,
        })}
        <span class="lintje-document-viewer__figure lintje-document-viewer__zoom"
          >${zoomLabel(zoom, this.naturalWidth ? this.fitPercent : undefined)}</span
        >
        ${this.renderButton('functioneel-vergrootglas-plus', 'Inzoomen', () => this.zoomBy(1), {
          disabled: current >= ZOOM_MAX,
        })}
        <button
          type="button"
          class="lintje-icon-button lintje-icon-button--flat lintje-icon-button--text lintje-document-viewer__button"
          aria-pressed=${String(zoom === 'fit')}
          @click=${() => this.setZoom('fit')}
        >
          <span class="lintje-icon-button__label">Passend</span>
        </button>
        ${this.renderButton('functioneel-downloaden', 'Downloaden', () => this.download(), {
          disabled: count === 0,
        })}
      </div>
    </div>`
  }

  private renderPage(): TemplateResult {
    if (this.count === 0) {
      return html`<lintje-empty-state
        class="lintje-document-viewer__empty"
        icon="op-kantoor-document-blanco"
        heading="Er is geen document om te tonen"
      ></lintje-empty-state>`
    }
    if (this.failed) {
      return html`<lintje-empty-state
        class="lintje-document-viewer__failed"
        icon="op-kantoor-document-blanco"
        heading="Het document kan niet worden getoond"
        text="Download het bestand om het te bekijken."
      >
        <lintje-button
          variant="primary"
          icon="functioneel-downloaden"
          @click=${() => this.download()}
          >Downloaden</lintje-button
        >
      </lintje-empty-state>`
    }
    const count = this.count
    const page = clampPage(this.page, count)
    const url = this.url
    const zoom = this.zoom
    const width =
      zoom === 'fit' || !this.naturalWidth ? null : `${(this.naturalWidth * zoom) / 100}px`
    return html`${
      this.loaded
        ? nothing
        : html`<lintje-skeleton class="lintje-document-viewer__skeleton" height="auto"></lintje-skeleton>`
    }
      <div
        class=${classMap({
          'lintje-document-viewer__page': true,
          'is-fit': zoom === 'fit',
          'is-loading': !this.loaded,
        })}
        role="img"
        aria-label=${`${pageLabel(page, count)}${this.name ? ` van ${this.name}` : ''}`}
        ${styleProps({ width })}
      >
        ${
          url
            ? html`<img
                class="lintje-document-viewer__image"
                src=${url}
                alt=""
                @load=${this.onLoad}
                @error=${this.onError}
              />`
            : nothing
        }
      </div>
      ${
        this.texts?.[page - 1]
          ? html`<div class="visually-hidden lintje-document-viewer__text">
              ${this.texts[page - 1]}
            </div>`
          : nothing
      }`
  }

  protected override render(): TemplateResult {
    return html`<div class="lintje-document-viewer" @keydown=${this.onKeydown}>
      ${this.renderToolbar()}
      <span class="visually-hidden" role="status">${this.said}</span>
      <div
        class="lintje-document-viewer__view"
        role="region"
        tabindex="0"
        aria-label=${this.name || 'Document'}>
        ${this.renderPage()}
      </div>
    </div>`
  }
}

define('lintje-document-viewer', LintjeDocumentViewer)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-document-viewer': LintjeDocumentViewer
  }
}
