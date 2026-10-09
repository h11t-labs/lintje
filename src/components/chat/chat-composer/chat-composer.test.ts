/**
 * `<lintje-chat-composer>`: one frame, and a press is one event. The field is
 * the browser's own editable text, so what is checked here is what the element
 * decides around it — when it sends, what it sends, and what stands in the bar.
 * The painting of a term is the browser's and is looked at in the style guide.
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deepActiveElement } from '../../../core/focus'
import './chat-composer'
import type { LintjeChatComposer } from './chat-composer'
import type { ChatSourceData, ChatTermData } from '../../../types'

const SOURCES: ChatSourceData[] = [
  { id: 'requests', label: 'Aanvragen en wachttijden', asOf: 'tot 08:15', selected: true },
  { id: 'staffing', label: 'Bezetting' },
]
const VOCABULARY: ChatTermData[] = [
  { label: 'wachttijd', kind: 'Definitie', source: 'requests' },
  { label: 'bezetting', kind: 'Definitie', source: 'staffing' },
]

async function composer(props: Partial<LintjeChatComposer> = {}): Promise<LintjeChatComposer> {
  const element = document.createElement('lintje-chat-composer')
  Object.assign(element, props)
  document.body.append(element)
  await element.updateComplete
  await element.updateComplete
  return element
}

const field = (element: LintjeChatComposer): HTMLElement =>
  element.renderRoot.querySelector('.lintje-chat-composer__input') as HTMLElement

/** What a reader does: the text lands in the field and the field says so. */
async function type(element: LintjeChatComposer, text: string): Promise<void> {
  field(element).textContent = text
  field(element).dispatchEvent(new Event('input'))
  await element.updateComplete
}

async function press(element: LintjeChatComposer, init: KeyboardEventInit): Promise<void> {
  field(element).dispatchEvent(new KeyboardEvent('keydown', { ...init, cancelable: true }))
  await element.updateComplete
}

function heard(element: LintjeChatComposer, name: string): unknown[] {
  const details: unknown[] = []
  element.addEventListener(name, (event) => details.push((event as CustomEvent).detail))
  return details
}

beforeEach(() => localStorage.clear())
// Leaving the page stops the draft's pending announcement, so none outlives its test.
afterEach(() => document.body.replaceChildren())

// Read from disk, not imported: vitest does not run the CSS pipeline, so an
// `?inline` import comes back empty.
const composerCss = readFileSync(
  resolvePath('src/components/chat/chat-composer/chat-composer.css'),
  'utf8',
)

const described = (element: LintjeChatComposer): string =>
  (field(element).getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => element.renderRoot.querySelector(`#${id}`)?.textContent ?? '')
    .join(' ')

describe('lintje-chat-composer', () => {
  it('is a labelled, multi-line text box with a placeholder', async () => {
    const element = await composer()
    const input = field(element)
    expect(input.getAttribute('role')).toBe('textbox')
    expect(input.getAttribute('aria-multiline')).toBe('true')
    expect(input.getAttribute('aria-label')).toBe('Je vraag')
    expect(input.dataset.placeholder).toBe('Stel een vraag over de gegevens')
    expect(input.getAttribute('aria-placeholder')).toBe('Stel een vraag over de gegevens')
    expect(input.classList.contains('is-empty')).toBe(true)
    // Drawn by CSS, said by `aria-placeholder`: the drawing has an empty alternative.
    expect(composerCss).toContain("content: attr(data-placeholder) / '';")
  })

  it('says the send key in the field description, also where no menu sets it', async () => {
    const element = await composer()
    expect(described(element)).toContain('Enter verstuurt, Shift+Enter begint een nieuwe regel.')
    element.sendKey = 'ctrl-enter'
    await element.updateComplete
    expect(described(element)).toContain('Ctrl+Enter verstuurt, Enter begint een nieuwe regel.')

    localStorage.setItem('lintje-chat-send-key', 'ctrl-enter')
    const plain = await composer({ plain: true })
    expect(described(plain)).toContain('Enter verstuurt, Shift+Enter begint een nieuwe regel.')
  })

  it('sends the question with its terms, its sources and the answer form, and empties the field', async () => {
    const element = await composer({ sources: SOURCES, vocabulary: VOCABULARY })
    const sent = heard(element, 'lintje-message-send')
    await type(element, '  Hoe was de wachttijd?')
    await press(element, { key: 'Enter' })
    expect(sent).toEqual([
      {
        text: 'Hoe was de wachttijd?',
        terms: [{ start: 11, end: 20, kind: 'Definitie', certain: true }],
        sources: ['requests'],
        form: 'auto',
      },
    ])
    expect(field(element).textContent).toBe('')
  })

  it('sends on the key the reader set, and a new line on the other', async () => {
    const element = await composer()
    const sent = heard(element, 'lintje-message-send')
    await type(element, 'Een vraag')
    await press(element, { key: 'Enter', shiftKey: true })
    expect(sent).toHaveLength(0)

    element.sendKey = 'ctrl-enter'
    await press(element, { key: 'Enter' })
    expect(sent).toHaveLength(0)
    await press(element, { key: 'Enter', ctrlKey: true })
    expect(sent).toHaveLength(1)
  })

  it('plain: only "Versturen", without the menu of options', async () => {
    // A reader who chose Ctrl+Enter in a chat still sends this box with Enter.
    localStorage.setItem('lintje-chat-send-key', 'ctrl-enter')
    const element = await composer({ plain: true })
    expect(element.renderRoot.querySelector('.lintje-chat-composer__options-toggle')).toBeNull()
    const sent = heard(element, 'lintje-message-send')
    await type(element, 'Kan ik audio naar tekst omzetten?')
    await press(element, { key: 'Enter' })
    expect(sent).toHaveLength(1)
  })

  it('does not send an empty question', async () => {
    const element = await composer()
    const sent = heard(element, 'lintje-message-send')
    await type(element, '   ')
    await press(element, { key: 'Enter' })
    expect(sent).toEqual([])
    expect(element.renderRoot.querySelector('lintje-button')?.hasAttribute('disabled')).toBe(true)
  })

  it('says so when no source is chosen, and does not send', async () => {
    const element = await composer({
      sources: SOURCES.map((source) => ({ ...source, selected: false })),
    })
    const sent = heard(element, 'lintje-message-send')
    await type(element, 'Een vraag')
    await press(element, { key: 'Enter' })
    expect(sent).toEqual([])
    const hint = element.renderRoot.querySelector('#hint')
    expect(hint?.textContent).toBe('Kies eerst een bron om een vraag te stellen')
    expect(field(element).getAttribute('aria-describedby')).toBe('hint send-key')
    expect(element.renderRoot.querySelector('lintje-multiselect')?.getAttribute('summary')).toBe(
      'Bronnen: 0 van 2',
    )
  })

  it('announces a change of sources and keeps none itself', async () => {
    const element = await composer({ sources: SOURCES })
    const changes = heard(element, 'lintje-sources-change')
    const picker = element.renderRoot.querySelector('lintje-multiselect')
    expect(picker?.getAttribute('summary')).toBe('Bronnen: 1 van 2')
    picker?.dispatchEvent(
      new CustomEvent('lintje-change', { detail: ['requests', 'staffing'], bubbles: true }),
    )
    await element.updateComplete
    expect(changes).toEqual([{ ids: ['requests', 'staffing'] }])
    expect(picker?.getAttribute('summary')).toBe('Bronnen: 1 van 2')
  })

  it('busy: "Stoppen" stands in for the send button, and Escape stops too', async () => {
    const element = await composer({ busy: true })
    const stops = heard(element, 'lintje-answer-stop')
    const stop = element.renderRoot.querySelector<HTMLElement>('lintje-button')
    expect(stop?.textContent?.trim()).toBe('Stoppen')
    stop?.click()
    await press(element, { key: 'Escape' })
    expect(stops).toHaveLength(2)
  })

  it('gives the focus to the field when "Stoppen" leaves from under it', async () => {
    const element = await composer({ busy: true })
    const stop = element.renderRoot.querySelector<
      HTMLElement & {
        updateComplete: Promise<unknown>
      }
    >('.lintje-chat-composer__stop')
    await stop?.updateComplete
    stop?.shadowRoot?.querySelector('button')?.focus()
    element.busy = false
    await element.updateComplete
    expect(deepActiveElement()).toBe(field(element))
  })

  it('brings the last question back with ↑ in an empty field', async () => {
    const element = await composer({ recall: 'Hoeveel aanvragen?' })
    await press(element, { key: 'ArrowUp' })
    expect(field(element).textContent).toBe('Hoeveel aanvragen?')
  })

  it('offers to complete the word being typed, and takes one with Enter', async () => {
    const element = await composer({ vocabulary: VOCABULARY })
    const sent = heard(element, 'lintje-message-send')
    await type(element, 'Hoe was de bez')
    const options = [...element.renderRoot.querySelectorAll('[role="option"]')]
    expect(options.map((option) => option.querySelector('span')?.textContent)).toEqual([
      'bezetting',
    ])
    expect(field(element).getAttribute('aria-activedescendant')).toBe(options[0].id)

    await press(element, { key: 'Enter' })
    expect(field(element).textContent).toBe('Hoe was de bezetting ')
    expect(sent).toEqual([])
    expect(element.renderRoot.querySelector('[role="option"]')).toBeNull()
  })

  it('says the recognised terms in words, and which are not certain', async () => {
    const element = await composer({ sources: SOURCES, vocabulary: VOCABULARY })
    await type(element, 'wachttijd en bezetting')
    expect(element.renderRoot.querySelector('[aria-live]')?.textContent).toBe(
      'Herkend: wachttijd (Definitie), bezetting (Definitie, niet zeker)',
    )
  })

  it('lets the host’s own reading win while the text is the one it read', async () => {
    const element = await composer({ vocabulary: VOCABULARY })
    await type(element, 'gisteren')
    element.draftTerms = { text: 'gisteren', ranges: [{ start: 0, end: 8, kind: 'Periode' }] }
    await element.updateComplete
    expect(element.renderRoot.querySelector('[aria-live]')?.textContent).toBe(
      'Herkend: gisteren (Periode)',
    )
    await type(element, 'gisteren en')
    expect(element.renderRoot.querySelector('[aria-live]')?.textContent).toBe('')
  })

  it('opens the send options from a button that says so, and remembers the send key', async () => {
    const element = await composer()
    const toggle = element.renderRoot.querySelector<HTMLElement>(
      '.lintje-chat-composer__options-toggle',
    )
    expect(toggle?.getAttribute('label')).toBe('Opties bij versturen')
    // One half of the joined send button: it takes the button's 48 px as its box, and
    // sets no size of its own.
    expect(toggle?.classList.contains('lintje-chat-composer__send-half')).toBe(true)
    expect(toggle?.hasAttribute('size')).toBe(false)
    toggle?.click()
    await element.updateComplete
    const options = element.renderRoot.querySelector('[role="dialog"]')
    const groups = [...(options?.querySelectorAll('lintje-radio-group') ?? [])]
    expect(groups.map((group) => group.getAttribute('label'))).toEqual([
      'Antwoord als',
      'Versturen met',
    ])
    groups[1].dispatchEvent(
      new CustomEvent('lintje-change', { detail: 'ctrl-enter', bubbles: true }),
    )
    expect(element.sendKey).toBe('ctrl-enter')
    expect(localStorage.getItem('lintje-chat-send-key')).toBe('ctrl-enter')
    expect((await composer()).sendKey).toBe('ctrl-enter')
  })

  it('edit: no picker and no split send; submit and cancel stay with the message', async () => {
    const element = await composer({
      variant: 'edit',
      text: 'Hoeveel aanvragen?',
      sources: SOURCES,
    })
    expect(field(element).textContent).toBe('Hoeveel aanvragen?')
    expect(field(element).getAttribute('aria-label')).toBe('Je vraag bewerken')
    expect(element.renderRoot.querySelector('lintje-multiselect')).toBeNull()
    const buttons = [...element.renderRoot.querySelectorAll<HTMLElement>('lintje-button')]
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'Annuleren',
      'Opnieuw vragen',
    ])

    const submitted = heard(element, 'lintje-submit')
    const cancelled = heard(element, 'lintje-cancel')
    const sent = heard(element, 'lintje-message-send')
    buttons[1].click()
    await press(element, { key: 'Escape' })
    expect(submitted).toEqual([{ text: 'Hoeveel aanvragen?', terms: [] }])
    expect(cancelled).toHaveLength(1)
    expect(sent).toEqual([])
  })
})

describe('lintje-chat-composer and its draft', () => {
  it('says what is typed a moment later, and nothing once it has left the page', async () => {
    vi.useFakeTimers()
    try {
      const element = await composer()
      const drafts = heard(element, 'lintje-draft-change')
      await type(element, 'Hoeveel')
      await vi.advanceTimersByTimeAsync(200)
      expect(drafts).toEqual([{ text: 'Hoeveel' }])
      await type(element, 'Hoeveel aanvragen')
      element.remove()
      await vi.advanceTimersByTimeAsync(200)
      expect(drafts).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
