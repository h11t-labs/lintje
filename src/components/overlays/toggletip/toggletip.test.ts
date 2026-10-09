/**
 * The toggletip: a click opens and closes it, Escape closes it and leaves the focus on
 * the trigger, a click outside closes it, `aria-expanded` follows, and the text stands
 * in a `role="status"` region that is there before it opens. Where the popover stands
 * is geometry and is checked in a browser.
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import './toggletip'
import type { LintjeToggletip } from './toggletip'

// Read from disk, not imported: vitest does not run the CSS pipeline, so an
// `?inline` import comes back empty.
const toggletipCss = readFileSync(
  resolvePath('src/components/overlays/toggletip/toggletip.css'),
  'utf8',
)

async function mount(): Promise<LintjeToggletip> {
  const element = document.createElement('lintje-toggletip')
  element.textContent = 'De mediaan van de wachttijd per kwartier.'
  document.body.append(element)
  await element.updateComplete
  return element
}

const trigger = (element: LintjeToggletip): HTMLButtonElement =>
  element.shadowRoot!.querySelector('button') as HTMLButtonElement
const region = (element: LintjeToggletip): HTMLElement =>
  element.shadowRoot!.querySelector('[role="status"]') as HTMLElement

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('lintje-toggletip', () => {
  it('names its trigger and points it at the region', async () => {
    const element = await mount()
    expect(trigger(element).getAttribute('aria-label')).toBe('Toelichting')
    expect(trigger(element).getAttribute('aria-controls')).toBe(region(element).id)
    expect(trigger(element).getAttribute('aria-expanded')).toBe('false')
  })

  it('keeps an empty status region while closed and fills it on open', async () => {
    const element = await mount()
    expect(region(element)).not.toBeNull()
    expect(region(element).querySelector('slot')).toBeNull()
    const closed = region(element)
    trigger(element).click()
    await element.updateComplete
    // The same region, now with the text in it.
    expect(region(element)).toBe(closed)
    expect(region(element).querySelector('slot')).not.toBeNull()
  })

  it('keeps the closed region in the accessibility tree: visually hidden, never display: none', async () => {
    const element = await mount()
    expect(region(element).classList.contains('visually-hidden')).toBe(true)
    const rules = toggletipCss.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(rules).not.toMatch(/__popover[^{}]*\{[^}]*display:\s*none/)
    trigger(element).click()
    await element.updateComplete
    expect(region(element).classList.contains('visually-hidden')).toBe(false)
    expect(region(element).classList.contains('is-open')).toBe(true)
  })

  it('toggles on a click, and says so', async () => {
    const element = await mount()
    const seen: boolean[] = []
    element.addEventListener('lintje-toggle', (event) =>
      seen.push((event as CustomEvent<{ open: boolean }>).detail.open),
    )
    trigger(element).click()
    await element.updateComplete
    expect(element.open).toBe(true)
    expect(element.hasAttribute('open')).toBe(true)
    expect(trigger(element).getAttribute('aria-expanded')).toBe('true')
    trigger(element).click()
    await element.updateComplete
    expect(element.open).toBe(false)
    expect(trigger(element).getAttribute('aria-expanded')).toBe('false')
    expect(seen).toEqual([true, false])
  })

  it('closes on Escape and keeps the focus on the trigger', async () => {
    const element = await mount()
    trigger(element).focus()
    trigger(element).click()
    await element.updateComplete
    trigger(element).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
    )
    await element.updateComplete
    expect(element.open).toBe(false)
    expect(element.shadowRoot!.activeElement).toBe(trigger(element))
  })

  it('closes on a click outside, not on one inside', async () => {
    const element = await mount()
    const outside = document.createElement('p')
    document.body.append(outside)
    trigger(element).click()
    await element.updateComplete
    region(element).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }))
    await element.updateComplete
    expect(element.open).toBe(true)
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }))
    await element.updateComplete
    expect(element.open).toBe(false)
  })

  it('closes when the focus leaves it', async () => {
    const element = await mount()
    const elsewhere = document.createElement('button')
    document.body.append(elsewhere)
    trigger(element).focus()
    trigger(element).click()
    await element.updateComplete
    elsewhere.focus()
    await element.updateComplete
    expect(element.open).toBe(false)
  })

  it('stays open when the focus falls back to a box around it', async () => {
    const element = await mount()
    trigger(element).click()
    await element.updateComplete
    // A press on the bubble's text, inside a focusable box such as the shell's main region.
    trigger(element).dispatchEvent(
      new FocusEvent('focusout', { relatedTarget: document.body, bubbles: true, composed: true }),
    )
    await element.updateComplete
    expect(element.open).toBe(true)
  })

  it('stands on the popover layer and goes above a trigger with no room below', async () => {
    const element = await mount()
    const rules = toggletipCss.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(rules).toMatch(/z-index:\s*85;/)
    const button = trigger(element)
    const height = window.innerHeight || 768
    button.getBoundingClientRect = () =>
      ({ top: height - 40, bottom: height - 8, left: 100, right: 140, width: 40 }) as DOMRect
    button.click()
    await element.updateComplete
    await element.updateComplete
    const style = region(element).style
    expect(style.top).toBe('')
    expect(style.bottom).toBe(`${40 + 4}px`)
  })
})
