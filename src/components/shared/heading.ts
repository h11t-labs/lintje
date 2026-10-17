/** A heading at the level the host asks for; `h3` when it asks for none. */
import { html, nothing, type TemplateResult } from 'lit'

export type HeadingLevel = 2 | 3 | 4 | 5 | 6

export function renderHeading(
  level: HeadingLevel | undefined,
  className: string,
  content: unknown,
  id?: string,
): TemplateResult {
  const at = id ?? nothing
  switch (level) {
    case 2:
      return html`<h2 id=${at} class=${className}>${content}</h2>`
    case 4:
      return html`<h4 id=${at} class=${className}>${content}</h4>`
    case 5:
      return html`<h5 id=${at} class=${className}>${content}</h5>`
    case 6:
      return html`<h6 id=${at} class=${className}>${content}</h6>`
    default:
      return html`<h3 id=${at} class=${className}>${content}</h3>`
  }
}
