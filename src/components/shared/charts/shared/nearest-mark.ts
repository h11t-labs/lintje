/**
 * A tap beside a small mark: a drawn mark under the pointer answers itself, and elsewhere in the
 * plot the nearest clickable mark within half of `--h-target` does (WCAG 2.5.8), as the scatter
 * picks its nearest point. A thin bar, a thin part of a stack or a bar among many on a phone is
 * then a full target, without a neighbour's target covering it.
 */
import { nothing, svg, type SVGTemplateResult } from 'lit'
import { lengthPx } from '../../../../core/length'
import type { MarkAttributes } from './mark-select'
import type { PlotArea } from './scale'
import type { SvgSlot } from './axes'

/** A mark as drawn, in the drawing's own pixels. */
export interface MarkBox {
  x: number
  y: number
  width: number
  height: number
  mark: MarkAttributes | undefined
}

/** The clickable mark nearest to a point, by its distance to the box; `null` past `reach`. */
export function nearestMark(
  boxes: MarkBox[],
  px: number,
  py: number,
  reach: number,
): MarkAttributes | null {
  let nearest: MarkAttributes | null = null
  let distance = reach
  for (const box of boxes) {
    if (!box.mark?.clickable) continue
    const dx = Math.max(box.x - px, 0, px - (box.x + box.width))
    const dy = Math.max(box.y - py, 0, py - (box.y + box.height))
    const d = Math.hypot(dx, dy)
    if (d <= distance) {
      nearest = box.mark
      distance = d
    }
  }
  return nearest
}

/** A pointer's place in the drawing's own pixels, also while the svg is drawn at another size. */
function drawingPoint(
  group: SVGGElement,
  event: MouseEvent,
  area: PlotArea,
): { x: number; y: number } {
  const matrix = group.getScreenCTM?.()
  if (matrix) return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
  const box = group.ownerSVGElement?.getBoundingClientRect()
  const scale = box && box.width > 0 ? area.width / box.width : 1
  return {
    x: (event.clientX - (box?.left ?? 0)) * scale,
    y: (event.clientY - (box?.top ?? 0)) * scale,
  }
}

/**
 * The marks over a transparent hit area of the plot that sends a click beside them to the
 * nearest. Without a clickable mark the marks stay as they are.
 */
export function nearestHit(area: PlotArea, boxes: MarkBox[], marks: SvgSlot): SVGTemplateResult {
  if (!boxes.some((box) => box.mark?.clickable)) return svg`${marks}`
  const click = (event: MouseEvent) => {
    if ((event.target as Element).closest?.('[data-mark-id]')) return
    const group = event.currentTarget as SVGGElement
    const { x, y } = drawingPoint(group, event, area)
    const mark = nearestMark(boxes, x, y, lengthPx(group, '--h-target', 48) / 2)
    if (mark && mark.click !== nothing) mark.click(event)
  }
  return svg`<g @click=${click} @auxclick=${click}>
    <rect class="lintje-chart__hit" x=${area.left} y=${area.top}
          width=${Math.max(0, area.width - area.left - area.right)}
          height=${Math.max(0, area.height - area.top - area.bottom)} />
    ${marks}
  </g>`
}
