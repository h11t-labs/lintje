/**
 * Plain BEM CSS (`?inline`) as a shadow-root stylesheet: `shadowCss()` rewrites document-level
 * selectors onto `:host` and caches one `CSSResult` per source, so a sheet is parsed once.
 */
import { unsafeCSS, type CSSResult } from 'lit'
import tokens from '../tokens/tokens.css?inline'
import base from '../tokens/base.css?inline'

/**
 * Document-level selectors onto the element itself.
 *
 * - `@font-face` is dropped: Chromium ignores it in a shadow root; the host page declares fonts.
 * - `:root:not(X)` becomes `:host(:not(X))`: `:host:not(X)` does not match in Chromium.
 *   It runs before the plain `:root` rule.
 * - `[data-mode=…]`, `[data-style=…]` and `[data-corner=…]` become `:host([…])`, with the value
 *   quoted as the source writes it or bare as the minifier leaves it; a run of them
 *   (`[data-mode='dark'][data-style='new']`) becomes one `:host([…][…])`, as `:host([a])[b]` does
 *   not match.
 */
export function toShadowCss(css: string): string {
  return css
    .replace(/@font-face\s*\{[^}]*\}/g, '')
    .replace(/html,\s*body,\s*#root\s*\{[^}]*\}/g, '')
    .replace(/:root:not\(([^)]*)\)/g, ':host(:not($1))')
    .replace(/:root(?![\w-])/g, ':host')
    .replace(
      /(^|[\s,{}])((?:\[data-(?:mode|style|corner)=(?:'[^']*'|"[^"]*"|[\w-]+)\])+)/gm,
      '$1:host($2)',
    )
}

const cache = new Map<string, CSSResult>()

/** The stylesheet of one copied CSS file, scoped to the shadow root and shared. */
export function shadowCss(css: string): CSSResult {
  let sheet = cache.get(css)
  if (!sheet) {
    sheet = unsafeCSS(toShadowCss(css))
    cache.set(css, sheet)
  }
  return sheet
}

export const tokenStyles: CSSResult = shadowCss(tokens)

export const baseStyles: CSSResult = shadowCss(base)
