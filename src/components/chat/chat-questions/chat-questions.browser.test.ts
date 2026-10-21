/**
 * `<lintje-chat-questions>` in a real browser: a long list scrolls inside the box, and a choice
 * that takes the keyboard's focus comes wholly into view there, its focus ring uncut by the list.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { deepActiveElement } from '../../../core/focus'
import { TAB } from '../../../core/test-keys'
import './chat-questions'
import type { LintjeChatQuestions } from './chat-questions'
import type { ChatQuestion } from '../../../types'

const PROVINCES = [
  'Drenthe',
  'Flevoland',
  'Friesland',
  'Gelderland',
  'Groningen',
  'Limburg',
  'Noord-Brabant',
  'Noord-Holland',
  'Overijssel',
  'Utrecht',
  'Zeeland',
  'Zuid-Holland',
]

// A second question, so a `one` question is drawn as radios and not as the short form's buttons.
const questions = (kind: 'one' | 'many'): ChatQuestion[] => [
  {
    id: 'provincies',
    label: 'Provincies',
    text: 'Welke provincies tel ik mee?',
    kind,
    options: PROVINCES.map((name) => ({ value: name.toLowerCase(), label: name })),
  },
  { id: 'toelichting', label: 'Toelichting', text: 'Nog iets?', kind: 'text', optional: true },
]

async function mount(kind: 'one' | 'many', width: number): Promise<LintjeChatQuestions> {
  const start = Object.assign(document.createElement('input'), { ariaLabel: 'Zoeken' })
  const element = Object.assign(document.createElement('lintje-chat-questions'), {
    data: { questions: questions(kind) },
  })
  document.body.append(start, element)
  await element.updateComplete
  // Mounted first, then resized: WebKit keeps the media queries of a sheet no element uses.
  await page.viewport(width, 900)
  await expect.poll(() => window.innerWidth).toBe(width)
  // Every row drawn, a checkbox's in its own root.
  const rows = (): number => {
    const group = element.shadowRoot!.querySelector('.lintje-chat-questions__control')
    const boxes = [...(group?.shadowRoot?.querySelectorAll('lintje-checkbox') ?? [])]
    return boxes.length
      ? boxes.filter((box) => box.shadowRoot?.querySelector('.lintje-choice')).length
      : (group?.shadowRoot?.querySelectorAll('.lintje-choice').length ?? 0)
  }
  await expect.poll(rows).toBe(PROVINCES.length + 1)
  start.focus()
  return element
}

/** The sides where the focused choice's ring stands past what the list shows. */
function cut(element: LintjeChatQuestions): string[] {
  const control = deepActiveElement()?.parentElement?.querySelector<HTMLElement>(
    '.lintje-choice__box, .lintje-choice__radio',
  )
  if (!control) return ['no choice has the focus']
  const style = getComputedStyle(control)
  const grow =
    parseFloat(style.getPropertyValue('--focus-width')) +
    parseFloat(style.getPropertyValue('--focus-offset'))
  const ring = control.getBoundingClientRect()
  const list = element.shadowRoot!.querySelector<HTMLElement>('.lintje-chat-questions__choices')!
  const box = list.getBoundingClientRect()
  const left = box.left + list.clientLeft
  const top = box.top + list.clientTop
  return [
    ring.left - grow < left - 0.5 ? 'left' : '',
    ring.right + grow > left + list.clientWidth + 0.5 ? 'right' : '',
    ring.top - grow < top - 0.5 ? 'top' : '',
    ring.bottom + grow > top + list.clientHeight + 0.5 ? 'bottom' : '',
  ].filter(Boolean)
}

const label = (): string =>
  deepActiveElement()?.closest('.lintje-choice')?.textContent?.replace(/\s+/g, ' ').trim() ?? ''

afterEach(async () => {
  await page.viewport(1440, 900)
  document.body.replaceChildren()
})

describe('lintje-chat-questions, a long list that scrolls', () => {
  for (const width of [1440, 390]) {
    it(`brings each checkbox that Tab reaches into view with its ring whole, at ${width} px`, async () => {
      const element = await mount('many', width)
      const list = element.shadowRoot!.querySelector('.lintje-chat-questions__choices')!
      await expect.poll(() => list.scrollHeight > list.clientHeight).toBe(true)
      for (const name of [...PROVINCES, 'Iets anders…']) {
        await userEvent.keyboard(TAB)
        await expect.poll(label).toContain(name)
        expect(deepActiveElement()?.matches(':focus-visible'), name).toBe(true)
        await expect.poll(() => cut(element), { message: name }).toEqual([])
      }
    })

    it(`brings each radio the arrows reach into view with room for its ring, at ${width} px`, async () => {
      const element = await mount('one', width)
      await userEvent.keyboard(TAB)
      await expect.poll(label).toContain('Drenthe')
      expect(deepActiveElement()?.matches(':focus-visible')).toBe(true)
      expect(cut(element)).toEqual([])
      for (const name of [...PROVINCES.slice(1), 'Iets anders…']) {
        await userEvent.keyboard('{ArrowDown}')
        await expect.poll(label).toContain(name)
        await expect.poll(() => cut(element), { message: name }).toEqual([])
      }
    })
  }
})
