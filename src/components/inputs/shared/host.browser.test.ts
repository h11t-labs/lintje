/**
 * What a reader sees of every element that adopts `input.css`, at 1440 and 390 px: the host's
 * display and width, alone and in a row, and its control's height; and the box that the text,
 * date and time fields share, in each state, in light and dark. A move in that sheet that
 * shifts any of it fails here.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import '../checkbox/checkbox'
import '../checkbox-group/checkbox-group'
import '../combobox/combobox'
import '../date-input/date-input'
import '../date-range/date-range'
import '../file-upload/file-upload'
import '../multiselect/multiselect'
import '../number-input/number-input'
import '../radio-group/radio-group'
import '../range/range'
import '../segmented/segmented'
import '../select/select'
import '../slot-picker/slot-picker'
import '../tag-input/tag-input'
import '../text-editor/text-editor'
import '../text-input/text-input'
import '../textarea/textarea'
import '../time-input/time-input'
import '../toggle/toggle'
import '../../tables/data-table/data-table'
import type { DataTableData } from '../../../types'

/** `fill`: as wide as its room; a number: that many px; `content`: narrower than its room. */
type Width = number | 'fill' | 'content'

/** What a reader sees at one width. */
interface Seen {
  /** As a flex item, where `auto` is not resolved to 0. */
  minWidth: string
  /** Alone in a block. */
  block: Width
  /** Alone in a flex row. */
  row: Width
  /** The control's height, in px. */
  control: number
}

interface Host {
  tag: string
  /** The control whose height is measured, in the shadow root. */
  control: string
  props?: Record<string, unknown>
  wide: Seen
  phone: Seen
}

const OPTIONS = [
  { value: 'noord', label: 'Noord' },
  { value: 'zuid', label: 'Zuid' },
]

/** The widths that a host sets itself. */
const FIXED = [120, 180, 480]

/** Shrinks to 0 in a row, fills a block, narrower than a row. */
const FIELD: Seen = { minWidth: '0px', block: 'fill', row: 'content', control: 48 }
/** Below 768 px: as wide as its room, also in a row. */
const FULL: Seen = { ...FIELD, row: 'fill' }
/** Keeps its content's width in a row. */
const AUTO: Seen = { ...FIELD, minWidth: 'auto' }
const WIDE_180: Seen = { ...FIELD, block: 180, row: 180 }

const HOSTS: Host[] = [
  { tag: 'lintje-text-input', control: '.lintje-text-input__box', wide: FIELD, phone: FIELD },
  {
    tag: 'lintje-number-input',
    control: '.lintje-number-input',
    props: { value: 3 },
    wide: FIELD,
    phone: FIELD,
  },
  {
    tag: 'lintje-textarea',
    control: '.lintje-textarea__control',
    wide: { ...FIELD, control: 90 },
    phone: { ...FULL, control: 90 },
  },
  {
    tag: 'lintje-select',
    control: '.lintje-select__control',
    props: { options: OPTIONS },
    wide: { ...WIDE_180, minWidth: 'auto' },
    phone: { ...WIDE_180, minWidth: 'auto' },
  },
  {
    tag: 'lintje-combobox',
    control: '.lintje-combobox__control',
    props: { options: OPTIONS },
    wide: FIELD,
    phone: FULL,
  },
  {
    tag: 'lintje-multiselect',
    control: '.lintje-multiselect__field',
    props: { options: OPTIONS, selected: ['noord'] },
    wide: WIDE_180,
    phone: WIDE_180,
  },
  { tag: 'lintje-tag-input', control: '.lintje-tag-input', wide: FIELD, phone: FULL },
  { tag: 'lintje-checkbox', control: '.lintje-choice', wide: FIELD, phone: FIELD },
  {
    tag: 'lintje-checkbox-group',
    control: '.lintje-checkbox-group__option',
    props: { options: OPTIONS },
    wide: FIELD,
    phone: FIELD,
  },
  {
    tag: 'lintje-radio-group',
    control: '.lintje-choice',
    props: { options: OPTIONS, value: 'noord' },
    wide: FIELD,
    phone: FIELD,
  },
  { tag: 'lintje-toggle', control: '.lintje-choice', wide: FIELD, phone: FIELD },
  {
    tag: 'lintje-segmented',
    control: '.lintje-segmented',
    props: { options: OPTIONS, value: 'noord' },
    wide: AUTO,
    phone: AUTO,
  },
  {
    tag: 'lintje-range',
    control: '.lintje-range',
    props: { steps: ['8:00', '10:00', '12:00'], from: 0, to: 2 },
    wide: WIDE_180,
    phone: WIDE_180,
  },
  { tag: 'lintje-date-input', control: '.lintje-date-input__control', wide: FIELD, phone: FULL },
  {
    tag: 'lintje-time-input',
    control: '.lintje-time-input__control',
    wide: { ...FIELD, block: 120, row: 120 },
    phone: FULL,
  },
  {
    tag: 'lintje-date-range',
    control: '.lintje-date-range-picker__field',
    wide: AUTO,
    phone: AUTO,
  },
  {
    tag: 'lintje-slot-picker',
    control: '.lintje-slot-picker__slot',
    props: {
      days: [{ date: '2026-10-12', slots: [{ value: '2026-10-12T09:00', label: '09:00' }] }],
    },
    wide: { ...FIELD, control: 40 },
    phone: FIELD,
  },
  { tag: 'lintje-file-upload', control: '.lintje-file-upload__button', wide: FIELD, phone: FIELD },
  {
    tag: 'lintje-text-editor',
    control: '.lintje-text-editor__tool',
    wide: { ...FIELD, control: 40 },
    phone: { ...FIELD, control: 40 },
  },
]

const TABLE: DataTableData = {
  caption: 'Loketten',
  rowKey: 'name',
  selectable: true,
  checkedIds: ['Utrecht'],
  columns: [
    { key: 'name', header: 'Loket' },
    { key: 'requests', header: 'Aanvragen' },
  ],
  rows: [
    { name: 'Utrecht', requests: 12 },
    { name: 'Zwolle', requests: 7 },
  ],
}

/* Helpers ----------------------------------------------------------------- */

type Drawn = HTMLElement & { updateComplete?: Promise<unknown> }

async function viewport(width: number, height: number): Promise<void> {
  await page.viewport(width, height)
  // WebKit resizes the frame after `viewport()` resolves, and its media queries a frame later.
  while (window.innerWidth !== width || !matchMedia(`(width: ${width}px)`).matches)
    await new Promise(requestAnimationFrame)
  await new Promise(requestAnimationFrame)
}

/** The element in a wrapper of the page's full width: a block, or a flex row. */
async function mount(
  tag: string,
  props: Record<string, unknown> = {},
  layout: 'block' | 'row' = 'block',
  attributes: Record<string, string> = {},
): Promise<{ element: Drawn; wrapper: HTMLElement }> {
  const wrapper = document.createElement('div')
  if (layout === 'row') Object.assign(wrapper.style, { display: 'flex', alignItems: 'flex-start' })
  const element = Object.assign(document.createElement(tag), { label: 'Veld', ...props }) as Drawn
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
  wrapper.append(element)
  document.body.append(wrapper)
  await element.updateComplete
  return { element, wrapper }
}

/** The first drawn match in the element's shadow root, through nested shadow roots. */
function part(root: Element, selector: string): HTMLElement | null {
  for (const node of root.shadowRoot?.querySelectorAll<HTMLElement>('*') ?? []) {
    if (node.matches(selector) && node.getBoundingClientRect().height > 0) return node
    const inner = part(node, selector)
    if (inner) return inner
  }
  return null
}

function widthIn({ element, wrapper }: { element: Element; wrapper: Element }): Width {
  const width = element.getBoundingClientRect().width
  if (Math.abs(width - wrapper.clientWidth) < 0.5) return 'fill'
  const px = Math.round(width)
  return FIXED.includes(px) ? px : 'content'
}

const height = (element: Element | null): number =>
  Math.round(element?.getBoundingClientRect().height ?? NaN)

/** The colour a token resolves to on this page, as the browser writes it. */
function colourOf(token: string): string {
  const probe = document.createElement('span')
  probe.style.color = `var(${token})`
  document.body.append(probe)
  const colour = getComputedStyle(probe).color
  probe.remove()
  return colour
}

beforeAll(async () => {
  document.documentElement.lang = 'nl'
  document.documentElement.dataset.theme = 'rijksoverheid'
  document.body.style.margin = '0'
  await viewport(1440, 900)
})

// WebKit keeps the media queries of a sheet that no connected element adopts as they were, so
// every resize happens with the elements in place.
afterEach(async () => {
  await viewport(1440, 900)
  document.body.replaceChildren()
  delete document.documentElement.dataset.mode
})

/* The hosts --------------------------------------------------------------- */

describe('the hosts at 1440 and 390 px', () => {
  it.each(HOSTS.map((host) => [host.tag, host] as const))('%s', async (_, host) => {
    const block = await mount(host.tag, host.props)
    const row = await mount(host.tag, host.props, 'row')
    // `stacked` and `hidden` are input.css's own, for every tag.
    const stacked = await mount(host.tag, host.props, 'row', { stacked: '' })
    const hidden = await mount(host.tag, host.props, 'block', { hidden: '' })
    const look = (): Seen => {
      expect(getComputedStyle(block.element).display).toBe('block')
      expect(widthIn(stacked)).toBe('fill')
      expect(getComputedStyle(hidden.element).display).toBe('none')
      return {
        minWidth: getComputedStyle(row.element).minWidth,
        block: widthIn(block),
        row: widthIn(row),
        control: height(part(block.element, host.control)),
      }
    }
    const wide = look()
    await viewport(390, 844)
    expect({ wide, phone: look() }).toEqual({ wide: host.wide, phone: host.phone })
  })

  // In the new style a select fills its column, up to a field's widest: 480 in a wide block, the
  // phone's width there.
  it('lintje-select in the new style', async () => {
    document.documentElement.dataset.styleVersion = 'new'
    try {
      const host = HOSTS.find((entry) => entry.tag === 'lintje-select')!
      const block = await mount(host.tag, host.props)
      const row = await mount(host.tag, host.props, 'row')
      const look = (): Pick<Seen, 'block' | 'row'> => ({ block: widthIn(block), row: widthIn(row) })
      const wide = look()
      await viewport(390, 844)
      expect({ wide, phone: look() }).toEqual({
        wide: { block: 480, row: 480 },
        phone: { block: 'fill', row: 'fill' },
      })
    } finally {
      delete document.documentElement.dataset.styleVersion
    }
  })

  // The table adopts input.css for its rows' boxes: no host rule of a field reaches it.
  it('lintje-data-table', async () => {
    const block = await mount('lintje-data-table', { data: TABLE })
    const row = await mount('lintje-data-table', { data: TABLE }, 'row')
    const look = (view: string) => {
      const boxes = [...block.element.shadowRoot!.querySelectorAll('.lintje-choice__box')].filter(
        (box) => box.getBoundingClientRect().height > 0,
      )
      // The last row's box: not checked, so it shows the box's own edge.
      const box = boxes.at(-1)!
      return {
        display: getComputedStyle(block.element).display,
        minWidth: getComputedStyle(row.element).minWidth,
        block: widthIn(block),
        row: widthIn(row),
        boxes: boxes.length,
        box: [height(box), Math.round(box.getBoundingClientRect().width)],
        edge: getComputedStyle(box).borderTopColor === colourOf('--color-border-choice'),
        line: height(part(block.element, view)),
      }
    }
    const table = {
      display: 'block',
      minWidth: '0px',
      block: 'fill',
      row: 'content',
      boxes: 3,
      box: [24, 24],
      edge: true,
      line: 48,
    }
    expect(look('.lintje-data-table__full tbody .lintje-choice')).toEqual(table)
    await viewport(390, 844)
    expect(look('.lintje-data-table__mobile .lintje-choice')).toEqual(table)
  })
})

/* The box of the text, date and time fields ------------------------------- */

interface Field {
  tag: string
  /** The frame: border and fill. */
  box: string
  /** What the reader types in: its colour and padding. */
  entry: string
  /** The button inside the field at its end. */
  toggle?: string
  /** The padding at the end of the typing part, in px. */
  end: string
}

const FIELDS: Field[] = [
  {
    tag: 'lintje-text-input',
    box: '.lintje-text-input__box',
    entry: '.lintje-text-input__control',
    end: '16px',
  },
  {
    tag: 'lintje-date-input',
    box: '.lintje-date-input__control',
    entry: '.lintje-date-input__control',
    toggle: '.lintje-date-input__toggle',
    end: '54px',
  },
  {
    tag: 'lintje-time-input',
    box: '.lintje-time-input__control',
    entry: '.lintje-time-input__control',
    toggle: '.lintje-time-input__toggle',
    end: '54px',
  },
]

type Look = 'rest' | 'error' | 'readonly' | 'disabled'

interface State {
  name: string
  props: Record<string, unknown>
  look: Look
  /** Only the text field can be read-only. */
  textOnly?: boolean
}

/** Disabled wins over read-only, read-only over error. */
const STATES: State[] = [
  { name: 'at rest', props: {}, look: 'rest' },
  { name: 'in error', props: { error: 'Klopt niet' }, look: 'error' },
  { name: 'disabled', props: { disabled: true }, look: 'disabled' },
  {
    name: 'in error and disabled',
    props: { error: 'Klopt niet', disabled: true },
    look: 'disabled',
  },
  { name: 'read-only', props: { readonly: true }, look: 'readonly', textOnly: true },
  {
    name: 'in error and read-only',
    props: { error: 'Klopt niet', readonly: true },
    look: 'readonly',
    textOnly: true,
  },
  {
    name: 'read-only and disabled',
    props: { readonly: true, disabled: true },
    look: 'disabled',
    textOnly: true,
  },
]

/** What a look draws, by token. */
function drawn(look: Look): Record<string, string> {
  const quiet = look === 'readonly' || look === 'disabled'
  return {
    border: look === 'error' ? '2px' : '1px',
    edge: colourOf(
      look === 'error' ? '--color-error' : quiet ? '--color-border-strong' : '--color-border-field',
    ),
    fill: colourOf(
      quiet
        ? '--color-bg-subtle'
        : look === 'error'
          ? '--color-bg-field-error'
          : '--color-bg-surface',
    ),
    text: colourOf(look === 'disabled' ? '--color-text-disabled' : '--color-text-primary'),
    radius: '0px',
    start: '16px',
    size: '16px',
    height: '48',
  }
}

const MODES = ['light', 'dark'] as const

const CASES = FIELDS.flatMap((field) =>
  STATES.filter((state) => !state.textOnly || field.tag === 'lintje-text-input').map(
    (state) => [`${field.tag} ${state.name}`, field, state] as const,
  ),
)

describe.each(MODES)('the field box in %s', (mode) => {
  it.each(CASES)('%s', async (_, field, state) => {
    document.documentElement.dataset.mode = mode
    const { element } = await mount(field.tag, state.props)
    const box = part(element, field.box)!
    const frame = getComputedStyle(box)
    const typing = getComputedStyle(part(element, field.entry)!)
    expect({
      border: frame.borderTopWidth,
      edge: frame.borderTopColor,
      fill: frame.backgroundColor,
      text: typing.color,
      radius: frame.borderTopLeftRadius,
      start: typing.paddingLeft,
      size: typing.fontSize,
      height: String(height(box)),
    }).toEqual(drawn(state.look))
    expect(typing.paddingRight).toBe(field.end)

    if (field.toggle) {
      // The button stands inside the border: 2 px in from an error's, 1 px from any other.
      const inset = state.look === 'error' ? 2 : 1
      const toggle = part(element, field.toggle)!
      const button = toggle.getBoundingClientRect()
      const outer = box.getBoundingClientRect()
      expect([
        button.top - outer.top,
        outer.right - button.right,
        button.width,
        button.height,
      ]).toEqual([inset, inset, 48 - 2 * inset, 48 - 2 * inset])
      expect(getComputedStyle(toggle).borderLeftColor).toBe(colourOf('--color-border-default'))
      expect(getComputedStyle(toggle).color).toBe(
        colourOf(state.look === 'disabled' ? '--color-text-disabled' : '--color-accent-text'),
      )
    }
  })

  it('keeps the end open for a button beside the text field, also in error', async () => {
    document.documentElement.dataset.mode = mode
    const { element } = await mount('lintje-text-input', { action: 'Zoek', error: 'Klopt niet' })
    const frame = getComputedStyle(part(element, '.lintje-text-input__box')!)
    expect([frame.borderTopWidth, frame.borderRightWidth]).toEqual(['2px', '0px'])
  })
})

// Else a dark run that draws light would pass.
it('draws the field box in another fill in dark', async () => {
  const fill = async (mode: string): Promise<string> => {
    document.documentElement.dataset.mode = mode
    const { element } = await mount('lintje-date-input')
    const colour = getComputedStyle(part(element, '.lintje-date-input__control')!).backgroundColor
    document.body.replaceChildren()
    return colour
  }
  expect(await fill('light')).not.toBe(await fill('dark'))
})
