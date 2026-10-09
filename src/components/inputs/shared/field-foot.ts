/**
 * The foot of every field: the hint, or the message that replaces it. One line, so a field in
 * error does not grow taller than one with a hint, and `aria-describedby` names what is shown.
 */
import { html, nothing, type TemplateResult } from 'lit'
import { renderIcon } from '../../../icons/render'

export interface FootIds {
  hintId: string
  errorId: string
}

export function footDescribedBy(
  hint: string | undefined,
  message: string,
  ids: FootIds,
): string | typeof nothing {
  if (message) return ids.errorId
  return hint ? ids.hintId : nothing
}

/** `alert: false` leaves a message out of the alert region, for one that changes as the user types. */
export function renderFieldFoot(
  hint: string | undefined,
  message: string,
  ids: FootIds,
  alert = true,
): TemplateResult | typeof nothing {
  if (message) {
    return html`<span id=${ids.errorId} class="lintje-field__error" role=${alert ? 'alert' : nothing}
      >${renderIcon('functioneel-waarschuwing', { size: 14 })}${message}</span
    >`
  }
  return hint ? html`<span id=${ids.hintId} class="lintje-field__hint">${hint}</span>` : nothing
}
