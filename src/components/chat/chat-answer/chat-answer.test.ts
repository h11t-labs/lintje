/**
 * `<lintje-chat-answer>`: an answer is existing blocks with a conversation
 * around them. What is checked is which parts each state draws, and what leaves.
 */
import { describe, expect, it, vi } from 'vitest'
import { deepActiveElement } from '../../../core/focus'
import type { LintjeButton } from '../../../primitives/button/button'
import './chat-answer'
import type { LintjeChatAnswer } from './chat-answer'
import type { ChatBlock, ChatStripData } from '../../../types'

const STRIP: ChatStripData = { items: [{ key: 'source', label: 'Bron', value: 'Aanvragen' }] }
const BLOCKS: ChatBlock[] = [
  { kind: 'prose', text: 'Een toelichting.' },
  { kind: 'kpi-row', data: { kpis: [{ label: 'Aanvragen', value: '148.230' }] } },
  {
    kind: 'chart-tile',
    data: { chart: { kind: 'bar', labels: ['ma'], values: [1] }, description: 'Per dag.', span: 6 },
  },
  { kind: 'data-table', data: { caption: 'Loketten', columns: [], rows: [], rowKey: 'id' } },
]

async function answer(props: Partial<LintjeChatAnswer>): Promise<LintjeChatAnswer> {
  const element = document.createElement('lintje-chat-answer')
  Object.assign(
    element,
    { lead: 'Het zijn er 148.230.', text: 'Dat is meer dan vorige week.' },
    props,
  )
  document.body.append(element)
  await element.updateComplete
  return element
}

const has = (element: LintjeChatAnswer, selector: string): boolean =>
  element.renderRoot.querySelector(selector) !== null

function heard(name: string): unknown[] {
  const details: unknown[] = []
  document.addEventListener(name, (event) => details.push((event as CustomEvent).detail))
  return details
}

describe('lintje-chat-answer', () => {
  it('opens with the role, hidden, and the first sentence bold', async () => {
    const element = await answer({})
    const text = element.renderRoot.querySelector('lintje-prose')
    expect(text?.querySelector('.visually-hidden')?.textContent).toBe('Assistent: ')
    expect(text?.querySelector('strong')?.textContent).toBe('Het zijn er 148.230.')
    expect(text?.textContent).toContain('Dat is meer dan vorige week.')
  })

  it('draws each block with the tag that already exists', async () => {
    const element = await answer({ blocks: BLOCKS })
    const tags = [
      ...(element.renderRoot.querySelector('.lintje-chat-answer__blocks')?.children ?? []),
    ]
    expect(tags.map((tag) => tag.localName)).toEqual([
      'lintje-prose',
      'lintje-kpi-row',
      'lintje-chart-tile',
      'lintje-data-table',
    ])
    expect(tags[2].getAttribute('span')).toBe('6')
  })

  it('ready: the strip and the actions; follow-ups and retry on the current answer only', async () => {
    const followUps = [{ label: 'En gisteren?' }]
    const older = await answer({ strip: STRIP, followUps })
    expect(has(older, 'lintje-chat-strip[disabled]')).toBe(true)
    expect(has(older, '[label="Antwoord kopiëren"]')).toBe(true)
    expect(has(older, '[label="Opnieuw beantwoorden"]')).toBe(false)
    expect(has(older, 'lintje-chat-suggestions')).toBe(false)
    // The actions are the icon button's one box with its 48 px hit area: no size of their own.
    expect(has(older, '.lintje-chat-answer__actions lintje-icon-button[size]')).toBe(false)

    const current = await answer({ strip: STRIP, followUps, current: true })
    expect(has(current, 'lintje-chat-strip:not([disabled])')).toBe(true)
    expect(has(current, '[label="Opnieuw beantwoorden"]')).toBe(true)
    expect(current.renderRoot.querySelector('lintje-chat-suggestions')?.getAttribute('label')).toBe(
      'Jij, als vervolgvraag',
    )
  })

  it('streaming: busy, a status line that names the step, and nothing to press', async () => {
    const element = await answer({
      state: 'streaming',
      status: 'Cijfers berekenen',
      strip: STRIP,
      current: true,
    })
    expect(element.renderRoot.querySelector('lintje-prose')?.getAttribute('aria-busy')).toBe('true')
    const spinner = element.renderRoot.querySelector('lintje-spinner')
    expect(spinner?.getAttribute('label')).toBe('Cijfers berekenen')
    // The step is a status of its own, so nothing busy may stand around it.
    expect(spinner?.closest('[aria-busy]')).toBeNull()
    expect(has(element, 'lintje-chat-strip')).toBe(false)
    expect(has(element, 'lintje-icon-button')).toBe(false)
  })

  it('streaming: the log does not read the text; whole sentences are spoken beside it', async () => {
    const element = await answer({ state: 'streaming', lead: 'Het zijn er', text: '' })
    const spoken = (): string[] =>
      [...element.renderRoot.querySelectorAll('[role="status"]:not(lintje-spinner) p')].map(
        (p) => p.textContent ?? '',
      )
    const text = element.renderRoot.querySelector('lintje-prose')
    expect(text?.getAttribute('aria-live')).toBe('off')
    expect(spoken()).toEqual([])

    element.lead = 'Het zijn er 148.230.'
    element.text = 'Dat is meer dan'
    await element.updateComplete
    expect(spoken()).toEqual(['Het zijn er 148.230.'])

    element.text = 'Dat is meer dan vorige week'
    element.state = 'ready'
    await element.updateComplete
    expect(spoken()).toEqual(['Het zijn er 148.230.', 'Dat is meer dan vorige week'])
    // Still off: the log would read the finished text a second time.
    expect(text?.getAttribute('aria-live')).toBe('off')
    // A new sentence is read on its own, not with every sentence before it.
    const region = element.renderRoot.querySelector('[role="status"]:not(lintje-spinner)')
    expect(region?.getAttribute('aria-atomic')).toBe('false')
  })

  it('streaming: text replaced in place is spoken from its start, not from where the old ended', async () => {
    const element = await answer({ state: 'streaming', lead: 'Het zijn er 148.230.', text: 'Dat' })
    const spoken = (): string[] =>
      [...element.renderRoot.querySelectorAll('[role="status"]:not(lintje-spinner) p')].map(
        (p) => p.textContent ?? '',
      )
    expect(spoken()).toEqual(['Het zijn er 148.230.'])

    element.lead = 'Er zijn 12 loketten.'
    element.text = 'Elk'
    await element.updateComplete
    expect(spoken()).toEqual(['Er zijn 12 loketten.'])

    element.text = 'Elk loket is open.'
    element.state = 'ready'
    await element.updateComplete
    expect(spoken()).toEqual(['Er zijn 12 loketten.', 'Elk loket is open.'])
  })

  it('an answer that arrives whole is read by the log and spoken nowhere else', async () => {
    const element = await answer({})
    expect(element.renderRoot.querySelector('lintje-prose')?.hasAttribute('aria-live')).toBe(false)
    expect(element.renderRoot.querySelector('[role="status"]:not(lintje-spinner) p')).toBeNull()
  })

  it('says "Gekopieerd" again on a second copy, and lets it go after a while', async () => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    })
    try {
      const element = await answer({})
      const note = (): string =>
        element.renderRoot.querySelector('.lintje-chat-answer__note')?.textContent ?? ''
      const copy = element.renderRoot.querySelector<HTMLElement>('[label="Antwoord kopiëren"]')
      copy?.click()
      await vi.advanceTimersByTimeAsync(0)
      expect(note()).toBe('Gekopieerd')
      copy?.click()
      await vi.advanceTimersByTimeAsync(0)
      expect(note()).toBe('')
      await vi.advanceTimersByTimeAsync(100)
      expect(note()).toBe('Gekopieerd')
      await vi.advanceTimersByTimeAsync(2000)
      expect(note()).toBe('')
    } finally {
      vi.useRealTimers()
    }
  })

  it('stopped: says so, and offers no actions', async () => {
    const element = await answer({ state: 'stopped', current: true })
    expect(element.renderRoot.querySelector('.lintje-chat-answer__stopped')?.textContent).toBe(
      'Antwoord gestopt.',
    )
    expect(has(element, 'lintje-icon-button')).toBe(false)
  })

  it('error: the warning announcement, with a retry on the current answer', async () => {
    const retries = heard('lintje-answer-retry')
    const element = await answer({
      state: 'error',
      turnId: 't3',
      current: true,
      error: { text: 'Te laat.' },
    })
    const notice = element.renderRoot.querySelector('lintje-announcement')
    // It failed just now, so the announcement is a live region.
    expect(notice?.data).toMatchObject({ kind: 'warning', text: 'Te laat.', live: true })
    const retry = notice?.querySelector<HTMLElement>('lintje-button[slot="action"]')
    expect(retry?.textContent).toContain('Opnieuw proberen')
    retry?.click()
    expect(retries).toEqual([{ turnId: 't3' }])

    const older = await answer({ state: 'error' })
    expect(has(older, 'lintje-button[slot="action"]')).toBe(false)
  })

  it('a question back: solid choices under their own label, per state', async () => {
    const choices = [{ label: 'Loket A' }]
    const clarify = await answer({ state: 'needs-clarification', choices, current: true })
    const asked = clarify.renderRoot.querySelector('lintje-chat-suggestions')
    expect(asked?.getAttribute('kind')).toBe('choice')
    expect(asked?.getAttribute('label')).toBe('Kies je antwoord')

    const scope = await answer({ state: 'out-of-scope', choices, current: true })
    expect(scope.renderRoot.querySelector('lintje-chat-suggestions')?.getAttribute('label')).toBe(
      'Kies wat je wilt doen',
    )
    expect(has(scope, 'lintje-icon-button')).toBe(false)
  })

  it('a thumbs down asks why, and each press is one event', async () => {
    const feedback = heard('lintje-answer-rate')
    const element = await answer({ turnId: 't4' })
    const down = element.renderRoot.querySelector<HTMLElement>('[label="Slecht antwoord"]')
    down?.click()
    await element.updateComplete
    const reasons = element.renderRoot.querySelector('.lintje-chat-answer__reasons')
    expect(reasons?.getAttribute('role')).toBe('group')
    const buttons = reasons?.querySelectorAll<HTMLElement>('lintje-button') ?? []
    expect([...buttons].map((button) => button.textContent?.trim())).toEqual([
      'Klopt niet',
      'Niet wat ik vroeg',
      'Onduidelijk',
    ])
    buttons[0].click()
    await element.updateComplete
    expect(feedback).toEqual([
      { turnId: 't4', rating: 'down', reason: null },
      { turnId: 't4', rating: 'down', reason: 'Klopt niet' },
    ])
    expect(has(element, '.lintje-chat-answer__reasons')).toBe(false)
    expect(element.renderRoot.querySelector('.lintje-chat-answer__note')?.textContent).toBe(
      'Bedankt, doorgegeven.',
    )
  })

  it('a reason chosen by keyboard leaves the focus on the thumb it answers', async () => {
    const element = await answer({})
    const down = element.renderRoot.querySelector<HTMLElement>('[label="Slecht antwoord"]')
    down?.click()
    await element.updateComplete
    const reason = element.renderRoot.querySelector<LintjeButton>(
      '.lintje-chat-answer__reasons lintje-button',
    )
    await reason?.updateComplete
    reason?.shadowRoot?.querySelector<HTMLElement>('button')?.focus()
    expect(deepActiveElement()).toBe(reason?.shadowRoot?.querySelector('button'))
    reason?.click()
    await element.updateComplete
    expect(has(element, '.lintje-chat-answer__reasons')).toBe(false)
    expect(deepActiveElement()).toBe(down?.shadowRoot?.querySelector('button'))
  })
})
