/**
 * Paper: always light and white, no phone form, no controls, no motion, a tile on one sheet where
 * it fits, the shell's logo and name at the top, and what folds shut printed open.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { commands, page } from 'vitest/browser'
import { MOBILE } from '../../core/media'
import '../../primitives/button/button'
import '../../primitives/icon-button/icon-button'
import '../../primitives/tile/tile'
import '../../components/actions/copy-button/copy-button'
import '../../components/actions/menu-button/menu-button'
import '../../components/charts/chart/chart'
import '../../components/charts/explainer/explainer'
import '../../components/charts/kpi/kpi'
import '../../components/charts/note/note'
import '../../components/chat/chat-composer/chat-composer'
import '../../components/chat/chat-suggestions/chat-suggestions'
import '../../components/feedback/toast/toast'
import '../../components/forms/form-actions/form-actions'
import '../../components/frame/footer/footer'
import '../../components/frame/shell/shell'
import '../../components/map/map/map'
import '../../components/tables/card/card'
import '../../components/tables/data-table/data-table'
import type { ExplainerData, ShellData } from '../../types'

declare module 'vitest/browser' {
  interface BrowserCommands {
    emulatePrint: (on: boolean) => Promise<void>
  }
}

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))

async function mount<T extends HTMLElement>(tag: string, setup?: (element: T) => void): Promise<T> {
  const element = document.createElement(tag) as T
  setup?.(element)
  document.body.append(element)
  await (element as unknown as { updateComplete: Promise<unknown> }).updateComplete
  await frame()
  return element
}

async function onPaper<R>(read: () => R): Promise<{ screen: R; paper: R }> {
  const screen = read()
  await commands.emulatePrint(true)
  await frame()
  const paper = read()
  await commands.emulatePrint(false)
  await frame()
  return { screen, paper }
}

const shadow = (element: Element, selector: string): Element =>
  element.shadowRoot!.querySelector(selector) as Element

beforeAll(() => page.viewport(1440, 900))

afterEach(async () => {
  await commands.emulatePrint(false)
  document.body.replaceChildren()
  await page.viewport(1440, 900)
})

describe('paper is light', () => {
  it('draws a dark tile in the light surface', async () => {
    const holder = document.createElement('div')
    holder.dataset.mode = 'dark'
    document.body.append(holder)
    const tile = document.createElement('lintje-tile')
    tile.setAttribute('heading', 'Aanvragen')
    holder.append(tile)
    await (tile as unknown as { updateComplete: Promise<unknown> }).updateComplete
    const fill = () => getComputedStyle(shadow(tile, '.lintje-tile')).backgroundColor
    const { screen, paper } = await onPaper(fill)
    expect(screen).not.toBe('rgb(255, 255, 255)')
    expect(paper).toBe('rgb(255, 255, 255)')
  })
})

describe('paper keeps the desktop form', () => {
  it('does not match the phone query at a portrait sheet’s width', async () => {
    await page.viewport(718, 1000)
    await expect.poll(() => window.innerWidth).toBe(718)
    const { screen, paper } = await onPaper(() => matchMedia(MOBILE).matches)
    expect(screen).toBe(true)
    expect(paper).toBe(false)
  })
})

/** A control has nothing to say on paper. */
const CONTROLS: { tag: string; setup?: (element: HTMLElement) => void }[] = [
  { tag: 'lintje-button', setup: (element) => (element.textContent = 'Opslaan') },
  { tag: 'lintje-icon-button', setup: (element) => element.setAttribute('label', 'Vergroot') },
  { tag: 'lintje-menu-button', setup: (element) => element.setAttribute('label', 'Exporteren') },
  { tag: 'lintje-copy-button', setup: (element) => element.setAttribute('text', 'tekst') },
  { tag: 'lintje-toast', setup: (element) => (element.textContent = 'Opgeslagen') },
  { tag: 'lintje-form-actions' },
  { tag: 'lintje-chat-composer' },
  { tag: 'lintje-chat-suggestions' },
  { tag: 'lintje-footer' },
]

describe('controls leave the paper', () => {
  for (const { tag, setup } of CONTROLS) {
    it(`${tag} is not printed`, async () => {
      const element = await mount(tag, setup)
      const { screen, paper } = await onPaper(() => getComputedStyle(element).display)
      expect(screen).not.toBe('none')
      expect(paper).toBe('none')
    })
  }
})

/** What stays on one sheet where it fits, and what breaks between its rows. */
const BREAKS: { tag: string; value: string; setup?: (element: HTMLElement) => void }[] = [
  { tag: 'lintje-tile', value: 'avoid' },
  { tag: 'lintje-chart', value: 'avoid' },
  { tag: 'lintje-map', value: 'avoid' },
  { tag: 'lintje-kpi', value: 'avoid' },
  { tag: 'lintje-card', value: 'avoid' },
  { tag: 'lintje-note', value: 'avoid' },
  { tag: 'lintje-explainer', value: 'avoid' },
  { tag: 'lintje-data-table', value: 'auto' },
  { tag: 'lintje-tile', value: 'auto', setup: (element) => element.setAttribute('breakable', '') },
]

describe('a tile stays on one sheet where it fits', () => {
  for (const { tag, value, setup } of BREAKS) {
    it(`${tag}${setup ? ' (breakable)' : ''} breaks ${value === 'avoid' ? 'nowhere' : 'between rows'}`, async () => {
      const element = await mount(tag, setup)
      const { paper } = await onPaper(() => getComputedStyle(element).breakInside)
      expect(paper).toBe(value)
    })
  }
})

describe('no motion on paper', () => {
  // The browser tests run with reduced motion, which keeps an 80 ms transition on everything.
  it('leaves no transition running', async () => {
    const tile = await mount('lintje-tile')
    const { screen, paper } = await onPaper(
      () => getComputedStyle(shadow(tile, '.lintje-tile')).transitionDuration,
    )
    expect(screen).not.toBe('0s')
    expect(paper).toBe('0s')
  })
})

describe('the shell on paper', () => {
  const data: ShellData = {
    name: 'Dashboard Vergunningen',
    environment: 'Acceptatie',
    emblem: { name: 'embleem-rijksoverheid', label: 'Rijksoverheid' },
    navigation: [{ label: 'Overzicht', href: '#', active: true }],
  }

  for (const layout of ['top', 'side'] as const) {
    it(`says what the page is in the ${layout} layout, without its bars`, async () => {
      const shell = await mount<HTMLElement & { data: ShellData }>('lintje-shell', (element) => {
        element.data = { ...data, layout }
      })
      const head = shadow(shell, '.lintje-shell__print-head')
      const bar = shadow(shell, layout === 'top' ? '.lintje-shell__nav' : '.lintje-nav')
      const { screen, paper } = await onPaper(() => ({
        head: getComputedStyle(head).display,
        bar: getComputedStyle(bar).display,
      }))
      expect(screen).toEqual({ head: 'none', bar: expect.not.stringMatching(/^none$/) })
      expect(paper.head).not.toBe('none')
      expect(paper.bar).toBe('none')
      expect(head.textContent).toContain('Dashboard Vergunningen · Acceptatie')
    })
  }
})

describe('what folds shut is printed open', () => {
  it('prints a closed explainer’s terms', async () => {
    const explainer = await mount<HTMLElement & { data: ExplainerData }>(
      'lintje-explainer',
      (element) => {
        element.data = {
          title: 'Hoe deze cijfers worden berekend',
          items: [{ term: 'Aanvragen', description: 'Afgehandeld per kalenderdag.' }],
          defaultOpen: false,
        }
      },
    )
    const body = shadow(explainer, '.lintje-disclosure__body-inner')
    const { screen, paper } = await onPaper(() => getComputedStyle(body).visibility)
    expect(screen).toBe('hidden')
    expect(paper).toBe('visible')
  })
})
