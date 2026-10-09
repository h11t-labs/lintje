/** The file zone in a real engine: how many files a drag carries, read from its `DataTransfer`. */
import { afterEach, describe, expect, it } from 'vitest'
import './file-upload'
import type { LintjeFileUpload } from './file-upload'

async function mount(): Promise<LintjeFileUpload> {
  const element = Object.assign(document.createElement('lintje-file-upload'), {
    label: 'Bijlagen',
  })
  document.body.append(element)
  await element.updateComplete
  return element
}

const zone = (element: LintjeFileUpload): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('.lintje-file-upload')!

const shown = (element: LintjeFileUpload): string =>
  element.shadowRoot!.querySelector('.lintje-file-upload__text')!.textContent!.trim()

function carrying(...names: string[]): DataTransfer {
  const data = new DataTransfer()
  for (const name of names) data.items.add(new File(['inhoud'], name, { type: 'application/pdf' }))
  return data
}

async function drag(
  element: LintjeFileUpload,
  type: string,
  dataTransfer: DataTransfer,
): Promise<DragEvent> {
  const event = new DragEvent(type, {
    dataTransfer,
    bubbles: true,
    composed: true,
    cancelable: true,
  })
  zone(element).dispatchEvent(event)
  await element.updateComplete
  return event
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('lintje-file-upload while files are dragged over it', () => {
  it('says how many files the drag carries', async () => {
    const element = await mount()
    await drag(element, 'dragenter', carrying('verslag.pdf', 'bijlage.pdf'))
    expect(shown(element)).toBe('Laat los om 2 bestanden toe te voegen')
  })

  it('says one file in the singular', async () => {
    const element = await mount()
    await drag(element, 'dragenter', carrying('verslag.pdf'))
    expect(shown(element)).toBe('Laat los om 1 bestand toe te voegen')
  })

  it('takes the drop: the zone accepts it on dragover, and the drop hands over the files', async () => {
    const element = await mount()
    const data = carrying('verslag.pdf', 'bijlage.pdf')
    await drag(element, 'dragenter', data)
    expect((await drag(element, 'dragover', data)).defaultPrevented).toBe(true)
    const added: File[][] = []
    element.addEventListener('lintje-files-add', (event) =>
      added.push((event as CustomEvent<File[]>).detail),
    )
    await drag(element, 'drop', data)
    expect(added.map((files) => files.map((file) => file.name))).toEqual([
      ['verslag.pdf', 'bijlage.pdf'],
    ])
    expect(shown(element)).toBe('of sleep ze hierheen')
  })

  it('returns to the button when the drag leaves', async () => {
    const element = await mount()
    const data = carrying('verslag.pdf')
    await drag(element, 'dragenter', data)
    await drag(element, 'dragleave', data)
    expect(shown(element)).toBe('of sleep ze hierheen')
  })

  it('ignores a drag without files', async () => {
    const element = await mount()
    const data = new DataTransfer()
    data.setData('text/plain', 'Een stuk tekst')
    await drag(element, 'dragenter', data)
    expect(shown(element)).toBe('of sleep ze hierheen')
  })
})
