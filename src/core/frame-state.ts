/**
 * State shared between elements: a module-level store, since every element runs from the same
 * module. It holds only what one part of the shell tells another; `FrameStateController`
 * subscribes an element to it.
 */
import type { ReactiveController, ReactiveControllerHost } from 'lit'

export interface FrameState {
  titleHidden: boolean
  scrolled: boolean
  sheetOpen: boolean
  /** Filters that differ from their default, for the mobile header's badge. */
  modifiedCount: number
  summary: string
  hasFilters: boolean
}

let state: FrameState = {
  titleHidden: false,
  scrolled: false,
  sheetOpen: false,
  modifiedCount: 0,
  summary: '',
  hasFilters: false,
}

const listeners = new Set<() => void>()

export function getFrameState(): FrameState {
  return state
}

export function setFrameState(patch: Partial<FrameState>): void {
  const keys = Object.keys(patch) as (keyof FrameState)[]
  if (keys.every((key) => state[key] === patch[key])) return
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

// Stable setters, so an observer that takes one is not restarted on every render.
export const setTitleHidden = (titleHidden: boolean): void => setFrameState({ titleHidden })
export const setScrolled = (scrolled: boolean): void => setFrameState({ scrolled })

export function subscribeToFrameState(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export class FrameStateController implements ReactiveController {
  private unsubscribe: (() => void) | null = null

  constructor(private readonly host: ReactiveControllerHost) {
    host.addController(this)
  }

  get state(): FrameState {
    return state
  }

  hostConnected(): void {
    this.unsubscribe = subscribeToFrameState(() => this.host.requestUpdate())
  }

  hostDisconnected(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
  }
}

/** A page without a zone must not inherit the count, sentence or open sheet of the last one. */
export function clearFilterZone(): void {
  setFrameState({
    hasFilters: false,
    modifiedCount: 0,
    summary: '',
    scrolled: false,
    sheetOpen: false,
  })
}
