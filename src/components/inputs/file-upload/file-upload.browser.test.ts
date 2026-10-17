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

/** A script's `DataTransfer` ignores a set `dropEffect`; an own property records it. */
function recordingDropEffect(data: DataTransfer): DataTransfer {
  Object.defineProperty(data, 'dropEffect', { value: 'copy', writable: true })
  return data
}

async function drag(
  element: LintjeFileUpload,
  type: string,
  dataTransfer: DataTransfer,
  target: EventTarget = zone(element),
): Promise<DragEvent> {
  const event = new DragEvent(type, {
    dataTransfer,
    bubbles: true,
    composed: true,
    cancelable: true,
  })
  target.dispatchEvent(event)
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

  it('points at itself while the drag is beside it, and fills only once it is over it', async () => {
    const element = await mount()
    const data = carrying('verslag.pdf', 'bijlage.pdf')
    await drag(element, 'dragenter', data, document.body)
    expect(shown(element)).toBe('Sleep 2 bestanden hierheen')
    expect(zone(element).classList.contains('is-dragging')).toBe(true)
    expect(zone(element).classList.contains('is-over')).toBe(false)
    await drag(element, 'dragenter', data)
    expect(shown(element)).toBe('Laat los om 2 bestanden toe te voegen')
    expect(zone(element).classList.contains('is-over')).toBe(true)
    await drag(element, 'dragleave', data)
    expect(shown(element)).toBe('Sleep 2 bestanden hierheen')
    expect(zone(element).classList.contains('is-over')).toBe(false)
  })

  it('stays filled while the drag crosses into the zone’s own text', async () => {
    const element = await mount()
    const data = carrying('verslag.pdf')
    await drag(element, 'dragenter', data)
    const text = element.shadowRoot!.querySelector('.lintje-file-upload__text')!
    await drag(element, 'dragenter', data, text)
    await drag(element, 'dragleave', data)
    expect(zone(element).classList.contains('is-over')).toBe(true)
  })

  it('ignores a drag without files', async () => {
    const element = await mount()
    const data = new DataTransfer()
    data.setData('text/plain', 'Een stuk tekst')
    await drag(element, 'dragenter', data)
    expect(shown(element)).toBe('of sleep ze hierheen')
  })
})

describe('lintje-file-upload when files are dropped beside it', () => {
  function addedBy(element: LintjeFileUpload): File[][] {
    const added: File[][] = []
    element.addEventListener('lintje-files-add', (event) =>
      added.push((event as CustomEvent<File[]>).detail),
    )
    return added
  }

  it('refuses the drop, so the browser does not open the file', async () => {
    const element = await mount()
    const added = addedBy(element)
    const data = recordingDropEffect(carrying('verslag.pdf'))
    const over = await drag(element, 'dragover', data, document.body)
    expect(over.defaultPrevented).toBe(true)
    expect(data.dropEffect).toBe('none')
    expect((await drag(element, 'drop', data, document.body)).defaultPrevented).toBe(true)
    expect(added).toEqual([])
  })

  it('leaves the drag state when a refused drag leaves without a drop or dragend', async () => {
    const element = await mount()
    const data = carrying('verslag.pdf')
    await drag(element, 'dragenter', data, document.body)
    expect(shown(element)).toBe('Sleep het bestand hierheen')
    await drag(element, 'dragleave', data, document.body)
    expect(shown(element)).toBe('of sleep ze hierheen')
  })

  it('leaves a drag without files to the browser', async () => {
    const element = await mount()
    const data = new DataTransfer()
    data.setData('text/plain', 'Een stuk tekst')
    expect((await drag(element, 'dragover', data, document.body)).defaultPrevented).toBe(false)
    expect((await drag(element, 'drop', data, document.body)).defaultPrevented).toBe(false)
  })

  it("leaves a host's own drop target alone", async () => {
    const element = await mount()
    const target = document.createElement('div')
    document.body.append(target)
    const dropped: DragEvent[] = []
    target.addEventListener('dragover', (event) => event.preventDefault())
    target.addEventListener('drop', (event) => {
      event.preventDefault()
      dropped.push(event)
    })
    const data = recordingDropEffect(carrying('verslag.pdf'))
    await drag(element, 'dragover', data, target)
    expect(data.dropEffect).toBe('copy')
    await drag(element, 'drop', data, target)
    expect(dropped).toHaveLength(1)
  })

  it('refuses nothing while disabled, nor once it has left the page', async () => {
    const element = await mount()
    element.disabled = true
    await element.updateComplete
    const data = carrying('verslag.pdf')
    expect((await drag(element, 'dragover', data, document.body)).defaultPrevented).toBe(false)
    expect((await drag(element, 'drop', data, document.body)).defaultPrevented).toBe(false)
    element.disabled = false
    element.remove()
    expect((await drag(element, 'dragover', data, document.body)).defaultPrevented).toBe(false)
    expect((await drag(element, 'drop', data, document.body)).defaultPrevented).toBe(false)
  })

  it('takes a drop once with two uploads on the page', async () => {
    const first = await mount()
    const second = await mount()
    const toFirst = addedBy(first)
    const toSecond = addedBy(second)
    const data = carrying('verslag.pdf')
    expect((await drag(first, 'drop', data, document.body)).defaultPrevented).toBe(true)
    expect((await drag(second, 'drop', data)).defaultPrevented).toBe(true)
    expect(toFirst).toEqual([])
    expect(toSecond.map((files) => files.map((file) => file.name))).toEqual([['verslag.pdf']])
  })
})
