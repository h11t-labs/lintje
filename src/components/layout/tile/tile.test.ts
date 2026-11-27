/**
 * The tile's error state: the error is a `role="status"` region that is drawn empty and
 * filled on the next frame, so a screen reader announces the failure — a region inserted
 * together with its words is not announced. happy-dom has no layout.
 */
import { afterEach, describe, expect, it } from 'vitest'
import './tile'
import type { LintjeTile } from './tile'

const nextFrame = (): Promise<unknown> => new Promise((resolve) => requestAnimationFrame(resolve))

async function mount(props: Partial<LintjeTile> = {}): Promise<LintjeTile> {
  const tile = Object.assign(document.createElement('lintje-tile'), {
    heading: 'Aanvragen',
    ...props,
  })
  document.body.append(tile)
  await tile.updateComplete
  return tile
}

const region = (tile: LintjeTile): HTMLElement | null =>
  tile.shadowRoot!.querySelector<HTMLElement>('[role="status"]')

afterEach(() => {
  document.body.replaceChildren()
})

describe('lintje-tile error', () => {
  it('draws the status region empty, and fills the same region on the next frame', async () => {
    const tile = await mount({ state: 'error', message: 'De bron reageerde niet.' })
    const first = region(tile)!
    expect(first.classList.contains('lintje-announcement--error')).toBe(true)
    expect(first.textContent?.trim()).toBe('')
    expect(first.querySelector('.lintje-announcement__icon svg')).not.toBeNull()
    await nextFrame()
    await tile.updateComplete
    expect(region(tile)).toBe(first)
    expect(first.querySelector('.lintje-announcement__text')?.textContent?.trim()).toBe(
      'Fout: De bron reageerde niet.',
    )
  })

  it('empties and fills the region again for a new message, and for a new error', async () => {
    const tile = await mount({ state: 'error', message: 'Eerste.' })
    await nextFrame()
    await tile.updateComplete
    tile.message = 'Tweede.'
    await tile.updateComplete
    expect(region(tile)!.querySelector('.lintje-announcement__text')).toBeNull()
    await nextFrame()
    await tile.updateComplete
    expect(region(tile)!.textContent).toContain('Tweede.')

    tile.state = 'ready'
    await tile.updateComplete
    tile.state = 'error'
    await tile.updateComplete
    expect(region(tile)!.querySelector('.lintje-announcement__text')).toBeNull()
    await nextFrame()
    await tile.updateComplete
    expect(region(tile)!.textContent).toContain('Tweede.')
  })

  it('keeps the last known value beside the error', async () => {
    const tile = await mount({
      state: 'error',
      message: 'Weg.',
      lastKnown: 'Laatst bekend: 11 min',
    })
    expect(tile.shadowRoot!.querySelector('.lintje-chart-state__last-known')?.textContent).toBe(
      'Laatst bekend: 11 min',
    )
  })
})

describe('lintje-tile empty', () => {
  it('is the compact empty state in a status region, filled on the next frame', async () => {
    const tile = await mount({ state: 'empty', message: 'Geen aanvragen in deze periode.' })
    const first = region(tile)!
    expect(first.classList.contains('lintje-empty-state--compact')).toBe(true)
    expect(first.textContent?.trim()).toBe('')
    await nextFrame()
    await tile.updateComplete
    expect(region(tile)).toBe(first)
    expect(first.textContent?.trim()).toBe('Geen aanvragen in deze periode.')
  })
})

describe('lintje-tile without a message', () => {
  /** The words a sighted reader sees in the region: everything but what only a screen reader hears. */
  const visible = (element: HTMLElement): string => {
    const copy = element.cloneNode(true) as HTMLElement
    copy.querySelectorAll('.visually-hidden, [aria-hidden="true"]').forEach((node) => node.remove())
    return copy.textContent!.replace(/\s+/g, ' ').trim()
  }

  it.each([
    ['error', 'Laden mislukt.', 'Fout: Laden mislukt.'],
    ['empty', 'Geen gegevens.', 'Geen gegevens.'],
  ] as const)('in %s shows and says words of its own', async (state, shown, heard) => {
    const tile = await mount({ state })
    await nextFrame()
    await tile.updateComplete
    const live = region(tile)!
    expect(visible(live)).toBe(shown)
    expect(live.textContent!.replace(/\s+/g, ' ').trim()).toBe(heard)
  })

  it("takes the host's message over its own words", async () => {
    const tile = await mount({ state: 'error', message: 'De bron reageerde niet.' })
    await nextFrame()
    await tile.updateComplete
    expect(visible(region(tile)!)).toBe('De bron reageerde niet.')
  })
})

describe('lintje-tile level', () => {
  it('draws the title as an h3, or at the level the host asks', async () => {
    const plain = await mount()
    expect(plain.shadowRoot!.querySelector('.lintje-tile__title')!.tagName).toBe('H3')
    const higher = await mount({ level: 2 })
    expect(higher.shadowRoot!.querySelector('.lintje-tile__title')!.tagName).toBe('H2')
  })

  it('reads level from its attribute', async () => {
    document.body.innerHTML = '<lintje-tile heading="Aanvragen" level="2"></lintje-tile>'
    const tile = document.querySelector('lintje-tile')!
    await tile.updateComplete
    expect(tile.shadowRoot!.querySelector('h2.lintje-tile__title')).not.toBeNull()
  })
})

describe('lintje-tile loading', () => {
  it('says the loading in words, in a region filled on the next frame', async () => {
    const tile = await mount({ state: 'loading' })
    const first = region(tile)!
    expect(first.textContent?.trim()).toBe('')
    await nextFrame()
    await tile.updateComplete
    expect(region(tile)).toBe(first)
    expect(first.querySelector('.visually-hidden')?.textContent).toBe('Gegevens laden…')
  })
})

describe('lintje-tile collapsed-mobile', () => {
  const viewport = (width: number): void =>
    (
      window as unknown as { happyDOM: { setViewport(size: { width: number }): void } }
    ).happyDOM.setViewport({ width })

  afterEach(() => viewport(1024))

  it('changes nothing on a wide screen', async () => {
    viewport(1024)
    const tile = await mount({ heading: 'Aanvragen per regio', collapsedMobile: true })
    expect(tile.shadowRoot!.querySelector('.lintje-tile__fold-toggle')).toBeNull()
    expect(tile.shadowRoot!.querySelector('.lintje-tile__fold')!.hasAttribute('hidden')).toBe(false)
  })

  it('folds the content on a phone and unfolds it on the button, saying so', async () => {
    viewport(390)
    const tile = await mount({ heading: 'Aanvragen per regio', collapsedMobile: true })
    const root = tile.shadowRoot!
    const fold = root.querySelector('.lintje-tile__fold')!
    const toggle = root.querySelector<HTMLButtonElement>('.lintje-tile__fold-toggle')!
    expect(fold.hasAttribute('hidden')).toBe(true)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.getAttribute('aria-controls')).toBe(fold.id)
    expect(toggle.textContent!.trim()).toBe('Tonen')
    // The button names the title it is about.
    expect(root.getElementById(toggle.getAttribute('aria-describedby')!)!.textContent).toBe(
      'Aanvragen per regio',
    )

    const toggled: boolean[] = []
    tile.addEventListener('lintje-toggle', (event) => toggled.push((event as CustomEvent).detail))
    toggle.click()
    await tile.updateComplete
    expect(fold.hasAttribute('hidden')).toBe(false)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(toggle.textContent!.trim()).toBe('Verbergen')
    expect(toggled).toEqual([true])
  })
})
