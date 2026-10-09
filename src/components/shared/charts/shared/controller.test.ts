/**
 * The height a chart measures for itself (`npm test`).
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
import { ChartController } from './controller'

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
