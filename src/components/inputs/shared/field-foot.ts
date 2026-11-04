/**
 * The line of every field between its label and its control: the hint, or the message that
 * replaces it. One line, so a field in error does not grow taller than one with a hint, and
 * `aria-describedby` names what is shown. A lone choice draws the same line under its label.
 */
import { html, nothing, type TemplateResult } from 'lit'
import { renderIcon } from '../../../icons/render'

export interface FootIds {
  hintId: string
  errorId: string
}

/** Where a control's `description` stands: hidden text, read after its label. */
export const DESCRIPTION_ID = 'lintje-input-description'

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

/** A control's `description`, never drawn: the host shows those words itself. */
export function renderDescription(
  description: string | undefined,
): TemplateResult | typeof nothing {
  return description
    ? html`<span id=${DESCRIPTION_ID} class="visually-hidden">${description}</span>`
    : nothing
}

/** `aria-describedby` with the description in front of the ids of the foot. */
export function describedWith(
  description: string | undefined,
  ids: string | typeof nothing,
): string | typeof nothing {
  const all = [description ? DESCRIPTION_ID : '', ids === nothing ? '' : ids]
  return all.filter(Boolean).join(' ') || nothing
}
