/**
 * The tile's error state: the warning is a `role="status"` region that is drawn empty and
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
    expect(first.classList.contains('lintje-announcement--warning')).toBe(true)
    expect(first.textContent?.trim()).toBe('')
    expect(first.querySelector('.lintje-announcement__icon svg')).not.toBeNull()
    await nextFrame()
    await tile.updateComplete
    expect(region(tile)).toBe(first)
    expect(first.querySelector('.lintje-announcement__text')?.textContent?.trim()).toBe(
      'Waarschuwing: De bron reageerde niet.',
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

  it('keeps the last known value beside the warning', async () => {
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
