/** The progress bar: a value, no value, and what it says to a screen reader. */
import { describe, expect, it } from 'vitest'
import './progress-bar'

async function mount(props: Record<string, unknown>): Promise<ShadowRoot> {
  const element = Object.assign(document.createElement('lintje-progress-bar'), props)
  document.body.append(element)
  await element.updateComplete
  return element.shadowRoot!
}

const track = (root: ShadowRoot): HTMLElement => root.querySelector('[role="progressbar"]')!
const fill = (root: ShadowRoot): HTMLElement => root.querySelector('.lintje-progress__fill')!

describe('lintje-progress-bar', () => {
  it('writes the value as the width and as aria-valuenow', async () => {
    const root = await mount({ label: 'Transcriberen', detail: '62%', value: 62 })
    expect(track(root).getAttribute('aria-valuenow')).toBe('62')
    expect(track(root).getAttribute('aria-label')).toBe('Transcriberen')
    expect(track(root).getAttribute('aria-valuetext')).toBe('62%')
    expect(fill(root).style.width).toBe('62%')
  })

  it('has no value when the duration is unknown', async () => {
    const root = await mount({ label: 'Wachten op de server' })
    expect(track(root).hasAttribute('aria-valuenow')).toBe(false)
    expect(track(root).classList.contains('is-indeterminate')).toBe(true)
    expect(fill(root).style.width).toBe('')
  })

  it('turns to done at 100 and keeps an explicit tone', async () => {
    const done = await mount({ label: 'Klaar', value: 100 })
    expect(done.querySelector('.lintje-progress--done')).not.toBeNull()
    const failed = await mount({ label: 'Afgebroken', value: 100, tone: 'error' })
    expect(failed.querySelector('.lintje-progress--error')).not.toBeNull()
  })

  it('clamps a value outside 0–100', async () => {
    const root = await mount({ label: 'Te ver', value: 140 })
    expect(fill(root).style.width).toBe('100%')
  })

  it('says done, error and paused in the value text and marks them before the label', async () => {
    const failed = await mount({ label: 'Afgebroken', value: 40, tone: 'error' })
    expect(track(failed).getAttribute('aria-valuetext')).toBe('40%, mislukt')
    expect(failed.querySelector('.lintje-progress__label .lintje-progress__mark')).not.toBeNull()

    const paused = await mount({ label: 'Uploaden', detail: '62%', value: 62, tone: 'paused' })
    expect(track(paused).getAttribute('aria-valuetext')).toBe('62%, gepauzeerd')

    const done = await mount({ label: 'Klaar', value: 100, hideLabel: true })
    expect(track(done).getAttribute('aria-valuetext')).toBe('100%, klaar')

    const running = await mount({ label: 'Bezig', value: 30 })
    expect(track(running).hasAttribute('aria-valuetext')).toBe(false)
    expect(running.querySelector('.lintje-progress__mark')).toBeNull()
  })
})
