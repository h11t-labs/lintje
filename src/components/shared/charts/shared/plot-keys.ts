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
  /** What the status region says instead of the tooltip read as one sentence. */
  sentence?: string
  side?: 'left'
  /** Where the tooltip ends when it does not fit right of `x` (`TooltipState.flip`). */
  flip?: number
}

/** What the drawing (the `<svg>`) takes, and its marks. */
export interface PlotKeys {
  keydown: (event: KeyboardEvent) => void
  focus: (event: FocusEvent) => void
  blur: () => void
  /**
   * The pointer on category `index`, or the focus on its mark (`now`): the keyboard's tooltip at
   * the keyboard's place, without the status. The pointer's follows to another category only
   * after a moment, so the pointer can reach it (`ChartController.pointTo`).
   */
  point: (event: Event, index: number, now?: boolean) => void
  /** The pointer left the marks. */
  leave: () => void
}

const NEXT = new Set(['ArrowRight', 'ArrowDown'])
const PREVIOUS = new Set(['ArrowLeft', 'ArrowUp'])

/** The tooltip's text as one sentence, for a screen reader. */
export function tooltipSentence(content: TooltipContent): string {
  const title = [content.kicker, content.note ? `${content.title} ${content.note}` : content.title]
    .filter(Boolean)
    .join(', ')
  const values = `${title}: ${content.rows
    .map((row) => `${row.label} ${row.value}${row.aside ? `, ${row.aside}` : ''}`.trim())
    .join(', ')}`
  const events = (content.events ?? []).map(
    (event) => `Gebeurtenis ${event.number}: ${event.label}`,
  )
  return [values, ...events].join('. ')
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
  /** The tooltip of `index` at its place; the keyboard's says it in the status region too. */
  const place = (drawing: Element, index: number, spoken: boolean): void => {
    const point = at(index)
    const anchor = drawing.closest('[data-tooltip-anchor]')
    const box = drawing.getBoundingClientRect()
    const origin = anchor?.getBoundingClientRect() ?? box
    controller.hoverIndex = index
    controller.status = spoken ? (point.sentence ?? tooltipSentence(point.content)) : ''
    const left = box.left - origin.left
    controller.showTooltipAt(
      left + point.x,
      box.top - origin.top + point.y,
      point.content,
      point.side ?? (point.flip != null ? left + point.flip : undefined),
    )
  }
  const show = (drawing: Element, index: number) => {
    controller.keyFrom = null
    place(drawing, index, true)
  }
  return {
    keydown(event) {
      // A mark inside the drawing has keys of its own.
      if (event.target !== event.currentTarget || count === 0) return
      // A place from before new data may lie past the end: then the last category is it.
      const from = controller.hoverIndex ?? controller.keyFrom
      const current = from == null ? -1 : Math.min(from, count - 1)
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
    point(event, index, now = false) {
      const target = event.currentTarget as Element
      const drawing = target.closest('svg') ?? target
      const go = () => place(drawing, index, false)
      if (now) go()
      else controller.pointTo(index, go)
    },
    leave() {
      controller.pointerLeft()
    },
    blur() {
      controller.keyFrom = null
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
