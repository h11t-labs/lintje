/**
 * `<lintje-chat-questions>`: the short form or the steps from the data alone, "Iets anders…" in
 * every choice question, its own checks at Volgende and Versturen, and one event with the answers
 * and the reader's message.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deepActiveElement } from '../../../core/focus'
import { otherField } from '../../shared/controls'
import { OTHER_MISSING_TEXT } from '../../shared/other'
import './chat-questions'
import type { LintjeChatQuestions } from './chat-questions'
import type { LintjeRadioGroup } from '../../inputs/radio-group/radio-group'
import type { LintjeCheckboxGroup } from '../../inputs/checkbox-group/checkbox-group'
import type { LintjeTextarea } from '../../inputs/textarea/textarea'
import type { LintjeTextInput } from '../../inputs/text-input/text-input'
import type { ChatQuestion, ChatQuestionsData } from '../../../types'

const PERIOD: ChatQuestion = {
  id: 'periode',
  label: 'Periode',
  text: 'Welke periode bedoel je?',
  kind: 'one',
  options: [
    { value: '2025', label: 'Heel 2025', description: '1 januari tot en met 31 december 2025' },
    { value: '12m', label: 'Afgelopen 12 maanden' },
  ],
  error: 'Kies een periode. Zonder periode kan ik niet tellen.',
}
const PROVINCES: ChatQuestion = {
  id: 'provincies',
  label: 'Provincies',
  text: 'Welke provincies tel ik mee?',
  kind: 'many',
  optional: true,
  options: [
    { value: 'ut', label: 'Utrecht' },
    { value: 'gld', label: 'Gelderland' },
  ],
}
const NOTE: ChatQuestion = {
  id: 'toelichting',
  label: 'Toelichting',
  text: 'Wil je nog iets toelichten?',
  kind: 'text',
}
const SHORT: ChatQuestion = {
  id: 'periode',
  label: 'Periode',
  text: 'Welke periode bedoel je?',
  kind: 'one',
  options: [
    { value: '12m', label: 'Afgelopen 12 maanden' },
    { value: '2025', label: 'Heel 2025' },
  ],
}

async function mount(data: ChatQuestionsData): Promise<LintjeChatQuestions> {
  const element = document.createElement('lintje-chat-questions')
  Object.assign(element, { data, turnId: 't3' })
  document.body.append(element)
  await element.updateComplete
  return element
}

const root = (element: LintjeChatQuestions): ShadowRoot => element.shadowRoot!
const control = <T extends HTMLElement>(element: LintjeChatQuestions): T =>
  root(element).querySelector<T>('.lintje-chat-questions__control')!
const button = (element: LintjeChatQuestions, name: string): HTMLElement =>
  root(element).querySelector<HTMLElement>(`.lintje-chat-questions__${name}`)!

async function settle(element: LintjeChatQuestions): Promise<void> {
  await element.updateComplete
  await new Promise((resolve) => setTimeout(resolve))
  await element.updateComplete
}

function heard(_element: LintjeChatQuestions): unknown[] {
  const details: unknown[] = []
  document.addEventListener('lintje-questions-answer', (event) =>
    details.push((event as CustomEvent).detail),
  )
  return details
}

/** The group says the reader chose: what it does on a click. */
function choose(element: LintjeChatQuestions, value: string | string[]): void {
  control(element).dispatchEvent(new CustomEvent('lintje-change', { detail: value, bubbles: true }))
}

function writeOther(element: LintjeChatQuestions, text: string): void {
  control(element).dispatchEvent(
    new CustomEvent('lintje-other-change', { detail: text, bubbles: true }),
  )
}

async function enter(target: Element, init: KeyboardEventInit = {}): Promise<void> {
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      composed: true,
      cancelable: true,
      ...init,
    }),
  )
}

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('lintje-chat-questions, the short form', () => {
  it('is one `one` question without descriptions: its choices are buttons, "Iets anders…" last', async () => {
    const element = await mount({ questions: [SHORT] })
    const chips = [...root(element).querySelectorAll('.lintje-chat-questions__chip')]
    expect(chips.map((chip) => chip.textContent?.trim())).toEqual([
      'Afgelopen 12 maanden',
      'Heel 2025',
      'Iets anders…',
    ])
    expect(root(element).querySelector('lintje-progress-bar')).toBeNull()
    const group = root(element).querySelector('[role="group"]')!
    expect(
      root(element).querySelector(`#${group.getAttribute('aria-labelledby')}`)?.textContent,
    ).toBe('Welke periode bedoel je?')
  })

  it('sends with one tap: the choice is the message', async () => {
    const element = await mount({ questions: [SHORT] })
    const answers = heard(element)
    root(element).querySelector<HTMLButtonElement>('.lintje-chat-questions__chip')!.click()
    expect(answers).toEqual([
      {
        turnId: 't3',
        answers: [{ id: 'periode', values: ['12m'], other: null, skipped: false }],
        text: 'Afgelopen 12 maanden',
      },
    ])
  })

  it('opens "Iets anders…" as its own field with the focus, says what is missing, and sends the text', async () => {
    const element = await mount({
      questions: [{ ...SHORT, otherPlaceholder: 'Bijvoorbeeld: 2023' }],
    })
    const answers = heard(element)
    const other = root(element).querySelector<HTMLButtonElement>(
      '.lintje-chat-questions__chip--other',
    )!
    other.click()
    await settle(element)
    const field = otherField<LintjeTextInput>(root(element))!
    expect(other.getAttribute('aria-expanded')).toBe('true')
    expect(field.label).toBe('Iets anders…')
    expect(field.placeholder).toBe('Bijvoorbeeld: 2023')
    expect(deepActiveElement()).toBe(field.renderRoot.querySelector('input'))
    button(element, 'own-send').click()
    await settle(element)
    expect(answers).toEqual([])
    expect(field.error).toBe(OTHER_MISSING_TEXT)
    const input = field.renderRoot.querySelector('input')!
    input.value = 'Het eerste kwartaal'
    await enter(input)
    await settle(element)
    expect(answers).toEqual([
      {
        turnId: 't3',
        answers: [{ id: 'periode', values: [], other: 'Het eerste kwartaal', skipped: false }],
        text: 'Het eerste kwartaal',
      },
    ])
  })

  it('closes "Iets anders…" on a second tap and keeps its text', async () => {
    const element = await mount({ questions: [SHORT] })
    const other = root(element).querySelector<HTMLButtonElement>(
      '.lintje-chat-questions__chip--other',
    )!
    other.click()
    await settle(element)
    const input = otherField<LintjeTextInput>(root(element))!.renderRoot.querySelector('input')!
    input.value = 'Het eerste kwartaal'
    input.dispatchEvent(new Event('change'))
    other.click()
    await settle(element)
    expect(otherField(root(element))).toBeNull()
    other.click()
    await settle(element)
    expect(otherField<LintjeTextInput>(root(element))!.value).toBe('Het eerste kwartaal')
  })

  it('out of scope: the host’s actions as one question, with "Iets anders…"', async () => {
    const element = await mount({
      questions: [
        {
          id: 'actie',
          label: 'Actie',
          text: 'Wat wil je doen?',
          kind: 'one',
          options: [
            { value: 'add-source', label: 'Bron Klachten toevoegen en opnieuw vragen' },
            { value: 'all', label: 'Zoek in alle bronnen' },
          ],
        },
      ],
    })
    const chips = [...root(element).querySelectorAll('.lintje-chat-questions__chip')]
    expect(chips.at(-1)?.textContent?.trim()).toBe('Iets anders…')
    expect(chips).toHaveLength(3)
  })
})

describe('lintje-chat-questions, the steps', () => {
  it('is everything else: one question at a time, with its place and its own groups', async () => {
    const element = await mount({ questions: [PERIOD, PROVINCES, NOTE] })
    expect(root(element).querySelector('.lintje-chat-questions__count')?.textContent).toContain(
      'Vraag 1 van 3',
    )
    const group = control<LintjeRadioGroup>(element)
    expect(group.localName).toBe('lintje-radio-group')
    expect(group.other).toBe(true)
    expect(group.otherLabel).toBe('Iets anders…')
    expect(group.label).toBe('Welke periode bedoel je?')
    expect(group.name).toBe('')
    expect(button(element, 'back')).toBeNull()
    expect(button(element, 'next').textContent?.trim()).toBe('Volgende')
    const one = await mount({ questions: [{ ...SHORT, kind: 'many' }] })
    expect(root(one).querySelector('lintje-checkbox-group')).not.toBeNull()
  })

  it('Volgende on a required question without an answer says so and puts the focus on it', async () => {
    const element = await mount({ questions: [PERIOD, PROVINCES] })
    button(element, 'next').click()
    await settle(element)
    expect(control<LintjeRadioGroup>(element).error).toBe(
      'Kies een periode. Zonder periode kan ik niet tellen.',
    )
    expect(deepActiveElement()?.localName).toBe('input')
    choose(element, '2025')
    await settle(element)
    expect(control<LintjeRadioGroup>(element).error).toBeUndefined()
  })

  it('"Iets anders…" chosen and empty: OTHER_MISSING_TEXT under its field', async () => {
    const element = await mount({ questions: [PERIOD, PROVINCES] })
    choose(element, 'other')
    await settle(element)
    button(element, 'next').click()
    await settle(element)
    expect(control<LintjeRadioGroup>(element).otherError).toBe(OTHER_MISSING_TEXT)
    writeOther(element, 'Het eerste kwartaal')
    await settle(element)
    expect(control<LintjeRadioGroup>(element).otherError).toBeUndefined()
  })

  it('Enter in "Iets anders…" commits the text first, then goes on', async () => {
    const element = await mount({ questions: [PERIOD, PROVINCES] })
    const group = control<LintjeRadioGroup>(element)
    group.renderRoot.querySelector<HTMLInputElement>('input[value="other"]')!.click()
    await settle(element)
    await group.updateComplete
    const field = otherField<LintjeTextInput>(group.renderRoot)!
    await field.updateComplete
    const input = field.renderRoot.querySelector('input')!
    input.value = 'Het eerste kwartaal'
    input.dispatchEvent(new Event('input'))
    await enter(input)
    await settle(element)
    expect(root(element).querySelector('.lintje-chat-questions__count')?.textContent).toContain(
      'Vraag 2 van 2',
    )
  })

  it('Enter goes to the next question and sends on the last; Vorige goes back', async () => {
    const element = await mount({ questions: [PERIOD, PROVINCES] })
    const answers = heard(element)
    choose(element, '2025')
    await settle(element)
    await enter(control(element))
    await settle(element)
    expect(control(element).localName).toBe('lintje-checkbox-group')
    expect(button(element, 'next').textContent?.trim()).toBe('Versturen')
    button(element, 'back').click()
    await settle(element)
    expect(control<LintjeRadioGroup>(element).value).toBe('2025')
    await enter(control(element))
    await settle(element)
    choose(element, ['ut', 'other'])
    writeOther(element, 'Zeeuws-Vlaanderen')
    await settle(element)
    await enter(control(element))
    expect(answers).toEqual([
      {
        turnId: 't3',
        answers: [
          { id: 'periode', values: ['2025'], other: null, skipped: false },
          { id: 'provincies', values: ['ut'], other: 'Zeeuws-Vlaanderen', skipped: false },
        ],
        text: 'Periode: Heel 2025\nProvincies: Utrecht, Zeeuws-Vlaanderen',
      },
    ])
  })

  it('Overslaan passes an optional question: skipped, and "geen voorkeur" in the message', async () => {
    const element = await mount({ questions: [PERIOD, PROVINCES, NOTE] })
    const answers = heard(element)
    choose(element, '12m')
    await settle(element)
    button(element, 'next').click()
    await settle(element)
    choose(element, ['gld'])
    button(element, 'skip').click()
    await settle(element)
    const note = control<LintjeTextarea>(element)
    expect(note.localName).toBe('lintje-textarea')
    note.dispatchEvent(
      new CustomEvent('lintje-change', { detail: 'Zonder ingetrokken aanvragen', bubbles: true }),
    )
    await settle(element)
    button(element, 'next').click()
    expect(answers).toEqual([
      {
        turnId: 't3',
        answers: [
          { id: 'periode', values: ['12m'], other: null, skipped: false },
          { id: 'provincies', values: [], other: null, skipped: true },
          {
            id: 'toelichting',
            values: ['Zonder ingetrokken aanvragen'],
            other: null,
            skipped: false,
          },
        ],
        text: 'Periode: Afgelopen 12 maanden\nProvincies: geen voorkeur\nToelichting: Zonder ingetrokken aanvragen',
      },
    ])
  })

  it('free text: Enter is a new line, Ctrl+Enter goes on, and the hint says so', async () => {
    const element = await mount({ questions: [NOTE, PERIOD] })
    expect(root(element).querySelector('.lintje-chat-questions__hint')?.textContent).toContain(
      'Ctrl+Enter',
    )
    const note = control<LintjeTextarea>(element)
    await note.updateComplete
    note.dispatchEvent(
      new CustomEvent('lintje-change', { detail: 'Graag per kwartaal', bubbles: true }),
    )
    const textarea = note.renderRoot.querySelector('textarea')!
    await enter(textarea)
    await settle(element)
    expect(control(element).localName).toBe('lintje-textarea')
    await enter(textarea, { ctrlKey: true })
    await settle(element)
    expect(control(element).localName).toBe('lintje-radio-group')
  })

  it('a required free text without an answer says "Vul een antwoord in."', async () => {
    const element = await mount({ questions: [NOTE, PERIOD] })
    button(element, 'next').click()
    await settle(element)
    expect(control<LintjeTextarea>(element).error).toBe('Vul een antwoord in.')
  })

  it('keeps the reader’s choices for new data with the same questions, and starts over for others', async () => {
    const element = await mount({ questions: [PERIOD, PROVINCES] })
    choose(element, '2025')
    button(element, 'next').click()
    await settle(element)
    element.data = { questions: [PERIOD, PROVINCES], state: 'open' }
    await settle(element)
    expect(button(element, 'next').textContent?.trim()).toBe('Versturen')
    element.data = { questions: [{ ...PERIOD, id: 'jaar' }, PROVINCES] }
    await settle(element)
    expect(button(element, 'next').textContent?.trim()).toBe('Volgende')
    expect(control<LintjeRadioGroup>(element).value).toBe('')
  })

  it('while sending: Versturen busy, Vorige and Overslaan aria-disabled, the form busy', async () => {
    const element = await mount({ questions: [PERIOD, PROVINCES], state: 'sending' })
    element.step = 1
    await settle(element)
    const form = root(element).querySelector('form')!
    expect(form.getAttribute('aria-busy')).toBe('true')
    expect((button(element, 'next') as HTMLElement & { busy: boolean }).busy).toBe(true)
    expect((button(element, 'back') as HTMLElement & { disabled: boolean }).disabled).toBe(true)
    expect((button(element, 'skip') as HTMLElement & { disabled: boolean }).disabled).toBe(true)
  })

  it('announces the questions a frame after it opens, and each step', async () => {
    const element = await mount({ questions: [PERIOD, PROVINCES] })
    const status = (): string | null | undefined =>
      root(element).querySelector('[role="status"]')?.textContent
    await vi.waitFor(() => expect(status()).toBe('Assistent vraagt, vraag 1 van 2'))
    choose(element, '2025')
    button(element, 'next').click()
    await vi.waitFor(() => expect(status()).toBe('Vraag 2 van 2'))
  })

  it('draws more than five, and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const many = Array.from({ length: 6 }, (_, index) => ({ ...NOTE, id: `q${index}` }))
    const element = await mount({ questions: many })
    element.data = { questions: many }
    await element.updateComplete
    expect(root(element).querySelector('.lintje-chat-questions__count')?.textContent).toContain(
      'Vraag 1 van 6',
    )
    expect(warn).toHaveBeenCalledOnce()
  })

  it('draws nothing without questions', async () => {
    const element = await mount({ questions: [] })
    expect(root(element).querySelector('form')).toBeNull()
  })

  it('focus() lands on the first choice', async () => {
    const element = await mount({ questions: [{ ...PROVINCES, optional: false }, PERIOD] })
    element.focus()
    await settle(element)
    const group = control<LintjeCheckboxGroup>(element)
    const first = group.renderRoot.querySelector('lintje-checkbox')!
    expect(deepActiveElement()).toBe(first.shadowRoot!.querySelector('input'))
  })
})
