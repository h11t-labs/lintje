/**
 * `LintjeInputElement` — what every control in `components/inputs/` has in common.
 *
 * Events: `lintje-change` (bubbles, not composed) carries the value to the component that drew
 * the control. `lintje-values-change` (composed, `{ [name]: value }`) goes out only when `name`
 * is set, so an input inside another component's shadow root does not leak a filter change.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeGridItemElement } from '../../../primitives/shared/grid-item-element'
import { footDescribedBy, renderFieldFoot } from './field-foot'
import { formEntries, readControl, writeControl } from '../../forms/form/controls'

const OPTIONAL = '(niet verplicht)'
const MODIFIED = 'afwijkend van standaard'

/** What an input may commit. A host serialises it into the URL. */
export type InputValue = string | number | boolean | null

export abstract class LintjeInputElement extends LintjeGridItemElement {
  static override properties: PropertyDeclarations = {
    name: { type: String },
    label: { type: String },
    hideLabel: { type: Boolean, attribute: 'hide-label' },
    hint: { type: String },
    error: { type: String },
    disabled: { type: Boolean, reflect: true },
    modified: { type: Boolean, reflect: true },
    required: { type: Boolean, reflect: true },
    optional: { type: Boolean },
    layout: { type: String, reflect: true },
    resetLabel: { type: String, attribute: 'reset-label' },
  }

  /** The filter key, e.g. `p.threshold`. Without it no `lintje-values-change` is sent. */
  name: string = ''
  label: string = ''
  hideLabel: boolean = false
  /**
   * `row`: a setting's row — the name and its hint on the left, the control on the right; stacked
   * again when the field itself is narrower than 35rem (a phone, a drawer). Left out, the label
   * stands above the control.
   */
  declare layout?: 'row'
  declare hint?: string
  /** The Dutch error message. */
  declare error?: string
  disabled: boolean = false
  /** Differs from the default: draws the orange dot by the label. */
  modified: boolean = false
  /** With `modified`: a link under the field ("Terugzetten naar 2 tot 12") that sends `lintje-reset`. */
  declare resetLabel?: string
  /** The field must be filled. Draws nothing; sets `aria-required` and form validity. */
  required: boolean = false
  /** Marks the label "(niet verplicht)", inside the label so it is in the accessible name. */
  optional: boolean = false

  /** Takes part in a native `<form>`: its value is posted under `name`. */
  static formAssociated = true

  /**
   * The one `ElementInternals` per element: `attachInternals()` may run only once, so the base
   * owns it and `LintjeFormInputElement` reuses it. `null` in happy-dom.
   */
  protected readonly internals: ElementInternals | null =
    typeof this.attachInternals === 'function' ? this.attachInternals() : null
  #first: unknown
  #seen = false

  constructor() {
    super()
    this.addController({ hostUpdated: () => this.syncForm() })
  }

  /** The value as the form posts it; a control whose wire shape differs overrides this. */
  protected get postedValue(): unknown {
    return readControl(this)
  }

  /** Puts the value in the native form around the control, in the shape `formEntries` gives. */
  protected syncForm(): void {
    if (!this.#seen) {
      this.#seen = true
      this.#first = structuredClone(readControl(this))
    }
    if (!this.internals) return
    const data = new FormData()
    if (this.name && !this.disabled) {
      for (const [key, value] of formEntries(this.name, this.postedValue)) data.append(key, value)
    }
    this.internals.setFormValue(data)
  }

  formResetCallback(): void {
    writeControl(this, structuredClone(this.#first))
  }

  /** The control's own `disabled`, or a `<fieldset disabled>` around it. */
  formDisabledCallback(disabled: boolean): void {
    this.disabled = disabled
  }

  protected get labelId(): string {
    return 'lintje-input-label'
  }

  /** The id of the one native control, for the label's `for`. */
  protected get controlId(): string {
    return 'lintje-input-control'
  }

  /** Focuses the native control, else the checked radio, else the first focusable part. */
  protected focusControl(options?: FocusOptions): void {
    // Disabled is out of the tab order: a label click or a script's `focus()` lands nowhere.
    if (this.disabled) return
    const root = this.renderRoot
    const target =
      root.querySelector<HTMLElement>(`#${this.controlId}`) ??
      root.querySelector<HTMLElement>('input[type="radio"]:checked:not(:disabled)') ??
      [...root.querySelectorAll<HTMLElement>('input, select, button, textarea')].find(
        (node) => !(node as HTMLInputElement).disabled,
      )
    target?.focus(options)
  }

  override focus(options?: FocusOptions): void {
    this.focusControl(options)
  }

  protected get hintId(): string {
    return 'lintje-input-hint'
  }

  protected get errorId(): string {
    return 'lintje-input-error'
  }

  /** The message under the control: the host's `error`, or a control's own when there is none. */
  protected get footMessage(): string {
    return this.error ?? ''
  }

  /** What `aria-describedby` points at: the message, else the hint. */
  protected get describedBy(): string | typeof nothing {
    return footDescribedBy(this.hint, this.footMessage, {
      hintId: this.hintId,
      errorId: this.errorId,
    })
  }

  /** One change, told twice: `lintje-change`, and `lintje-values-change` when `name` is set. */
  protected commit(value: InputValue): void {
    this.announce(value)
  }

  /** The same commit for a non-scalar value; `url` is the shape sent in `lintje-values-change`. */
  protected announce(value: unknown, url: unknown = value): void {
    // A disabled control commits nothing, even when something else moves it.
    if (this.disabled) return
    this.emitLocal('lintje-change', value)
    if (this.name) this.emit('lintje-values-change', { [this.name]: url })
  }

  /**
   * The label line. With `forId` a real `<label for>`; without, a span whose click focuses the
   * first part. `value` is shown behind the label and hidden with it.
   */
  protected renderLabel(
    forId?: string,
    value: TemplateResult | typeof nothing = nothing,
  ): TemplateResult {
    const focus = (): void => this.focusControl()
    if (this.hideLabel) {
      const hiddenSuffix = this.renderLabelSuffix()
      return forId
        ? html`<label id=${this.labelId} for=${forId} class="visually-hidden">${this.label} ${hiddenSuffix}</label>`
        : html`<span id=${this.labelId} class="visually-hidden" @click=${focus}>${this.label} ${hiddenSuffix}</span>`
    }
    const classes = classMap({ 'lintje-label': true, 'is-modified': this.modified })
    const dot = this.modified
      ? html`<span class="lintje-label__dot"><span class="visually-hidden">${MODIFIED}</span></span>`
      : nothing
    const suffix = this.renderLabelSuffix()
    return forId
      ? html`<label id=${this.labelId} for=${forId} class=${classes}>${this.label} ${suffix} ${dot} ${value}</label>`
      : html`<span id=${this.labelId} class=${classes} @click=${focus}>${this.label} ${suffix} ${dot} ${value}</span>`
  }

  protected renderLabelSuffix(): TemplateResult | typeof nothing {
    return this.isOptional ? html`<span class="lintje-label__optional">${OPTIONAL}</span>` : nothing
  }

  private get isOptional(): boolean {
    return this.optional && !this.required
  }

  /**
   * What the label says beyond its name — "(niet verplicht)" and the dot's words — for a name a
   * control builds as a string instead of pointing at the label. Starts with a space when not empty.
   */
  protected get labelSuffixText(): string {
    const words = [
      this.isOptional ? OPTIONAL : '',
      this.modified && !this.hideLabel ? MODIFIED : '',
    ]
    return words
      .filter(Boolean)
      .map((word) => ` ${word}`)
      .join('')
  }

  /** The label as a reader hears it; empty without a label. */
  protected get labelText(): string {
    return this.label ? `${this.label}${this.labelSuffixText}` : ''
  }

  protected renderFoot(): TemplateResult | typeof nothing {
    const foot = renderFieldFoot(this.hint, this.footMessage, {
      hintId: this.hintId,
      errorId: this.errorId,
    })
    if (!this.modified || !this.resetLabel) return foot
    // The host resets: it knows the default, the field only asks. The reset clears `modified`,
    // which removes this button, so the focus goes to the field first.
    const reset = (): void => {
      this.focusControl()
      this.emitLocal('lintje-reset')
    }
    return html`${foot}<button
        type="button"
        class="lintje-field__reset"
        ?disabled=${this.disabled}
        @click=${reset}
      >
        ${this.resetLabel}
      </button>`
  }
}

/**
 * `LintjeFormInputElement` — the text input, number input and textarea, which also stand in a
 * host's form. Beyond the base it posts a string value, reports `required` as validity on the
 * native control, and submits the host's form on Enter. `readonly` refuses every commit.
 */
export abstract class LintjeFormInputElement extends LintjeInputElement {
  static override properties: PropertyDeclarations = {
    // Reflected: a form submits under the `name` attribute.
    name: { type: String, reflect: true },
    readonly: { type: Boolean, reflect: true },
  }

  readonly: boolean = false

  abstract value: unknown

  private initialValue: unknown = undefined

  protected abstract get formValue(): string

  /** The native control, the anchor of the validation message. */
  protected get nativeControl(): HTMLInputElement | HTMLTextAreaElement | null {
    return this.renderRoot.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `#${this.controlId}`,
    )
  }

  protected override announce(value: unknown, url: unknown = value): void {
    if (this.readonly) return
    super.announce(value, url)
  }

  protected override firstUpdated(changed: PropertyValues<this>): void {
    super.firstUpdated(changed)
    this.initialValue = this.value
  }

  // The base posts via `syncForm`; these post a string and set validity in `updated`.
  protected override syncForm(): void {}

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    const internals = this.internals
    if (!internals) return
    internals.setFormValue(this.disabled ? null : this.formValue)
    const control = this.nativeControl
    const missing = this.required && !this.disabled && !this.readonly && this.formValue === ''
    if (missing && control) {
      internals.setValidity(
        { valueMissing: true },
        control.validationMessage || 'Vul dit veld in.',
        control,
      )
    } else {
      internals.setValidity({})
    }
  }

  /**
   * Enter commits, then submits the host's form: the native control sits in a shadow root, so
   * implicit submission cannot reach it. Waits a task so `lintje-form` can prevent it.
   */
  protected submitOnEnter(event: KeyboardEvent, commit: () => void): void {
    if (event.key !== 'Enter' || event.isComposing || this.readonly || this.disabled) return
    commit()
    const form = this.internals?.form
    if (!form || typeof form.requestSubmit !== 'function') return
    setTimeout(() => {
      if (!event.defaultPrevented) form.requestSubmit()
    })
  }

  // The native control is written too: uncommitted text left the property unchanged.
  override formResetCallback(): void {
    this.value = this.initialValue
    const control = this.nativeControl
    if (control) control.value = this.formValue
    // Validity is set in `updated`, which an unchanged value would not run.
    this.requestUpdate()
  }
}
