/**
 * The field of an own answer ("Anders, namelijk"): a `lintje-text-input` under the option that
 * opens it, labelled by the option's word. The choice groups and the chat questions' "Iets
 * anders…" draw it. It checks nothing: whoever draws it sets the host's message as `error`, so it
 * says it must be filled with `aria-required` alone.
 */
import { html, nothing, type TemplateResult } from 'lit'
import { otherField } from './controls'
import '../inputs/text-input/text-input'

/** The words for a chosen "Anders" with an empty field, so every form says the same. */
export const OTHER_MISSING_TEXT = 'Vul in wat je bedoelt.'

export interface OtherFieldOptions {
  /** The option's word: the field's hidden label. */
  label: string
  text: string
  placeholder?: string
  error?: string
  disabled?: boolean
  /** The holder's class for the field's place. */
  className?: string
  /** The text, committed when the reader leaves the field or presses Enter. */
  onCommit: (text: string) => void
}

export function renderOtherField(options: OtherFieldOptions): TemplateResult {
  return html`<lintje-text-input
    class=${options.className ?? nothing}
    data-other
    hide-label
    soft-required
    label=${options.label}
    .value=${options.text}
    placeholder=${options.placeholder ?? ''}
    .error=${options.error || undefined}
    ?disabled=${Boolean(options.disabled)}
    @lintje-change=${(event: CustomEvent<string>) => {
      event.stopPropagation()
      options.onCommit(event.detail)
    }}
  ></lintje-text-input>`
}

/** Puts the focus in the field once it has drawn itself. */
export async function focusOtherField(root: ParentNode): Promise<void> {
  const field = otherField(root)
  if (!field) return
  await field.updateComplete
  field.focus()
}
