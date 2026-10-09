/**
 * The page's one register of keyboard shortcuts: one `keydown` listener; `shortcuts()` lists
 * them for `<lintje-shortcuts>`. Without Ctrl, Alt or Meta a key never fires in a field; with
 * one, only when registered with `inFields`. A key registered twice warns in development.
 *
 * A one-character key (`/`, `?`) can be switched off by the reader (WCAG 2.1.4, for speech
 * input and stray keystrokes): `setCharacterKeys(false)`, remembered in `localStorage`.
 */

export interface ShortcutOptions {
  /** One key with optional modifiers joined by `+`: `'/'`, `'Ctrl+S'`. A letter ignores case. */
  keys: string
  /** What the key does, in Dutch: the line in the overview. */
  description: string
  handler: (event: KeyboardEvent) => void
  /** Also while the focus is in a field; only with Ctrl, Alt or Meta. */
  inFields?: boolean
}

export interface ShortcutInfo {
  keys: string
  description: string
  inFields: boolean
}

interface Chord {
  key: string
  ctrl: boolean
  alt: boolean
  meta: boolean
  shift: boolean
}

interface Entry {
  options: ShortcutOptions
  chord: Chord
  normalized: string
}

const KEY_NAMES: Record<string, string> = {
  esc: 'Escape',
  escape: 'Escape',
  space: ' ',
  spatie: ' ',
  enter: 'Enter',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
}

const KEY_LABELS: Record<string, string> = {
  ' ': 'Spatie',
  Escape: 'Esc',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Ctrl: 'Ctrl',
  Alt: 'Alt',
  Shift: 'Shift',
  Meta: 'Cmd',
}

const entries: Entry[] = []
let listening = false

const CHARACTER_KEYS = 'lintje-character-keys'
let characterKeysOn: boolean | null = null

/** Whether the one-character keys work: on, unless the reader switched them off. */
export function characterKeys(): boolean {
  if (characterKeysOn === null) {
    try {
      characterKeysOn = localStorage.getItem(CHARACTER_KEYS) !== 'off'
    } catch {
      characterKeysOn = true
    }
  }
  return characterKeysOn
}

export function setCharacterKeys(on: boolean): void {
  characterKeysOn = on
  try {
    if (on) localStorage.removeItem(CHARACTER_KEYS)
    else localStorage.setItem(CHARACTER_KEYS, 'off')
  } catch {
    // Storage blocked: the choice holds until the page reloads.
  }
}

/** A printable character without Ctrl, Alt or Meta: the kind of key the reader can switch off. */
export function isCharacterKey(keys: string): boolean {
  return isCharacterChord(parseKeys(keys))
}

const isCharacterChord = (chord: Chord): boolean =>
  !chord.ctrl && !chord.alt && !chord.meta && chord.key.length === 1

const isLetter = (key: string): boolean => /^[a-z]$/i.test(key)

/** `'Ctrl+S'` → `{ key: 's', ctrl: true, … }`. A `+` on its own is the key. */
export function parseKeys(keys: string): Chord {
  const parts = keys === '+' ? ['+'] : keys.split('+').filter((part) => part !== '')
  if (keys.endsWith('++')) parts.push('+')
  const chord: Chord = { key: '', ctrl: false, alt: false, meta: false, shift: false }
  parts.forEach((part, index) => {
    const lower = part.toLowerCase()
    if (index < parts.length - 1) {
      if (lower === 'ctrl' || lower === 'control') chord.ctrl = true
      else if (lower === 'alt') chord.alt = true
      else if (lower === 'meta' || lower === 'cmd') chord.meta = true
      else if (lower === 'shift') chord.shift = true
      return
    }
    const named = KEY_NAMES[lower]
    chord.key = named ?? (part.length === 1 ? part.toLowerCase() : part)
  })
  return chord
}

function normalize(chord: Chord): string {
  return [
    chord.ctrl ? 'Ctrl' : '',
    chord.alt ? 'Alt' : '',
    chord.meta ? 'Meta' : '',
    chord.shift ? 'Shift' : '',
    chord.key,
  ]
    .filter(Boolean)
    .join('+')
}

/** Whether the event is this chord. */
export function matchesKeys(chord: Chord, event: KeyboardEvent): boolean {
  if (event.ctrlKey !== chord.ctrl || event.altKey !== chord.alt || event.metaKey !== chord.meta)
    return false
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
  if (key !== chord.key) return false
  // A sign such as `?` or `/` takes Shift or not depending on the layout: the character decides.
  if (chord.key.length === 1 && !isLetter(chord.key)) return true
  return event.shiftKey === chord.shift
}

export function isTypingTarget(event: Event): boolean {
  const target = event.composedPath()[0]
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target.getAttribute('contenteditable') === 'true') return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  if (target instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file'].includes(
      target.type,
    )
  }
  return false
}

const onKeydown = (event: KeyboardEvent): void => {
  if (event.defaultPrevented || event.isComposing) return
  // The latest registration first: a dialog over the page takes the key from the page.
  for (let index = entries.length - 1; index >= 0; index--) {
    const { chord, options } = entries[index]
    if (!matchesKeys(chord, event)) continue
    if (isCharacterChord(chord) && !characterKeys()) continue
    if (isTypingTarget(event)) {
      const modified = chord.ctrl || chord.alt || chord.meta
      if (!modified || !options.inFields) return
    }
    event.preventDefault()
    options.handler(event)
    return
  }
}

/** Adds a shortcut; the returned function removes it. */
export function registerShortcut(options: ShortcutOptions): () => void {
  const chord = parseKeys(options.keys)
  const entry: Entry = { options, chord, normalized: normalize(chord) }
  if (import.meta.env?.DEV && entries.some((other) => other.normalized === entry.normalized)) {
    console.warn(
      `lintje-shortcuts: "${options.keys}" is registered twice ("${options.description}"); the latest registration handles it.`,
    )
  }
  entries.push(entry)
  if (!listening && typeof document !== 'undefined') {
    document.addEventListener('keydown', onKeydown)
    listening = true
  }
  return () => {
    const index = entries.indexOf(entry)
    if (index !== -1) entries.splice(index, 1)
    if (!entries.length && listening) {
      document.removeEventListener('keydown', onKeydown)
      listening = false
    }
  }
}

export function shortcuts(): ShortcutInfo[] {
  const seen = new Set<string>()
  const list: ShortcutInfo[] = []
  for (let index = entries.length - 1; index >= 0; index--) {
    const { options, normalized } = entries[index]
    if (seen.has(normalized)) continue
    seen.add(normalized)
    list.unshift({
      keys: options.keys,
      description: options.description,
      inFields: Boolean(options.inFields),
    })
  }
  return list
}

export function keyLabels(keys: string): string[] {
  const chord = parseKeys(keys)
  const labels: string[] = []
  if (chord.ctrl) labels.push('Ctrl')
  if (chord.alt) labels.push('Alt')
  if (chord.meta) labels.push(KEY_LABELS.Meta)
  if (chord.shift) labels.push('Shift')
  labels.push(
    KEY_LABELS[chord.key] ?? (chord.key.length === 1 ? chord.key.toUpperCase() : chord.key),
  )
  return labels
}

/** The value for `aria-keyshortcuts` on the control the key belongs to: `'Control+S'`. */
export function ariaKeyShortcuts(keys: string): string {
  const chord = parseKeys(keys)
  const key =
    chord.key === ' ' ? 'Space' : chord.key.length === 1 ? chord.key.toUpperCase() : chord.key
  return [
    chord.ctrl ? 'Control' : '',
    chord.alt ? 'Alt' : '',
    chord.meta ? 'Meta' : '',
    chord.shift ? 'Shift' : '',
    key,
  ]
    .filter(Boolean)
    .join('+')
}
