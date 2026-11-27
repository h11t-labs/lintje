/**
 * The head the windows share: a close button that answers no pointer while it is unavailable,
 * and the same title colour and lines in the dialog, the modal, the drawer and the sheet, in both
 * house styles, light and dark.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import '../filters/filter-sheet/filter-sheet'
import '../overlays/dialog/dialog'
import '../overlays/drawer/drawer'
import '../overlays/modal/modal'

type Window = HTMLElement & { open: boolean; busy?: boolean; updateComplete: Promise<unknown> }

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))

async function mount(tag: string, props: Partial<Window> = {}): Promise<Window> {
  const element = Object.assign(document.createElement(tag) as Window, {
    heading: 'Aanvraag',
    ...props,
  })
  document.body.append(element)
  element.open = true
  await element.updateComplete
  await frame()
  return element
}

/** The colour a token resolves to inside the element's own root. */
function token(element: HTMLElement, name: string): string {
  const probe = document.createElement('i')
  probe.style.color = `var(${name})`
  element.shadowRoot!.append(probe)
  const colour = getComputedStyle(probe).color
  probe.remove()
  return colour
}

const shadow = (element: HTMLElement, selector: string): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>(selector)!

afterEach(async () => {
  await page.viewport(1440, 900)
  document.body.replaceChildren()
  delete document.documentElement.dataset.styleVersion
  document.documentElement.dataset.mode = 'light'
})

describe('the close button of a busy window', () => {
  it.each([
    ['lintje-dialog', '.lintje-dialog__close'],
    ['lintje-drawer', '.lintje-drawer__close'],
  ])('%s keeps the disabled colour under the pointer', async (tag, selector) => {
    const element = await mount(tag, { busy: true })
    const close = shadow(element, selector)
    await userEvent.hover(close)
    await frame()
    await frame()
    expect(close.matches(':hover')).toBe(true)
    // No transition set off: the colour is the disabled one and stays there.
    expect(close.getAnimations()).toHaveLength(0)
    expect(getComputedStyle(close).color).toBe(token(element, '--color-text-disabled'))
  })

  it('takes the text colour under the pointer once it is free again', async () => {
    const element = await mount('lintje-dialog')
    const close = shadow(element, '.lintje-dialog__close')
    await userEvent.hover(close)
    await expect
      .poll(() => getComputedStyle(close).color)
      .toBe(token(element, '--color-text-primary'))
  })
})

interface Head {
  title: string
  /** The line under the head, and above the foot where there is one. */
  lines: [string, string][]
}

const HEADS: Record<string, Head> = {
  'lintje-dialog': { title: '.lintje-dialog__heading', lines: [] },
  'lintje-modal': {
    title: '.lintje-modal__title',
    lines: [
      ['.lintje-modal__header', 'border-bottom-width'],
      ['.lintje-modal__footer', 'border-top-width'],
    ],
  },
  'lintje-drawer': {
    title: '.lintje-drawer__title',
    lines: [
      ['.lintje-drawer__header', 'border-bottom-width'],
      ['.lintje-drawer__footer', 'border-top-width'],
    ],
  },
  'lintje-filter-sheet': {
    title: '.lintje-sheet__title',
    lines: [['.lintje-sheet__head', 'border-bottom-width']],
  },
}

/** Each window's title colour and the width of its lines, with the sheet on a phone. */
async function heads(): Promise<Record<string, { title: string; lines: string[] }>> {
  const found: Record<string, { title: string; lines: string[] }> = {}
  for (const [tag, head] of Object.entries(HEADS)) {
    const element = await mount(tag)
    // A footer only draws with something in it.
    const footer = Object.assign(document.createElement('span'), { slot: 'footer' })
    footer.textContent = 'Bijgewerkt'
    element.append(footer)
    if (tag === 'lintje-filter-sheet') {
      await page.viewport(390, 844)
      await expect.poll(() => window.innerWidth).toBe(390)
    }
    await expect.poll(() => element.shadowRoot!.querySelector(head.title) !== null).toBe(true)
    await frame()
    found[tag] = {
      title: getComputedStyle(shadow(element, head.title)).color,
      lines: head.lines.map(([selector, side]) =>
        getComputedStyle(shadow(element, selector)).getPropertyValue(side),
      ),
    }
    element.remove()
    await page.viewport(1440, 900)
  }
  return found
}

/** A computed colour in sRGB channels: a canvas draws `oklch()` as well as `rgb()`. */
function channels(colour: string): number[] {
  const context = document.createElement('canvas').getContext('2d')!
  context.fillStyle = colour
  context.fillRect(0, 0, 1, 1)
  return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3))
}

/** The contrast of two opaque colours. */
function contrast(a: string, b: string): number {
  const luminance = (colour: string): number => {
    const [r, g, bl] = channels(colour).map((value) => {
      const c = value / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!
  }
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (lighter! + 0.05) / (darker! + 0.05)
}

const LOOKS = (['classic', 'new'] as const).flatMap((style) =>
  (['light', 'dark'] as const).map((mode) => [style, mode] as const),
)

function look(style: 'classic' | 'new', mode: 'light' | 'dark'): void {
  document.documentElement.dataset.mode = mode
  if (style === 'new') document.documentElement.dataset.styleVersion = 'new'
  else delete document.documentElement.dataset.styleVersion
}

describe('the head of a window', () => {
  it.each(LOOKS)(
    'has one title colour and the same lines everywhere, %s %s',
    async (style, mode) => {
      look(style, mode)
      const found = await heads()
      const probe = await mount('lintje-modal')
      const title = token(probe, style === 'new' ? '--color-accent-text' : '--color-text-primary')
      const line = style === 'new' ? '0px' : '1px'
      for (const [tag, head] of Object.entries(found)) {
        expect(head.title, tag).toBe(title)
        for (const width of head.lines) expect(width, tag).toBe(line)
      }
    },
  )

  it('differs between the two house styles', async () => {
    look('classic', 'light')
    const classic = await heads()
    look('new', 'light')
    const fresh = await heads()
    expect(fresh['lintje-drawer']!.title).not.toBe(classic['lintje-drawer']!.title)
    expect(fresh['lintje-filter-sheet']!.lines).not.toEqual(classic['lintje-filter-sheet']!.lines)
  })

  it.each(LOOKS)('reads at 4.5:1 on the filter sheet, %s %s', async (style, mode) => {
    look(style, mode)
    const sheet = await mount('lintje-filter-sheet')
    await page.viewport(390, 844)
    await expect.poll(() => window.innerWidth).toBe(390)
    await frame()
    const title = shadow(sheet, '.lintje-sheet__title')
    const ground = getComputedStyle(shadow(sheet, '.lintje-sheet__head')).backgroundColor
    expect(contrast(getComputedStyle(title).color, ground)).toBeGreaterThanOrEqual(4.5)
  })
})
