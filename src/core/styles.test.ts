/**
 * `toShadowCss()` on the CSS as the build hands it over: minified, so an attribute value has
 * lost its quotes and the rules their whitespace.
 */
import { describe, expect, it } from 'vitest'
import { toShadowCss } from './styles'

describe('toShadowCss', () => {
  it('moves the dark block onto the host, quoted or bare', () => {
    expect(toShadowCss(`[data-mode='dark'] { --a: 1; }`)).toBe(
      `:host([data-mode='dark']) { --a: 1; }`,
    )
    expect(toShadowCss(`[data-mode=dark]{--a:1}`)).toBe(`:host([data-mode=dark]){--a:1}`)
    expect(toShadowCss(`:root{--a:0}[data-mode=dark]{--a:1}`)).toBe(
      `:host{--a:0}:host([data-mode=dark]){--a:1}`,
    )
  })

  it('leaves a host rule the source already wrote alone', () => {
    expect(toShadowCss(`:host([data-mode=dark]){--a:1}`)).toBe(`:host([data-mode=dark]){--a:1}`)
  })

  it('rewrites :root, also minified, and drops @font-face', () => {
    expect(toShadowCss(`:root:not(.x){--a:1}:root{--b:2}`)).toBe(
      `:host(:not(.x)){--a:1}:host{--b:2}`,
    )
    expect(
      toShadowCss(`@font-face{font-family:a;src:url(a.woff2)}html,body,#root{margin:0}.x{}`),
    ).toBe(`.x{}`)
  })
})
