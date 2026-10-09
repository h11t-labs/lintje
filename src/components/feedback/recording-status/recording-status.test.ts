/** The recording status: the running time, the sound and the connection, each with its word. */
import { afterEach, describe, expect, it } from 'vitest'
import './recording-status'
import { clockOf, levelWord, type LintjeRecordingStatus } from './recording-status'
import type { LintjeDescriptionList } from '../../tables/description-list/description-list'
import type { LintjeLevelMeter } from '../level-meter/level-meter'

async function mount(props: Partial<LintjeRecordingStatus>): Promise<LintjeRecordingStatus> {
  const element = Object.assign(document.createElement('lintje-recording-status'), props)
  document.body.append(element)
  await element.updateComplete
  return element
}

afterEach(() => document.body.replaceChildren())

describe('lintje-recording-status', () => {
  const list = (element: LintjeRecordingStatus): LintjeDescriptionList =>
    element.shadowRoot!.querySelector('lintje-description-list')!

  it("sets its figures in the description list's cells, the time large as a clock", async () => {
    const element = await mount({ elapsed: 724, level: 0.6 })
    const cells = list(element)
    expect(cells.layout).toBe('grid')
    expect(cells.columns).toBe(2)
    expect(cells.items.map((item) => item.label)).toEqual(['Looptijd', 'Geluid'])
    expect(cells.items[0]).toMatchObject({ value: '12:04', large: true })
    expect(
      element.shadowRoot!.querySelector<LintjeLevelMeter>('lintje-level-meter[slot="level"]')!
        .level,
    ).toBe(0.6)
  })

  it('adds the connection only when the host gives one, with how far it runs behind', async () => {
    const element = await mount({ elapsed: 5, level: 0.5, connection: 'weak', delay: 3 })
    expect(list(element).columns).toBe(3)
    const connection = element.shadowRoot!.querySelector('[slot="connection"]')!
    expect(connection.textContent).toContain('Zwak')
    expect(connection.textContent).toContain('3 seconden achter')
    expect(connection.querySelectorAll('.is-lit')).toHaveLength(2)
  })

  it('says a lost connection waits, and leaves a dash, never zero, for what it lacks', async () => {
    const element = await mount({ elapsed: null, level: null, connection: 'lost', delay: 1 })
    const [time, level] = list(element).items
    expect(time!.value).toBeNull()
    expect(level!.slot).toBeUndefined()
    const connection = element.shadowRoot!.querySelector('[slot="connection"]')!
    expect(connection.textContent).toContain('Verbroken')
    expect(connection.textContent).toContain('Wacht op verbinding')
  })

  it('reads the clock and the level in words', () => {
    expect(clockOf(59)).toBe('0:59')
    expect(clockOf(3729)).toBe('1:02:09')
    expect(levelWord(0.01)).toBe('Stil')
    expect(levelWord(0.1)).toBe('Zacht')
    expect(levelWord(0.7)).toBe('Goed')
  })
})
