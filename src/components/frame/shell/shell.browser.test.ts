/**
 * The shell in a browser: the ring in the phone's sheet of "Weergave" is the page's, not the
 * header's, the side menu draws and drags its own thumb, and a group in the bar opened under a
 * finger stays open while a mouse rests elsewhere on the page.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cdp, page, server, userEvent } from 'vitest/browser'
import { deepActiveElement } from '../../../core/focus'
import './shell'
import type { LintjeShell } from './shell'
import type { ShellData } from '../../../types'
import { TAB } from '../../../core/test-keys'

const DATA: ShellData = {
  name: 'Dashboard Vergunningen',
  layout: 'side',
  navigation: [{ label: 'Overzicht', icon: 'functioneel-home', href: '/', active: true }],
  view: { mode: 'system' },
  share: true,
}

async function mount(): Promise<LintjeShell> {
  const element = document.createElement('lintje-shell')
  element.data = DATA
  element.innerHTML = '<button type="button" class="content">Inhoud</button>'
  document.body.append(element)
  await element.updateComplete
  return element
}

/** The colour `--color-focus` resolves to on the page. */
function focusColour(): string {
  const probe = document.createElement('div')
  probe.style.outline = '3px solid var(--color-focus)'
  document.body.append(probe)
  const colour = getComputedStyle(probe).outlineColor
  probe.remove()
  return colour
}

afterEach(async () => {
  document.body.replaceChildren()
  await page.viewport(1440, 900)
  // WebKit resizes the frame after `viewport()` resolves.
  await expect.poll(() => window.innerWidth).toBe(1440)
})

describe('"Weergave" below 768 px', () => {
  it('rings its controls in --color-focus: the sheet is the page surface, not the header', async () => {
    await page.viewport(390, 800)
    await expect.poll(() => window.innerWidth).toBe(390)
    const shell = await mount()
    const tool = shell.shadowRoot!.querySelector<HTMLButtonElement>(
      '.lintje-mobile-header button.lintje-view__button',
    )!
    // By the keyboard: a click goes through a locator by name, and the desktop tool has it too.
    tool.focus()
    await userEvent.keyboard('{Enter}')
    await shell.updateComplete
    await expect
      .poll(() => deepActiveElement()?.classList.contains('lintje-share__close'))
      .toBe(true)
    await userEvent.keyboard(TAB)
    const option = deepActiveElement()!
    expect(option.classList.contains('lintje-toggle-group__option')).toBe(true)
    expect(option.matches(':focus-visible')).toBe(true)
    await expect.poll(() => getComputedStyle(option).outlineColor).toBe(focusColour())
  })
})

describe('the side menu’s thumb', () => {
  const many: ShellData = {
    ...DATA,
    navigation: Array.from({ length: 30 }, (_, index) => ({
      label: `Pagina ${index + 1}`,
      icon: 'functioneel-home',
      href: `#p${index + 1}`,
      active: index === 0,
    })),
  }

  async function mountMany(): Promise<{ list: HTMLElement; thumb: HTMLElement }> {
    await page.viewport(1440, 600)
    await expect.poll(() => window.innerHeight).toBe(600)
    const element = document.createElement('lintje-shell')
    element.data = many
    document.body.append(element)
    await element.updateComplete
    const root = element.shadowRoot!
    return {
      list: root.querySelector<HTMLElement>('.lintje-nav__list')!,
      thumb: root.querySelector<HTMLElement>('.lintje-nav__thumb')!,
    }
  }

  const top = (element: Element): number => element.getBoundingClientRect().top

  it('hides the native bar and follows the scroll', async () => {
    const { list, thumb } = await mountMany()
    // No native bar takes width: the rows reach the menu's edge.
    expect(list.offsetWidth).toBe(list.clientWidth)
    await expect.poll(() => thumb.offsetHeight).toBeGreaterThan(0)
    expect(thumb.offsetHeight).toBeLessThan(list.clientHeight)
    expect(Math.round(top(thumb))).toBe(Math.round(top(list)))
    expect(getComputedStyle(thumb).opacity).toBe('0')

    list.scrollTop = list.scrollHeight
    await expect
      .poll(() => Math.round(thumb.getBoundingClientRect().bottom))
      .toBe(Math.round(list.getBoundingClientRect().bottom))
  })

  it('shows under the pointer and scrolls the list when dragged', async () => {
    const { list, thumb } = await mountMany()
    await expect.poll(() => thumb.offsetHeight).toBeGreaterThan(0)
    await userEvent.hover(list)
    await expect.poll(() => getComputedStyle(thumb).opacity).toBe('1')
    const footer = list.parentElement!.querySelector('.lintje-nav__footer') ?? list
    await userEvent.dragAndDrop(thumb, footer)
    await expect.poll(() => list.scrollTop).toBeGreaterThan(0)
  })
})

// Playwright drives no touch in WebKit; Chromium takes it through the DevTools protocol.
describe.skipIf(server.browser !== 'chromium')('a group in the bar under a finger', () => {
  /** A point of this frame in the page's coordinates, which the protocol speaks: the test runs in
   * a scaled frame. */
  function onPage(x: number, y: number): { x: number; y: number } {
    const frame = window.frameElement!.getBoundingClientRect()
    const scale = frame.width / window.innerWidth
    return { x: frame.left + x * scale, y: frame.top + y * scale }
  }

  async function tap(target: Element): Promise<void> {
    const box = target.getBoundingClientRect()
    const point = onPage(box.left + box.width / 2, box.top + box.height / 2)
    await cdp().send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
    await cdp().send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }

  it('stays open after a tap while a mouse rests elsewhere on the page', async () => {
    await page.viewport(1280, 800)
    await expect.poll(() => window.innerWidth).toBe(1280)
    const shell = document.createElement('lintje-shell')
    shell.data = {
      name: 'Dashboard Vergunningen',
      navigation: [
        { label: 'Overzicht', href: '/', active: true },
        {
          label: 'Beheer',
          links: [
            { label: 'Woordenlijst', href: '#woordenlijst' },
            { label: 'Gebruikers', href: '#gebruikers' },
          ],
        },
      ],
    }
    document.body.append(shell)
    await shell.updateComplete
    const group = shell.shadowRoot!.querySelector<HTMLButtonElement>('button.lintje-navbar__entry')!
    // A laptop with a touchscreen: the mouse rests on the page, below the bar. After the tap the
    // browser gives the hover back to it, which leaves the bar.
    const bar = shell.shadowRoot!.querySelector('.lintje-navbar')!.getBoundingClientRect()
    const rest = onPage(bar.left + 10, window.innerHeight - 10)
    await cdp().send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...rest })

    await tap(group)
    await expect.poll(() => group.getAttribute('aria-expanded')).toBe('true')
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(group.getAttribute('aria-expanded')).toBe('true')
  })
})
