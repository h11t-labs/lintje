/** The attachment: the icon of its kind, the name cut in the middle, what it opens and its states. */
import { afterEach, describe, expect, it } from 'vitest'
import './attachment'
import { fileIcon, splitName, type LintjeAttachment } from './attachment'
import type { UploadFile } from '../../shared/files'

async function mount(props: Partial<LintjeAttachment>): Promise<LintjeAttachment> {
  const element = Object.assign(document.createElement('lintje-attachment'), props)
  document.body.append(element)
  await element.updateComplete
  return element
}

function listen(element: Element, name: string): unknown[] {
  const seen: unknown[] = []
  element.addEventListener(name, (event) => seen.push((event as CustomEvent).detail))
  return seen
}

const part = (element: LintjeAttachment, name: string): HTMLElement | null =>
  element.shadowRoot!.querySelector<HTMLElement>(`.lintje-attachment__${name}`)

const said = (element: LintjeAttachment): string | null | undefined =>
  element.shadowRoot!.querySelector('.lintje-attachment__main .visually-hidden')?.textContent

const PDF: UploadFile = {
  id: 'p',
  name: 'beleidsregel-2026.pdf',
  size: 1.2 * 1024 * 1024,
  state: 'done',
}

afterEach(() => document.body.replaceChildren())

describe('the icon of a file', () => {
  it('follows the type first, CSV before text', () => {
    expect(fileIcon({ name: 'x', type: 'text/csv' })).toBe('op-kantoor-document-met-tekst-csv')
    expect(fileIcon({ name: 'x', type: 'text/plain' })).toBe('op-kantoor-document-met-lijnen')
    expect(fileIcon({ name: 'x', type: 'application/vnd.ms-excel' })).toBe(
      'op-kantoor-document-met-vlakken-en-lijnen-erop',
    )
    expect(fileIcon({ name: 'x.pdf', type: 'image/jpeg' })).toBe('op-kantoor-document-blanco')
  })

  it('follows the extension without a type', () => {
    expect(fileIcon({ name: 'export.CSV' })).toBe('op-kantoor-document-met-tekst-csv')
    expect(fileIcon({ name: 'aanvragen-q3.xlsx' })).toBe(
      'op-kantoor-document-met-vlakken-en-lijnen-erop',
    )
    expect(fileIcon({ name: 'notitie.md' })).toBe('op-kantoor-document-met-lijnen')
    expect(fileIcon({ name: 'foto.jpg' })).toBe('op-kantoor-document-blanco')
    expect(fileIcon({ name: '.pdf' })).toBe('op-kantoor-document-blanco')
  })
})

describe('the name cut in the middle', () => {
  it('keeps the last six letters of the stem and the extension', () => {
    expect(splitName('beleidsregel-subsidie-definitief.pdf')).toEqual({
      stem: 'beleidsregel-subsidie-defi',
      tail: 'nitief.pdf',
    })
  })

  it('keeps only the last six letters without an extension', () => {
    expect(splitName('LEESMIJ-EERST')).toEqual({ stem: 'LEESMIJ', tail: '-EERST' })
    expect(splitName('.gitignore')).toEqual({ stem: '.git', tail: 'ignore' })
  })

  it('cuts nothing from a short name', () => {
    expect(splitName('a.pdf')).toEqual({ stem: '', tail: 'a.pdf' })
    expect(splitName('formulier.jpg')).toEqual({ stem: '', tail: 'formulier.jpg' })
  })
})

describe('lintje-attachment', () => {
  it('draws the name whole in its title and the size beside it', async () => {
    const element = await mount({ data: PDF })
    expect(part(element, 'name')!.title).toBe('beleidsregel-2026.pdf')
    expect(part(element, 'name')!.textContent).toBe('beleidsregel-2026.pdf')
    expect(part(element, 'detail')!.textContent).toBe('1,2 MB')
    expect(said(element)).toBe('beleidsregel-2026.pdf, 1,2 MB')
  })

  it('puts `detail` in place of the size, and stands alone without either', async () => {
    const element = await mount({ data: { ...PDF, detail: 'blz. 4' } })
    expect(part(element, 'detail')!.textContent).toBe('blz. 4')
    element.data = { id: 'n', name: 'notitie.txt', state: 'done' }
    await element.updateComplete
    expect(part(element, 'detail')).toBeNull()
    expect(said(element)).toBe('notitie.txt')
  })

  it('draws a thumbnail when the host gives one, and the blank sheet for an image without', async () => {
    const element = await mount({ data: { ...PDF, name: 'foto.jpg', thumbnail: 'foto-klein.jpg' } })
    const image = element.shadowRoot!.querySelector('img')!
    expect(image.getAttribute('src')).toBe('foto-klein.jpg')
    expect(image.alt).toBe('')
  })

  it('without `href` is a button that asks the host to open it', async () => {
    const element = await mount({ data: PDF })
    const opened = listen(element, 'lintje-file-open')
    const main = part(element, 'main')!
    expect(main.localName).toBe('button')
    main.click()
    expect(opened).toEqual([{ id: 'p' }])
  })

  it('with `href` is a link that reports `lintje-navigate`', async () => {
    const element = await mount({ data: { ...PDF, href: '/bestanden/p' } })
    const navigated = listen(element, 'lintje-navigate')
    element.addEventListener('lintje-navigate', (event) => event.preventDefault())
    const main = part(element, 'main') as HTMLAnchorElement
    expect(main.localName).toBe('a')
    expect(main.getAttribute('href')).toBe('/bestanden/p')
    main.click()
    expect(navigated).toEqual([{ href: '/bestanden/p' }])
  })

  it('with `download` leaves the click to the browser and says it in words', async () => {
    const element = await mount({ data: { ...PDF, href: '/bestanden/p', download: true } })
    const navigated = listen(element, 'lintje-navigate')
    const main = part(element, 'main') as HTMLAnchorElement
    expect(main.hasAttribute('download')).toBe(true)
    main.addEventListener('click', (event) => event.preventDefault())
    main.click()
    expect(navigated).toEqual([])
    expect(part(element, 'sign')).not.toBeNull()
    expect(said(element)).toBe('beleidsregel-2026.pdf, 1,2 MB, downloaden')
  })

  it('opens nothing when removable or disabled, and the cross asks to remove', async () => {
    const element = await mount({ data: PDF, removable: true })
    expect(part(element, 'main')!.localName).toBe('span')
    const removed = listen(element, 'lintje-file-remove')
    part(element, 'remove')!.click()
    expect(removed).toEqual([{ id: 'p' }])
    expect(part(element, 'remove')!.getAttribute('aria-label')).toBe(
      'Verwijderen beleidsregel-2026.pdf',
    )
    element.disabled = true
    await element.updateComplete
    expect(part(element, 'main')!.localName).toBe('span')
    expect(part(element, 'remove')).toBeNull()
  })

  it('busy: the line with its percentage, and the cross cancels', async () => {
    const element = await mount({
      data: { id: 'v', name: 'verklaring.pdf', state: 'busy', progress: 64 },
      removable: true,
    })
    const line = element.shadowRoot!.querySelector('[role="progressbar"]')!
    expect(line.getAttribute('aria-valuenow')).toBe('64')
    expect(line.getAttribute('aria-label')).toBe('verklaring.pdf uploaden')
    expect(part(element, 'detail')!.textContent).toBe('64%')
    expect(said(element)).toBe('verklaring.pdf, bezig, 64%')
    const cancelled = listen(element, 'lintje-file-cancel')
    expect(part(element, 'remove')!.getAttribute('aria-label')).toBe('Annuleren verklaring.pdf')
    part(element, 'remove')!.click()
    expect(cancelled).toEqual([{ id: 'v' }])
  })

  it('busy without a number: the line runs without a value', async () => {
    const element = await mount({ data: { id: 'v', name: 'verklaring.pdf', state: 'busy' } })
    const line = element.shadowRoot!.querySelector('[role="progressbar"]')!
    expect(line.hasAttribute('aria-valuenow')).toBe(false)
    expect(line.classList.contains('is-indeterminate')).toBe(true)
    expect(part(element, 'main')!.localName).toBe('span')
  })

  it('an error: the triangle and the reason, "mislukt" from the host and "geweigerd" when refused', async () => {
    const failed: UploadFile = {
      id: 'v',
      name: 'verklaring.pdf',
      state: 'error',
      message: 'Uploaden mislukt',
    }
    const element = await mount({ data: failed })
    expect(element.shadowRoot!.querySelector('.lintje-attachment__icon.is-error')).not.toBeNull()
    expect(part(element, 'detail')!.textContent).toBe('Uploaden mislukt')
    expect(said(element)).toBe('verklaring.pdf, mislukt: Uploaden mislukt')
    element.refused = true
    await element.updateComplete
    expect(said(element)).toBe('verklaring.pdf, geweigerd: Uploaden mislukt')
  })

  it('"Opnieuw" with `retry`, and the focus goes to the cross once the file is busy again', async () => {
    const failed: UploadFile = {
      id: 'v',
      name: 'verklaring.pdf',
      state: 'error',
      message: 'Uploaden mislukt',
      retry: true,
    }
    const element = await mount({ data: failed, removable: true })
    const retried = listen(element, 'lintje-file-retry')
    const retry = part(element, 'retry')!
    expect(retry.getAttribute('aria-label')).toBe('Opnieuw verklaring.pdf')
    retry.focus()
    retry.click()
    expect(retried).toEqual([{ id: 'v' }])
    element.data = { ...failed, state: 'busy', progress: 0 }
    await element.updateComplete
    expect(part(element, 'retry')).toBeNull()
    expect(element.shadowRoot!.activeElement).toBe(part(element, 'remove'))
  })
})
