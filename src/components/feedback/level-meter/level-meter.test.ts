/** The level meter: bars that follow the sound, and the word that names it. */
import { afterEach, describe, expect, it } from 'vitest'
import './level-meter'
import { levelWord, type LintjeLevelMeter } from './level-meter'

async function mount(props: Partial<LintjeLevelMeter>): Promise<LintjeLevelMeter> {
  const element = Object.assign(document.createElement('lintje-level-meter'), props)
  document.body.append(element)
  await element.updateComplete
  return element
}

afterEach(() => document.body.replaceChildren())

describe('lintje-level-meter', () => {
  it('names the sound in words, for the eye and the screen reader', async () => {
    const root = (await mount({ level: 0.7 })).shadowRoot!
    expect(root.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('Geluid: goed')
    expect(root.querySelector('.lintje-level-meter__word')!.textContent).toBe('Goed')
    expect(root.querySelectorAll('.lintje-level-meter__bar').length).toBeGreaterThan(4)
  })

  it('lies flat and says so when it hears nothing', async () => {
    const root = (await mount({ level: 0 })).shadowRoot!
    expect(root.querySelector('.lintje-level-meter.is-quiet')).not.toBeNull()
    expect(root.querySelector('.lintje-level-meter__word')!.textContent).toBe('Stil')
  })

  it('shows a dash, not "Stil", before anything is measured', async () => {
    const root = (await mount({ level: null })).shadowRoot!
    expect(root.querySelector('.lintje-level-meter__word')!.textContent).toBe('—')
    expect(root.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe(
      'Geluid: nog niet gemeten',
    )
  })

  it('leaves the word to the host without words', async () => {
    const root = (await mount({ level: 0.5, words: false })).shadowRoot!
    expect(root.querySelector('.lintje-level-meter__word')).toBeNull()
  })

  it('reads the level in words', () => {
    expect(levelWord(0.01)).toBe('Stil')
    expect(levelWord(0.1)).toBe('Zacht')
    expect(levelWord(0.7)).toBe('Goed')
  })
})
