/**
 * The words of a live region that is always there. A screen reader reads only a change, so `say()`
 * empties the region and fills it a frame later: the first message is heard, and the same one
 * twice is heard twice. A disconnected host drops the pending frame.
 */
import type { ReactiveController, ReactiveControllerHost } from 'lit'

export class LiveMessage implements ReactiveController {
  #text = ''
  #frame = 0

  constructor(private readonly host: ReactiveControllerHost) {
    host.addController(this)
  }

  /** What the region holds now: render it inside the region. */
  get text(): string {
    return this.#text
  }

  say(message: string): void {
    this.clear()
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0
      this.#set(message)
    })
  }

  /** Empties the region and drops a message still on its way. */
  clear(): void {
    cancelAnimationFrame(this.#frame)
    this.#frame = 0
    this.#set('')
  }

  hostDisconnected(): void {
    cancelAnimationFrame(this.#frame)
    this.#frame = 0
  }

  #set(text: string): void {
    if (text === this.#text) return
    this.#text = text
    this.host.requestUpdate()
  }
}
