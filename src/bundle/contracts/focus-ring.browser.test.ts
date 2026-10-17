/**
 * The ring of the focus is whole and stands on what has the focus (WCAG 2.4.7): no scroll box
 * cuts it and no neighbour covers it. And the links of a list each keep the 24 px target that a
 * finger aims at (2.5.8).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { deepActiveElement, holdsFocus } from '../../core/focus'
import { SHIFT_TAB, TAB } from '../../core/test-keys'
import '../../components/actions/menu-button/menu-button'
import '../../components/chat/chat-composer/chat-composer'
import '../../components/forms/error-summary/error-summary'
import '../../components/inputs/range/range'
import '../../components/inputs/select/select'
import '../../components/overlays/dialog/dialog'

type Updating = HTMLElement & { updateComplete?: Promise<unknown> }

async function append<T extends HTMLElement>(element: T): Promise<T> {
  document.body.append(element)
  await (element as Updating).updateComplete
  return element
}

/** A control before the element: a click on it gives the test's frame the keyboard in WebKit. */
async function start(): Promise<void> {
  const before = Object.assign(document.createElement('button'), { textContent: 'Begin' })
  document.body.prepend(before)
  await userEvent.click(before)
}

const shadow = <T extends Element = HTMLElement>(host: Element, selector: string): T =>
  host.shadowRoot!.querySelector<T>(selector)!

/** What draws the ring of the focused element: itself, or the nearest box round it that does. */
function ringOf(element: Element | null): HTMLElement | null {
  let node: Node | null = element
  while (node) {
    if (node instanceof HTMLElement) {
      const style = getComputedStyle(node)
      if (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) return node
    }
    node = node.parentNode instanceof ShadowRoot ? node.parentNode.host : node.parentNode
  }
  return null
}

/** The box the ring takes: the element's, out by its offset and its width. */
function ringBox(element: HTMLElement): DOMRect {
  const style = getComputedStyle(element)
  const out = parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth)
  const box = element.getBoundingClientRect()
  return new DOMRect(box.x - out, box.y - out, box.width + 2 * out, box.height + 2 * out)
}

const within = (inner: DOMRect, outer: DOMRect): boolean =>
  inner.top >= outer.top - 0.5 &&
  inner.bottom <= outer.bottom + 0.5 &&
  inner.left >= outer.left - 0.5 &&
  inner.right <= outer.right + 0.5

/** A computed colour as 0–255 channels, whatever syntax the browser writes it in. */
function rgbOf(colour: string): number[] {
  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
  context.fillStyle = colour
  context.fillRect(0, 0, 1, 1)
  return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3))
}

/** A token's colour on this page. */
function channels(token: string): number[] {
  const probe = document.createElement('span')
  probe.style.color = `var(${token})`
  document.body.append(probe)
  const colour = getComputedStyle(probe).color
  probe.remove()
  return rgbOf(colour)
}

/** How many pixels of a picture of the element have the colour, in each half: left and right. */
async function colouredHalves(element: HTMLElement, rgb: number[]): Promise<[number, number]> {
  const base64 = await page.screenshot({ element, save: false })
  const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob()
  const picture = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = picture.width
  canvas.height = picture.height
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(picture, 0, 0)
  const { data } = context.getImageData(0, 0, picture.width, picture.height)
  const halves: [number, number] = [0, 0]
  for (let index = 0; index < data.length; index += 4) {
    const near = rgb.every((value, channel) => Math.abs(data[index + channel]! - value) < 40)
    if (near) halves[(index / 4) % picture.width < picture.width / 2 ? 0 : 1]++
  }
  return halves
}

afterEach(async () => {
  await page.viewport(1440, 900)
  document.body.replaceChildren()
})

describe('the ring of the focus', () => {
  it('stays whole on the first and the last field in the scroll box of lintje-dialog', async () => {
    await page.viewport(1440, 600)
    await start()
    const dialog = Object.assign(document.createElement('lintje-dialog'), {
      heading: 'Gegevens van de aanvrager',
      wide: true,
    })
    // Selects without a visible label: the first box stands at the top of the scroll box, and its
    // ring 5 px outside it.
    const labels = ['Regio', 'Soort loket', 'Periode', 'Behandelaar', 'Status', 'Bron']
    for (const label of [...labels, ...labels.map((label) => `${label}, tweede`)]) {
      const select = Object.assign(document.createElement('lintje-select'), {
        label,
        hideLabel: true,
        value: 'a',
        options: [
          { value: 'a', label: 'Alle' },
          { value: 'b', label: 'Een' },
        ],
      })
      select.style.width = '100%'
      dialog.append(select)
    }
    dialog.open = true
    await append(dialog)
    const body = shadow(dialog, '.lintje-dialog__body')
    await expect.poll(() => body.scrollHeight > body.clientHeight).toBe(true)
    // The first field has the focus; from the keyboard, so the ring shows in every browser.
    await expect.poll(() => holdsFocus(dialog.querySelector('lintje-select')!)).toBe(true)
    await userEvent.keyboard(TAB)
    await userEvent.keyboard(SHIFT_TAB)
    const first = ringOf(deepActiveElement())!
    expect(getComputedStyle(first).outlineWidth).toBe('3px')
    expect(within(ringBox(first), body.getBoundingClientRect()), 'the first field').toBe(true)
    for (let step = 0; step < 11; step++) await userEvent.keyboard(TAB)
    const last = ringOf(deepActiveElement())!
    expect(last).not.toBe(first)
    await expect.poll(() => within(ringBox(last), body.getBoundingClientRect())).toBe(true)
    body.scrollTop = body.scrollHeight
    expect(within(ringBox(last), body.getBoundingClientRect()), 'the last field').toBe(true)
  })

  it('lies over the other half of a split lintje-menu-button', async () => {
    await start()
    const menu = Object.assign(document.createElement('lintje-menu-button'), {
      split: true,
      variant: 'primary',
      label: 'Downloaden',
      action: 'docx',
      items: [{ value: 'pdf', label: 'Als pdf' }],
    })
    await append(menu)
    const main = shadow(menu, '.lintje-menu-button__main')
    const arrow = shadow(menu, '.lintje-menu-button__trigger--split')
    const over = (top: HTMLElement, under: HTMLElement): boolean =>
      getComputedStyle(top).position !== 'static' &&
      Number(getComputedStyle(top).zIndex) > (Number(getComputedStyle(under).zIndex) || 0)
    await userEvent.keyboard(TAB)
    await expect.poll(() => deepActiveElement()).toBe(main)
    expect(getComputedStyle(main).outlineWidth).toBe('3px')
    // The ring reaches over the other half, and is drawn above it.
    expect(ringBox(main).right).toBeGreaterThan(arrow.getBoundingClientRect().left)
    expect(over(main, arrow)).toBe(true)
    await userEvent.keyboard(TAB)
    await expect.poll(() => deepActiveElement()).toBe(arrow)
    expect(ringBox(arrow).left).toBeLessThan(main.getBoundingClientRect().right)
    expect(over(arrow, main)).toBe(true)
  })

  it('stands round the handle of lintje-range with the focus, not round the bar', async () => {
    await start()
    const range = Object.assign(document.createElement('lintje-range'), {
      label: 'Openingstijd',
      steps: ['8:00', '10:00', '12:00', '14:00', '16:00'],
      from: 0,
      to: 4,
    })
    range.style.width = '400px'
    await append(range)
    const [from, to] = range.shadowRoot!.querySelectorAll<HTMLElement>('.lintje-range__input')
    await userEvent.keyboard(TAB)
    await userEvent.keyboard(TAB)
    await expect.poll(() => deepActiveElement()).toBe(to)
    expect(getComputedStyle(to!).outlineStyle).toBe('none')
    expect(getComputedStyle(from!).outlineStyle).toBe('none')
    // The first handle at the start, the second at the end: only the end has the ring's colour.
    const [start_, end] = await colouredHalves(range, channels('--color-focus'))
    expect(end, 'the ring round the second handle').toBeGreaterThan(20)
    expect(start_, 'no ring round the first handle').toBe(0)
  })

  it('rings the completion the keys stand on in lintje-chat-composer, not the one pointed at', async () => {
    const composer = Object.assign(document.createElement('lintje-chat-composer'), {
      vocabulary: [
        { label: 'Amsterdam Centrum', kind: 'loket' },
        { label: 'Amstelveen', kind: 'gemeente' },
        { label: 'Ameland', kind: 'gemeente' },
      ],
    })
    // Low on the page: the completions open above the box.
    composer.style.width = '480px'
    composer.style.marginTop = '320px'
    await append(composer)
    const field = shadow(composer, '.lintje-chat-composer__input')
    await userEvent.click(field)
    await userEvent.keyboard('Am')
    const rows = (): HTMLElement[] => [
      ...composer.shadowRoot!.querySelectorAll<HTMLElement>('.lintje-chat-composer__completion'),
    ]
    await expect.poll(() => rows().length).toBe(3)
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => rows()[1]!.classList.contains('is-active')).toBe(true)
    const active = getComputedStyle(rows()[1]!)
    expect(active.outlineStyle).toBe('solid')
    expect(active.outlineWidth).toBe('3px')
    expect(rgbOf(active.outlineColor)).toEqual(channels('--color-focus'))
    await userEvent.hover(rows()[2]!)
    expect(rows()[2]!.classList.contains('is-active')).toBe(false)
    expect(getComputedStyle(rows()[2]!).outlineStyle).toBe('none')
  })
})

describe('the links of a list', () => {
  it('are each at least 24 px high in lintje-error-summary', async () => {
    const summary = Object.assign(document.createElement('lintje-error-summary'), {
      items: [
        { field: 'voornaam', label: 'Voornaam', message: 'Vul je voornaam in.' },
        {
          field: 'postcode',
          label: 'Postcode',
          message: 'Een postcode is vier cijfers en twee letters.',
        },
        { field: 'plaats', label: 'Plaats', message: 'Vul je woonplaats in.' },
      ],
    })
    await append(summary)
    const links = [
      ...summary.shadowRoot!.querySelectorAll<HTMLElement>('.lintje-error-summary__link'),
    ]
    expect(links).toHaveLength(3)
    for (const link of links) expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(24)
  })
})
