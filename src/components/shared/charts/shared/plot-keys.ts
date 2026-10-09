/**
 * The keyboard's way to the values a pointer reads from the tooltip: the drawing takes the
 * focus once, and the arrow keys walk its categories, the tooltip standing on the one reached
 * and a status region saying it. Home and End go to the ends.
 */
import { html, type TemplateResult } from 'lit'
import type { ChartController, TooltipContent } from './controller'

/** Where a category's tooltip stands, in the drawing's own px, and what it says. */
export interface PlotPoint {
  x: number
  y: number
  content: TooltipContent
}

/** What the drawing (the `<svg>`) takes. */
export interface PlotKeys {
  keydown: (event: KeyboardEvent) => void
  focus: (event: FocusEvent) => void
  blur: () => void
}

const NEXT = new Set(['ArrowRight', 'ArrowDown'])
const PREVIOUS = new Set(['ArrowLeft', 'ArrowUp'])

/** The tooltip's text as one sentence, for a screen reader. */
export function tooltipSentence(content: TooltipContent): string {
  return `${content.title}: ${content.rows.map((row) => `${row.label} ${row.value}`).join(', ')}`
}

/** A focus that came from a pointer shows nothing: the pointer has its own tooltip. */
function fromKeyboard(element: Element): boolean {
  try {
    return element.matches(':focus-visible')
  } catch {
    return true
  }
}

export function plotKeys(
  controller: ChartController,
  count: number,
  at: (index: number) => PlotPoint,
): PlotKeys {
  const show = (drawing: Element, index: number) => {
    const point = at(index)
    const anchor = drawing.closest('[data-tooltip-anchor]')
    const box = drawing.getBoundingClientRect()
    const origin = anchor?.getBoundingClientRect() ?? box
    controller.hoverIndex = index
    controller.status = tooltipSentence(point.content)
    controller.showTooltipAt(
      box.left - origin.left + point.x,
      box.top - origin.top + point.y,
      point.content,
    )
  }
  return {
    keydown(event) {
      // A mark inside the drawing has keys of its own.
      if (event.target !== event.currentTarget || count === 0) return
      const current = controller.hoverIndex ?? -1
      let index: number
      if (NEXT.has(event.key)) index = Math.min(count - 1, current + 1)
      else if (PREVIOUS.has(event.key)) index = Math.max(0, current - 1)
      else if (event.key === 'Home') index = 0
      else if (event.key === 'End') index = count - 1
      else return
      event.preventDefault()
      show(event.currentTarget as Element, index)
    },
    focus(event) {
      const drawing = event.currentTarget as Element
      if (event.target !== drawing || count === 0 || !fromKeyboard(drawing)) return
      show(drawing, Math.min(controller.hoverIndex ?? 0, count - 1))
    },
    blur() {
      if (controller.hoverIndex == null && !controller.status) return
      controller.hoverIndex = null
      controller.status = ''
      controller.hideTooltip()
      controller.requestUpdate()
    },
  }
}

/** The status region the keyboard's tooltip is spoken from; always there, so a change speaks. */
export function renderPlotStatus(controller: ChartController): TemplateResult {
  return html`<p class="visually-hidden" role="status">${controller.status}</p>`
}
