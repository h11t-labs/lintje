/**
 * What the content tiles (chart, map, data table) share: the expand action.
 * The content is rendered a second time in `<lintje-modal>`, owned by the element that has the
 * data. The modal's events stop here, like the tile's own, so one action is one line in a log.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { LintjeGridItemElement } from '../../primitives/shared/grid-item-element'
import '../overlays/modal/modal'

export interface ExpandModalOptions {
  heading?: string
  subtitle?: string
  footnote?: string
  /** Writes the CSV; without it the button stays away. */
  csv?: () => void
  /** Writes the PNG — only for content that is an svg. */
  png?: () => void
}

export class LintjeContentTileElement extends LintjeGridItemElement {
  static override properties: PropertyDeclarations = {
    expanded: { state: true },
  }

  expanded: boolean = false

  protected expand(open: boolean): void {
    if (this.expanded === open) return
    this.expanded = open
    this.expandChanged(open)
  }

  /** Hook for what an element sets up or tears down when the modal opens or closes. */
  protected expandChanged(_open: boolean): void {}

  protected renderExpandModal(content: unknown, options: ExpandModalOptions): TemplateResult {
    const { heading, subtitle, footnote, csv, png } = options
    return html`<lintje-modal
      .open=${this.expanded}
      heading=${heading ?? 'Vergroot'}
      subtitle=${subtitle ?? nothing}
      .csv=${csv !== undefined}
      .png=${png !== undefined}
      @lintje-close=${(event: Event) => {
        event.stopPropagation()
        this.expand(false)
      }}
      @lintje-download-csv=${(event: Event) => {
        event.stopPropagation()
        csv?.()
      }}
      @lintje-download-png=${(event: Event) => {
        event.stopPropagation()
        png?.()
      }}
    >
      ${content}${footnote ? html`<span slot="footer">${footnote}</span>` : nothing}
    </lintje-modal>`
  }
}
