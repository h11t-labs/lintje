/**
 * Runs a layout: on the page for a small graph, and in a worker above `LARGE_GRAPH` nodes, so the
 * page keeps answering while it works. Where no worker starts — a test document, a policy that
 * forbids one — a large graph is laid out on the page too, a frame later, after its busy state.
 */
import { computeLayout, type LayoutRequest, type LayoutResult } from './layout'
import { LARGE_GRAPH } from './model'

type Settle = (result: LayoutResult) => void

export class LayoutRunner {
  #worker: Worker | null | undefined = undefined
  #sequence = 0
  readonly #waiting = new Map<number, { request: LayoutRequest; settle: Settle }>()

  /** A small graph's result at once; a large one's when it is ready. */
  run(request: LayoutRequest): LayoutResult | Promise<LayoutResult> {
    if (request.nodes.length <= LARGE_GRAPH) return computeLayout(request)
    return new Promise((settle) => {
      const worker = this.worker()
      if (!worker) {
        requestAnimationFrame(() => settle(computeLayout(request)))
        return
      }
      const id = ++this.#sequence
      this.#waiting.set(id, { request, settle })
      worker.postMessage({ id, request }, [])
    })
  }

  destroy(): void {
    this.#worker?.terminate()
    this.#worker = undefined
    this.#waiting.clear()
  }

  private worker(): Worker | null {
    if (this.#worker !== undefined) return this.#worker
    try {
      const worker = new Worker(new URL('./layout-worker.ts', import.meta.url), { type: 'module' })
      worker.addEventListener(
        'message',
        (event: MessageEvent<{ id: number; result: LayoutResult }>) => {
          const waiting = this.#waiting.get(event.data.id)
          this.#waiting.delete(event.data.id)
          waiting?.settle(event.data.result)
        },
      )
      // A worker that cannot load leaves its requests to the page.
      worker.addEventListener('error', () => {
        this.#worker?.terminate()
        this.#worker = null
        for (const { request, settle } of this.#waiting.values()) settle(computeLayout(request))
        this.#waiting.clear()
      })
      this.#worker = worker
    } catch {
      this.#worker = null
    }
    return this.#worker
  }
}
