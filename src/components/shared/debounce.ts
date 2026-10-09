/**
 * One pending call, run once typing has stopped for `delay` ms.
 * `flush()` runs it at once (Enter, leaving the field); a disconnected host drops it.
 */
import type { ReactiveController, ReactiveControllerHost } from 'lit'

export const TYPING_DELAY = 300

export class Debounce implements ReactiveController {
  #timer: ReturnType<typeof setTimeout> | null = null
  #run: (() => void) | null = null

  constructor(
    host: ReactiveControllerHost,
    readonly delay: number = TYPING_DELAY,
  ) {
    host.addController(this)
  }

  get pending(): boolean {
    return this.#run !== null
  }

  schedule(run: () => void): void {
    this.cancel()
    this.#run = run
    this.#timer = setTimeout(() => this.flush(), this.delay)
  }

  flush(): void {
    const run = this.#run
    this.cancel()
    run?.()
  }

  cancel(): void {
    if (this.#timer !== null) clearTimeout(this.#timer)
    this.#timer = null
    this.#run = null
  }

  hostDisconnected(): void {
    this.cancel()
  }
}
