/**
 * Disabled: every field looks the same when it is off, also over an error. The text is faint, the
 * surface subtle, the border the strong one at 1 px, the pointer `not-allowed`, and nothing dims
 * the field: the same as the text input, in light and dark and in both house styles.
 */
import { afterEach, describe, expect, it } from 'vitest'
import '../../components/inputs/combobox/combobox'
import '../../components/inputs/date-input/date-input'
import '../../components/inputs/file-upload/file-upload'
import '../../components/inputs/multiselect/multiselect'
import '../../components/inputs/segmented/segmented'
import '../../components/inputs/select/select'
import '../../components/inputs/text-input/text-input'

type Lit = HTMLElement & { updateComplete: Promise<unknown> }

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))

const OPTIONS = [
  { value: 'a', label: 'Alfa' },
  { value: 'b', label: 'Bravo' },
]

/** One field: the part that draws its surface and border, and the part that draws its text. */
interface Row {
  tag: string
  props?: object
  surface: string
  text: string
  /** The drop zone has a 2 px dashed edge of its own and no pointer of its own. */
  zone?: boolean
}

const ROWS: Row[] = [
  {
    tag: 'lintje-text-input',
    props: { value: 'Jansen' },
    surface: '.lintje-field__box',
    text: '.lintje-field__control',
  },
  {
    tag: 'lintje-select',
    props: { options: OPTIONS, value: 'a' },
    surface: '.lintje-select__control',
    text: '.lintje-select__control',
  },
  {
    tag: 'lintje-combobox',
    props: { options: OPTIONS, value: 'a' },
    surface: '.lintje-combobox__control',
    text: '.lintje-combobox__control',
  },
  {
    tag: 'lintje-multiselect',
    props: { options: OPTIONS, value: ['a'] },
    surface: '.lintje-multiselect__field',
    text: '.lintje-multiselect__field',
  },
  {
    tag: 'lintje-date-input',
    props: { value: '2026-10-04' },
    surface: '.lintje-date-input__control',
    text: '.lintje-date-input__control',
  },
  {
    tag: 'lintje-segmented',
    props: { options: OPTIONS, value: 'a' },
    surface: '.lintje-segmented',
    text: '.lintje-segmented__option:not(.is-active)',
  },
  {
    tag: 'lintje-file-upload',
    surface: '.lintje-file-upload',
    text: '.lintje-file-upload__text',
    zone: true,
  },
]

async function mount(tag: string, props: object): Promise<Lit> {
  const element = Object.assign(document.createElement(tag), props) as Lit
  document.body.append(element)
  await element.updateComplete
  await frame()
  return element
}

const part = (element: Element, selector: string): Element =>
  element.shadowRoot!.querySelector(selector)!

const parent = (node: Element): Element | null =>
  node.parentElement ?? ((node.getRootNode() as ShadowRoot).host as Element | undefined) ?? null

/** The opacity the element is drawn with: its own and every ancestor's, across shadow roots. */
function opacityOf(element: Element): number {
  let opacity = 1
  for (let node: Element | null = element; node; node = parent(node)) {
    opacity *= Number(getComputedStyle(node).opacity)
  }
  return opacity
}

/** A token as the browser resolves it on the page. */
function token(name: string): string {
  const probe = document.createElement('i')
  probe.style.color = `var(${name})`
  document.body.append(probe)
  const colour = getComputedStyle(probe).color
  probe.remove()
  return colour
}

afterEach(() => {
  document.documentElement.dataset.mode = 'light'
  delete document.documentElement.dataset.styleVersion
  document.body.replaceChildren()
})

/** Both house styles in both modes; the earlier style is the page without the attribute. */
const LOOKS = (['classic', 'new'] as const).flatMap((style) =>
  (['light', 'dark'] as const).map((mode) => [style, mode] as const),
)

function look(style: 'classic' | 'new', mode: 'light' | 'dark'): void {
  document.documentElement.dataset.mode = mode
  if (style === 'new') document.documentElement.dataset.styleVersion = 'new'
}

describe.each(ROWS)('$tag', (row) => {
  describe.each([
    ['disabled', {}],
    ['disabled over an error', { error: 'Vul dit veld in.' }],
  ] as const)('%s', (_, extra) => {
    it.each(LOOKS)('looks as every disabled field in the %s style, %s', async (style, mode) => {
      look(style, mode)
      const element = await mount(row.tag, { ...row.props, ...extra, disabled: true })
      const surface = getComputedStyle(part(element, row.surface))
      const text = part(element, row.text)
      expect(surface.backgroundColor).toBe(token('--color-bg-subtle'))
      expect(surface.borderTopColor).toBe(token('--color-border-strong'))
      expect(surface.borderLeftColor).toBe(token('--color-border-strong'))
      expect(getComputedStyle(text).color).toBe(token('--color-text-disabled'))
      expect(opacityOf(text)).toBe(1)
      if (row.zone) {
        expect(surface.borderTopStyle).toBe('dashed')
      } else {
        expect(surface.borderTopWidth).toBe('1px')
        expect(getComputedStyle(text).cursor).toBe('not-allowed')
      }
    })
  })
})

describe('the reset button of a disabled field', () => {
  it.each(LOOKS)('is faint text without a line in the %s style, %s', async (style, mode) => {
    look(style, mode)
    const element = await mount('lintje-text-input', {
      label: 'Naam',
      value: 'Overleg',
      modified: true,
      resetLabel: 'Leegmaken',
      disabled: true,
    })
    const reset = getComputedStyle(part(element, '.lintje-field__reset'))
    expect(reset.color).toBe(token('--color-text-disabled'))
    expect(reset.textDecorationLine).toBe('none')
    expect(reset.cursor).toBe('not-allowed')
  })
})
