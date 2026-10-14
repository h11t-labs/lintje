/** For a chart whose geometry follows a legend switch: stacked parts, grouped bars. */
import { durationMs, easing, prefersReducedMotion } from '../../../../core/motion'
import type { ChartController } from './controller'

/**
 * The weight each part is drawn with, 0 (off) to 1 (on), eased between the two over `--dur-layer`
 * after a legend switch. Points and `d` do not transition in every engine, so the edges are
 * worked out per frame.
 */
export interface LayerMotion {
  key: string
  from: number[]
  to: number[]
  start: number
  duration: number
  ease: (t: number) => number
  frame?: number
  element?: Element
  attach: (element: Element | undefined) => void
}

const motions = new WeakMap<ChartController, LayerMotion>()

function progress(motion: LayerMotion, now: number): number {
  return motion.duration > 0 ? Math.min(1, (now - motion.start) / motion.duration) : 1
}

function weightsAt(motion: LayerMotion, now: number): number[] {
  const done = progress(motion, now)
  // The end is exact, not a float near it: a weight of 0 takes the part out.
  if (done >= 1) return motion.to
  const eased = motion.ease(done)
  return motion.to.map((to, j) => motion.from[j] + (to - motion.from[j]) * eased)
}

/** The weights to draw now; a new switch starts from where a running one stands. */
export function layerWeights(controller: ChartController, key: string, target: number[]): number[] {
  const now = performance.now()
  let motion = motions.get(controller)
  if (!motion || motion.key !== key) {
    const fresh: LayerMotion = {
      key,
      from: target,
      to: target,
      start: now,
      duration: 0,
      ease: (t) => t,
      element: motion?.element,
      attach: (element) => {
        fresh.element = element
      },
    }
    motions.set(controller, fresh)
    return target
  }
  if (motion.to.some((to, j) => to !== target[j])) {
    const element = motion.element
    const instant = !element || prefersReducedMotion()
    motion.from = instant ? target : weightsAt(motion, now)
    motion.to = target
    motion.start = now
    motion.duration = instant ? 0 : durationMs(element, '--dur-layer')
    motion.ease = element ? easing(element, '--ease-in-motion') : (t) => t
    if (motion.frame == null && motion.duration > 0) {
      const running = motion
      const tick = () => {
        running.frame = undefined
        const done = progress(running, performance.now()) >= 1
        controller.requestUpdate()
        if (!done) running.frame = requestAnimationFrame(tick)
      }
      running.frame = requestAnimationFrame(tick)
    }
  }
  return weightsAt(motion, now)
}

/** The motion of a chart, after `layerWeights`; its `attach` goes on the drawing, for the tokens. */
export function layerMotion(controller: ChartController): LayerMotion {
  return motions.get(controller)!
}
