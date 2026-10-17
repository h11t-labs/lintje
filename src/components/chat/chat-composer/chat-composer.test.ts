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
import type { LintjeAttachment } from '../../content/attachment/attachment'
import type { ChatSourceData, ChatTermData, UploadFile } from '../../../types'

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

const region = (element: HTMLElement & { renderRoot: ParentNode }): string =>
  element.renderRoot
    .querySelector('.lintje-chat-composer > [role="status"]')
    ?.textContent?.trim() ?? 'geen regio'

/** What the composer's region says once its news has had its frame. */
async function news(
  element: HTMLElement & { renderRoot: ParentNode; updateComplete: Promise<unknown> },
) {
  await element.updateComplete
  await new Promise((resolve) => requestAnimationFrame(resolve))
  await element.updateComplete
  return region(element)
}

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
        attachments: [],
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

describe('lintje-chat-composer with attachments', () => {
  const DONE: UploadFile = { id: 'd', name: 'beleidsregel-2026.pdf', size: 120_000, state: 'done' }
  const BUSY: UploadFile = { id: 'b', name: 'aanvragen-q3.xlsx', state: 'busy', progress: 40 }
  const FAILED: UploadFile = {
    id: 'f',
    name: 'verklaring.pdf',
    state: 'error',
    message: 'Uploaden mislukt',
    retry: true,
  }

  const file = (name: string, kind: string, size = 1000): File => {
    const made = new File(['x'], name, { type: kind })
    Object.defineProperty(made, 'size', { value: size })
    return made
  }

  const sendButton = (element: LintjeChatComposer): HTMLElement & { disabled: boolean } =>
    element.renderRoot.querySelector('.lintje-chat-composer__send lintje-button')!

  const chips = (element: LintjeChatComposer): LintjeAttachment[] => [
    ...element.renderRoot.querySelectorAll<LintjeAttachment>('lintje-attachment'),
  ]

  const hint = (element: LintjeChatComposer): string | null | undefined =>
    element.renderRoot.querySelector('.lintje-chat-composer__hint')?.textContent

  it('has a paperclip only with `files`, and none in `variant="edit"`', async () => {
    const without = await composer()
    expect(without.renderRoot.querySelector('.lintje-chat-composer__attach')).toBeNull()
    const ask = await composer({ files: [] })
    const clip = ask.renderRoot.querySelector('.lintje-chat-composer__attach')!
    expect(clip.getAttribute('label')).toBe('Bijlage toevoegen')
    const edit = await composer({ files: [DONE], variant: 'edit' })
    expect(edit.renderRoot.querySelector('.lintje-chat-composer__attach')).toBeNull()
    expect(chips(edit)).toHaveLength(0)
  })

  it('draws the files in the frame, above the field, as removable chips in a labelled list', async () => {
    const element = await composer({ files: [DONE, BUSY] })
    const list = element.renderRoot.querySelector('.lintje-chat-composer__frame > ul')!
    expect(list.getAttribute('aria-label')).toBe('Bijlagen bij je vraag')
    expect(chips(element).map((chip) => chip.data?.id)).toEqual(['d', 'b'])
    expect(chips(element).every((chip) => chip.removable)).toBe(true)
  })

  it('sends with text only', async () => {
    const element = await composer({ files: [] })
    const sent = heard(element, 'lintje-message-send')
    await type(element, 'Hoeveel?')
    expect(sendButton(element).disabled).toBe(false)
    await press(element, { key: 'Enter' })
    expect(sent).toEqual([
      { text: 'Hoeveel?', terms: [], sources: [], form: 'auto', attachments: [] },
    ])
  })

  it('sends with only a done attachment: no text, the ids in `attachments`', async () => {
    const element = await composer({ files: [DONE, FAILED] })
    const sent = heard(element, 'lintje-message-send')
    expect(sendButton(element).disabled).toBe(false)
    await press(element, { key: 'Enter' })
    expect(sent).toEqual([{ text: '', terms: [], sources: [], form: 'auto', attachments: ['d'] }])
  })

  it('does not send with only files that are busy or failed', async () => {
    const element = await composer({ files: [FAILED] })
    const sent = heard(element, 'lintje-message-send')
    expect(sendButton(element).disabled).toBe(true)
    await press(element, { key: 'Enter' })
    element.files = [BUSY]
    await element.updateComplete
    expect(sendButton(element).disabled).toBe(true)
    await press(element, { key: 'Enter' })
    expect(sent).toEqual([])
  })

  it('waits while an attachment is busy, also with text, and says so', async () => {
    const element = await composer({ files: [DONE, BUSY] })
    const sent = heard(element, 'lintje-message-send')
    await type(element, 'Toets hieraan')
    expect(sendButton(element).disabled).toBe(true)
    expect(hint(element)).toBe('Wacht op de upload')
    await press(element, { key: 'Enter' })
    expect(sent).toEqual([])
    element.files = [DONE, { ...BUSY, state: 'done' }]
    await element.updateComplete
    expect(hint(element)).toBe('')
    await press(element, { key: 'Enter' })
    expect(sent).toEqual([
      { text: 'Toets hieraan', terms: [], sources: [], form: 'auto', attachments: ['d', 'b'] },
    ])
  })

  it('lets "Kies eerst een bron" win over the upload', async () => {
    const element = await composer({
      files: [BUSY],
      sources: SOURCES.map((source) => ({ ...source, selected: false })),
    })
    expect(hint(element)).toBe('Kies eerst een bron om een vraag te stellen')
  })

  it('refuses what does not pass itself, and never sends that file to the host', async () => {
    const element = await composer({ files: [], accept: '.pdf,.xlsx', maxSize: 20 * 1024 * 1024 })
    const added = heard(element, 'lintje-files-add')
    const removed = heard(element, 'lintje-file-remove')
    const good = file('beleidsregel.pdf', 'application/pdf')
    element.add([good, file('foto.heic', 'image/heic'), file('scan.pdf', '', 30 * 1024 * 1024)])
    await element.updateComplete
    expect(added).toEqual([[good]])
    const refused = chips(element)
    await Promise.all(refused.map((chip) => chip.updateComplete))
    expect(refused.map((chip) => chip.refused)).toEqual([true, true])
    expect(await news(element)).toBe(
      'foto.heic geweigerd: Dit bestandstype kan niet. scan.pdf geweigerd: Groter dan 20 MB',
    )
    refused[0].shadowRoot!.querySelector<HTMLElement>('.lintje-attachment__remove')!.click()
    await element.updateComplete
    expect(removed).toEqual([])
    expect(chips(element)).toHaveLength(1)
  })

  it('lets the events of the host’s chips through', async () => {
    const element = await composer({ files: [FAILED] })
    const retried = heard(element, 'lintje-file-retry')
    const chip = chips(element)[0]
    await chip.updateComplete
    chip.shadowRoot!.querySelector<HTMLElement>('.lintje-attachment__retry')!.click()
    expect(retried).toEqual([{ id: 'f' }])
  })

  it('says what changes in the files', async () => {
    const element = await composer({ files: [BUSY] })
    element.files = [{ ...BUSY, state: 'done' }]
    expect(await news(element)).toBe('aanvragen-q3.xlsx klaar')
  })

  it('says a second failure as it said the first, from a region that empties first', async () => {
    const element = await composer({ files: [BUSY] })
    const failed = { ...BUSY, state: 'error' as const, message: 'Verbinding verbroken' }
    element.files = [failed]
    const first = await news(element)
    expect(first).toContain('mislukt')
    // "Opnieuw": busy again, then the same failure.
    element.files = [BUSY]
    await news(element)
    element.files = [failed]
    await element.updateComplete
    expect(region(element)).toBe('')
    expect(await news(element)).toBe(first)
  })

  it('pastes files only when the clipboard carries no text', async () => {
    const element = await composer({ files: [] })
    const added = heard(element, 'lintje-files-add')
    const paste = (text: string): ClipboardEvent => {
      const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
      const files = [file('schermafbeelding.png', 'image/png')]
      Object.defineProperty(event, 'clipboardData', {
        value: { getData: (kind: string) => (kind === 'text/plain' ? text : ''), files },
      })
      field(element).dispatchEvent(event)
      return event
    }
    const withText = paste('Een zin')
    expect(added).toEqual([])
    expect(withText.defaultPrevented).toBe(false)
    const withoutText = paste('')
    expect(withoutText.defaultPrevented).toBe(true)
    expect((added[0] as File[]).map((pasted) => pasted.name)).toEqual(['schermafbeelding.png'])
  })

  it('takes no pasted files without `files`', async () => {
    const element = await composer()
    const added = heard(element, 'lintje-files-add')
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: { getData: () => '', files: [file('a.png', 'image/png')] },
    })
    field(element).dispatchEvent(event)
    expect(added).toEqual([])
  })

  it('folded, counts every attachment in its one line and in its button’s name', async () => {
    const element = await composer({
      collapsed: true,
      placeholder: 'Stel een nieuwe vraag',
      files: [DONE, BUSY, FAILED],
    })
    const expand = element.renderRoot.querySelector<HTMLButtonElement>(
      '.lintje-chat-composer__expand',
    )!
    expect(expand.textContent?.trim()).toBe('Stel een nieuwe vraag · 3 bijlagen')
    expect(expand.getAttribute('aria-label')).toBe('Stel een nieuwe vraag, 3 bijlagen')
    expect(expand.getAttribute('aria-expanded')).toBe('false')
    expect(chips(element).every((chip) => chip.closest('[hidden]'))).toBe(true)
    element.files = [DONE]
    await element.updateComplete
    expect(expand.textContent?.trim()).toBe('Stel een nieuwe vraag · 1 bijlage')
    element.files = []
    await element.updateComplete
    expect(expand.textContent?.trim()).toBe('Stel een nieuwe vraag')
    expect(expand.hasAttribute('aria-label')).toBe(false)
  })
})

describe('lintje-chat-composer folded', () => {
  it('asks to open with a tap and to fold with "Inklappen", and keeps its draft', async () => {
    const element = await composer({ collapsed: true })
    const asked = heard(element, 'lintje-composer-expand')
    const folded = heard(element, 'lintje-composer-collapse')
    expect(element.renderRoot.querySelector('lintje-multiselect')).toBeNull()
    element.renderRoot.querySelector<HTMLButtonElement>('.lintje-chat-composer__expand')!.click()
    expect(asked).toHaveLength(1)
    element.collapsed = false
    element.collapsible = true
    await element.updateComplete
    await type(element, 'Hoeveel aanvragen?')
    element.renderRoot.querySelector<HTMLElement>('.lintje-chat-composer__collapse')!.click()
    expect(folded).toHaveLength(1)
    element.collapsed = true
    await element.updateComplete
    element.collapsed = false
    await element.updateComplete
    expect(field(element).textContent).toBe('Hoeveel aanvragen?')
  })

  it('takes the focus on its one line', async () => {
    const element = await composer({ collapsed: true })
    element.focus()
    expect(deepActiveElement()?.classList.contains('lintje-chat-composer__expand')).toBe(true)
  })

  it('draws the host’s hint in its bar; a missing source wins', async () => {
    const element = await composer({ hint: 'Een nieuwe vraag slaat deze vragen over' })
    const hint = (): string | null | undefined =>
      element.renderRoot.querySelector('.lintje-chat-composer__hint')?.textContent
    expect(hint()).toBe('Een nieuwe vraag slaat deze vragen over')
    element.sources = [{ id: 'a', label: 'Aanvragen' }]
    await element.updateComplete
    expect(hint()).toBe('Kies eerst een bron om een vraag te stellen')
  })
})
