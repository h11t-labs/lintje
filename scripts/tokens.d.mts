/** Types for `tokens.mjs`. */
export interface TokenEntry {
  name: string
  comment: string
}
export function tokensOf(css: string): TokenEntry[]
