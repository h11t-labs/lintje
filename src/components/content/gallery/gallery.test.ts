/** The gallery: the large picture, the thumbnails that choose another, and the change it reports. */
import { afterEach, describe, expect, it } from 'vitest'
import './gallery'
import type { GalleryItem, LintjeGallery } from './gallery'

const SCREENS: GalleryItem[] = [
  { src: 'a.png', alt: 'Het scherm Tekst', caption: 'Tekst vertalen.' },
  { src: 'b.png', alt: 'Het scherm Documenten', caption: 'Documenten in de wachtrij.' },
  { src: 'c.png', alt: 'Het scherm Woordenlijst' },
]

async function mount(props: Partial<LintjeGallery>): Promise<LintjeGallery> {
  const element = Object.assign(document.createElement('lintje-gallery'), props)
  document.body.append(element)
  await element.updateComplete
  return element
}

afterEach(() => document.body.replaceChildren())

describe('lintje-gallery', () => {
  it('draws the chosen picture large, with its caption and its alt', async () => {
    const root = (await mount({ items: SCREENS, selected: 1 })).shadowRoot!
    const image = root.querySelector<HTMLImageElement>('.lintje-gallery__image')!
    expect(image.getAttribute('src')).toBe('b.png')
    expect(image.alt).toBe('Het scherm Documenten')
    expect(root.querySelector('figcaption')!.textContent).toBe('Documenten in de wachtrij.')
  })

  it('a thumbnail chooses another picture, says which is chosen and reports the change', async () => {
    const element = await mount({ items: SCREENS, label: 'Schermafbeeldingen' })
    const root = element.shadowRoot!
    expect(root.querySelector('ul')!.getAttribute('aria-label')).toBe('Schermafbeeldingen')
    const thumbs = root.querySelectorAll<HTMLButtonElement>('.lintje-gallery__thumb')
    expect([...thumbs].map((thumb) => thumb.getAttribute('aria-current'))).toEqual([
      'true',
      null,
      null,
    ])
    expect(thumbs[2]!.textContent).toContain('Afbeelding 3 van 3: Het scherm Woordenlijst')

    const heard: unknown[] = []
    element.addEventListener('lintje-gallery-change', (event) =>
      heard.push((event as CustomEvent).detail),
    )
    thumbs[2]!.click()
    await element.updateComplete
    expect(heard).toEqual([{ index: 2 }])
    expect(root.querySelector('.lintje-gallery__image')!.getAttribute('src')).toBe('c.png')
    expect(root.querySelector('figcaption')).toBeNull()
  })

  it('says the picture it now shows from a status region that was there already', async () => {
    const element = await mount({ items: SCREENS })
    const root = element.shadowRoot!
    const region = root.querySelector('[role="status"]')!
    expect(region.textContent).toBe('')
    root.querySelectorAll<HTMLButtonElement>('.lintje-gallery__thumb')[1]!.click()
    await element.updateComplete
    expect(root.querySelector('[role="status"]')).toBe(region)
    expect(region.textContent).toBe('Afbeelding 2 van 3: Het scherm Documenten')
  })

  it('names a thumbnail by its alt when its caption is empty', async () => {
    const root = (await mount({ items: [SCREENS[0]!, { ...SCREENS[1]!, caption: '' }] }))
      .shadowRoot!
    const thumbs = root.querySelectorAll('.lintje-gallery__thumb')
    expect(thumbs[1]!.textContent).toContain('Afbeelding 2 van 2: Het scherm Documenten')
  })

  it('a selection past the end shows the last picture and does not report it again', async () => {
    const element = await mount({ items: SCREENS, selected: 5 })
    const heard: unknown[] = []
    element.addEventListener('lintje-gallery-change', (event) =>
      heard.push((event as CustomEvent).detail),
    )
    const root = element.shadowRoot!
    expect(root.querySelector('.lintje-gallery__image')!.getAttribute('src')).toBe('c.png')
    root.querySelectorAll<HTMLButtonElement>('.lintje-gallery__thumb')[2]!.click()
    expect(heard).toEqual([])
  })

  it('one picture has no thumbnails, and none draws nothing', async () => {
    const one = (await mount({ items: [SCREENS[0]!] })).shadowRoot!
    expect(one.querySelector('.lintje-gallery__thumbs')).toBeNull()
    const none = (await mount({ items: [] })).shadowRoot!
    expect(none.querySelector('.lintje-gallery')).toBeNull()
  })
})
