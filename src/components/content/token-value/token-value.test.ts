/**
 * What a token computes to, and when the element reads it again.
 *
 * happy-dom resolves a custom property and validates a `color`, which is enough for the
 * formatter and the re-reading. It evaluates no `color-mix()`, `oklch()`, `rem` or `font`
 * shorthand: those steps are a browser's and show in the style guide's Fundament pages.
 */
import { afterEach, describe, expect, it } from 'vitest'
import './token-value'
import { NO_VALUE, formatColour, type LintjeTokenValue } from './token-value'

/** An element carrying its own declarations, so it needs no stylesheet. */
async function tokenValue(
  name: string,
  declared: Record<string, string> = {},
): Promise<LintjeTokenValue> {
  const element = document.createElement('lintje-token-value')
  for (const [property, value] of Object.entries(declared)) {
    element.style.setProperty(property, value)
  }
  element.name = name
  document.body.append(element)
  await element.updateComplete
  return element
}

const part = (element: LintjeTokenValue, name: string): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>(`.lintje-token-value__${name}`)!

const shown = (element: LintjeTokenValue): string => part(element, 'value').textContent!.trim()

/** A MutationObserver delivers on a microtask; the re-render is one more await. */
async function settle(element: LintjeTokenValue): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await element.updateComplete
}

afterEach(() => {
  document.documentElement.removeAttribute('data-mode')
  document.documentElement.removeAttribute('data-theme')
  document.body.replaceChildren()
})

describe('formatColour', () => {
  it('prints a computed colour as upper-case hex', () => {
    expect(formatColour('rgb(14, 61, 110)')).toBe('#0E3D6E')
    expect(formatColour('rgb(43 84 127)')).toBe('#2B547F')
    expect(formatColour('color(srgb 0.054901 0.239215 0.431372)')).toBe('#0E3D6E')
  })

  it('adds the alpha in percent when the colour is not opaque', () => {
    expect(formatColour('rgba(0, 0, 0, 0.6)')).toBe('#000000 · 60 %')
    expect(formatColour('color(srgb 0 0 0 / 0.14)')).toBe('#000000 · 14 %')
  })

  it('clamps a channel outside sRGB', () => {
    expect(formatColour('color(srgb 1.02 -0.01 0.5)')).toBe('#FF0080')
  })

  it('is null for what is not a computed sRGB colour', () => {
    expect(formatColour('16px')).toBeNull()
    expect(formatColour('oklch(0.5 0.1 240)')).toBeNull()
    expect(formatColour('0 1px 2px rgba(0, 0, 0, 0.08)')).toBeNull()
  })
})

describe('lintje-token-value', () => {
  it('shows a colour as its hex, with a swatch of the token', async () => {
    const element = await tokenValue('--demo-colour', { '--demo-colour': '#0E3D6E' })
    expect(shown(element)).toBe('#0E3D6E')
    expect(part(element, 'swatch').hidden).toBe(false)
    expect(part(element, 'swatch').style.background).toBe('var(--demo-colour)')
  })

  it('leaves the swatch out when asked', async () => {
    const element = await tokenValue('--demo-colour', { '--demo-colour': '#0E3D6E' })
    element.noSwatch = true
    await element.updateComplete
    expect(shown(element)).toBe('#0E3D6E')
    expect(part(element, 'swatch').hidden).toBe(true)
  })

  it('shows a size as it computes, without a swatch', async () => {
    const element = await tokenValue('--demo-space', { '--demo-space': '16px' })
    expect(shown(element)).toBe('16px')
    expect(part(element, 'swatch').hidden).toBe(true)
  })

  it('shows an em dash for a property nothing declares', async () => {
    const element = await tokenValue('--demo-absent')
    expect(shown(element)).toBe(NO_VALUE)
    expect(part(element, 'swatch').hidden).toBe(true)
  })

  it('reads the property again when the theme on <html> changes', async () => {
    // The base class follows only `data-mode`: a theme switch reaching the value proves the
    // element's own observer.
    const element = await tokenValue('--demo-primary', { '--demo-primary': '#0E3D6E' })
    element.style.setProperty('--demo-primary', '#0E61AA')
    document.documentElement.setAttribute('data-theme', 'marine')
    await settle(element)
    expect(shown(element)).toBe('#0E61AA')
  })

  it('reads the property again when the mode on <html> changes', async () => {
    const element = await tokenValue('--demo-surface', { '--demo-surface': '#FFFFFF' })
    element.style.setProperty('--demo-surface', '#282828')
    document.documentElement.setAttribute('data-mode', 'dark')
    await settle(element)
    expect(shown(element)).toBe('#282828')
  })

  it('stops watching the document once it is taken off the page', async () => {
    const element = await tokenValue('--demo-primary', { '--demo-primary': '#0E3D6E' })
    element.remove()
    element.style.setProperty('--demo-primary', '#0E61AA')
    document.documentElement.setAttribute('data-theme', 'marine')
    await settle(element)
    expect(shown(element)).toBe('#0E3D6E')
  })

  it('reads the new property when its name changes', async () => {
    const element = await tokenValue('--demo-one', {
      '--demo-one': '#0E3D6E',
      '--demo-two': '16px',
    })
    element.name = '--demo-two'
    await element.updateComplete
    expect(shown(element)).toBe('16px')
  })
})
