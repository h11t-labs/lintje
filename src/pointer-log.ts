// TEMPORARY: logs pointer events during a drag, to find the Firefox flake.
const TYPES = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture', 'mousedown', 'mouseup']
export function pointerLog(root: Node & EventTarget, measure: () => unknown): { lines: string[]; stop: () => void } {
  const lines: string[] = []
  const t0 = performance.now()
  const on = (event: Event): void => {
    const e = event as PointerEvent
    const target = e.composedPath()[0] as Element
    lines.push(
      `${(e.timeStamp - t0).toFixed(1)} ${e.type} x=${e.clientX} y=${e.clientY} id=${e.pointerId} b=${e.buttons} trusted=${e.isTrusted} t=${target?.className ?? target?.nodeName} m=${JSON.stringify(measure())}`,
    )
  }
  for (const type of TYPES) root.addEventListener(type, on, true)
  return { lines, stop: () => { for (const type of TYPES) root.removeEventListener(type, on, true) } }
}
