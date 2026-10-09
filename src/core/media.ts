/**
 * A media query as a Lit reactive controller (viewport decisions, rule 9). One `MediaQueryList`
 * per query string is shared by every controller.
 */
import type { ReactiveController, ReactiveControllerHost } from 'lit'

/** Below this the views take their phone representation (rule 9). */
export const MOBILE = '(max-width: 767px)'

/** From here the menu can be pinned. The frame's markup changes at both breakpoints. */
export const WIDE = '(min-width: 1440px)'

const lists = new Map<string, MediaQueryList>()

function listFor(query: string): MediaQueryList | null {
  if (typeof matchMedia === 'undefined') return null
  let list = lists.get(query)
  if (!list) {
    list = matchMedia(query)
    lists.set(query, list)
  }
  return list
}

export class MediaController implements ReactiveController {
  /** Whether the query matches right now. */
  matches: boolean

  readonly #host: ReactiveControllerHost
  readonly #list: MediaQueryList | null
  readonly #onChange = (event: MediaQueryListEvent): void => {
    if (this.matches === event.matches) return
    this.matches = event.matches
    this.#host.requestUpdate()
  }

  constructor(host: ReactiveControllerHost, query: string = MOBILE) {
    this.#host = host
    this.#list = listFor(query)
    this.matches = this.#list?.matches ?? false
    host.addController(this)
  }

  hostConnected(): void {
    // Between disconnect and reconnect the viewport may have changed.
    if (!this.#list) return
    this.matches = this.#list.matches
    this.#list.addEventListener('change', this.#onChange)
  }

  hostDisconnected(): void {
    this.#list?.removeEventListener('change', this.#onChange)
  }
}
