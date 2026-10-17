/** Types for `tokens.mjs`. */
export interface TokenEntry {
  name: string
  comment: string
  /** The section of `tokens.css` it stands in. */
  group: string
}
export function tokensOf(css: string): TokenEntry[]
