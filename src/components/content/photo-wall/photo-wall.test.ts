/** The photo wall: a figure per photo, its alt and its label, and data a server renders. */
import { afterEach, describe, expect, it } from 'vitest'
import './photo-wall'
import type { LintjePhotoWall, PhotoWallItem } from './photo-wall'

const PHOTOS: PhotoWallItem[] = [
  { src: 'a.jpg', alt: 'Een balie met twee medewerkers', caption: 'Het loket' },
  { src: 'b.jpg', alt: 'Een kast vol dossiers', caption: 'Het archief' },
  { src: 'c.jpg', alt: 'Een vergaderzaal met een lange tafel' },
]

async function mount(element: LintjePhotoWall): Promise<LintjePhotoWall> {
  document.body.append(element)
  await element.updateComplete
  return element
}

const create = (items: PhotoWallItem[]): LintjePhotoWall =>
  Object.assign(document.createElement('lintje-photo-wall'), { items })

afterEach(() => document.body.replaceChildren())

describe('lintje-photo-wall', () => {
  it('draws every photo at once, each a figure with its alt and its label', async () => {
    const root = (await mount(create(PHOTOS))).shadowRoot!
    const figures = root.querySelectorAll('.lintje-photo-wall__item')
    expect(figures).toHaveLength(3)
    const images = root.querySelectorAll<HTMLImageElement>('.lintje-photo-wall__image')
    expect([...images].map((image) => image.getAttribute('src'))).toEqual([
      'a.jpg',
      'b.jpg',
      'c.jpg',
    ])
    expect(images[1]!.alt).toBe('Een kast vol dossiers')
    expect(figures[0]!.querySelector('figcaption')!.textContent).toBe('Het loket')
    expect(figures[2]!.querySelector('figcaption')).toBeNull()
  })

  it('has nothing to choose: no button, no link, no focus', async () => {
    const root = (await mount(create(PHOTOS))).shadowRoot!
    expect(root.querySelector('button, a, [tabindex]')).toBeNull()
  })

  it('draws nothing without photos', async () => {
    const root = (await mount(create([]))).shadowRoot!
    expect(root.querySelector('.lintje-photo-wall')).toBeNull()
  })

  it('reads its photos from a JSON child, as a server renders them', async () => {
    const element = document.createElement('lintje-photo-wall')
    element.innerHTML = `<script type="application/json" data-prop="items">${JSON.stringify(PHOTOS.slice(0, 2))}</script>`
    const root = (await mount(element)).shadowRoot!
    expect(root.querySelectorAll('figure')).toHaveLength(2)
    expect(element.querySelector('script')).toBeNull()
  })
})
