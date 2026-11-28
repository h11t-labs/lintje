/** A text field with a button at its end: box and button read as one frame, in both house styles. */
import { afterEach, describe, expect, it } from 'vitest'
import '../../actions/button/button'
import './text-input'

type Field = HTMLElement & { updateComplete: Promise<unknown> }

afterEach(() => {
  document.body.replaceChildren()
  delete document.documentElement.dataset.styleVersion
})

const STATES: [string, object][] = [
  ['at rest', {}],
  ['in error', { error: 'Gebruik alleen cijfers.' }],
  ['read-only', { readonly: true }],
  ['disabled', { disabled: true }],
]

const FIELDS: [string, object][] = [
  ['a password', { type: 'password', value: 'geheim' }],
  ['an action with a prefix and a suffix', { action: 'Zoek', prefix: '€', suffix: 'kg' }],
  ['a search with an action', { type: 'search', action: 'Zoek', value: 'subsidie' }],
]

/** The four corners, clockwise from the top left. */
function corners(element: Element): string[] {
  const style = getComputedStyle(element)
  return [
    style.borderTopLeftRadius,
    style.borderTopRightRadius,
    style.borderBottomRightRadius,
    style.borderBottomLeftRadius,
  ]
}

async function field(
  props: object,
): Promise<{ box: Element; button: Element; suffix: Element | null }> {
  const element = Object.assign(document.createElement('lintje-text-input'), {
    label: 'Veld',
    ...props,
  }) as Field
  document.body.append(element)
  await element.updateComplete
  const host = element.shadowRoot!.querySelector<Field>('lintje-button')!
  await host.updateComplete
  return {
    box: element.shadowRoot!.querySelector('.lintje-text-input__box')!,
    button: host.shadowRoot!.querySelector('.lintje-button')!,
    suffix: element.shadowRoot!.querySelector('.lintje-field__addon--suffix'),
  }
}

describe.each(FIELDS)('a text field with %s', (_, own) => {
  it.each(STATES)(
    'is square at the seam and round outside in the new style, %s',
    async (_, state) => {
      document.documentElement.dataset.styleVersion = 'new'
      const { box, button, suffix } = await field({ ...own, ...state })
      const round = getComputedStyle(document.documentElement).getPropertyValue('--radius-control')
      expect(round.trim()).toBe('4px')
      expect(corners(box)).toEqual(['4px', '0px', '0px', '4px'])
      expect(corners(button)).toEqual(['0px', '4px', '4px', '0px'])
      if (suffix) expect(corners(suffix)).toEqual(['0px', '0px', '0px', '0px'])
      expect(button.getBoundingClientRect().left).toBe(box.getBoundingClientRect().right)
    },
  )

  it.each(STATES)('keeps every corner square in the classic style, %s', async (_, state) => {
    const { box, button, suffix } = await field({ ...own, ...state })
    expect(corners(box)).toEqual(['0px', '0px', '0px', '0px'])
    expect(corners(button)).toEqual(['0px', '0px', '0px', '0px'])
    if (suffix) expect(corners(suffix)).toEqual(['0px', '0px', '0px', '0px'])
  })
})

it('leaves a host no corner to set: a button is never rounder than the small corner', async () => {
  document.documentElement.dataset.styleVersion = 'new'
  document.body.style.setProperty('--lintje-button-radius', '12px')
  try {
    const button = document.createElement('lintje-button') as Field
    button.textContent = 'Opslaan'
    document.body.append(button)
    await button.updateComplete
    expect(corners(button.shadowRoot!.querySelector('.lintje-button')!)).toEqual([
      '4px',
      '4px',
      '4px',
      '4px',
    ])
    const { button: own } = await field({ action: 'Zoek' })
    expect(corners(own)).toEqual(['0px', '4px', '4px', '0px'])
  } finally {
    document.body.style.removeProperty('--lintje-button-radius')
  }
})

describe.each(FIELDS)('a text field in error with %s', (_, own) => {
  it.each(['new', 'classic'])(
    'draws its button in the frame of the box, %s style',
    async (style) => {
      if (style === 'new') document.documentElement.dataset.styleVersion = 'new'
      const { box, button } = await field({ ...own, error: 'Gebruik alleen cijfers.' })
      const frame = getComputedStyle(box)
      const edge = getComputedStyle(button)
      expect(edge.borderTopColor).toBe(frame.borderTopColor)
      expect(edge.borderTopWidth).toBe(frame.borderTopWidth)
      expect(button.getBoundingClientRect().height).toBe(box.getBoundingClientRect().height)
    },
  )
})
