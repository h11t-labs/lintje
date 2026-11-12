/**
 * The height a chart measures for itself (`npm test`), and how the pointer's tooltip waits.
 *
 * The arithmetic only: a chart element that reports a height and a token, and
 * what the controller makes of it. `fit` is the difference between the two
 * places the same chart is drawn — in a tile the token is the drawing's height,
 * in the expand modal it is the body's inner height and the legend, the axis
 * title and any border have to come off it first.
 *
 * happy-dom lays nothing out, so the element's box is stubbed: it is the number
 * the controller reads, not a rendering, that is under test.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChartController, headingFor, POINTER_GRACE } from './controller'

/** An element that is `height` px tall and carries `--chart-h-main`. */
function chartElement(height: number, token: string): HTMLElement {
  const element = document.createElement('div')
  element.getBoundingClientRect = (() => ({ width: 800, height })) as never
  element.style.setProperty('--chart-h-main', token)
  document.body.append(element)
  return element
}

describe('ChartController height', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    // happy-dom's ResizeObserver is not what is tested; the controller only has
    // to survive installing one.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    )
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        disconnect() {}
      },
    )
  })

  it('takes the token as the drawing height without fit', () => {
    const controller = new ChartController(() => {})
    controller.measure({ width: true, height: '--chart-h-main' })
    // 40 px of legend on top of a 300 px drawing; the tile grows with it.
    controller.attach(chartElement(340, '300px'))
    expect(controller.height).toBe(300)
  })

  it('gives the legend and the axis title back to the body with fit', () => {
    const controller = new ChartController(() => {})
    controller.measure({ width: true, height: '--chart-h-main', fit: true })
    // The element stands 340 px tall while it was last told to draw 300: the
    // 40 px around the drawing are what the token has to lose.
    const element = chartElement(340, '600px')
    controller.height = 300
    controller.attach(element)
    expect(controller.height).toBe(560)
  })

  it('settles: a second read finds the same extras and asks for nothing', () => {
    const controller = new ChartController(() => {})
    controller.measure({ width: true, height: '--chart-h-main', fit: true })
    const element = chartElement(340, '600px')
    controller.height = 300
    controller.attach(element)
    // The chart has been drawn at 560 and the element is now the whole 600: the
    // next read (the ResizeObserver's) finds the same 40 px around it.
    element.getBoundingClientRect = (() => ({ width: 800, height: 600 })) as never
    controller.detach()
    controller.attach(element)
    expect(controller.height).toBe(560)
  })

  it('never shrinks the drawing below its floor', () => {
    const controller = new ChartController(() => {})
    controller.measure({ width: true, height: '--chart-h-main', fit: true })
    const element = chartElement(400, '200px')
    controller.height = 100
    controller.attach(element)
    expect(controller.height).toBe(120)
  })
})

describe('ChartController and the pointer', () => {
  const content = (title: string) => ({ title, rows: [] })
  const shown = (controller: ChartController) => controller.tooltip?.content.title

  function pointer() {
    const controller = new ChartController(() => {})
    const show = (title: string) => () => controller.showTooltipAt(0, 0, content(title))
    return { controller, show }
  }

  it('shows the first mark at once, and keeps it while the pointer crosses a neighbour', () => {
    vi.useFakeTimers()
    const { controller, show } = pointer()
    controller.pointTo(1, show('di'))
    expect(shown(controller)).toBe('di')
    // On its way to the tooltip the pointer crosses Wednesday, then reaches the tooltip.
    controller.pointTo(2, show('wo'))
    expect(shown(controller)).toBe('di')
    controller.enterTooltip()
    vi.advanceTimersByTime(POINTER_GRACE * 2)
    expect(shown(controller)).toBe('di')
    vi.useRealTimers()
  })

  it('follows a pointer that rests on another mark', () => {
    vi.useFakeTimers()
    const { controller, show } = pointer()
    controller.pointTo(1, show('di'))
    controller.pointTo(2, show('wo'))
    vi.advanceTimersByTime(POINTER_GRACE)
    expect(shown(controller)).toBe('wo')
    vi.useRealTimers()
  })

  it('lets the wait run out while the pointer keeps moving over the same mark', () => {
    vi.useFakeTimers()
    const { controller } = pointer()
    const shows: string[] = []
    const show = (title: string) => () => {
      shows.push(title)
      controller.showTooltipAt(0, 0, content(title))
    }
    controller.pointTo(1, show('di'))
    // A mousemove every frame over Wednesday.
    for (let time = 0; time < POINTER_GRACE - 16; time += 16) {
      controller.pointTo(2, show('wo'))
      vi.advanceTimersByTime(16)
    }
    expect(shown(controller)).toBe('di')
    vi.advanceTimersByTime(16)
    expect(shown(controller)).toBe('wo')
    expect(shows).toEqual(['di', 'wo'])
    vi.useRealTimers()
  })

  it('starts the wait again for yet another mark', () => {
    vi.useFakeTimers()
    const { controller, show } = pointer()
    controller.pointTo(1, show('di'))
    controller.pointTo(2, show('wo'))
    vi.advanceTimersByTime(POINTER_GRACE - 50)
    controller.pointTo(3, show('do'))
    vi.advanceTimersByTime(50)
    expect(shown(controller)).toBe('di')
    vi.advanceTimersByTime(POINTER_GRACE - 50)
    expect(shown(controller)).toBe('do')
    vi.useRealTimers()
  })

  it('waits afresh for a mark after the pointer left in between', () => {
    vi.useFakeTimers()
    const { controller, show } = pointer()
    controller.pointTo(1, show('di'))
    controller.pointTo(2, show('wo'))
    controller.pointerLeft()
    controller.pointTo(2, show('wo'))
    vi.advanceTimersByTime(POINTER_GRACE)
    expect(shown(controller)).toBe('wo')
    vi.useRealTimers()
  })

  // A tooltip right of the pointer, as a bar's stands.
  function withTooltip() {
    const { controller, show } = pointer()
    const element = document.createElement('div')
    const tooltip = document.createElement('div')
    tooltip.className = 'lintje-chart-tooltip'
    tooltip.getBoundingClientRect = () => new DOMRect(100, 100, 150, 80)
    element.append(tooltip)
    controller.element = element
    return { controller, show }
  }

  it('follows a pointer that sweeps away from the tooltip at once', () => {
    vi.useFakeTimers()
    const { controller, show } = withTooltip()
    controller.pointTo(1, show('di'), { x: 80, y: 140 })
    controller.pointTo(2, show('wo'), { x: 80, y: 200 })
    expect(shown(controller)).toBe('wo')
    controller.pointTo(3, show('do'), { x: 60, y: 200 })
    expect(shown(controller)).toBe('do')
    vi.useRealTimers()
  })

  it('waits for a pointer that heads for the tooltip, and shows at once once it turns away', () => {
    vi.useFakeTimers()
    const { controller, show } = withTooltip()
    controller.pointTo(1, show('di'), { x: 80, y: 140 })
    controller.pointTo(2, show('wo'), { x: 90, y: 140 })
    expect(shown(controller)).toBe('di')
    controller.pointTo(2, show('wo'), { x: 90, y: 230 })
    expect(shown(controller)).toBe('wo')
    vi.useRealTimers()
  })

  it('lifts the neighbour at once while the tooltip waits, and lifts its own mark back on it', () => {
    vi.useFakeTimers()
    const { controller, show } = withTooltip()
    const lifted: number[] = []
    const lift = (index: number) => () => lifted.push(index)
    controller.pointTo(1, show('di'), { x: 80, y: 140 }, lift(1))
    controller.pointTo(2, show('wo'), { x: 90, y: 140 }, lift(2))
    expect(shown(controller)).toBe('di')
    expect(lifted).toEqual([2])
    controller.enterTooltip()
    expect(lifted).toEqual([2, 1])
    vi.advanceTimersByTime(POINTER_GRACE * 2)
    expect(shown(controller)).toBe('di')
    vi.useRealTimers()
  })

  it('goes once the pointer has left the marks and the tooltip', () => {
    vi.useFakeTimers()
    const { controller, show } = pointer()
    controller.pointTo(1, show('di'))
    controller.pointerLeft()
    controller.enterTooltip()
    vi.advanceTimersByTime(POINTER_GRACE * 2)
    expect(shown(controller)).toBe('di')
    controller.leaveTooltip()
    vi.advanceTimersByTime(POINTER_GRACE)
    expect(shown(controller)).toBeUndefined()
    vi.useRealTimers()
  })
})

describe('headingFor', () => {
  const box = { left: 100, top: 100, right: 250, bottom: 180 }

  it('is true for a move towards the side that faces the pointer', () => {
    expect(headingFor({ x: 80, y: 140 }, { x: 90, y: 135 }, box)).toBe(true)
    expect(headingFor({ x: 300, y: 140 }, { x: 290, y: 150 }, box)).toBe(true)
    expect(headingFor({ x: 150, y: 60 }, { x: 155, y: 80 }, box)).toBe(true)
  })

  it('is true inside the box', () => {
    expect(headingFor({ x: 80, y: 140 }, { x: 120, y: 140 }, box)).toBe(true)
  })

  it('is false for a move along or away from it', () => {
    expect(headingFor({ x: 80, y: 140 }, { x: 80, y: 220 }, box)).toBe(false)
    expect(headingFor({ x: 80, y: 140 }, { x: 60, y: 140 }, box)).toBe(false)
    expect(headingFor({ x: 80, y: 220 }, { x: 95, y: 230 }, box)).toBe(false)
  })
})

describe('ChartController.liftAt', () => {
  it('moves the lift only from none, and jumps from one category to the next', () => {
    const controller = new ChartController(() => {})
    controller.element = document.createElement('div')
    const jumps = () => controller.element!.hasAttribute('data-lift-jumps')
    controller.liftAt(1)
    expect(jumps()).toBe(false)
    controller.liftAt(2)
    expect(jumps()).toBe(true)
    expect(controller.hoverIndex).toBe(2)
    controller.liftAt(null)
    expect(jumps()).toBe(false)
  })
})
