/**
 * Before each file of the `unit` project. The files a worker runs share one happy-dom window
 * (`isolate: false`: the window is what a file costs), so a file starts on the page a fresh
 * window would give: an empty body, nothing focused, no attributes on `<html>`, empty storage,
 * the opening address, no stubs or spies. Module state stays: a test that needs the registry of
 * a fresh page, or mocks a module, runs in `unit-window`.
 */
import { beforeAll, vi } from 'vitest'

beforeAll(() => {
  // What a file stubbed, spied on or sped up is its own.
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  // An element the last file focused and then removed stays the active one; a focus elsewhere
  // ends that, and clearing the body disconnects the elements, which drop their listeners.
  const probe = document.createElement('button')
  document.body.append(probe)
  probe.focus()
  probe.blur()
  document.body.replaceChildren()
  for (const name of Object.keys(document.documentElement.dataset)) {
    delete document.documentElement.dataset[name]
  }
  localStorage.clear()
  sessionStorage.clear()
  // A link a test followed moved the page; back to the address a fresh window opens on.
  ;(window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(
    'http://localhost:3000/',
  )
  // A property a test defined over one the DOM gives (`scrollTop`, `clipboard`) goes away.
  for (const target of [document, document.documentElement, document.body, navigator]) {
    for (const name of Object.getOwnPropertyNames(target)) {
      if (name in Object.getPrototypeOf(target))
        delete (target as unknown as Record<string, unknown>)[name]
    }
  }
})
