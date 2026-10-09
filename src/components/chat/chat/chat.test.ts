/**
 * `<lintje-chat>`: the view keeps nothing but which message is being edited.
 * What is checked is what it decides — the current answer, what an edit
 * replaces, the start screen — and that its parts' events arrive with the turn.
 */
import { afterEach, describe, expect, it } from 'vitest'
import './chat'
import type { LintjeChat } from './chat'
import { deepActiveElement } from '../../../core/focus'
import type { LintjeChatAnswer } from '../chat-answer/chat-answer'
import type { LintjeChatMessage } from '../chat-message/chat-message'
import type { ChatData } from '../../../types'

const TURNS: ChatData['turns'] = [
  {
    id: 't1',
    message: { text: 'Hoeveel aanvragen?', time: '08:20' },
    answer: { lead: 'Het zijn er 148.230.' },
  },
  {
    id: 't2',
    message: { text: 'En per loket?' },
    answer: { lead: 'Amsterdam Centrum was het drukst.', followUps: [{ label: 'En gisteren?' }] },
  },
]

// Leaving the page stops what the parts still had pending, so none outlives its test.
afterEach(() => document.body.replaceChildren())

async function chat(data: ChatData): Promise<LintjeChat> {
  const element = document.createElement('lintje-chat')
  element.data = data
  document.body.append(element)
  await element.updateComplete
  return element
}

/** The conversation's end lies `px` below what the page shows. */
function endsBelow(element: LintjeChat, px: number): void {
  const shown = (document.scrollingElement as HTMLElement).clientHeight
  element.getBoundingClientRect = () => ({ bottom: shown + px }) as DOMRect
}

/** The reader scrolls the page to `top`. */
function scrollPage(top: number): void {
  Object.defineProperty(document.scrollingElement, 'scrollTop', { value: top, configurable: true })
  document.dispatchEvent(new Event('scroll'))
}

/** Records how far `scroller` is asked to scroll. */
function watchScroll(scroller: HTMLElement): number[] {
  const asked: number[] = []
  scroller.scrollBy = ((options: ScrollToOptions) => asked.push(options.top ?? 0)) as never
  return asked
}

const answers = (element: LintjeChat): LintjeChatAnswer[] => [
  ...element.renderRoot.querySelectorAll('lintje-chat-answer'),
]
const messages = (element: LintjeChat): LintjeChatMessage[] => [
  ...element.renderRoot.querySelectorAll('lintje-chat-message'),
]

describe('lintje-chat', () => {
  it('is a labelled log that scrolls with the page, so it is no tab stop of its own', async () => {
    const element = await chat({ turns: TURNS })
    const log = element.renderRoot.querySelector('[role="log"]')
    expect(log?.getAttribute('aria-label')).toBe('Gesprek')
    expect(log?.hasAttribute('tabindex')).toBe(false)
  })

  it('draws a message and an answer per turn, and only the last answer is current', async () => {
    const element = await chat({ turns: TURNS })
    expect(messages(element).map((message) => message.text)).toEqual([
      'Hoeveel aanvragen?',
      'En per loket?',
    ])
    expect(answers(element).map((answer) => answer.current)).toEqual([false, true])
    expect(answers(element).map((answer) => answer.turnId)).toEqual(['t1', 't2'])
  })

  it('shows the start screen without turns: title, chosen sources, starters', async () => {
    const element = await chat({
      turns: [],
      sources: [
        { id: 'a', label: 'Aanvragen', asOf: 'tot 08:15', selected: true },
        { id: 'b', label: 'Bezetting' },
      ],
      start: { intro: 'Stel een vraag.', starters: [{ label: 'Hoeveel aanvragen?' }] },
    })
    const title = element.renderRoot.querySelector('.lintje-chat__title')
    expect(title?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Assistent: Waar wil je meer over weten?',
    )
    expect(element.renderRoot.querySelector('.lintje-chat__sources-title')?.textContent).toBe(
      'Je vraagt over 1 bron',
    )
    // Inside page content no heading stands above `h3`: the title is an `h3`, the
    // sources a level under it.
    expect(title?.localName).toBe('h3')
    expect(element.renderRoot.querySelector('.lintje-chat__sources-title')?.localName).toBe('h4')
    expect(element.renderRoot.querySelector('h1, h2')).toBeNull()
    expect(element.renderRoot.querySelectorAll('.lintje-chat__source')).toHaveLength(1)
    expect(element.renderRoot.querySelector('lintje-chat-suggestions')?.getAttribute('label')).toBe(
      'Jij, als eerste vraag',
    )
  })

  it('dims and disables what an edit is about to replace', async () => {
    const element = await chat({ turns: TURNS })
    const [first] = messages(element)
    await first.updateComplete
    first.renderRoot.querySelector<HTMLElement>('lintje-icon-button')?.click()
    await first.updateComplete
    await element.updateComplete

    const replaced = answers(element)
    expect(replaced.map((answer) => answer.classList.contains('is-replaced'))).toEqual([true, true])
    expect(replaced.map((answer) => answer.hasAttribute('inert'))).toEqual([true, true])
    expect(replaced.map((answer) => answer.current)).toEqual([false, false])
    // Only the message in its frame can still be edited.
    expect(messages(element).map((message) => message.editable)).toEqual([true, false])
  })

  it('offers no edit while an answer is arriving', async () => {
    const element = await chat({
      turns: [{ id: 't1', message: { text: 'Hoeveel?' }, answer: { state: 'streaming' } }],
    })
    expect(messages(element).map((message) => message.editable)).toEqual([false])
  })

  it('puts the question box under the conversation: busy while an answer arrives, the last question to recall', async () => {
    const element = await chat({
      turns: [...TURNS, { id: 't3', message: { text: 'En nu?' }, answer: { state: 'streaming' } }],
      sources: [{ id: 'a', label: 'Aanvragen', selected: true }],
      vocabulary: [{ label: 'aanvragen', kind: 'Definitie' }],
    })
    const box = element.renderRoot.querySelector('lintje-chat-composer')
    expect(box?.busy).toBe(true)
    expect(box?.recall).toBe('En nu?')
    expect(box?.sources).toHaveLength(1)
    expect(box?.vocabulary).toHaveLength(1)
    expect(
      (await chat({ turns: TURNS })).renderRoot.querySelector('lintje-chat-composer')?.busy,
    ).toBe(false)
  })

  it('offers "Naar nieuwste" once the reader has scrolled up, and not before', async () => {
    const element = await chat({ turns: TURNS })
    expect(element.renderRoot.querySelector('.lintje-chat__latest')).toBeNull()
    scrollPage(800)
    endsBelow(element, 400)
    scrollPage(400)
    await element.updateComplete
    const latest = element.renderRoot.querySelector('.lintje-chat__latest lintje-button')
    expect(latest?.textContent?.trim()).toBe('Naar nieuwste')
  })

  it('does not take an answer that grows below the reader for the reader leaving', async () => {
    const element = await chat({ turns: TURNS })
    scrollPage(800)
    endsBelow(element, 400)
    scrollPage(1000)
    await element.updateComplete
    expect(element.renderRoot.querySelector('.lintje-chat__latest')).toBeNull()
  })

  it('scrolls the page to a new turn, and "Naar nieuwste" scrolls it to the end', async () => {
    const element = await chat({ turns: TURNS })
    const scrolled = watchScroll(document.scrollingElement as HTMLElement)
    endsBelow(element, 400)
    element.data = { turns: [...TURNS, { id: 't3', message: { text: 'En vorige week?' } }] }
    await element.updateComplete
    expect(scrolled).toEqual([400])
    scrollPage(800)
    scrollPage(200)
    await element.updateComplete
    element.renderRoot.querySelector<HTMLElement>('.lintje-chat__latest lintje-button')?.click()
    expect(scrolled).toEqual([400, 400])
  })

  it('"Naar nieuwste" leaves once the end is in view, and gives the focus to the field', async () => {
    const element = await chat({ turns: TURNS })
    watchScroll(document.scrollingElement as HTMLElement)
    scrollPage(800)
    endsBelow(element, 400)
    scrollPage(200)
    await element.updateComplete
    element.renderRoot.querySelector<HTMLElement>('.lintje-chat__latest lintje-button')?.click()
    expect(deepActiveElement()?.classList.contains('lintje-chat-composer__input')).toBe(true)
  })

  it('gives the focus to the field after "Opnieuw vragen" when there is no edit button to return to', async () => {
    const element = await chat({ turns: TURNS })
    const message = messages(element)[1]
    element.addEventListener('lintje-message-edit', () => {
      element.data = { turns: [TURNS[0], { ...TURNS[1], answer: { state: 'streaming' } }] }
    })
    message.renderRoot.querySelector<HTMLElement>('.lintje-chat-message__edit')?.click()
    await message.updateComplete
    const frame = message.renderRoot.querySelector('lintje-chat-composer')!
    await frame.updateComplete
    frame.renderRoot.querySelector<HTMLElement>('.lintje-chat-composer__input')?.focus()
    frame.dispatchEvent(
      new CustomEvent('lintje-submit', { detail: { text: 'En per regio?', terms: [] } }),
    )
    await element.updateComplete
    await new Promise((settled) => requestAnimationFrame(settled))
    await new Promise((settled) => setTimeout(settled))
    const active = deepActiveElement()
    expect(active?.classList.contains('lintje-chat-composer__input')).toBe(true)
    expect(message.renderRoot.contains(active)).toBe(false)
  })

  it('gives the focus to the field when an answer that starts takes the edit button away', async () => {
    const element = await chat({ turns: TURNS })
    const edit = messages(element)[1].renderRoot.querySelector<
      HTMLElement & {
        updateComplete: Promise<unknown>
      }
    >('.lintje-chat-message__edit')
    await edit?.updateComplete
    edit?.shadowRoot?.querySelector<HTMLElement>('button')?.focus()
    expect(deepActiveElement()?.localName).toBe('button')
    element.data = {
      turns: [TURNS[0], { ...TURNS[1], answer: { state: 'streaming' } }],
    }
    await element.updateComplete
    await new Promise((settled) => requestAnimationFrame(settled))
    await new Promise((settled) => setTimeout(settled))
    expect(deepActiveElement()?.classList.contains('lintje-chat-composer__input')).toBe(true)
  })

  it('scrolls the nearest box that scrolls instead of the page, and sticks to its top', async () => {
    const box = document.createElement('div')
    box.style.overflowY = 'auto'
    document.body.append(box)
    const element = document.createElement('lintje-chat')
    element.data = { turns: TURNS.slice(0, 1) }
    box.append(element)
    await element.updateComplete
    expect(element.renderRoot.querySelector('.lintje-chat--page')).toBeNull()
    const scrolled = watchScroll(box)
    box.getBoundingClientRect = () => ({ bottom: 600 }) as DOMRect
    element.getBoundingClientRect = () => ({ bottom: 900 }) as DOMRect
    element.data = { turns: TURNS }
    await element.updateComplete
    expect(scrolled).toEqual([300])
  })

  it('sticks its questions under the frame when the page scrolls it', async () => {
    const element = await chat({ turns: TURNS })
    expect(element.renderRoot.querySelector('.lintje-chat--page')).not.toBeNull()
  })

  it('lets a part’s event through with the turn it came from', async () => {
    const element = await chat({ turns: TURNS })
    const details: unknown[] = []
    element.addEventListener('lintje-suggestion-select', (event) =>
      details.push((event as CustomEvent).detail),
    )
    const last = answers(element)[1]
    await last.updateComplete
    const followUps = last.renderRoot.querySelector('lintje-chat-suggestions')
    await followUps?.updateComplete
    followUps?.renderRoot.querySelector<HTMLButtonElement>('button')?.click()
    expect(details).toEqual([
      { turnId: 't2', kind: 'suggestion', label: 'En gisteren?', value: 'En gisteren?' },
    ])
  })
})
