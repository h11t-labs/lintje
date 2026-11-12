/** The level meter: bars that follow the sound, and the word that names it. */
import { afterEach, describe, expect, it } from 'vitest'
import './level-meter'
import { levelWord, litSteps, type LintjeLevelMeter } from './level-meter'

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

  it('lights its share of the steps, in the colour of the tone, and counts them out loud', async () => {
    const root = (
      await mount({ level: 0.5, steps: 4, tone: 'warning', name: 'Verbinding', word: 'Zwak' })
    ).shadowRoot!
    expect(root.querySelectorAll('.lintje-level-meter__step')).toHaveLength(4)
    expect(root.querySelectorAll('.lintje-level-meter__step.is-lit')).toHaveLength(2)
    expect(root.querySelector('.lintje-level-meter.is-warning')).not.toBeNull()
    expect(root.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe(
      'Verbinding: zwak, 2 van 4',
    )
    expect(root.querySelector('.lintje-level-meter__word')!.textContent).toBe('Zwak')
  })

  it("never borrows the sound's words for steps, and lies quiet with none lit", async () => {
    const root = (await mount({ level: 0, steps: 4, name: 'Verbinding' })).shadowRoot!
    expect(root.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe(
      'Verbinding: 0 van 4',
    )
    expect(root.querySelector('.lintje-level-meter__word')).toBeNull()
    expect(root.querySelector('.lintje-level-meter.is-quiet')).not.toBeNull()
    expect(litSteps(0.8, 5)).toBe(4)
    expect(litSteps(1.4, 4)).toBe(4)
  })
})
