/**
 * The ring of the focus is whole and stands on what has the focus (WCAG 2.4.7): no scroll box
 * cuts it and no neighbour covers it, and it keeps its inner line where a box round the control
 * draws it. And the links of a list each keep the 24 px target that a
 * finger aims at (2.5.8).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { deepActiveElement, holdsFocus } from '../../core/focus'
import { SHIFT_TAB, TAB } from '../../core/test-keys'
import '../../components/actions/menu-button/menu-button'
import '../../components/content/attachment/attachment'
import '../../components/frame/hero/hero'
import '../../components/inputs/checkbox/checkbox'
import '../../components/inputs/find/find'
import '../../components/inputs/radio-group/radio-group'
import '../../components/inputs/slot-picker/slot-picker'
import '../../components/inputs/tag-input/tag-input'
import '../../components/inputs/text-editor/text-editor'
import '../../components/inputs/toggle/toggle'
import '../../components/tables/card/card'
import '../../components/tables/data-table/data-table'
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
  delete document.documentElement.dataset.mode
  delete document.documentElement.dataset.styleVersion
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

/** A colour as this browser writes it, alpha included, so `transparent` is a colour too. */
function normalised(colour: string): string {
  const probe = document.createElement('span')
  probe.style.color = colour
  document.body.append(probe)
  const written = getComputedStyle(probe).color
  probe.remove()
  return written
}

/** The shadows of a computed `box-shadow`: colour, spread and whether it is inset. */
function shadowsOf(value: string): { colour: string; spread: number; inset: boolean }[] {
  if (value === 'none') return []
  return value.split(/,(?![^(]*\))/).map((part) => {
    const [, colour = '', rest = ''] =
      /^\s*((?:rgba?|color|oklch|lab|hsla?)\([^)]*\)|\S+)\s+(.*)$/.exec(part) ?? []
    const lengths = rest.split(/\s+/).filter((word) => word.endsWith('px'))
    return {
      colour: normalised(colour),
      spread: parseFloat(lengths[3] ?? '0'),
      inset: /inset/.test(rest),
    }
  })
}

interface RingRow {
  name: string
  /** Mounts the element; resolves to it. */
  mount: () => Promise<HTMLElement>
  /** What takes the focus from the keyboard. */
  target: (element: HTMLElement) => HTMLElement
  /** What draws the ring. */
  ring: (element: HTMLElement) => HTMLElement
}

const lit = async <T extends HTMLElement>(tag: string, set: (element: T) => void): Promise<T> => {
  const element = document.createElement(tag) as T
  set(element)
  return append(element)
}

const choice = (element: HTMLElement, part: string): HTMLElement => shadow(element, part)

const RING_ROWS: RingRow[] = [
  {
    name: 'the box of lintje-checkbox',
    mount: () => lit('lintje-checkbox', (box) => Object.assign(box, { label: 'Akkoord' })),
    target: (element) => choice(element, '.lintje-choice__input'),
    ring: (element) => choice(element, '.lintje-choice__box'),
  },
  {
    name: 'the circle of lintje-radio-group',
    mount: () =>
      lit('lintje-radio-group', (group) =>
        Object.assign(group, {
          label: 'Soort',
          options: [
            { value: 'a', label: 'Eerste' },
            { value: 'b', label: 'Tweede' },
          ],
        }),
      ),
    target: (element) => choice(element, '.lintje-choice__input'),
    ring: (element) => choice(element, '.lintje-choice__radio'),
  },
  {
    name: 'the track of lintje-toggle, on',
    mount: () =>
      lit('lintje-toggle', (toggle) =>
        Object.assign(toggle, { label: 'Meldingen', checked: true }),
      ),
    target: (element) => choice(element, '.lintje-choice__input'),
    ring: (element) => choice(element, '.lintje-choice__switch'),
  },
  {
    name: 'the box of lintje-find',
    mount: () => lit('lintje-find', (find) => Object.assign(find, { label: 'Zoeken in de tekst' })),
    target: (element) => shadow(element, '.lintje-find__control'),
    ring: (element) => shadow(element, '.lintje-find'),
  },
  {
    name: 'the field of lintje-tag-input',
    mount: () => lit('lintje-tag-input', (tags) => Object.assign(tags, { label: 'Trefwoorden' })),
    target: (element) => shadow(element, '.lintje-tag-input__input'),
    ring: (element) => shadow(element, '.lintje-tag-input'),
  },
  {
    name: 'the frame of lintje-text-editor',
    mount: () =>
      lit('lintje-text-editor', (editor) => Object.assign(editor, { label: 'Toelichting' })),
    target: (element) => shadow(element, '.lintje-text-editor__surface'),
    ring: (element) => shadow(element, '.lintje-text-editor'),
  },
  {
    name: 'the chosen time of lintje-slot-picker',
    mount: () =>
      lit('lintje-slot-picker', (picker) =>
        Object.assign(picker, {
          label: 'Tijd',
          value: 'b',
          days: [
            {
              date: '2026-10-12',
              slots: [
                { value: 'a', label: '09:00' },
                { value: 'b', label: '09:30' },
              ],
            },
          ],
        }),
      ),
    target: (element) => shadow(element, '.lintje-choice__input:checked'),
    ring: (element) => shadow(element, '.lintje-slot-picker__slot.is-chosen'),
  },
  {
    name: 'the chip of lintje-attachment that is a link',
    mount: () =>
      lit('lintje-attachment', (chip) =>
        Object.assign(chip, {
          data: { id: '1', name: 'besluit.pdf', state: 'done', href: '#besluit' },
        }),
      ),
    target: (element) => shadow(element, '.lintje-attachment__main'),
    ring: (element) => shadow(element, '.lintje-attachment'),
  },
  {
    name: 'the cross of lintje-attachment',
    mount: () =>
      lit('lintje-attachment', (chip) =>
        Object.assign(chip, {
          removable: true,
          data: { id: '1', name: 'besluit.pdf', state: 'done' },
        }),
      ),
    target: (element) => shadow(element, '.lintje-attachment__remove'),
    ring: (element) => shadow(element, '.lintje-attachment__remove'),
  },
  {
    name: 'lintje-card as a link',
    mount: () =>
      lit('lintje-card', (card) =>
        Object.assign(card, { data: { id: '1', title: 'Aanvragen', href: '#aanvragen' } }),
      ),
    target: (element) => shadow(element, '.lintje-card__link'),
    ring: (element) => shadow(element, '.lintje-card'),
  },
  {
    name: 'the detail toggle of lintje-data-table',
    mount: () =>
      lit('lintje-data-table', (table) =>
        Object.assign(table, {
          data: {
            caption: 'Loketten',
            rowKey: 'name',
            columns: [
              { key: 'name', header: 'Loket' },
              { key: 'requests', header: 'Aanvragen' },
            ],
            detailFields: [{ key: 'note', label: 'Toelichting' }],
            rows: [{ name: 'Utrecht', requests: 12, note: 'Open' }],
          },
        }),
      ),
    target: (element) => shadow(element, '.lintje-data-table__detail-toggle'),
    ring: (element) => shadow(element, '.lintje-data-table__detail-toggle'),
  },
  {
    name: 'the box of lintje-checkbox on the primary band of lintje-hero',
    mount: async () => {
      const hero = await lit('lintje-hero', (band) =>
        Object.assign(band, { heading: 'Welkom', tone: 'primary' }),
      )
      const box = Object.assign(document.createElement('lintje-checkbox'), { label: 'Akkoord' })
      hero.append(box)
      await (box as Updating).updateComplete
      return box
    },
    target: (element) => choice(element, '.lintje-choice__input'),
    ring: (element) => choice(element, '.lintje-choice__box'),
  },
]

/** Both house styles in both modes; the earlier style is the page without the attribute. */
const LOOKS = (['classic', 'new'] as const).flatMap((style) =>
  (['light', 'dark'] as const).map((mode) => [style, mode] as const),
)

describe.each(RING_ROWS)('the ring of $name', (row) => {
  it.each(LOOKS)('has its inner line in the %s style, %s', async (style, mode) => {
    document.documentElement.dataset.mode = mode
    if (style === 'new') document.documentElement.dataset.styleVersion = 'new'
    await start()
    const element = await row.mount()
    await expect
      .poll(() => (style === 'new') === (element.dataset.styleVersion === 'new'))
      .toBe(true)
    const target = row.target(element)
    for (let step = 0; step < 6 && deepActiveElement() !== target; step++)
      await userEvent.keyboard(TAB)
    expect(deepActiveElement()).toBe(target)
    const ring = row.ring(element)
    const drawn = getComputedStyle(ring)
    const token = (name: string): string => drawn.getPropertyValue(name).trim()
    const inside = parseFloat(drawn.outlineOffset) < 0
    expect(drawn.outlineStyle).toBe('solid')
    expect(drawn.outlineWidth).toBe(token('--focus-width'))
    expect(normalised(drawn.outlineColor)).toBe(
      normalised(token('--lintje-focus') || token('--color-focus')),
    )
    const inner = normalised(token('--lintje-focus-inner') || token('--color-focus-inner'))
    expect(shadowsOf(drawn.boxShadow)).toContainEqual({
      colour: inner,
      spread: parseFloat(token('--focus-offset')),
      inset: inside,
    })
    if (row.name.includes('primary band')) expect(token('--lintje-focus-inner')).not.toBe('')
  })
})
