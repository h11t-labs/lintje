/**
 * Types for `normalise.mjs`. The implementation is plain JavaScript because
 * `npm run build:icons` runs it in bare Node; the bundle imports it through these.
 */
export interface Glyph {
  viewBox: string
  attributes: Record<string, string>
  body: string
}

export declare const KEEP: string[]
export declare function isEmblem(name: string): boolean
export declare function normaliseSvg(name: string, svg: string): Glyph
