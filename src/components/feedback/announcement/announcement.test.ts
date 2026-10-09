/**
 * The announcement's live region and its mark; in content, its action and the close button
 * on request.
 *
 * It is a live region only when the host says so (`data.live`): then `alert` or
 * `status`, drawn empty first and filled on the next frame, so a screen reader
 * hears the content arrive. Without `live` it carries no role, whenever it
 * appears. The mark in the box is a house icon, never a typed character, and
 * stays `aria-hidden`: the hidden kind prefix carries the meaning.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import './announcement'
import type { AnnouncementViewData } from '../../../types'
import type { LintjeAnnouncement } from './announcement'

type Announcement = HTMLElement & {
  data: AnnouncementViewData
  updateComplete: Promise<unknown>
}

async function announce(data: AnnouncementViewData): Promise<HTMLElement> {
  const element = document.createElement('lintje-announcement') as Announcement
  element.data = data
  document.body.append(element)
  await element.updateComplete
  return element.shadowRoot!.querySelector('.lintje-announcement') as HTMLElement
}

const nextFrame = (): Promise<unknown> => new Promise((resolve) => requestAnimationFrame(resolve))

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('lintje-announcement', () => {
  it('stands an image of the message beside the text', async () => {
    const block = await announce({
      kind: 'info',
      title: 'Start de opname op je telefoon.',
      text: 'Scan de code.',
    })
    const media = block.querySelector('slot[name="media"]')
    expect(media).not.toBeNull()
    // Beside the text, not in it: the slot follows the body.
    expect(media?.previousElementSibling?.classList.contains('lintje-announcement__body')).toBe(
      true,
    )
  })

  it('carries no role when live is false', async () => {
    const block = await announce({ kind: 'outage', text: 'De koppeling ligt eruit.', live: false })
    expect(block.hasAttribute('role')).toBe(false)
  })

  it('is an alert or a status when live is true', async () => {
    const outage = await announce({ kind: 'outage', text: 'De koppeling ligt eruit.', live: true })
    expect(outage.getAttribute('role')).toBe('alert')
    const ok = await announce({ kind: 'ok', text: 'Opgeslagen.', live: true })
    expect(ok.getAttribute('role')).toBe('status')
  })

  it('without live, carries no role, also when it arrives after the page has loaded', async () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete')
    for (const kind of ['outage', 'info'] as const) {
      const block = await announce({ kind, text: 'De koppeling ligt eruit.' })
      expect(block.hasAttribute('role')).toBe(false)
      expect(block.textContent).toContain('De koppeling ligt eruit.')
    }
  })

  it('when live, draws the region empty and fills it on the next frame', async () => {
    const element = document.createElement('lintje-announcement') as Announcement
    element.data = { kind: 'outage', text: 'De koppeling ligt eruit.', live: true }
    document.body.append(element)
    await element.updateComplete
    const region = element.shadowRoot!.querySelector('.lintje-announcement') as HTMLElement
    expect(region.getAttribute('role')).toBe('alert')
    expect(region.textContent?.trim()).toBe('')
    await nextFrame()
    await element.updateComplete
    expect(element.shadowRoot!.querySelector('.lintje-announcement')).toBe(region)
    expect(region.textContent).toContain('De koppeling ligt eruit.')
  })

  it('empties and refills the region for a new live announcement', async () => {
    const element = document.createElement('lintje-announcement') as Announcement
    element.data = { kind: 'warning', text: 'Vertraagd.', live: true }
    document.body.append(element)
    await element.updateComplete
    await nextFrame()
    await element.updateComplete
    element.data = { kind: 'warning', text: 'Nog steeds vertraagd.', live: true }
    await element.updateComplete
    const region = element.shadowRoot!.querySelector('.lintje-announcement') as HTMLElement
    expect(region.textContent?.trim()).toBe('')
    await nextFrame()
    await element.updateComplete
    expect(region.textContent).toContain('Nog steeds vertraagd.')
  })

  it('draws an icon as its mark, not a character', async () => {
    for (const kind of ['warning', 'outage', 'info', 'ok'] as const) {
      const block = await announce({ kind, text: 'Tekst.' })
      const mark = block.querySelector('.lintje-announcement__icon') as HTMLElement
      expect(mark.getAttribute('aria-hidden')).toBe('true')
      expect(mark.querySelector('svg')).not.toBeNull()
      expect(mark.textContent?.trim()).toBe('')
    }
  })

  it('gives every kind its own mark', async () => {
    const marks = new Set<string>()
    for (const kind of ['warning', 'outage', 'info', 'ok'] as const) {
      const block = await announce({ kind, text: 'Tekst.' })
      marks.add(block.querySelector('.lintje-announcement__icon svg')!.innerHTML)
    }
    expect(marks.size).toBe(4)
  })

  it('sets the title on its own line, the kind spoken first', async () => {
    const block = await announce({ kind: 'warning', title: 'Let op', text: 'Twee loketten.' })
    const title = block.querySelector('.lintje-announcement__title')!
    expect(title.textContent?.trim()).toBe('Waarschuwing: Let op')
    const text = block.querySelector('.lintje-announcement__text')!
    expect(text.textContent?.trim()).toBe('Twee loketten.')
  })
})

async function mount(data: AnnouncementViewData, inner = ''): Promise<LintjeAnnouncement> {
  const element = document.createElement('lintje-announcement')
  element.compact = true
  element.innerHTML = inner
  element.data = data
  document.body.append(element)
  await element.updateComplete
  return element
}

const block = (element: LintjeAnnouncement): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('.lintje-announcement')!

describe('lintje-announcement in content', () => {
  it('when live, interrupts only for an outage', async () => {
    const outage = await mount({
      kind: 'outage',
      text: 'Het transcriberen is mislukt.',
      live: true,
    })
    expect(block(outage).getAttribute('role')).toBe('alert')
    for (const kind of ['warning', 'info', 'ok'] as const) {
      const element = await mount({ kind, text: 'Een melding.', live: true })
      expect(block(element).getAttribute('role')).toBe('status')
    }
  })

  it('takes the compact form in content', async () => {
    const element = await mount({ kind: 'info', text: 'Deze opname wordt na 30 dagen verwijderd.' })
    expect(block(element).classList.contains('is-compact')).toBe(true)
  })

  it('has a place for one action after the text', async () => {
    const element = await mount(
      { kind: 'warning', title: '2 fragmenten met lage zekerheid.', text: '' },
      '<lintje-button slot="action" variant="link">Naar het eerste fragment</lintje-button>',
    )
    const slot = element.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="action"]')!
    expect(slot.closest('.lintje-announcement__body')).not.toBeNull()
    expect(slot.assignedElements()).toHaveLength(1)
  })

  it('draws a close button only when asked, and never for an outage', async () => {
    const plain = await mount({ kind: 'ok', text: 'De vertaling is klaar.' })
    expect(plain.shadowRoot!.querySelector('.lintje-announcement__close')).toBeNull()

    const asked = await mount({ kind: 'ok', text: 'De vertaling is klaar.', dismissible: true })
    const close = asked.shadowRoot!.querySelector<HTMLButtonElement>('.lintje-announcement__close')!
    close.click()
    await asked.updateComplete
    expect(asked.shadowRoot!.querySelector('.lintje-announcement')).toBeNull()

    const outage = await mount({ kind: 'outage', text: 'Storing.', dismissible: true })
    expect(outage.shadowRoot!.querySelector('.lintje-announcement__close')).toBeNull()
  })

  it('hands the focus to the next stop on the page when closed from its button', async () => {
    const before = document.createElement('button')
    document.body.append(before)
    const element = await mount({ kind: 'info', text: 'Onderhoud vanavond.', dismissible: true })
    const after = document.createElement('a')
    after.href = '#verder'
    document.body.append(after)
    const close = element.shadowRoot!.querySelector<HTMLButtonElement>(
      '.lintje-announcement__close',
    )!
    close.focus()
    close.click()
    await element.updateComplete
    await element.updateComplete
    expect(document.activeElement).toBe(after)

    // Without a stop after it, the one before.
    const last = await mount({ kind: 'info', text: 'Nog een.', dismissible: true })
    after.remove()
    const lastClose = last.shadowRoot!.querySelector<HTMLButtonElement>(
      '.lintje-announcement__close',
    )!
    lastClose.focus()
    lastClose.click()
    await last.updateComplete
    await last.updateComplete
    expect(document.activeElement).toBe(before)
  })
})
