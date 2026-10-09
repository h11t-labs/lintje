/**
 * `<lintje-chat-suggestions>`: dashed versus solid is a rule, so the kind
 * is in the markup, and a press is one event that says which turn it came from.
 */
import { describe, expect, it } from 'vitest'
import './chat-suggestions'
import type { LintjeChatSuggestions } from './chat-suggestions'

async function suggestions(props: Partial<LintjeChatSuggestions>): Promise<LintjeChatSuggestions> {
  const element = document.createElement('lintje-chat-suggestions')
  Object.assign(element, props)
  document.body.append(element)
  await element.updateComplete
  return element
}

describe('lintje-chat-suggestions', () => {
  it('draws nothing without items', async () => {
    const element = await suggestions({ label: 'Jij, als vervolgvraag' })
    expect(element.renderRoot.querySelector('.lintje-chat-suggestions')).toBeNull()
  })

  it('names the group after its visible label', async () => {
    const element = await suggestions({
      label: 'Jij, als vervolgvraag',
      items: [{ label: 'En gisteren?' }],
    })
    const group = element.renderRoot.querySelector('[role="group"]')
    const label = element.renderRoot.querySelector(`#${group?.getAttribute('aria-labelledby')}`)
    expect(label?.textContent).toBe('Jij, als vervolgvraag')
  })

  it('carries the kind as a modifier: a suggestion by default, a choice when told', async () => {
    const suggestion = await suggestions({ items: [{ label: 'En gisteren?' }] })
    expect(
      suggestion.renderRoot.querySelector('.lintje-chat-suggestions--suggestion'),
    ).not.toBeNull()
    const choice = await suggestions({
      kind: 'choice',
      items: [{ label: 'Loket A' }],
      hint: 'Of typ zelf.',
    })
    expect(choice.renderRoot.querySelector('.lintje-chat-suggestions--choice')).not.toBeNull()
    expect(choice.renderRoot.querySelector('.lintje-chat-suggestions__hint')?.textContent).toBe(
      'Of typ zelf.',
    )
  })

  it('sends one composed event with the turn, the kind and the value', async () => {
    const element = await suggestions({
      turnId: 't1',
      kind: 'choice',
      items: [{ label: 'Loket A', value: 'desk-a' }, { label: 'Alle samen' }],
    })
    const events: CustomEvent[] = []
    document.addEventListener('lintje-suggestion-select', (event) =>
      events.push(event as CustomEvent),
    )
    const buttons = element.renderRoot.querySelectorAll<HTMLButtonElement>('button')
    buttons[0].click()
    buttons[1].click()
    expect(events.map((event) => event.detail)).toEqual([
      { turnId: 't1', kind: 'choice', label: 'Loket A', value: 'desk-a' },
      { turnId: 't1', kind: 'choice', label: 'Alle samen', value: 'Alle samen' },
    ])
  })

  it('stands on the right by default, and left with align="start"', async () => {
    const element = await suggestions({ items: [{ label: 'Kan ik een document vertalen?' }] })
    const group = element.renderRoot.querySelector('.lintje-chat-suggestions')!
    expect(group.classList.contains('lintje-chat-suggestions--end')).toBe(true)
    element.align = 'start'
    await element.updateComplete
    expect(group.classList.contains('lintje-chat-suggestions--start')).toBe(true)
    expect(element.getAttribute('align')).toBe('start')
  })
})
