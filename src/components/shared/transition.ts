const HEIGHT = 'grid-template-rows'

/**
 * How long a transition of `grid-template-rows` runs, in ms, from computed `transition-property`
 * and `transition-duration`: 0 when that property does not transition. A shorter duration list
 * repeats, and a later entry for the same property wins.
 */
export function heightTransitionMs(property: string, duration: string): number {
  const properties = property.split(',').map((name) => name.trim())
  const durations = duration.split(',').map((value) => value.trim())
  let ms = 0
  properties.forEach((name, index) => {
    if (name !== HEIGHT && name !== 'all') return
    const value = durations[index % durations.length] ?? ''
    const seconds = parseFloat(value)
    ms = Number.isFinite(seconds) ? seconds * (value.endsWith('ms') ? 1 : 1000) : 0
  })
  return ms
}

/**
 * How long a box waits before it lets its content out: only a height that really transitions.
 * Reading it from the computed style keeps `tokens/base.css` the one place that says what moves
 * under reduced motion.
 */
export function heightSettleMs(box: Element | null): number {
  if (!box) return 0
  const style = getComputedStyle(box)
  return heightTransitionMs(style.transitionProperty, style.transitionDuration)
}
