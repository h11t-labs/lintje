/**
 * A `ResizeObserver` whose callback runs a frame later, at most once per frame. What the
 * callback changes resizes the box again; inside the observer's own delivery the browser
 * reports that as a loop error. A row that no longer fits may stand one frame too wide.
 */
export class FrameResizeObserver {
  #observer: ResizeObserver | null = null
  #frame: number | null = null

  constructor(private readonly callback: () => void) {
    if (typeof ResizeObserver === 'undefined') return
    this.#observer = new ResizeObserver(() => this.#schedule())
  }

  observe(target: Element): void {
    this.#observer?.observe(target)
  }

  disconnect(): void {
    this.#observer?.disconnect()
    if (this.#frame !== null) cancelAnimationFrame(this.#frame)
    this.#frame = null
  }

  #schedule(): void {
    if (this.#frame !== null) return
    this.#frame = requestAnimationFrame(() => {
      this.#frame = null
      this.callback()
    })
  }
}
