/**
 * What `lintje-form`, `lintje-form-section` and `lintje-form-actions` share: finding the controls
 * in their light DOM, and setting a property on them that can be handed back.
 *
 * A `<fieldset disabled>` in a shadow root disables nothing slotted into it, so each holder
 * disables controls itself and hands back the state it found, or a control the host had
 * disabled comes back enabled.
 */

const NATIVE = new Set(['input', 'select', 'textarea', 'button'])

/** The control's `name` property, or its `name` attribute before it upgraded. */
export function controlName(element: Element): string {
  const property = (element as { name?: unknown }).name
  if (typeof property === 'string' && property) return property
  return element.getAttribute('name') ?? ''
}

/** Every light-DOM element below `root` that can be disabled. */
export function disableableControls(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('*')).filter(isControl)
}

function isControl(element: Element): boolean {
  return (
    NATIVE.has(element.localName) ||
    (element.localName.startsWith('lintje-') && 'disabled' in element)
  )
}

export function namedControls(root: ParentNode): HTMLElement[] {
  return disableableControls(root).filter((element) => controlName(element) !== '')
}

/** The named controls in an added or removed node: the node itself and those below it. */
export function namedControlsIn(node: Node): HTMLElement[] {
  if (!(node instanceof HTMLElement)) return []
  const own = isControl(node) && controlName(node) !== '' ? [node] : []
  return [...own, ...namedControls(node)]
}

type Fields = Record<string, unknown>

/** How one tag holds its value; without `write` it is read-only. */
interface ValueAccess {
  read(control: Fields): unknown
  write?(control: Fields, value: unknown): void
}

const BY_VALUE: ValueAccess = {
  read: (control) => control.value,
  write: (control, value) => {
    control.value = value
  },
}

const BY_CHECKED: ValueAccess = {
  read: (control) => Boolean(control.checked),
  write: (control, value) => {
    control.checked = Boolean(value)
  },
}

/** The controls whose value is not `.value`; `read` has the shape their `lintje-change` carries. */
const VALUE_ACCESS: Record<string, ValueAccess> = {
  'lintje-checkbox': BY_CHECKED,
  'lintje-toggle': BY_CHECKED,
  'lintje-multiselect': {
    read: (control) => [...((control.selected as string[] | undefined) ?? [])],
    write: (control, value) => {
      control.selected = Array.isArray(value) ? [...(value as string[])] : []
    },
  },
  'lintje-date-range': {
    read: (control) => ({ ...(control.range as object) }),
    write: (control, value) => {
      control.range = { from: null, to: null, ...(value as object) }
    },
  },
  'lintje-range': {
    read: (control) => (control.single ? control.value : [control.from, control.to]),
    write: (control, value) => {
      if (control.single) control.value = value
      else if (Array.isArray(value)) [control.from, control.to] = value as number[]
    },
  },
  // The ids of the files that are done. Read-only: a draft cannot put files back.
  'lintje-file-upload': {
    read: (control) =>
      ((control.files as { id: string; state: string }[] | undefined) ?? [])
        .filter((row) => row.state === 'done')
        .map((row) => row.id),
  },
}

function accessFor(control: HTMLElement): ValueAccess {
  if (control instanceof HTMLInputElement)
    return control.type === 'checkbox' || control.type === 'radio' ? BY_CHECKED : BY_VALUE
  return VALUE_ACCESS[control.localName] ?? BY_VALUE
}

export function readControl(control: HTMLElement): unknown {
  return accessFor(control).read(control as unknown as Fields)
}

/** Returns `false` for a control that cannot take a value back. */
export function writeControl(control: HTMLElement, value: unknown): boolean {
  const { write } = accessFor(control)
  if (!write) return false
  write(control as unknown as Fields, value)
  return true
}

/**
 * What a control posts in a native `<form>`, from the value `readControl` gives: a boolean posts
 * `on` or nothing, a list repeats the name, a `{ from, to }` pair posts `name-from`, `name-to`.
 */
export function formEntries(name: string, value: unknown): [string, string][] {
  if (typeof value === 'boolean') return value ? [[name, 'on']] : []
  if (Array.isArray(value)) return value.map((item) => [name, String(item ?? '')])
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).map(([key, part]) => [`${name}-${key}`, String(part ?? '')])
  }
  return [[name, String(value ?? '')]]
}

/** A control that tells its own changes (`lintje-change`); a native one has to be read. */
export function announces(control: HTMLElement): boolean {
  return control.localName.startsWith('lintje-')
}

const FOCUSABLE = 'input, textarea, select, button, a[href], [tabindex]:not([tabindex="-1"])'

/** A `lintje-…` host does not delegate focus, so `host.focus()` is a no-op: focus goes inside. */
export function focusInside(element: HTMLElement, options?: FocusOptions): void {
  const target =
    element.shadowRoot?.querySelector<HTMLElement>(FOCUSABLE) ??
    (element.matches(FOCUSABLE) ? element : element.querySelector<HTMLElement>(FOCUSABLE)) ??
    element
  target.focus(options)
}

/** `apply()` remembers the value it first found on an element; `release()` writes it back. */
export class PropertyHold {
  readonly #property: string
  readonly #prior = new Map<HTMLElement, unknown>()

  constructor(property: string) {
    this.#property = property
  }

  get active(): boolean {
    return this.#prior.size > 0
  }

  apply(elements: Iterable<HTMLElement>, value: unknown): void {
    for (const element of elements) {
      const target = element as unknown as Record<string, unknown>
      if (!this.#prior.has(element)) this.#prior.set(element, target[this.#property])
      target[this.#property] = value
    }
  }

  release(): void {
    for (const [element, value] of this.#prior) {
      ;(element as unknown as Record<string, unknown>)[this.#property] = value
    }
    this.#prior.clear()
  }
}

/** `PropertyHold` for a boolean attribute that is not a property (`block` is CSS only). */
export class AttributeHold {
  readonly #attribute: string
  readonly #prior = new Map<HTMLElement, boolean>()

  constructor(attribute: string) {
    this.#attribute = attribute
  }

  apply(elements: Iterable<HTMLElement>, on: boolean): void {
    for (const element of elements) {
      if (!this.#prior.has(element)) this.#prior.set(element, element.hasAttribute(this.#attribute))
      element.toggleAttribute(this.#attribute, on)
    }
  }

  release(): void {
    for (const [element, had] of this.#prior) element.toggleAttribute(this.#attribute, had)
    this.#prior.clear()
  }
}
