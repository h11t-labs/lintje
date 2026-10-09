/**
 * The explainer's heading level. It sits in a page section, under the page
 * title's `h2`, so its title is an `h3` — the same level as a tile's.
 */
import { afterEach, describe, expect, it } from 'vitest'
import './explainer'
import type { LintjeExplainer } from './explainer'

const mounted: HTMLElement[] = []
afterEach(() => {
  for (const element of mounted.splice(0)) element.remove()
})

describe('lintje-explainer', () => {
  it('renders its title as an h3 that holds the disclosure button', async () => {
    const element = document.createElement('lintje-explainer') as LintjeExplainer
    element.data = {
      title: 'Over deze cijfers',
      items: [{ term: 'Wachttijd', description: 'De mediaan per kwartier.' }],
    }
    document.body.append(element)
    mounted.push(element)
    await element.updateComplete
    const heading = element.shadowRoot!.querySelector('h3.lintje-disclosure__heading')!
    expect(heading.textContent!.trim()).toBe('Over deze cijfers')
    // The heading holds the button, so the heading is not presentational.
    const button = heading.querySelector(':scope > button.lintje-disclosure__header')!
    expect(button.hasAttribute('aria-expanded')).toBe(true)
    expect(button.querySelector('h3')).toBeNull()
  })
})
