/** The transcript: the segments, the one that sounds, the requests it sends and the editing state. */
import { describe, expect, it } from 'vitest'
import { deepActiveElement } from '../../../core/focus'
import './transcript'
import {
  markedParts,
  shouldFollow,
  speakerMenu,
  type LintjeTranscript,
  type TranscriptSegment,
} from './transcript'

const SEGMENTS: TranscriptSegment[] = [
  { id: 's1', start: 702, speaker: 'Spreker 1', text: 'Dan de planning voor volgende week.' },
  {
    id: 's2',
    start: 724,
    speaker: 'Spreker 2',
    text: 'Is dat afgestemd met de roostermaker? Vorige keer liep dat mis.',
    uncertain: [[24, 36]],
  },
  { id: 's3', start: 739, speaker: 'Spreker 1', text: 'Nog niet. Ik stuur vandaag een bericht.' },
]

async function mount(props: Partial<LintjeTranscript> = {}): Promise<LintjeTranscript> {
  const element = Object.assign(document.createElement('lintje-transcript'), {
    segments: SEGMENTS,
    ...props,
  })
  document.body.append(element)
  await element.updateComplete
  return element
}

const items = (element: LintjeTranscript): HTMLLIElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLLIElement>('li'),
]

function collect(element: LintjeTranscript, name: string): unknown[] {
  const seen: unknown[] = []
  element.addEventListener(name, (event) => seen.push((event as CustomEvent).detail))
  return seen
}

describe('markedParts', () => {
  it('cuts the text at the uncertain ranges and the hits, and numbers the hits', () => {
    expect(
      markedParts(
        'abcdefgh',
        [[2, 6]],
        [
          [0, 3],
          [7, 8],
        ],
      ),
    ).toEqual([
      { text: 'ab', uncertain: false, match: 0 },
      { text: 'c', uncertain: true, match: 0 },
      { text: 'def', uncertain: true, match: -1 },
      { text: 'g', uncertain: false, match: -1 },
      { text: 'h', uncertain: false, match: 1 },
    ])
  })
})

describe('speakerMenu', () => {
  it('offers every speaker as a choice, a new one, and the name everywhere', () => {
    expect(speakerMenu('Spreker 2', ['Spreker 1', 'Spreker 2'])).toEqual([
      { heading: 'Dit fragment toewijzen aan' },
      { value: 'speaker:Spreker 1', label: 'Spreker 1', checked: false, radio: true },
      { value: 'speaker:Spreker 2', label: 'Spreker 2', checked: true, radio: true },
      { value: 'new', label: 'Nieuwe spreker…' },
      'separator',
      { value: 'rename', label: '‘Spreker 2’ overal een andere naam geven' },
    ])
  })
})

describe('shouldFollow', () => {
  it('waits 5 s after the reader scrolled', () => {
    expect(shouldFollow(10_000, 6_000)).toBe(false)
    expect(shouldFollow(11_000, 6_000)).toBe(true)
    expect(shouldFollow(0, Number.NEGATIVE_INFINITY)).toBe(true)
  })
})

describe('lintje-transcript', () => {
  it('gives every speaker its colour on the fragment, and shows the words about it', async () => {
    const segments = SEGMENTS.map((segment, index) =>
      index === 0 ? { ...segment, tags: [{ label: 'Actiepunt' }] } : segment,
    )
    const element = await mount({ segments })
    expect(items(element)[0]!.style.getPropertyValue('--lintje-speaker')).toBe(
      'var(--color-chart-sky-blue)',
    )
    expect(items(element)[2]!.style.getPropertyValue('--lintje-speaker')).toBe(
      'var(--color-chart-sky-blue)',
    )
    expect(items(element)[0]!.textContent).toContain('Actiepunt')
  })

  it("keeps a speaker's colour from `speakers` when only some fragments are shown", async () => {
    const element = await mount({ segments: [SEGMENTS[1]!], speakers: ['Spreker 1', 'Spreker 2'] })
    expect(items(element)[0]!.style.getPropertyValue('--lintje-speaker')).toBe(
      'var(--color-chart-dark-yellow)',
    )
  })

  it("marks a speaker's next fragment as a repeat, for grouping", async () => {
    const segments = [
      ...SEGMENTS,
      { id: 's4', start: 750, speaker: 'Spreker 1', text: 'Tot vrijdag.' },
    ]
    const element = await mount({ segments, grouped: true })
    expect(items(element).map((item) => item.classList.contains('is-repeat'))).toEqual([
      false,
      false,
      false,
      true,
    ])
    expect(element.hasAttribute('grouped')).toBe(true)
  })

  it('asks for another speaker, a new one, or the name everywhere from the speaker menu', async () => {
    const element = await mount()
    const moves = collect(element, 'lintje-segment-speaker')
    const news = collect(element, 'lintje-speaker-new')
    const renames = collect(element, 'lintje-speaker-rename')
    const menu = items(element)[1]!.querySelector('lintje-menu-button')!
    expect(menu.label).toBe('Spreker 2')
    expect(menu.accessibleLabel).toBe('Spreker: Spreker 2, wisselen')
    const choose = (value: string) =>
      menu.dispatchEvent(
        new CustomEvent('lintje-action', { detail: value, bubbles: true, composed: true }),
      )
    choose('speaker:Spreker 1')
    choose('speaker:Spreker 2')
    choose('new')
    choose('rename')
    expect(moves).toEqual([{ id: 's2', speaker: 'Spreker 1' }])
    expect(news).toEqual(['s2'])
    expect(renames).toEqual(['Spreker 2'])
  })

  it('shows the note row only once the host gives it a sentence', async () => {
    const element = await mount()
    const note = () => element.shadowRoot!.querySelector('.lintje-transcript__note')!
    expect(note().classList.contains('has-note')).toBe(false)
    const sentence = Object.assign(document.createElement('span'), {
      slot: 'note',
      textContent: 'Gemaakt door AI.',
    })
    element.append(sentence)
    await new Promise((resolve) => setTimeout(resolve))
    await element.updateComplete
    expect(note().classList.contains('has-note')).toBe(true)
  })

  it('live, says who speaks now and sets the provisional tail apart', async () => {
    const segments = SEGMENTS.map((segment, index) =>
      index === 1 ? { ...segment, pending: 'en je tekent' } : segment,
    )
    const root = (await mount({ segments, speakingId: SEGMENTS[1]!.id })).shadowRoot!
    const second = root.querySelectorAll('li')[1]!
    expect(second.querySelector('.lintje-transcript__now')!.textContent).toBe('spreekt nu')
    expect(second.querySelector('.lintje-transcript__pending')!.textContent).toBe('en je tekent')
  })

  it('read only, draws the text with no control in it', async () => {
    const root = (await mount({ readonly: true })).shadowRoot!
    expect(root.querySelectorAll('li')).toHaveLength(SEGMENTS.length)
    expect(root.querySelector('button, lintje-icon-button, lintje-menu-button')).toBeNull()
    expect(root.querySelector('.lintje-transcript__speaker')!.textContent).toBe(
      SEGMENTS[0]!.speaker,
    )
  })

  it('is an ordered list with a named timecode button and a speaker menu per segment', async () => {
    const element = await mount()
    const list = element.shadowRoot!.querySelector('ol')!
    expect(list.children).toHaveLength(3)
    const time = items(element)[1]!.querySelector('.lintje-transcript__time')!
    expect(time.textContent!.trim()).toBe('12:04')
    expect(time.getAttribute('aria-label')).toBe('Speel af vanaf 12:04')
    expect(items(element)[1]!.querySelector('lintje-menu-button')!.label).toBe('Spreker 2')
    // The edit button is the icon button's one box with its 48 px hit area: no size of its own.
    expect(items(element)[1]!.querySelector('.lintje-transcript__edit')!.hasAttribute('size')).toBe(
      false,
    )
  })

  it('marks the uncertain words with the highlight', async () => {
    const element = await mount()
    const marks = items(element)[1]!.querySelectorAll('lintje-highlight')
    expect(marks).toHaveLength(1)
    expect(marks[0]!.getAttribute('kind')).toBe('uncertain')
    expect(marks[0]!.textContent).toBe('roostermaker')
  })

  it('marks the segment that sounds with aria-current', async () => {
    const element = await mount({ currentTime: 730 })
    expect(items(element).map((item) => item.getAttribute('aria-current'))).toEqual([
      null,
      'true',
      null,
    ])
    expect(items(element)[1]!.classList.contains('is-current')).toBe(true)
    // The time of the one that sounds carries the play mark; the words say nothing more.
    expect(items(element)[1]!.querySelector('.lintje-transcript__playing')).not.toBeNull()
    expect(items(element)[0]!.querySelector('.lintje-transcript__playing')).toBeNull()
    element.currentTime = 600
    await element.updateComplete
    expect(element.shadowRoot!.querySelector('[aria-current]')).toBeNull()
  })

  it('asks to seek on a timecode and to edit on the edit button', async () => {
    const element = await mount()
    const seeks = collect(element, 'lintje-seek')
    const edits = collect(element, 'lintje-segment-edit')
    items(element)[2]!.querySelector<HTMLButtonElement>('.lintje-transcript__time')!.click()
    items(element)[0]!.querySelector<HTMLElement>('.lintje-transcript__edit')!.click()
    expect(seeks).toEqual([739])
    expect(edits).toEqual(['s1'])
  })

  it('draws the field and the buttons for the segment in editing, and sends save and cancel', async () => {
    const element = await mount({ editingId: 's3' })
    const editing = items(element)[2]!
    const field = editing.querySelector('lintje-textarea')!
    expect(field.value).toBe('Nog niet. Ik stuur vandaag een bericht.')
    expect(field.label).toBe('Tekst van dit fragment')
    expect(items(element)[0]!.querySelector('lintje-textarea')).toBeNull()

    const saves = collect(element, 'lintje-segment-save')
    const cancels = collect(element, 'lintje-segment-cancel')
    field.value = 'Nog niet. Ik bel vandaag.'
    const [save, cancel] = editing.querySelectorAll('lintje-button')
    save!.click()
    cancel!.click()
    expect(saves).toEqual([{ id: 's3', text: 'Nog niet. Ik bel vandaag.' }])
    expect(cancels).toEqual(['s3'])
  })

  it('saves on Ctrl+Enter and cancels on Escape', async () => {
    const element = await mount({ editingId: 's1' })
    const editor = items(element)[0]!.querySelector('.lintje-transcript__editor')!
    const saves = collect(element, 'lintje-segment-save')
    const cancels = collect(element, 'lintje-segment-cancel')
    editor.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }),
    )
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(saves).toHaveLength(1)
    expect(cancels).toEqual(['s1'])
  })

  it('disables the field and makes Opslaan busy while saving, and shows the error', async () => {
    const element = await mount({
      editingId: 's2',
      busyId: 's2',
      errors: { s2: 'Opslaan is niet gelukt. Probeer het opnieuw.' },
    })
    const editing = items(element)[1]!
    expect(editing.querySelector('lintje-textarea')!.disabled).toBe(true)
    expect(editing.querySelector('lintje-textarea')!.error).toBe(
      'Opslaan is niet gelukt. Probeer het opnieuw.',
    )
    const [save] = editing.querySelectorAll('lintje-button')
    expect(save!.busy).toBe(true)
    const saves = collect(element, 'lintje-segment-save')
    save!.click()
    expect(saves).toHaveLength(0)
  })

  it('keeps the focus while a save from the field runs, and gives it back when it fails', async () => {
    const element = await mount({ editingId: 's2' })
    const editing = items(element)[1]!
    const field = editing.querySelector('lintje-textarea')!
    await field.updateComplete
    const area = field.shadowRoot!.querySelector('textarea')!
    area.focus()
    const [save] = editing.querySelectorAll('lintje-button')
    await save!.updateComplete

    element.busyId = 's2'
    await element.updateComplete
    await field.updateComplete
    expect(field.disabled).toBe(true)
    expect(deepActiveElement()).toBe(save!.shadowRoot!.querySelector('button'))

    element.busyId = null
    element.errors = { s2: 'Opslaan is niet gelukt. Probeer het opnieuw.' }
    await element.updateComplete
    await field.updateComplete
    await Promise.resolve()
    expect(deepActiveElement()).toBe(area)
  })

  it("marks a host search's hits, one of them current", async () => {
    const element = await mount({
      searchMatches: {
        s2: [
          [7, 16],
          [38, 44],
        ],
        s3: [[0, 3]],
      },
      currentMatch: { id: 's2', index: 1 },
    })
    const marks = (index: number) => [
      ...items(element)[index]!.querySelectorAll('lintje-highlight[kind="match"]'),
    ]
    expect(marks(1).map((mark) => mark.textContent!.trim())).toEqual(['afgestemd', 'Vorige'])
    expect(marks(1).map((mark) => mark.hasAttribute('current'))).toEqual([false, true])
    expect(marks(2).map((mark) => mark.textContent!.trim())).toEqual(['Nog'])
    // The uncertain range keeps its own marking.
    expect(items(element)[1]!.querySelector('lintje-highlight[kind="uncertain"]')).not.toBeNull()
  })
})
