/**
 * The fixed text beside a field's input — a currency sign, a domain, a unit — which the reader
 * never types and which is never part of the value. The input names it in `aria-describedby`.
 */
import { html, nothing, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'

export const PREFIX_ID = 'lintje-input-prefix'
export const SUFFIX_ID = 'lintje-input-suffix'

export interface AddonState {
  readonly: boolean
  disabled: boolean
}

export function renderAddon(
  side: 'prefix' | 'suffix',
  text: string | null | undefined,
  state: AddonState,
): TemplateResult | typeof nothing {
  if (!text) return nothing
  return html`<span
    id=${side === 'prefix' ? PREFIX_ID : SUFFIX_ID}
    class=${classMap({
      'lintje-field__addon': true,
      [`lintje-field__addon--${side}`]: true,
      'is-readonly': state.readonly,
      'is-disabled': state.disabled,
    })}
    >${text}</span
  >`
}

/** The addons' ids before what the field already points at, in reading order. */
export function addonDescribedBy(
  prefix: boolean,
  suffix: boolean,
  rest: string | typeof nothing,
): string | typeof nothing {
  const ids = [prefix ? PREFIX_ID : '', suffix ? SUFFIX_ID : '', rest === nothing ? '' : rest]
  return ids.filter(Boolean).join(' ') || nothing
}
