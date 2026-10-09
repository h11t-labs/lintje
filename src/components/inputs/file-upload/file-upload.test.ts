/**
 * The file upload: the check on type and size (arithmetic), what it sends the host and what
 * it keeps itself, the rows it draws from `.files`, and the line a screen reader hears.
 * Dragging is a browser matter; what a drop *does* is tested through the same `add()`.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import './file-upload'
import {
  accepts,
  formatSize,
  refusal,
  rowNews,
  typesText,
  type LintjeFileUpload,
  type UploadFile,
} from './file-upload'

const MB = 1024 * 1024

async function mount(props: Partial<LintjeFileUpload> = {}): Promise<LintjeFileUpload> {
  const element = document.createElement('lintje-file-upload')
  Object.assign(element, props)
  document.body.append(element)
  await element.updateComplete
  return element
}

const file = (name: string, type: string, size = 1000): File => {
  const made = new File(['x'], name, { type })
  Object.defineProperty(made, 'size', { value: size })
  return made
}

function listen(element: LintjeFileUpload, name: string): unknown[] {
  const seen: unknown[] = []
  element.addEventListener(name, (event) => seen.push((event as CustomEvent).detail))
  return seen
}

const ROWS: UploadFile[] = [
  { id: 'a', name: 'verklaring.pdf', size: 482113, state: 'busy', progress: 45 },
  { id: 'b', name: 'foto.jpg', size: 2.4 * MB, state: 'done' },
  { id: 'c', name: 'beeld.mov', size: 9 * MB, state: 'error', message: 'De server weigerde het' },
]

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('the arithmetic', () => {
  it('writes sizes the Dutch way', () => {
    expect(formatSize(512)).toBe('512 B')
    expect(formatSize(820 * 1024)).toBe('820 kB')
    expect(formatSize(2.4 * MB)).toBe('2,4 MB')
    expect(formatSize(10 * MB)).toBe('10 MB')
  })

  it('says the accepted types as a reader would', () => {
    expect(typesText('.pdf,.jpg,.png')).toBe('PDF, JPG of PNG')
    expect(typesText('application/pdf, image/*')).toBe('PDF of afbeeldingen')
    expect(typesText('.pdf')).toBe('PDF')
  })

  it('matches a file by extension, by type and by kind', () => {
    expect(accepts({ name: 'A.PDF', type: '' }, '.pdf')).toBe(true)
    expect(accepts({ name: 'foto', type: 'image/jpeg' }, 'image/*')).toBe(true)
    expect(accepts({ name: 'beeld.mov', type: 'video/quicktime' }, '.pdf,image/*')).toBe(false)
    expect(accepts({ name: 'wat dan ook', type: '' }, '')).toBe(true)
  })

  it('gives the reason a file is refused', () => {
    expect(refusal({ name: 'beeld.mov', type: 'video/quicktime', size: 1 }, '.pdf', 0)).toBe(
      'Dit bestandstype kan niet',
    )
    expect(refusal({ name: 'groot.pdf', type: '', size: 11 * MB }, '.pdf', 10 * MB)).toBe(
      'Groter dan 10 MB',
    )
    expect(refusal({ name: 'klein.pdf', type: '', size: 1 }, '.pdf', 10 * MB)).toBe('')
  })

  it('tells what changed between two lists of rows', () => {
    const busy: UploadFile = { id: 'a', name: 'verklaring.pdf', size: 1, state: 'busy' }
    expect(rowNews([], [busy])).toBe('verklaring.pdf toegevoegd')
    expect(rowNews([busy], [{ ...busy, progress: 50 }])).toBe('')
    expect(rowNews([busy], [{ ...busy, state: 'done' }])).toBe('verklaring.pdf klaar')
    expect(rowNews([busy], [{ ...busy, state: 'error', message: 'Te groot' }])).toBe(
      'verklaring.pdf geweigerd: Te groot',
    )
  })
})

describe('lintje-file-upload', () => {
  it('draws the zone with the button, the types and the size', async () => {
    const element = await mount({ accept: '.pdf,.jpg', maxSize: 10 * MB })
    const zone = element.renderRoot.querySelector('.lintje-file-upload')!
    expect(zone.querySelector('lintje-button')?.textContent?.trim()).toBe('Bestanden kiezen')
    expect(zone.querySelector('.lintje-file-upload__meta')?.textContent).toBe(
      'PDF of JPG · hoogstens 10 MB',
    )
    const input = element.renderRoot.querySelector<HTMLInputElement>('input[type="file"]')!
    expect(input.accept).toBe('.pdf,.jpg')
    expect(input.multiple).toBe(true)
  })

  it('stacks the zone in the middle of its height with `fill`', async () => {
    const element = await mount({ fill: true })
    expect(element.hasAttribute('fill')).toBe(true)
    expect(element.renderRoot.querySelector('.lintje-file-upload--fill')).not.toBeNull()
  })

  it('sends the files that pass and keeps a row for the ones it refuses', async () => {
    const element = await mount({ accept: '.pdf', maxSize: 10 * MB })
    const added = listen(element, 'lintje-files-add')
    const good = file('verklaring.pdf', 'application/pdf')
    element.add([good, file('beeld.mov', 'video/quicktime'), file('groot.pdf', '', 20 * MB)])
    await element.updateComplete
    expect(added).toEqual([[good]])
    const reasons = [...element.renderRoot.querySelectorAll('.lintje-file-upload__reason')].map(
      (node) => node.textContent,
    )
    expect(reasons).toEqual(['Dit bestandstype kan niet', 'Groter dan 10 MB'])
    expect(element.renderRoot.querySelector('[role="status"]')?.textContent).toContain(
      'beeld.mov geweigerd: Dit bestandstype kan niet',
    )
    // Removing a refused row is the element's own business: nothing goes to the host.
    const removed = listen(element, 'lintje-file-remove')
    element.renderRoot.querySelector<HTMLElement>('.is-error lintje-button')!.click()
    await element.updateComplete
    expect(removed).toEqual([])
    expect(element.renderRoot.querySelectorAll('.lintje-file-upload__row')).toHaveLength(1)
  })

  it("draws the host's rows: busy with its bar, done, refused", async () => {
    const element = await mount({ files: ROWS })
    const rows = element.renderRoot.querySelectorAll('.lintje-file-upload__row')
    expect(rows).toHaveLength(3)
    expect(rows[0].querySelector('lintje-progress-bar')?.value).toBe(45)
    expect(rows[0].querySelector('.lintje-file-upload__detail')?.textContent).toBe('· 45%')
    expect(rows[1].querySelector('.lintje-file-upload__detail')?.textContent).toBe('· 2,4 MB')
    expect(rows[2].querySelector('.lintje-file-upload__reason')?.textContent).toBe(
      'De server weigerde het',
    )
  })

  it('asks the host to cancel and to remove, with the id', async () => {
    const element = await mount({ files: ROWS })
    const cancels = listen(element, 'lintje-file-cancel')
    const removes = listen(element, 'lintje-file-remove')
    const buttons = element.renderRoot.querySelectorAll<HTMLElement>(
      '.lintje-file-upload__row lintje-button',
    )
    buttons[0].click()
    buttons[1].click()
    expect(cancels).toEqual([{ id: 'a' }])
    expect(removes).toEqual([{ id: 'b' }])
  })

  it('commits the ids of the finished rows through the name gate', async () => {
    const element = await mount({ files: [ROWS[0]], name: 'bijlagen' })
    const seen = listen(element, 'lintje-values-change')
    element.files = [{ ...ROWS[0], state: 'done' }]
    await element.updateComplete
    expect(seen).toEqual([{ bijlagen: ['a'] }])
    expect(element.renderRoot.querySelector('[role="status"]')?.textContent).toBe(
      'verklaring.pdf klaar',
    )
  })

  it('takes a drop and ignores one while disabled', async () => {
    const element = await mount()
    const added = listen(element, 'lintje-files-add')
    const zone = element.renderRoot.querySelector('.lintje-file-upload')!
    const drop = (): Event => {
      const event = new Event('drop', { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'dataTransfer', {
        value: { files: [file('a.pdf', 'application/pdf')], types: ['Files'] },
      })
      return event
    }
    zone.dispatchEvent(drop())
    expect(added).toHaveLength(1)
    element.disabled = true
    await element.updateComplete
    zone.dispatchEvent(drop())
    expect(added).toHaveLength(1)
    expect(element.renderRoot.querySelector('lintje-button')?.hasAttribute('disabled')).toBe(true)
  })

  it('gives the button, the one control, the label, the limits and the message', async () => {
    const element = await mount({
      label: 'Bijlagen',
      hint: 'Een scan mag ook',
      accept: '.pdf',
      maxSize: 10 * MB,
    })
    const button = element.renderRoot.querySelector<HTMLElement & { invalid: boolean }>(
      '.lintje-file-upload__button',
    )!
    expect(button.getAttribute('accessible-name')).toBe('Bestanden kiezen, Bijlagen')
    expect(button.getAttribute('description')).toBe('PDF · hoogstens 10 MB. Een scan mag ook')
    expect(button.invalid).toBe(false)
    element.error = 'Voeg minstens één bestand toe'
    await element.updateComplete
    expect(button.getAttribute('description')).toBe(
      'PDF · hoogstens 10 MB. Voeg minstens één bestand toe',
    )
    expect(button.invalid).toBe(true)
  })

  it('says how each row stands in words, not only by its icon', async () => {
    const element = await mount({ files: ROWS })
    const states = [...element.renderRoot.querySelectorAll('.lintje-file-upload__name')].map(
      (name) => name.querySelector('.visually-hidden')?.textContent,
    )
    expect(states).toEqual([', bezig', ', klaar', ', geweigerd'])
  })

  it('moves the focus to the row in the place of a removed one, else the one before, else the button', async () => {
    const element = await mount({ files: ROWS })
    const rowButton = (id: string): HTMLElement =>
      element.renderRoot
        .querySelector(`[data-id="${id}"] lintje-button`)!
        .shadowRoot!.querySelector('button')!
    const focused = (): Element | null | undefined =>
      element.shadowRoot!.activeElement?.shadowRoot?.activeElement
    rowButton('b').focus()
    element.files = [ROWS[0], ROWS[2]]
    await element.updateComplete
    expect(focused()).toBe(rowButton('c'))
    element.files = [ROWS[0]]
    await element.updateComplete
    expect(focused()).toBe(rowButton('a'))
    element.files = []
    await element.updateComplete
    expect(
      element.shadowRoot!.activeElement?.classList.contains('lintje-file-upload__button'),
    ).toBe(true)
  })

  it('draws the error line with its glyph and the solid red border', async () => {
    const element = await mount({ error: 'Voeg minstens één bestand toe' })
    expect(
      element.renderRoot.querySelector('.lintje-file-upload')?.classList.contains('is-error'),
    ).toBe(true)
    const message = element.renderRoot.querySelector('.lintje-field__error')!
    expect(message.querySelector('svg')).not.toBeNull()
    expect(message.getAttribute('role')).toBe('alert')
  })
})
