/**
 * `<lintje-form>` — collects the values of its light-DOM fields, keeps the draft, asks for one
 * submit and puts the host's errors under their fields.
 *
 * Its `<form>` is in the shadow root, so slotted fields have no form owner: the form's own key
 * and click handlers are the one submit. `lintje-values-change` is stopped so form input never
 * reaches the URL.
 *
 * Events: `lintje-submit` `{ values }`, `lintje-invalid` (the errors), `lintje-dirty-change`
 * (boolean).
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { deepActiveElement, holdsFocus } from '../../../core/focus'
import { MediaController, MOBILE } from '../../../core/media'
import { shadowCss } from '../../../core/styles'
import type { ErrorSummaryItem, LintjeErrorSummary } from '../error-summary/error-summary'
import type { FormActionsState } from '../form-actions/form-actions'
import {
  PropertyHold,
  announces,
  controlName,
  namedControls,
  namedControlsIn,
  readControl,
  writeControl,
} from './controls'
import '../error-summary/error-summary'
import '../form-actions/form-actions'
import formCss from './form.css?inline'

export type FormValues = Record<string, unknown>

/** What the host hands back after a failed attempt: per field, and what belongs to no field. */
export interface FormErrors {
  fields: Record<string, string>
  form?: string
}

export interface StoredDraft {
  savedAt: number
  values: FormValues
}

export const DRAFT_PREFIX = 'lintje-draft:'

const HOUR = 3_600_000

const ONE_LINE = new Set([
  'text',
  'search',
  'email',
  'tel',
  'url',
  'number',
  'password',
  'date',
  'time',
])

/**
 * A native field slotted into the form has no error line of its own: it is marked invalid and
 * its message stands in the summary. A `lintje-*` input draws its own.
 */
function markInvalid(control: HTMLElement, invalid: boolean): void {
  if (control.localName.includes('-')) return
  if (invalid) control.setAttribute('aria-invalid', 'true')
  else control.removeAttribute('aria-invalid')
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/** The stored draft, or `null` when there is none, it is unreadable, or it is older than `ttl` hours. */
export function readDraft(
  key: string,
  ttlHours: number,
  now: number = Date.now(),
): StoredDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + key)
    if (!raw) return null
    const draft = JSON.parse(raw) as StoredDraft
    if (typeof draft?.savedAt !== 'number' || now - draft.savedAt > ttlHours * HOUR) {
      localStorage.removeItem(DRAFT_PREFIX + key)
      return null
    }
    return draft
  } catch {
    return null
  }
}

export class LintjeForm extends LintjeElement {
  static override styles = shadowCss(formCss)

  static override properties: PropertyDeclarations = {
    values: { attribute: false },
    errors: { attribute: false },
    busy: { type: Boolean, reflect: true },
    savedAt: { type: String, attribute: 'saved-at' },
    draftKey: { type: String, attribute: 'draft-key' },
    draftTtl: { type: Number, attribute: 'draft-ttl' },
    dirty: { type: Boolean, reflect: true },
    phase: { state: true },
  }

  /** What is saved. The form writes it into the fields and compares every change with it. */
  values: FormValues = {}
  /** The host's answer to a failed attempt. */
  declare errors?: FormErrors
  busy: boolean = false
  /** When it was last saved ("10:42" or an ISO moment); `saved()` sets it. */
  declare savedAt?: string
  /** Keeps the draft in `localStorage` under `lintje-draft:<key>`. Without it: memory only. */
  declare draftKey?: string
  /** Hours a stored draft stays good. */
  draftTtl: number = 24
  /** The draft differs from `values`. Reflected; the form sets it, a host reads it. */
  dirty: boolean = false

  protected phase: Exclude<FormActionsState, 'busy'> = ''

  #draft: FormValues = {}
  #draftLoaded = false
  #started = false
  #restored: StoredDraft | null = null
  /** `values` changed by `forget()`: the fields are not written again. */
  #quiet = false
  /** The control that had the focus when `busy` disabled the fields; it gets it back after. */
  #busyFocus: HTMLElement | null = null

  readonly #fields = new MutationObserver((records) => {
    const added: HTMLElement[] = []
    const removed: HTMLElement[] = []
    for (const record of records) {
      for (const node of record.addedNodes) added.push(...namedControlsIn(node))
      for (const node of record.removedNodes) removed.push(...namedControlsIn(node))
    }
    this.#adopt(added.filter((control) => this.contains(control)))
    // A node that moved inside the form is reported removed and added: it stays.
    const present = new Set(namedControls(this).map(controlName))
    for (const control of removed) {
      const name = controlName(control)
      if (!this.contains(control) && !present.has(name)) this.forget(name)
    }
  })
  readonly #mobile = new MediaController(this, MOBILE)
  readonly #fieldsDisabled = new PropertyHold('disabled')
  readonly #stacked = new PropertyHold('stacked')

  readonly #onChange = (event: Event): void => {
    const control = event.target as HTMLElement
    if (control === this) return
    const name = controlName(control)
    if (!name) return
    const value = (event as CustomEvent).detail
    // A field that leaves its value to its host gets it back here: the form is that host.
    if (!same(readControl(control), value)) writeControl(control, value)
    if (same(value, this.values[name])) delete this.#draft[name]
    else this.#draft[name] = value
    this.#storeDraft()
    this.#clearError(name, control)
    this.#settle('dirty')
  }

  readonly #onValuesChange = (event: Event): void => {
    if (event.target !== this) event.stopPropagation()
  }

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    const origin = event.composedPath()[0]
    const mod = event.ctrlKey || event.metaKey
    if (mod && event.key.toLowerCase() === 's') {
      event.preventDefault()
      this.#flush(origin)
      this.saveDraft()
      return
    }
    if (event.key !== 'Enter' || event.shiftKey || event.altKey) return
    // A combobox, a tag input or a date field that used the key itself keeps it.
    if (event.defaultPrevented || event.isComposing) return
    const oneLine = origin instanceof HTMLInputElement && ONE_LINE.has(origin.type)
    const textarea = origin instanceof HTMLTextAreaElement && mod
    if (!oneLine && !textarea) return
    event.preventDefault()
    // `lintje-textarea` commits on Ctrl+Enter itself: a flush would commit it a second time.
    if (oneLine) this.#flush(origin)
    this.submit()
  }

  readonly #onClick = (event: MouseEvent): void => {
    const submit = event
      .composedPath()
      .find(
        (node): node is HTMLElement =>
          node instanceof HTMLElement &&
          node.localName === 'lintje-button' &&
          (node as unknown as { type?: string }).type === 'submit',
      )
    if (!submit || !this.contains(submit)) return
    // The button would also submit a host's `<form>` around this one: the form submits once.
    event.preventDefault()
    this.submit()
  }

  readonly #onBeforeUnload = (event: BeforeUnloadEvent): void => {
    event.preventDefault()
    event.returnValue = ''
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.addEventListener('lintje-change', this.#onChange)
    this.addEventListener('lintje-values-change', this.#onValuesChange)
    this.addEventListener('keydown', this.#onKeyDown)
    this.addEventListener('click', this.#onClick)
    this.#fields.observe(this, { childList: true, subtree: true })
  }

  override disconnectedCallback(): void {
    this.#fields.disconnect()
    this.removeEventListener('lintje-change', this.#onChange)
    this.removeEventListener('lintje-values-change', this.#onValuesChange)
    this.removeEventListener('keydown', this.#onKeyDown)
    this.removeEventListener('click', this.#onClick)
    window.removeEventListener('beforeunload', this.#onBeforeUnload)
    this.#fieldsDisabled.release()
    this.#stacked.release()
    super.disconnectedCallback()
  }

  /** The values to send: `values` with the draft over it; silent and native controls are read. */
  collect(): FormValues {
    const values: FormValues = { ...this.values, ...this.#draft }
    for (const control of namedControls(this)) {
      const name = controlName(control)
      if (!announces(control) || !(name in values)) values[name] = readControl(control)
    }
    return values
  }

  /** Drops a field from `values` and the draft; the form does this when a named field leaves. */
  forget(name: string): void {
    const inValues = name in this.values
    if (!inValues && !(name in this.#draft)) return
    delete this.#draft[name]
    if (inValues) {
      const values = { ...this.values }
      delete values[name]
      this.#quiet = true
      this.values = values
    }
    this.#storeDraft()
    this.#settle(this.phase === 'saved' && !Object.keys(this.#draft).length ? 'saved' : 'dirty')
  }

  /**
   * The draft put back from `localStorage`, readable before any field exists so a host can build
   * the rows it needs. A copy; `null` without a stored draft. Set `draft-key` and `draft-ttl`
   * before the first read: the store is read once.
   */
  get restoredDraft(): FormValues | null {
    this.#loadDraft()
    return this.#restored ? structuredClone(this.#restored.values) : null
  }

  /** When the restored draft was written; `null` when there is none. */
  get restoredAt(): Date | null {
    this.#loadDraft()
    return this.#restored ? new Date(this.#restored.savedAt) : null
  }

  /** Asks the host to save; does nothing while `busy`. */
  submit(): void {
    if (this.busy) return
    this.#attempted = true
    this.emit('lintje-submit', { values: this.collect() })
  }

  /** The host's word that the save succeeded. */
  saved(at: Date = new Date()): void {
    this.#commitSave()
    this.savedAt = at.toISOString()
  }

  /** Keeps the draft now (Ctrl+S). Without `draft-key` nothing is stored or said. */
  saveDraft(): void {
    if (!this.dirty || !this.draftKey) return
    this.#storeDraft()
    this.#draftSavedAt = new Date().toISOString()
    this.#settle('draft')
    this.requestUpdate()
  }

  discardDraft(): void {
    this.#draft = {}
    this.#restored = null
    this.#removeDraft()
    this.#writeFields()
    this.#settle('')
  }

  #draftSavedAt = ''

  #loadDraft(): void {
    if (this.#draftLoaded) return
    // A host may ask before it set `draft-key`: not yet the answer.
    if (!this.draftKey && !this.#started) return
    this.#draftLoaded = true
    const stored = this.draftKey ? readDraft(this.draftKey, this.draftTtl) : null
    if (!stored) return
    this.#draft = { ...stored.values }
    this.#restored = stored
  }

  #adopt(controls: HTMLElement[]): void {
    if (!controls.length || !this.hasUpdated) return
    const values = { ...this.values, ...this.#draft }
    for (const control of controls) {
      const name = controlName(control)
      if (name in values) writeControl(control, values[name])
    }
    if (this.busy) this.#fieldsDisabled.apply(controls, true)
    if (this.#mobile.matches) {
      this.#stacked.apply(
        controls.filter((control) => 'stacked' in control),
        true,
      )
    }
    if (this.errors) {
      this.#items = this.#placeErrors()
      this.requestUpdate()
    }
  }

  #flush(origin: EventTarget | undefined): void {
    if (origin instanceof HTMLInputElement || origin instanceof HTMLTextAreaElement) {
      origin.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }

  #commitSave(): void {
    // Before the first render the fields do not hold `values` yet: what is saved is what was given.
    this.values = this.hasUpdated ? this.collect() : { ...this.values, ...this.#draft }
    this.#draft = {}
    this.#restored = null
    this.#removeDraft()
    this.errors = undefined
    this.#settle('saved')
  }

  #settle(phase: Exclude<FormActionsState, 'busy'>): void {
    const dirty = Object.keys(this.#draft).length > 0
    if (dirty !== this.dirty) {
      this.dirty = dirty
      this.emit('lintje-dirty-change', dirty)
    }
    this.phase = phase === 'dirty' && !dirty ? '' : phase
  }

  #storeDraft(): void {
    if (!this.draftKey) return
    try {
      if (!Object.keys(this.#draft).length) return this.#removeDraft()
      const stored: StoredDraft = { savedAt: Date.now(), values: this.#draft }
      localStorage.setItem(DRAFT_PREFIX + this.draftKey, JSON.stringify(stored))
    } catch {
      // Private mode or a full store: the draft stays in memory.
    }
  }

  #removeDraft(): void {
    if (!this.draftKey) return
    try {
      localStorage.removeItem(DRAFT_PREFIX + this.draftKey)
    } catch {}
  }

  #writeFields(): void {
    const values = { ...this.values, ...this.#draft }
    for (const control of namedControls(this)) {
      const name = controlName(control)
      if (name in values) writeControl(control, values[name])
    }
  }

  #clearError(name: string, control: HTMLElement): void {
    if (!this.errors?.fields[name]) return
    const fields = { ...this.errors.fields }
    delete fields[name]
    if ('error' in control) (control as unknown as { error?: string }).error = undefined
    else markInvalid(control, false)
    this.#clearing = true
    this.errors = { ...this.errors, fields }
  }

  #placeErrors(): ErrorSummaryItem[] {
    const fields = this.errors?.fields ?? {}
    const items: ErrorSummaryItem[] = []
    const placed = new Set<string>()
    for (const control of namedControls(this)) {
      const name = controlName(control)
      const message = fields[name]
      if ('error' in control)
        (control as unknown as { error?: string }).error = message || undefined
      else markInvalid(control, Boolean(message))
      if (message && !placed.has(name)) {
        placed.add(name)
        const label = (control as unknown as { label?: string }).label
        items.push({ field: name, label: label || undefined, message })
      }
    }
    for (const [name, message] of Object.entries(fields)) {
      if (message && !placed.has(name)) items.push({ message })
    }
    return items
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (!this.#started) {
      this.#started = true
      this.#loadDraft()
      this.#settle(Object.keys(this.#draft).length ? 'dirty' : '')
    }
    if (changed.has('savedAt') && this.hasUpdated && this.savedAt && this.phase !== 'saved') {
      this.#commitSave()
    }
    if (changed.has('errors')) this.#items = this.#placeErrors()
    if (changed.has('busy') && this.busy) {
      this.#busyFocus = holdsFocus(this) ? deepActiveElement() : null
    }
    if (changed.has('dirty')) {
      if (this.dirty) window.addEventListener('beforeunload', this.#onBeforeUnload)
      else window.removeEventListener('beforeunload', this.#onBeforeUnload)
    }
  }

  #items: ErrorSummaryItem[] = []
  #attempted = false
  /** The errors changed because a field lost its own, not because the host answered. */
  #clearing = false

  get #hasErrors(): boolean {
    return this.#items.length > 0 || Boolean(this.errors?.form)
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (changed.has('values') && !this.#quiet) this.#writeFields()
    this.#quiet = false
    if (changed.has('busy')) {
      if (this.busy) this.#fieldsDisabled.apply(namedControls(this), true)
      else {
        this.#fieldsDisabled.release()
        this.#restoreFocus()
      }
    }
    if (this.#mobile.matches) {
      this.#stacked.apply(
        namedControls(this).filter((control) => 'stacked' in control),
        true,
      )
    } else this.#stacked.release()
    this.#tellActions()
    if (changed.has('errors')) {
      const fresh = !this.#clearing
      this.#clearing = false
      if (fresh && this.errors && this.#hasErrors) void this.#announceErrors(this.errors)
    }
  }

  /**
   * A native `disabled` drops the focus to the page. Once the fields have drawn themselves
   * enabled again, the control that had it gets it back — unless the reader moved on.
   */
  #restoreFocus(): void {
    const control = this.#busyFocus
    this.#busyFocus = null
    if (!control) return
    requestAnimationFrame(() => {
      const now = deepActiveElement()
      if (now && now !== document.body) return
      if (control.isConnected) control.focus()
    })
  }

  async #announceErrors(errors: FormErrors): Promise<void> {
    this.emit('lintje-invalid', errors)
    // The focus moves after a failed attempt only — not when a page arrives with its errors set.
    if (!this.#attempted) return
    this.#attempted = false
    const summary = this.renderRoot.querySelector<LintjeErrorSummary>('lintje-error-summary')
    if (!summary) return
    await summary.updateComplete
    summary.focus()
  }

  #tellActions(): void {
    const state: FormActionsState = this.busy ? 'busy' : this.phase
    const at = this.phase === 'draft' ? this.#draftSavedAt : (this.savedAt ?? '')
    for (const actions of this.querySelectorAll('lintje-form-actions')) {
      actions.state = state
      actions.savedAt = at
    }
  }

  protected override render(): TemplateResult {
    return html`<form
      class="lintje-form"
      novalidate
      aria-busy=${this.busy ? 'true' : nothing}
      @submit=${(event: Event) => {
        event.preventDefault()
        this.submit()
      }}
    >
      <lintje-error-summary
        class="lintje-form__summary"
        retry="Opnieuw proberen"
        ?hidden=${!this.#hasErrors}
        .items=${this.#items}
        .message=${this.errors?.form}
        @lintje-retry=${(event: Event) => {
          event.stopPropagation()
          this.submit()
        }}
      ></lintje-error-summary>
      <slot></slot>
    </form>`
  }
}

define('lintje-form', LintjeForm)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-form': LintjeForm
  }
}
