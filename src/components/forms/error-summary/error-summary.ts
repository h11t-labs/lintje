/**
 * `<lintje-error-summary>` — the error summary above a form, with a link to each field.
 *
 * It never validates, and with nothing to show it draws nothing. A link focuses the field, found
 * by `name` or `id` in the summary's own tree or, from a shadow root, in its host's light DOM, and
 * scrolls it into view clear of a sticky top bar and the form's action bar. `<name>-other` is the
 * field under a choice group's "Anders".
 *
 * It is no alert: the focus is the announcement. A host that shows it after an attempt calls its
 * `focus()`, as `lintje-form` does; a page that arrives with its errors set leaves the focus alone.
 *
 * Events: `lintje-retry` ("Opnieuw proberen" was pressed).
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { statusIcon } from '../../shared/tone'
import { controlForKey, focusInside, namedControls, otherField } from '../../shared/controls'
import '../../actions/button/button'
import errorSummaryCss from './error-summary.css?inline'

/** `field` is the field's `name`; without it (a field not on the page) the line is plain text. */
export interface ErrorSummaryItem {
  field?: string
  label?: string
  message: string
}

export function summaryHeading(count: number): string {
  return `Controleer ${count} ${count === 1 ? 'veld' : 'velden'}`
}

function fieldIn(scope: ParentNode, field: string): HTMLElement | null {
  const found = controlForKey(namedControls(scope), field)
  if (found?.other) return otherField(found.control.shadowRoot ?? found.control) ?? found.control
  return (
    found?.control ?? scope.querySelector<HTMLElement>(`[id="${field.replace(/["\\]/g, '\\$&')}"]`)
  )
}

const isShadowRoot = (node: Node): node is ShadowRoot =>
  node.nodeType === Node.DOCUMENT_FRAGMENT_NODE && 'host' in node

/** Searches the summary's tree, then each host's light DOM outwards to the document. */
export function findField(from: Node, field: string): HTMLElement | null {
  let root = from.getRootNode()
  while (isShadowRoot(root)) {
    const found = fieldIn(root, field) ?? fieldIn(root.host, field)
    if (found) return found
    root = root.host.getRootNode()
  }
  return root.nodeType === Node.DOCUMENT_NODE ? fieldIn(root as Document, field) : null
}

export class LintjeErrorSummary extends LintjeElement {
  static override styles = [iconStyles, shadowCss(errorSummaryCss)]

  static override properties: PropertyDeclarations = {
    items: { attribute: false },
    message: { type: String },
    heading: { type: String },
    retry: { type: String },
  }

  /** The field errors, in the order of the form. */
  items: ErrorSummaryItem[] = []
  /** The error that belongs to no field: one sentence. */
  declare message?: string
  /** Overrides the default heading (the count, or "Opslaan is niet gelukt"). */
  declare heading?: string
  /** The label of the retry button under `message`; without it there is none. */
  declare retry?: string

  get hasErrors(): boolean {
    return this.items.length > 0 || Boolean(this.message)
  }

  /** Puts the focus on the frame (`tabindex="-1"`). */
  override focus(options?: FocusOptions): void {
    this.renderRoot.querySelector<HTMLElement>('.lintje-error-summary')?.focus(options)
  }

  private goTo(event: Event, item: ErrorSummaryItem): void {
    event.preventDefault()
    const field = item.field ? findField(this, item.field) : null
    if (!field) return
    field.scrollIntoView?.({ block: 'center' })
    focusInside(field, { preventScroll: true })
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.hasErrors) return nothing
    const heading =
      this.heading ??
      (this.items.length ? summaryHeading(this.items.length) : 'Opslaan is niet gelukt')
    return html`<div
      class="lintje-error-summary"
      role="group"
      aria-labelledby="lintje-error-summary-heading"
      tabindex="-1"
    >
      ${renderIcon(statusIcon('error', this.isNewStyle), { size: 20, className: 'lintje-error-summary__icon' })}
      <div class="lintje-error-summary__body">
        <h3 id="lintje-error-summary-heading" class="lintje-error-summary__heading">${heading}</h3>
        ${
          this.items.length
            ? html`<ul class="lintje-error-summary__list">
              ${this.items.map(
                (item) =>
                  html`<li class="lintje-error-summary__item">
                    ${
                      item.field
                        ? html`<a
                          class="lintje-error-summary__link"
                          href="#${item.field}"
                          @click=${(event: Event) => this.goTo(event, item)}
                          >${item.label ? `${item.label}: ${item.message}` : item.message}</a
                        >`
                        : item.message
                    }
                  </li>`,
              )}
            </ul>`
            : nothing
        }
        ${
          this.message
            ? html`<p class="lintje-error-summary__message">
              ${this.message}
              ${
                this.retry
                  ? html`<lintje-button variant="link" @click=${() => this.emit('lintje-retry')}
                    >${this.retry}</lintje-button
                  >`
                  : nothing
              }
            </p>`
            : nothing
        }
      </div>
    </div>`
  }
}

define('lintje-error-summary', LintjeErrorSummary)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-error-summary': LintjeErrorSummary
  }
}
