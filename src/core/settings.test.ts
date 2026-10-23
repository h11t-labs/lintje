/**
 * The settings every element mirrors onto its host: the house style and the corner, read from
 * the nearest ancestor as the mode is, and refreshed when `<html>` changes.
 */
import { afterEach, describe, expect, it } from 'vitest'
import '../components/actions/button/button'
import type { LintjeElement } from './element'

const root = document.documentElement

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

async function mount(): Promise<LintjeElement> {
  const element = document.createElement('lintje-button') as LintjeElement
  document.body.append(element)
  await element.updateComplete
  return element
}

afterEach(() => {
  document.body.innerHTML = ''
  root.removeAttribute('data-style-version')
  root.removeAttribute('data-page-corner')
})

describe('the house style and the corner', () => {
  it('are classic and round by default, mirrored on the host', async () => {
    const element = await mount()
    expect(element.dataset.styleVersion).toBe('classic')
    expect(element.dataset.pageCorner).toBe('round')
    expect(element.resolvedStyle).toBe('classic')
  })

  it('follow the nearest ancestor, and a change of it', async () => {
    root.dataset.styleVersion = 'new'
    root.dataset.pageCorner = 'square'
    const element = await mount()
    expect(element.dataset.styleVersion).toBe('new')
    expect(element.dataset.pageCorner).toBe('square')
    root.dataset.pageCorner = 'round'
    await settle()
    expect(element.dataset.pageCorner).toBe('round')
    expect(element.resolvedCorner).toBe('round')
    root.removeAttribute('data-style-version')
    await settle()
    expect(element.dataset.styleVersion).toBe('classic')
  })

  it('treat an unknown value as the default', async () => {
    root.dataset.styleVersion = 'other'
    const element = await mount()
    expect(element.dataset.styleVersion).toBe('classic')
  })
})
