/**
 * The map: its chrome — the legend above it, the layer switcher, the zoom buttons, the select
 * button with its menu of tools, the scale and the selection panel — around the surface that
 * draws it (`leaflet.ts`).
 */
import { html, nothing, type TemplateResult } from 'lit'
import { ref } from 'lit/directives/ref.js'
import { keyed } from 'lit/directives/keyed.js'
import { styleProps } from '../../../../core/style-props'
import { formatNumber } from '../../../../core/format'
import { chartIcon, ZOOM_CONTROLS } from '../shared/chart-icons'
import { renderIcon } from '../../../../icons/render'
import { renderTooltip } from '../shared/tooltip'
import { LeafletSurface } from './leaflet'
import { seriesColor } from '../shared/colors'
import { markPath } from '../shared/series-shapes'
import { nextRow, type MenuItem } from '../../../actions/menu-button/menu-button'
import type { ChartController, ChartOptions } from '../shared/controller'
import { mapDrawings, withUnit, type MapDrawing } from './drawings'
import { seriesKey } from './marks'
import { renderMapLegend } from './map-legend'
import type { MapArea, MapControls, MapSpec, MapTool, MapValue } from '../shared/types'
import { idsInArea, isRect } from './area'
import '../../../../primitives/popover/popover'

/** The map's own height in a tile: on a phone taller, so all its buttons fit on the touch size. */
export const MAP_HEIGHT = { desktop: 400, mobile: 280 } as const

const DEFAULT_CONTROLS: Required<MapControls> = {
  zoom: true,
  wheel: true,
  drag: true,
  reset: true,
  lasso: false,
  circle: false,
  rect: false,
  scale: true,
  legend: true,
}

/** The drawing tools under the zoom buttons, in the order the menu lists them. */
const AREA_TOOLS: { tool: MapTool; name: string; text: string; label: string }[] = [
  { tool: 'lasso', name: 'functioneel-lasso', text: 'Lasso', label: 'Selecteer met een lasso' },
  {
    tool: 'circle',
    name: 'functioneel-cirkelselectie',
    text: 'Cirkel',
    label: 'Selecteer met een cirkel',
  },
  {
    tool: 'rect',
    name: 'functioneel-rechthoekselectie',
    text: 'Rechthoek',
    label: 'Selecteer met een rechthoek',
  },
]

/** How to draw with a tool, under the map; a phone gets the short form, for a finger. */
const TOOL_HINTS: Record<MapTool, { full: string; short: string }> = {
  lasso: {
    full: 'Sleep om te kiezen, of klik de hoeken · Escape stopt',
    short: 'Sleep om te kiezen',
  },
  circle: {
    full: 'Sleep vanuit het midden, of klik het midden en dan de rand · Escape stopt',
    short: 'Sleep vanuit het midden',
  },
  rect: {
    full: 'Sleep van hoek naar hoek, of klik twee hoeken · Escape stopt',
    short: 'Sleep van hoek naar hoek',
  },
}

/* --- The wheel ---------------------------------------------------------------- */

/** Wheel pixels per doubling of the zoom: a mouse notch is about a hundred, a pinch far less. */
const WHEEL_PX_PER_DOUBLING = 200
const HINT_MS = 1500

/** A pinch on a trackpad arrives as a wheel with Ctrl, on every platform. */
function zoomsWith(event: WheelEvent): boolean {
  return event.ctrlKey || event.metaKey
}

/** Doublings of the zoom a wheel asks for; lines and pages are turned into pixels. */
function wheelDoublings(event: WheelEvent): number {
  const pixels =
    event.deltaMode === 1
      ? event.deltaY * 16
      : event.deltaMode === 2
        ? event.deltaY * 400
        : event.deltaY
  return -pixels / WHEEL_PX_PER_DOUBLING
}

function hintText(): string {
  const platform = (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform
  const mac = /mac|iphone|ipad/i.test(platform ?? navigator.platform)
  return `Gebruik ${mac ? '⌘' : 'Ctrl'} + scrollen om te zoomen`
}

/** The hint, for a moment; another wheel keeps it. */
function showHint(controller: ChartController): void {
  controller.mapHint = hintText()
  if (controller.mapHintTimer) clearTimeout(controller.mapHintTimer)
  controller.mapHintTimer = setTimeout(() => {
    controller.mapHint = null
    controller.mapHintTimer = null
    controller.requestUpdate()
  }, HINT_MS)
  controller.requestUpdate()
}

/* --- The scale ---------------------------------------------------------------- */

/** The distance of the scale, in m or km: the figure beside the bracket. */
export function scaleLabel(metres: number): string {
  const km = metres >= 1000
  const value = km ? metres / 1000 : metres
  return `${formatNumber(value, Number.isInteger(value) ? 0 : 1)} ${km ? 'km' : 'm'}`
}

/* --- The map ------------------------------------------------------------------ */

/**
 * What the map sends back. `description` and `selectedId` come from the map's own data, so
 * the chart options of those names are omitted.
 */
export interface MapOptions extends Omit<ChartOptions, 'description' | 'onSelect' | 'selectedId'> {
  description?: string
  /** An area or point was clicked; the whole mark travels, as the panel needs its figure. */
  onSelect?: (mark: MapValue) => void
  /** The selection was undone (chosen mark again, empty map, Escape, close); travels the id. */
  onClear?: (previousId: string) => void
  onLayerChange?: (value: string) => void
  /** An area was drawn, or undone (`null`); travels the ids of every mark in it. */
  onArea?: (area: MapArea | null, ids: string[]) => void
}

/** What a drawn area is called in its panel. */
function areaWords(area: MapArea): string {
  if (area.kind === 'circle')
    return `binnen ${formatNumber(Math.round(area.radiusKm * 10) / 10)} km`
  return isRect(area.ring) ? 'binnen de rechthoek' : 'binnen de getekende lijn'
}

export function renderMap(data: MapSpec, options: MapOptions): TemplateResult {
  const {
    controller,
    description = data.description,
    mobile = false,
    onSelect,
    onClear,
    onLayerChange,
    onArea,
  } = options
  const {
    unit = 'aantal',
    selectedId = null,
    selectedArea = null,
    layers,
    layer,
    basemap,
    selectLabel = 'Zet als bereik',
  } = data
  const expanded = Boolean(options.expanded)
  const controls: Required<MapControls> = { ...DEFAULT_CONTROLS, ...data.controls }
  const tools = AREA_TOOLS.filter((tool) => controls[tool.tool])
  // A tool switched off by the host cannot stay on, nor stand on the button.
  if (controller.mapTool && !controls[controller.mapTool]) controller.mapTool = null
  if (controller.mapLastTool && !controls[controller.mapLastTool]) controller.mapLastTool = null

  // In the tile the map picks its own height; in the modal it takes the body's. Below 768 px
  // the modal is full screen and its token is a drawing height, so `fit` is off.
  controller.measure(expanded ? { width: true, height: '--chart-h-main', fit: !mobile } : {})
  const areaHeight = expanded
    ? controller.height
    : (options.height ?? data.height ?? (mobile ? MAP_HEIGHT.mobile : MAP_HEIGHT.desktop))

  // A one-variant map is a stack of one. Each drawing scales to its own figures and speaks its
  // own unit; the ids are unique across the stack, so one selection serves all of it.
  const drawings = mapDrawings(data, unit)

  // The host's `selectedId` is adopted once; after that the map owns its selection.
  if (controller.hostSelection !== selectedId) {
    controller.hostSelection = selectedId
    controller.mapSelection = selectedId
  }
  // The host's area is adopted as its `selectedId` is: when it changes.
  const hostArea = JSON.stringify(selectedArea)
  if (controller.hostArea !== hostArea) {
    controller.hostArea = hostArea
    controller.mapArea = selectedArea
  }
  const area = tools.length > 0 ? controller.mapArea : null
  const chosen = area ? idsInArea(area, drawings, data.geo) : []
  const active = controller.mapSelection
  const byId = new Map<string, MapValue>()
  const drawingOf = new Map<string, MapDrawing>()
  for (const drawing of drawings)
    for (const value of drawing.values) {
      byId.set(value.id, value)
      drawingOf.set(value.id, drawing)
    }
  const selection = active ? byId.get(active) : undefined
  const selectionDrawing = selection ? drawingOf.get(selection.id) : undefined
  const seriesLabelOf = (value: MapValue) =>
    (value.series && drawingOf.get(value.id)?.seriesLabels?.[value.series]) || undefined

  // The legend switches a layer and a series of a layer; what it switched off is not drawn. A
  // series is keyed by its layer: a colour may serve several layers.
  const hiddenLayers = controller.hiddenLayers
  const hidden = controller.hiddenSeries

  const clear = () => {
    const previous = controller.mapSelection
    if (previous == null) return
    controller.mapSelection = null
    onClear?.(previous)
    controller.requestUpdate()
  }
  // A drawn area stays until it is dismissed: its panel's close, Escape or the reset.
  const clearArea = () => {
    if (!controller.mapArea) return
    controller.mapArea = null
    onArea?.(null, [])
    controller.requestUpdate()
  }
  const select = (value: MapValue) => {
    if (value.id === active) return clear()
    controller.mapSelection = value.id
    onSelect?.(value)
    controller.requestUpdate()
  }
  // A shape is a tool: it stays in hand after drawing, and a new area replaces the last.
  const drawn = (next: MapArea) => {
    controller.mapArea = next
    onArea?.(next, idsInArea(next, drawings, data.geo))
    controller.requestUpdate()
  }
  const setTool = (tool: MapTool | null) => {
    controller.mapTool = tool
    if (tool) controller.mapLastTool = tool
    controller.requestUpdate()
  }
  // A series or a layer switched off takes its chosen mark with it: the selection goes, as the
  // mark did.
  if (
    selection &&
    selectionDrawing &&
    ((selection.series && hidden.includes(seriesKey(selectionDrawing, selection.series))) ||
      hiddenLayers.includes(selectionDrawing.index))
  ) {
    clear()
    return renderMap(data, options)
  }

  // The surface lives on the controller so it survives a render.
  const leaflet = (controller.leaflet ??= new LeafletSurface(controller))
  leaflet.sync(data, {
    unit,
    active,
    hidden,
    hiddenLayers,
    area,
    chosen,
    tool: controller.mapTool,
    drag: controls.drag,
    zoom: controls.zoom,
    scale: controls.scale,
    drawn,
    stopTool: () => setTool(null),
    select,
    clear,
    mobile,
  })

  const buttons = ZOOM_CONTROLS.filter((control) =>
    control.action === 'home' ? controls.reset : controls.zoom,
  )
  const scale = controls.scale ? leaflet.scaleBar() : null
  const onZoom = (action: (typeof ZOOM_CONTROLS)[number]['action']) => {
    if (action === 'in') leaflet.zoomIn()
    else if (action === 'out') leaflet.zoomOut()
    else {
      // The reset: the whole area in view, and nothing chosen, drawn or being drawn.
      controller.mapTool = null
      clear()
      clearArea()
      leaflet.home()
    }
  }

  /* --- The tools: one button, or a split button with the menu of them ------------- */

  const menuId = `${controller.id}-tools`
  // The shape the button draws with: the one that is on, else the last one used, else the first.
  const shown = AREA_TOOLS.find(
    (tool) => tool.tool === (controller.mapTool ?? controller.mapLastTool ?? tools[0]?.tool),
  )
  // The menu's rows: one of a choice, the shape on the button checked.
  const rows: MenuItem[] = tools.map((tool) => ({
    value: tool.tool,
    label: tool.text,
    icon: tool.name,
    checked: shown?.tool === tool.tool,
    radio: true,
  }))
  const openMenu = (open: boolean, focus: 'first' | 'last' | 'checked' | null = 'first') => {
    controller.mapMenuOpen = open
    controller.mapMenuFocus = open ? focus : null
    controller.requestUpdate()
  }
  const trigger = () =>
    controller.element?.querySelector<HTMLButtonElement>('.lintje-map-chart__tool')
  const closeMenu = (returnFocus: boolean) => {
    openMenu(false, null)
    if (returnFocus) trigger()?.focus()
  }
  const menuRows = (menu: Element) => [...menu.querySelectorAll<HTMLElement>('.lintje-menu__row')]
  const onMenuKeydown = (event: KeyboardEvent) => {
    const menu = event.currentTarget as Element
    const elements = menuRows(menu)
    const focused = (menu.getRootNode() as Document | ShadowRoot).activeElement
    const current = elements.findIndex((row) => row === focused)
    const focus = (index: number) => {
      if (index >= 0) elements[index]?.focus()
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        return focus(nextRow(rows, current, 1))
      case 'ArrowUp':
        event.preventDefault()
        return focus(nextRow(rows, current < 0 ? rows.length : current, -1))
      case 'Home':
        event.preventDefault()
        return focus(nextRow(rows, -1, 1))
      case 'End':
        event.preventDefault()
        return focus(nextRow(rows, rows.length, -1))
      case 'Tab':
        // Tab goes on from the button, past the menu that stands after it.
        if (!event.shiftKey) trigger()?.focus()
        return closeMenu(false)
      default:
        return
    }
  }
  // The rows are the popover's slotted content: the first takes the focus once it has drawn.
  const focusMenu = (menu: Element | undefined) => {
    const focus = controller.mapMenuFocus
    if (!menu || !focus) return
    controller.mapMenuFocus = null
    const popover = menu.closest('lintje-popover')
    void (popover?.updateComplete ?? Promise.resolve()).then(() => {
      const elements = menuRows(menu)
      const index =
        focus === 'first'
          ? 0
          : focus === 'last'
            ? elements.length - 1
            : Math.max(
                0,
                elements.findIndex((row) => row.getAttribute('aria-checked') === 'true'),
              )
      elements[index]?.focus()
    })
  }
  // A shape chosen in the menu goes on at once; the button switches it off again.
  const chooseTool = (tool: MapTool) => {
    closeMenu(true)
    setTool(tool)
  }
  // A press held on the button opens the menu instead of switching the shape: the timer runs
  // from the press, and the click that ends a held press is not a click.
  const renderTools = () => {
    if (tools.length === 0 || !shown) return nothing
    const first = buttons.length > 0 ? 'lintje-map-chart__tip--first' : ''
    const on = controller.mapTool === shown.tool
    const menu = tools.length > 1
    const open = controller.mapMenuOpen
    // One shape: a button that switches it on and off. More: a select button whose corner says a
    // menu stands behind it; a click opens the menu, the shape used last checked and focused.
    // With a shape in hand the button shows it, and a click puts it down.
    const label = on ? 'Stop met selecteren' : menu ? 'Selecteren' : shown.label
    // Keyed by its name: the icon is drawn anew when the shape changes, and grows in.
    const name = on || !menu ? shown.name : 'functioneel-selectie'
    const icon = keyed(
      name,
      html`<span class="lintje-map-chart__tool-icon">${chartIcon(name, on || !menu ? shown.text : 'Kies')}</span>`,
    )
    return html`
      <lintje-tooltip class="lintje-map-chart__tip ${first}" text=${label} placement="left" no-describe>
        <button type="button"
                class="lintje-map-chart__zoom-button lintje-map-chart__tool ${menu ? 'lintje-map-chart__tool--menu' : ''} ${on ? 'is-active' : ''}"
                aria-label=${label} aria-pressed=${on}
                aria-haspopup=${menu && !on ? 'menu' : nothing} aria-expanded=${menu && !on ? String(open) : nothing}
                aria-controls=${menu && !on ? menuId : nothing}
                @click=${() => {
                  if (on) setTool(null)
                  else if (menu) openMenu(!open, 'checked')
                  else setTool(shown.tool)
                }}
                @keydown=${(event: KeyboardEvent) => {
                  if (!menu || on || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return
                  event.preventDefault()
                  openMenu(true, event.key === 'ArrowDown' ? 'first' : 'last')
                }}>${icon}</button>
      </lintje-tooltip>
      ${menu ? renderMenu(open) : nothing}
    `
  }
  const renderMenu = (open: boolean) => html`
      <lintje-popover id=${menuId} panel-role="menu" label="Andere vorm" placement="left-start" ?open=${open}
                      @lintje-close=${(event: CustomEvent<{ reason: string }>) => {
                        event.stopPropagation()
                        closeMenu(event.detail?.reason === 'escape')
                      }}>
        ${
          open
            ? html`<div class="lintje-menu lintje-map-chart__menu" ${ref(focusMenu)} @keydown=${onMenuKeydown}>
            ${rows.map(
              (row) => html`
              <button type="button" class="lintje-menu__row focus-inset" role="menuitemradio" tabindex="-1"
                      aria-checked=${String(row.checked)}
                      @click=${() => chooseTool(row.value as MapTool)}>
                ${renderIcon(row.icon, { size: 16, className: 'lintje-menu__icon' })}
                <span class="lintje-menu__label">${row.label}</span>
                ${row.checked ? renderIcon('functioneel-vinkje', { size: 16, className: 'lintje-menu__check' }) : nothing}
              </button>`,
            )}
          </div>`
            : nothing
        }
      </lintje-popover>
  `

  /* --- The panel: what was chosen, a mark or an area ------------------------------ */

  const renderPanel = () => {
    const below = mobile ? 'lintje-map-chart__selection--below' : ''
    if (selection)
      return html`
        <div class="lintje-map-chart__selection ${below}">
          <span class="lintje-map-chart__selection-title">Geselecteerd</span>
          <!-- The way out of a selection that is always there, for mouse and
               keyboard alike; the focus goes back to the mark it had. -->
          <button type="button" class="lintje-map-chart__selection-close"
                  aria-label="Selectie opheffen"
                  @click=${() => clear()}>${renderIcon('functioneel-kruis', { size: 14 })}</button>
          <b>${selection.label}</b>
          ${
            seriesLabelOf(selection)
              ? html`<span class="lintje-map-chart__selection-series">
                <svg class="lintje-map-chart__series-swatch" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
                  <path d=${markPath(selection.series, 5.5, 7, 7)} fill=${seriesColor(selection.series) ?? 'currentColor'} />
                </svg>${seriesLabelOf(selection)}
              </span>`
              : nothing
          }
          <span class="lintje-map-chart__selection-value">
            ${selection.value == null ? 'geen gegevens' : withUnit(formatNumber(selection.value), selectionDrawing?.unit ?? unit)}${selection.detail ? ` · ${selection.detail}` : ''}
          </span>
          <!-- Only when the mark carries a URL the host minted: without one
               the link had nowhere to go and did nothing. -->
          ${
            onSelect && selection.href
              ? html`
            <button type="button" class="lintje-map-chart__set-scope"
                    @click=${() => onSelect(selection)}>
              ${selectLabel} ${renderIcon('functioneel-locatiemarker', { size: 14 })}
            </button>
          `
              : nothing
          }
        </div>
      `
    if (area)
      return html`
        <div class="lintje-map-chart__selection ${below}">
          <span class="lintje-map-chart__selection-title">Geselecteerd</span>
          <button type="button" class="lintje-map-chart__selection-close"
                  aria-label="Selectie opheffen"
                  @click=${() => clearArea()}>${renderIcon('functioneel-kruis', { size: 14 })}</button>
          <b>${chosen.length === 0 ? 'Niets' : chosen.length === 1 ? '1 op de kaart' : `${formatNumber(chosen.length)} op de kaart`}</b>
          <span class="lintje-map-chart__selection-value">${areaWords(area)}</span>
        </div>
      `
    return nothing
  }

  const hint = controller.mapHint
    ? controller.mapHint
    : controller.mapTool
      ? TOOL_HINTS[controller.mapTool][mobile ? 'short' : 'full']
      : null

  return html`
    <div class="lintje-map-chart ${mobile ? 'lintje-map-chart--mobile' : ''} ${basemap ? 'lintje-map-chart--basemap' : ''}"
         ${ref(controller.attach)} ?data-in-view=${controller.inView}
         @keydown=${(event: KeyboardEvent) => {
           if (event.key !== 'Escape') return
           // Escape undoes one thing: the tool, then the chosen mark, then the area.
           if (controller.mapTool) controller.mapTool = null
           else if (active) clear()
           else if (area) clearArea()
           else return
           event.stopPropagation()
           controller.requestUpdate()
         }}>
      ${
        controls.legend
          ? renderMapLegend({
              drawings,
              hiddenLayers,
              hiddenSeries: hidden,
              expanded,
              mobile,
              open: controller.mapLegendOpen,
              onLayer: (index) => controller.toggleLayer(index),
              onSeries: (key) => controller.toggleSeries(key),
              onOpen: (open) => {
                controller.mapLegendOpen = open
                controller.requestUpdate()
              },
            })
          : nothing
      }
      <div class="lintje-map-chart__area" ${styleProps({ height: `${areaHeight}px` })} data-tooltip-anchor
           @wheel=${{
             handleEvent: (event: WheelEvent) => {
               if (!controls.wheel) return
               if (!zoomsWith(event)) return showHint(controller)
               event.preventDefault()
               leaflet.zoomBy(event, wheelDoublings(event))
             },
             passive: false,
           }}>
        <p class="visually-hidden">${description}</p>
        <div class="lintje-map-chart__leaflet" ${ref(leaflet.attach)}></div>
        ${renderTooltip(controller)}

        <!-- Layer switcher top left. -->
        ${
          layers && layers.length > 1
            ? html`
          <div class="lintje-map-chart__layers" role="group" aria-label="Kaartlaag">
            ${layers.map(
              (item) => html`
              <button type="button"
                      class="lintje-map-chart__layer ${item.value === layer ? 'is-active' : ''}"
                      aria-pressed=${item.value === layer}
                      @click=${() => onLayerChange?.(item.value)}>${item.label}</button>
            `,
            )}
          </div>
        `
            : nothing
        }

        ${hint ? html`<p class="lintje-map-chart__hint" role="status">${hint}</p>` : nothing}

        <!-- Zoom, reset and the drawing tools top right, those the host keeps. -->
        ${
          buttons.length + tools.length > 0
            ? html`
        <div class="lintje-map-chart__zoom">
          ${buttons.map(
            (control) => html`
            <lintje-tooltip class="lintje-map-chart__tip" text=${control.label} placement="left" no-describe>
              <button type="button" class="lintje-map-chart__zoom-button" aria-label=${control.label}
                      @click=${() => onZoom(control.action)}>${chartIcon(control.name, control.text, 16, 'flip' in control ? control.flip : undefined)}</button>
            </lintje-tooltip>
          `,
          )}
          ${renderTools()}
        </div>
        `
            : nothing
        }

        <!-- The scale bottom right: a round distance, and a bracket as long as it on the map. -->
        ${
          scale
            ? html`<div class="lintje-map-chart__scale-bar" aria-hidden="true">
          <span>${scaleLabel(scale.metres)}</span>
          <span class="lintje-map-chart__scale-line" ${styleProps({ width: `${scale.width}px` })}></span>
        </div>`
            : nothing
        }

        <!-- What was chosen, bottom left; on a phone under the map. -->
        ${mobile ? nothing : renderPanel()}
      </div>
      ${mobile ? renderPanel() : nothing}
    </div>
  `
}
