/**
 * The transcript in a browser: the timecode's hit area never lies over a button of its fragment,
 * and the Escape of an edit in a window ends the edit, not the window.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import './transcript'
import '../../overlays/dialog/dialog'
import type { LintjeTranscript, TranscriptSegment } from './transcript'

const SEGMENTS: TranscriptSegment[] = [
  { id: 's1', start: 12, speaker: 'Spreker 1', text: 'Dan de planning voor volgende week.' },
  { id: 's2', start: 24, speaker: 'Spreker 2', text: 'Ja.' },
  { id: 's3', start: 31, speaker: 'Spreker 2', text: 'Is dat afgestemd met het team?' },
  { id: 's4', start: 45, speaker: 'Spreker 1', text: 'Nog niet. Ik stuur vandaag een bericht.' },
]

interface Case {
  name: string
  layout: 'rows' | 'chat'
  grouped: boolean
  /** Below 40rem the transcript puts name and time on one line. */
  width: string
  phone?: boolean
}

const CASES: Case[] = [
  { name: 'rows', layout: 'rows', grouped: false, width: '900px' },
  { name: 'rows, grouped', layout: 'rows', grouped: true, width: '900px' },
  { name: 'narrow rows', layout: 'rows', grouped: false, width: '360px' },
  { name: 'chat', layout: 'chat', grouped: false, width: '900px' },
  { name: 'chat, grouped', layout: 'chat', grouped: true, width: '900px' },
  { name: 'narrow chat', layout: 'chat', grouped: true, width: '360px' },
  { name: 'rows on a phone', layout: 'rows', grouped: false, width: '360px', phone: true },
]

async function mount({ layout, grouped, width, phone }: Case): Promise<LintjeTranscript> {
  if (phone) {
    await page.viewport(390, 844)
    await expect.poll(() => window.innerWidth).toBe(390)
  }
  const element = Object.assign(document.createElement('lintje-transcript'), {
    segments: SEGMENTS,
    layout,
    grouped,
  })
  element.style.width = width
  // The name shifts left to line up with the time: keep it on the screen.
  element.style.margin = '16px'
  document.body.append(element)
  await element.updateComplete
  await expect
    .poll(() => element.shadowRoot!.querySelectorAll('lintje-icon-button').length)
    .toBe(SEGMENTS.length)
  return element
}

/** The visible box of each button a fragment draws beside its time: the speaker and the pencil. */
function buttons(element: LintjeTranscript): { host: Element; box: DOMRect }[] {
  return [...element.shadowRoot!.querySelectorAll('lintje-menu-button, lintje-icon-button')]
    .map((host) => ({
      host,
      box: host.shadowRoot!.querySelector('button')!.getBoundingClientRect(),
    }))
    .filter(
      ({ host, box }) => box.width > 0 && getComputedStyle(host.parentElement!).opacity !== '0',
    )
}

/** Points over the whole box, 1 px in from its edges. */
function points(box: DOMRect): [number, number][] {
  const out: [number, number][] = []
  for (let x = box.left + 1; x <= box.right - 1; x += 3) {
    for (let y = box.top + 1; y <= box.bottom - 1; y += 2) out.push([x, y])
  }
  return out
}

afterEach(async () => {
  await page.viewport(1440, 900)
  document.body.replaceChildren()
})

describe('the timecode’s hit area', () => {
  it.each(CASES.map((item) => [item.name, item] as const))('%s', async (_, item) => {
    const element = await mount(item)
    const root = element.shadowRoot!
    const drawn = buttons(element)
    expect(drawn.length).toBeGreaterThan(SEGMENTS.length)
    for (const { host, box } of drawn) {
      const missed = points(box)
        .filter(([x, y]) => root.elementFromPoint(x, y) !== host)
        .map(
          ([x, y]) =>
            `${Math.round(x)},${Math.round(y)}: ${root.elementFromPoint(x, y)?.className}`,
        )
      expect(
        missed,
        `${host.localName} of ${host.closest<HTMLElement>('[data-id]')?.dataset.id}`,
      ).toEqual([])
    }
    for (const time of root.querySelectorAll<HTMLElement>('.lintje-transcript__time')) {
      const box = time.getBoundingClientRect()
      expect(root.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)).toBe(time)
    }
  })
})

describe('an edit in a window', () => {
  it('ends with Escape in its field, and the window stays open', async () => {
    const dialog = Object.assign(document.createElement('lintje-dialog'), {
      heading: 'Fragment bewerken',
    }) as HTMLElement & { open: boolean; updateComplete: Promise<unknown> }
    const element = Object.assign(document.createElement('lintje-transcript'), {
      segments: SEGMENTS,
      editingId: 's1',
    })
    const cancels: unknown[] = []
    element.addEventListener('lintje-segment-cancel', (event) =>
      cancels.push((event as CustomEvent).detail),
    )
    let closes = 0
    dialog.addEventListener('lintje-close', () => closes++)
    dialog.append(element)
    document.body.append(dialog)
    dialog.open = true
    await dialog.updateComplete
    await element.updateComplete
    const field = element.shadowRoot!.querySelector('lintje-textarea')!
    await expect.poll(() => field.shadowRoot?.querySelector('textarea')).toBeTruthy()
    field.shadowRoot!.querySelector('textarea')!.focus()
    await userEvent.keyboard('{Escape}')
    expect(cancels).toEqual(['s1'])
    expect(closes).toBe(0)
  })
})
