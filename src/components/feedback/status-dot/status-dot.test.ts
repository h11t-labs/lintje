import { afterEach, describe, expect, it } from 'vitest'
import { TONE_WORD, type Tone } from '../../shared/tone'
import './status-dot'

afterEach(() => document.body.replaceChildren())

async function mount(tone: HTMLElementTagNameMap['lintje-status-dot']['tone'], label?: string) {
  const element = document.createElement('lintje-status-dot')
  Object.assign(element, { tone, label })
  document.body.append(element)
  await element.updateComplete
  return element.shadowRoot!
}

describe('lintje-status-dot', () => {
  it.each([
    ['complete', 'success', 'compleet'],
    ['delayed', 'warning', 'vertraagd'],
    ['outage', 'error', 'storing'],
    ['no-data', 'neutral', 'geen data'],
  ] as const)('translates %s into its tone and delivery word', async (delivery, tone, word) => {
    const root = await mount(delivery)
    expect(root.querySelector('.lintje-status__dot--' + tone)).not.toBeNull()
    expect(root.textContent?.trim()).toBe(word)
  })

  it.each(Object.keys(TONE_WORD) as Tone[])('uses the shared word for %s', async (tone) => {
    const root = await mount(tone)
    expect(root.querySelector('.lintje-status__dot--' + tone)).not.toBeNull()
    expect(root.textContent?.trim()).toBe(TONE_WORD[tone])
  })

  it.each(['busy', 'delayed'] as const)('lets a label override %s', async (tone) => {
    expect((await mount(tone, 'Wordt verwerkt')).textContent?.trim()).toBe('Wordt verwerkt')
    expect((await mount(tone, '')).textContent?.trim()).toBe('')
  })
})
