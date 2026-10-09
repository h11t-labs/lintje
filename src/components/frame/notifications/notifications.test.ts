/**
 * The bell and its panel: the counter and the name, the three carriers of unread, the empty
 * state, and what a choice and "Alles gelezen" send.
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import './notifications'
import {
  bellLabel,
  countLabel,
  newsMessage,
  type LintjeNotifications,
  type NotificationItem,
} from './notifications'

const ITEMS: NotificationItem[] = [
  {
    id: 'n1',
    title: 'Transcriptie klaar',
    text: 'Teamoverleg 2 oktober.m4a',
    when: '2 minuten geleden',
    href: '/opnames/481',
    unread: true,
  },
  { id: 'n2', title: 'Vertaling mislukt', when: '14 minuten geleden', unread: true },
  { id: 'n3', title: 'Export klaar', when: 'gisteren om 16:05' },
]

afterEach(() => {
  document.body.innerHTML = ''
})

async function mount(
  items: NotificationItem[] = ITEMS,
  open = false,
): Promise<LintjeNotifications> {
  const element = document.createElement('lintje-notifications')
  element.items = items
  element.open = open
  document.body.append(element)
  await element.updateComplete
  return element
}

const bell = (element: LintjeNotifications): HTMLButtonElement =>
  element.shadowRoot!.querySelector('.lintje-notifications__bell')!

describe('lintje-notifications', () => {
  it('counts the unread in the badge and in the name', async () => {
    const element = await mount()
    const button = bell(element)
    expect(button.getAttribute('aria-label')).toBe('Meldingen, 2 ongelezen')
    expect(button.getAttribute('aria-haspopup')).toBe('dialog')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.querySelector('lintje-badge')!.textContent!.trim()).toBe('2')
    expect(countLabel(12)).toBe('9+')
    expect(countLabel(120, 99)).toBe('99+')
    expect(countLabel(99, 99)).toBe('99')
    expect(bellLabel(0)).toBe('Meldingen')
    expect(bellLabel(12)).toBe('Meldingen, 9+ ongelezen')
    expect(bellLabel(120, 99)).toBe('Meldingen, 99+ ongelezen')
  })

  it('lets a new figure rise in where the counter already stands, and pops a new counter', async () => {
    const element = await mount()
    const figure = () => bell(element).querySelector('.lintje-notifications__figure')!
    expect(figure().classList.contains('is-replaced')).toBe(false)
    element.items = ITEMS.map((item) => ({ ...item, unread: true }))
    await element.updateComplete
    expect(figure().textContent).toBe('3')
    expect(figure().classList.contains('is-replaced')).toBe(true)
    element.items = []
    await element.updateComplete
    element.items = ITEMS
    await element.updateComplete
    expect(figure().classList.contains('is-replaced')).toBe(false)
  })

  it('toggles its own panel and marks the unread three ways', async () => {
    const element = await mount()
    bell(element).click()
    await element.updateComplete
    expect(element.open).toBe(true)
    const popover = element.shadowRoot!.querySelector('lintje-popover')!
    expect(bell(element).getAttribute('aria-controls')).toBe(popover.id)
    const items = [...element.shadowRoot!.querySelectorAll('.lintje-notifications__item')]
    expect(items.map((item) => item.classList.contains('is-unread'))).toEqual([true, true, false])
    expect(items[0].querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('Ongelezen')
    expect(items[2].querySelector('[role="img"]')).toBeNull()

    bell(element).click()
    await element.updateComplete
    expect(element.open).toBe(false)
  })

  it('sends the chosen notification and closes; Alles gelezen sends the request', async () => {
    const element = await mount(ITEMS, true)
    const opened: unknown[] = []
    let read = 0
    element.addEventListener('lintje-notification-open', (event) =>
      opened.push((event as CustomEvent).detail),
    )
    element.addEventListener('lintje-notifications-read', () => read++)

    const link = element.shadowRoot!.querySelector<HTMLAnchorElement>(
      'a.lintje-notifications__title',
    )!
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    link.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(false)
    expect(opened).toEqual([{ id: 'n1', href: '/opnames/481' }])
    expect(element.open).toBe(false)

    element.open = true
    await element.updateComplete
    element.shadowRoot!.querySelector<HTMLButtonElement>('.lintje-notifications__read')!.click()
    expect(read).toBe(1)
  })

  it('shows one sentence and no counter when there is nothing', async () => {
    const element = await mount([], true)
    expect(element.shadowRoot!.querySelector('lintje-badge')).toBeNull()
    expect(
      element.shadowRoot!.querySelector('.lintje-notifications__empty')!.textContent,
    ).toContain('Geen meldingen.')
    expect(element.shadowRoot!.querySelector('.lintje-notifications__read')).toBeNull()
  })

  it('closes on the popover’s Escape and stops it there', async () => {
    const element = await mount(ITEMS, true)
    let escaped = 0
    document.body.addEventListener('lintje-close', () => escaped++)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await element.updateComplete
    expect(element.open).toBe(false)
    expect(escaped).toBe(0)
  })

  it('is a modal sheet on a phone: the close button has the focus, Tab stays, the bell gets it back', async () => {
    const viewport = (width: number): void =>
      (
        window as unknown as { happyDOM: { setViewport(size: { width: number }): void } }
      ).happyDOM.setViewport({ width })
    try {
      const element = await mount(ITEMS)
      viewport(390)
      await element.updateComplete
      bell(element).focus()
      bell(element).click()
      await element.updateComplete
      const sheet = element.shadowRoot!.querySelector('.lintje-notifications__sheet')!
      expect(sheet.getAttribute('aria-modal')).toBe('true')
      const close = element.shadowRoot!.querySelector<HTMLElement>('.lintje-notifications__close')!
      expect(close.classList.contains('lintje-dialog-close')).toBe(true)
      expect(element.shadowRoot!.activeElement).toBe(close)
      expect(document.body.style.overflow).toBe('hidden')

      const titles = element.shadowRoot!.querySelectorAll<HTMLElement>(
        '.lintje-notifications__title',
      )
      const last = titles[titles.length - 1]!
      last.focus()
      const tab = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        composed: true,
        cancelable: true,
      })
      last.dispatchEvent(tab)
      // Tab from the last title goes round to the first stop in the sheet, not to the page.
      expect(tab.defaultPrevented).toBe(true)
      expect(element.shadowRoot!.activeElement).toBe(
        element.shadowRoot!.querySelector('.lintje-notifications__read'),
      )

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await element.updateComplete
      expect(element.open).toBe(false)
      expect(element.shadowRoot!.activeElement).toBe(bell(element))
      expect(document.body.style.overflow).toBe('')
    } finally {
      viewport(1024)
    }
  })
})

// Read from disk, not imported: vitest does not run the CSS pipeline.
const notificationsCss = readFileSync(
  resolvePath('src/components/frame/notifications/notifications.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '')

describe('the counter on the bell', () => {
  it("stands at the glyph's top right, measured from the bell's middle, off most of the glyph", () => {
    const rule = /\.lintje-notifications__count\s*\{([^}]*)\}/.exec(notificationsCss)?.[1] ?? ''
    // 4 px inside a 48 px box around the bell's middle, so it overlaps the glyph's corner.
    expect(rule).toMatch(/top:\s*calc\(50% - var\(--h-touch\) \/ 2 \+ var\(--space-1\)\);/)
    expect(rule).toMatch(/right:\s*var\(--space-1\);/)
  })
})

describe('lintje-notifications, what changes', () => {
  const nextFrame = (): Promise<unknown> => new Promise((resolve) => requestAnimationFrame(resolve))

  it('speaks new unread items from a status region that is already there', async () => {
    const element = await mount()
    const region = element.shadowRoot!.querySelector('[role="status"]')!
    expect(region.textContent).toBe('')
    element.items = [{ id: 'n0', title: 'Samenvatting klaar', when: 'nu', unread: true }, ...ITEMS]
    await element.updateComplete
    await nextFrame()
    await element.updateComplete
    expect(element.shadowRoot!.querySelector('[role="status"]')).toBe(region)
    expect(region.textContent).toBe('1 nieuwe melding')
    // Fewer unread is no news.
    element.items = ITEMS.map((item) => ({ ...item, unread: false }))
    await element.updateComplete
    await nextFrame()
    await element.updateComplete
    expect(region.textContent).toBe('1 nieuwe melding')
    expect(newsMessage(3)).toBe('3 nieuwe meldingen')
  })

  it('moves the focus to the first item when "Alles gelezen" goes', async () => {
    const element = await mount(ITEMS, true)
    const read = element.shadowRoot!.querySelector<HTMLButtonElement>(
      '.lintje-notifications__read',
    )!
    read.focus()
    element.items = ITEMS.map((item) => ({ ...item, unread: false }))
    await element.updateComplete
    expect(element.shadowRoot!.querySelector('.lintje-notifications__read')).toBeNull()
    expect(element.shadowRoot!.activeElement).toBe(
      element.shadowRoot!.querySelector('.lintje-notifications__title'),
    )
  })
})
