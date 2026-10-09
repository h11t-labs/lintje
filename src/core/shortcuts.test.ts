/**
 * The shortcut register: matching, the field rule, the duplicate warning, the listing and the
 * one listener that comes and goes with the registrations.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ariaKeyShortcuts,
  characterKeys,
  isCharacterKey,
  keyLabels,
  parseKeys,
  matchesKeys,
  registerShortcut,
  setCharacterKeys,
  shortcuts,
} from './shortcuts'

const cleanups: (() => void)[] = []
function register(...args: Parameters<typeof registerShortcut>): () => void {
  const off = registerShortcut(...args)
  cleanups.push(off)
  return off
}

afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

function press(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    composed: true,
    cancelable: true,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

describe('matching', () => {
  it('compares a sign on the character alone and a letter with its modifiers', () => {
    const question = parseKeys('?')
    expect(matchesKeys(question, new KeyboardEvent('keydown', { key: '?', shiftKey: true }))).toBe(
      true,
    )
    const save = parseKeys('Ctrl+S')
    expect(matchesKeys(save, new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))).toBe(true)
    expect(
      matchesKeys(save, new KeyboardEvent('keydown', { key: 'S', ctrlKey: true, shiftKey: true })),
    ).toBe(false)
    expect(matchesKeys(save, new KeyboardEvent('keydown', { key: 's' }))).toBe(false)
  })

  it('labels the keys for a <kbd> and for aria-keyshortcuts', () => {
    expect(keyLabels('Ctrl+S')).toEqual(['Ctrl', 'S'])
    expect(keyLabels('ArrowLeft')).toEqual(['←'])
    expect(keyLabels('Space')).toEqual(['Spatie'])
    expect(ariaKeyShortcuts('Ctrl+S')).toBe('Control+S')
    expect(ariaKeyShortcuts('/')).toBe('/')
  })
})

describe('registerShortcut', () => {
  it('runs the handler and cancels the key', () => {
    const handler = vi.fn()
    register({ keys: '/', description: 'Zoeken', handler })
    const event = press(document.body, { key: '/' })
    expect(handler).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
  })

  it('leaves a plain key alone in a field, also inside a shadow root', () => {
    const handler = vi.fn()
    register({ keys: '/', description: 'Zoeken', handler, inFields: true })
    const input = document.createElement('input')
    document.body.append(input)
    press(input, { key: '/' })

    const host = document.createElement('div')
    document.body.append(host)
    const inner = host
      .attachShadow({ mode: 'open' })
      .appendChild(document.createElement('textarea'))
    press(inner, { key: '/' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('lets a modified key through in a field only with inFields', () => {
    const save = vi.fn()
    const print = vi.fn()
    register({ keys: 'Ctrl+S', description: 'Opslaan', handler: save, inFields: true })
    register({ keys: 'Ctrl+P', description: 'Afdrukken', handler: print })
    const input = document.createElement('input')
    document.body.append(input)
    press(input, { key: 's', ctrlKey: true })
    press(input, { key: 'p', ctrlKey: true })
    expect(save).toHaveBeenCalledOnce()
    expect(print).not.toHaveBeenCalled()
  })

  it('warns about a duplicate key and gives it to the latest registration', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const first = vi.fn()
    const second = vi.fn()
    register({ keys: '?', description: 'Overzicht', handler: first })
    register({ keys: '?', description: 'Overzicht', handler: second })
    expect(warn).toHaveBeenCalledOnce()
    press(document.body, { key: '?', shiftKey: true })
    expect(second).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()
    expect(shortcuts()).toHaveLength(1)
  })

  it('lists what is registered and forgets what is removed, and the listener with it', () => {
    const add = vi.spyOn(document, 'addEventListener')
    const remove = vi.spyOn(document, 'removeEventListener')
    const offSearch = register({ keys: '/', description: 'Zoeken', handler: () => {} })
    const offSave = register({ keys: 'Ctrl+S', description: 'Opslaan', handler: () => {} })
    expect(shortcuts().map((item) => item.description)).toEqual(['Zoeken', 'Opslaan'])
    expect(add.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(1)

    offSearch()
    expect(shortcuts().map((item) => item.description)).toEqual(['Opslaan'])
    offSave()
    expect(shortcuts()).toEqual([])
    expect(remove.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(1)
  })
})

describe('one-character keys', () => {
  afterEach(() => setCharacterKeys(true))

  it('knows a one-character key from a chord with Ctrl, Alt or Meta', () => {
    expect(isCharacterKey('/')).toBe(true)
    expect(isCharacterKey('?')).toBe(true)
    expect(isCharacterKey('Shift+K')).toBe(true)
    expect(isCharacterKey('Ctrl+S')).toBe(false)
    expect(isCharacterKey('Alt+K')).toBe(false)
    expect(isCharacterKey('Escape')).toBe(false)
  })

  it('switches them off and on, remembered, and leaves the chords alone', () => {
    const search = vi.fn()
    const save = vi.fn()
    register({ keys: '/', description: 'Zoeken', handler: search })
    register({ keys: 'Ctrl+S', description: 'Opslaan', handler: save })

    setCharacterKeys(false)
    expect(characterKeys()).toBe(false)
    expect(localStorage.getItem('lintje-character-keys')).toBe('off')
    const ignored = press(document.body, { key: '/' })
    expect(ignored.defaultPrevented).toBe(false)
    press(document.body, { key: 's', ctrlKey: true })
    expect(search).not.toHaveBeenCalled()
    expect(save).toHaveBeenCalledOnce()

    setCharacterKeys(true)
    expect(localStorage.getItem('lintje-character-keys')).toBeNull()
    press(document.body, { key: '/' })
    expect(search).toHaveBeenCalledOnce()
  })
})
