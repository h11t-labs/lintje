/**
 * `<lintje-chat-steps>`: what the closed line chooses, the list when open, the link in a detail and
 * what the status region says. Cutting a detail and its running on are the browser's; what is
 * checked here is the rule that lets it run on.
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import './chat-steps'
import { summarise, type LintjeChatSteps } from './chat-steps'
import type { ChatStep } from '../../../types'

// Read from disk, not imported: vitest does not run the CSS pipeline.
const stepsCss = readFileSync(resolvePath('src/components/chat/chat-steps/chat-steps.css'), 'utf8')

const DONE: ChatStep[] = [
  { label: 'Vraag gelezen' },
  { label: '3 bronnen doorzocht', detail: 'Bezwaren, Besluiten, Termijnen' },
  {
    label: 'Tabel opgehaald',
    detail: 'Bezwaren, stand 1 oktober 2026',
    href: '/bronnen/bezwaren',
    linkText: 'Bezwaren',
  },
  { label: 'Opgeteld', detail: '4.812 bezwaren in 12 maanden' },
  { label: 'Grafiek getekend' },
]

async function mount(props: Partial<LintjeChatSteps>): Promise<LintjeChatSteps> {
  const element = Object.assign(document.createElement('lintje-chat-steps'), props)
  document.body.append(element)
  await element.updateComplete
  return element
}

const frame = (): Promise<void> => new Promise((done) => requestAnimationFrame(() => done()))

const toggle = (element: LintjeChatSteps): HTMLButtonElement | null =>
  element.shadowRoot!.querySelector('.lintje-chat-steps__toggle')

const head = (element: LintjeChatSteps): string =>
  (element.shadowRoot!.querySelector('.lintje-chat-steps__head')?.textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim()

const said = (element: LintjeChatSteps): string[] =>
  [...element.shadowRoot!.querySelectorAll('[role="status"] p')].map((p) => p.textContent ?? '')

afterEach(() => document.body.replaceChildren())

describe('the closed line', () => {
  it('chooses the running step, the last of more, with its number from step 2', () => {
    expect(summarise([{ label: 'Vraag lezen', state: 'busy' }])).toEqual({
      mark: 'ring',
      label: 'Vraag lezen',
      rest: '',
    })
    const running: ChatStep[] = [
      { label: 'Vraag gelezen' },
      { label: 'Bron mislukt', state: 'error' },
      { label: 'Tabel ophalen', state: 'busy' },
    ]
    expect(summarise(running, '12 s')).toEqual({
      mark: 'ring',
      label: 'Tabel ophalen',
      rest: 'stap 3',
    })
  })

  it('then the first failure, with the count and the duration', () => {
    const failed: ChatStep[] = [
      ...DONE.slice(0, 3),
      { label: 'Tabel behandeltermijnen ophalen mislukt', state: 'error', detail: 'Geen antwoord' },
      { label: 'Tweede mislukt', state: 'error' },
    ]
    expect(summarise(failed, '41 s')).toEqual({
      mark: 'cross',
      label: 'Tabel behandeltermijnen ophalen mislukt',
      failed: true,
      rest: '5 stappen · 41 s',
    })
  })

  it('then a stopped step, then the count', () => {
    const stopped: ChatStep[] = [
      ...DONE.slice(0, 4),
      { label: 'Tabel ophalen gestopt', state: 'cancelled' },
    ]
    expect(summarise(stopped)).toEqual({
      mark: 'open',
      label: 'Tabel ophalen gestopt',
      rest: '5 stappen',
    })
    expect(summarise(DONE, '12 s')).toEqual({ mark: 'square', rest: '5 stappen · 12 s' })
    expect(summarise(DONE.slice(0, 1))).toEqual({ mark: 'square', rest: '1 stap' })
  })
})

describe('lintje-chat-steps', () => {
  it('is one button that names the closed line and controls the list', async () => {
    const element = await mount({ items: DONE, duration: '12 s' })
    const button = toggle(element)!
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.getAttribute('aria-haspopup')).toBeNull()
    const list = element.shadowRoot!.getElementById(button.getAttribute('aria-controls')!)
    expect(list?.querySelectorAll('li')).toHaveLength(5)
    expect(head(element)).toBe('5 stappen · 12 s')
  })

  it('open: the line says only how many and how long, and each step is one line with its detail', async () => {
    const element = await mount({
      items: [...DONE.slice(0, 4), { label: 'Grafiek tekenen', state: 'busy' }],
      duration: '12 s',
    })
    expect(head(element)).toBe('Grafiek tekenen · stap 5')
    toggle(element)!.click()
    await element.updateComplete
    expect(element.open).toBe(true)
    expect(toggle(element)!.getAttribute('aria-expanded')).toBe('true')
    // The duration waits while a step runs.
    expect(head(element)).toBe('5 stappen')
    const step = element.shadowRoot!.querySelectorAll('.lintje-chat-steps__text')[1]
    expect(step.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      '3 bronnen doorzocht · Bezwaren, Besluiten, Termijnen',
    )
    expect(step.getAttribute('title')).toBe('3 bronnen doorzocht · Bezwaren, Besluiten, Termijnen')
  })

  it('lets a cut detail run on while the focus is in the group, and on a phone', () => {
    expect(stepsCss).toMatch(
      /\.lintje-chat-steps:focus-within \.lintje-chat-steps__text \{[^}]*white-space: normal/,
    )
    const phone = stepsCss.slice(stepsCss.indexOf('@media screen and (max-width: 767px)'))
    expect(phone).toMatch(/\.lintje-chat-steps__text \{[^}]*white-space: normal/)
  })

  it('has no button for one step without detail, and shows its label with the duration', async () => {
    const element = await mount({ items: [{ label: 'Vraag gelezen' }], duration: '2 s' })
    expect(toggle(element)).toBeNull()
    expect(head(element)).toBe('Vraag gelezen · 2 s')
  })

  it('draws the closed line of a stopped step', async () => {
    const element = await mount({
      items: [...DONE.slice(0, 2), { label: 'Tabel ophalen gestopt', state: 'cancelled' }],
    })
    expect(head(element)).toBe('Tabel ophalen gestopt · 3 stappen')
    expect(
      element.shadowRoot!.querySelector(
        '.lintje-chat-steps__head .lintje-chat-steps__square--open',
      ),
    ).not.toBeNull()
  })

  it('makes `linkText` in the detail a link that reports `lintje-navigate`', async () => {
    const element = await mount({ items: DONE, open: true })
    const navigated: unknown[] = []
    element.addEventListener('lintje-navigate', (event) => {
      event.preventDefault()
      navigated.push((event as CustomEvent).detail)
    })
    const link = element.shadowRoot!.querySelector<HTMLAnchorElement>('.lintje-chat-steps__link')!
    expect(link.textContent).toBe('Bezwaren')
    expect(link.parentElement!.textContent).toBe(' · Bezwaren, stand 1 oktober 2026')
    link.click()
    expect(navigated).toEqual([{ href: '/bronnen/bezwaren' }])
  })

  it('makes the whole detail the link when `linkText` is not in it', async () => {
    const element = await mount({
      items: [{ label: 'Tabel opgehaald', detail: 'Termijnen', href: '/t', linkText: 'Bezwaren' }],
    })
    expect(element.shadowRoot!.querySelector('.lintje-chat-steps__link')!.textContent).toBe(
      'Termijnen',
    )
  })

  it('speaks only the first step starting and a failure, a frame later', async () => {
    const element = await mount({ items: [] })
    element.items = [{ label: 'Vraag lezen', state: 'busy' }]
    await element.updateComplete
    await frame()
    await element.updateComplete
    expect(said(element)).toEqual(['Bezig: Vraag lezen.'])
    element.items = [{ label: 'Vraag gelezen' }, { label: 'Bronnen doorzoeken', state: 'busy' }]
    await element.updateComplete
    element.items = [
      { label: 'Vraag gelezen' },
      {
        label: 'Tabel behandeltermijnen ophalen mislukt',
        state: 'error',
        detail: 'De bron Termijnen gaf binnen 30 s geen antwoord.',
      },
    ]
    await element.updateComplete
    await frame()
    await element.updateComplete
    expect(said(element)).toEqual([
      'Bezig: Vraag lezen.',
      'Tabel behandeltermijnen ophalen mislukt. De bron Termijnen gaf binnen 30 s geen antwoord.',
    ])
  })

  it('says nothing about the steps it arrives with, even a failure', async () => {
    const element = await mount({
      items: [{ label: 'Vraag gelezen' }, { label: 'Tabel ophalen mislukt', state: 'error' }],
    })
    await frame()
    await element.updateComplete
    expect(said(element)).toEqual([])
  })

  it('keeps the list out of the live log and the marks out of the tree', async () => {
    const element = await mount({ items: DONE })
    expect(element.shadowRoot!.querySelector('.lintje-chat-steps')!.getAttribute('aria-live')).toBe(
      'off',
    )
    const marks = [...element.shadowRoot!.querySelectorAll('.lintje-chat-steps__mark')]
    expect(marks.every((mark) => mark.getAttribute('aria-hidden') === 'true')).toBe(true)
  })
})
