/**
 * The single-handle slider: what the keyboard does, when the value leaves the
 * control, and what a screen reader hears. Then the two handles — whom they
 * tell — and the modified state on the label line.
 *
 * The three things a slider gets wrong most easily. **When** it commits is the
 * one that costs: a commit is a
 * URL change and a tile reload, so a drag may move the handle on every pixel
 * but must write the URL once, when the pointer is let go. The geometry — where
 * the handle stands in pixels, whether the tick labels collide — is measured in
 * headless Chrome; this is the arithmetic and the events.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import './range'
import type { LintjeRange } from './range'

const STEPS = [5, 10, 15, 20, 25, 30]

async function mount(value: number = 15): Promise<LintjeRange> {
  const element = document.createElement('lintje-range') as LintjeRange
  element.single = true
  element.name = 'p.drempel'
  element.label = 'Wachttijddrempel'
  element.unit = 'min'
  element.steps = STEPS
  element.value = value
  document.body.append(element)
  await element.updateComplete
  return element
}

/** The two-handle range, from step 10 to step 20. */
async function mountPair(props: Partial<LintjeRange> = {}): Promise<LintjeRange> {
  const element = document.createElement('lintje-range') as LintjeRange
  element.label = 'Wachttijd'
  element.steps = STEPS
  element.from = 1
  element.to = 3
  Object.assign(element, props)
  document.body.append(element)
  await element.updateComplete
  return element
}

/** One of the two handles: 0 the lower, 1 the upper. */
const handle = (element: LintjeRange, which: 0 | 1): HTMLInputElement =>
  element.renderRoot.querySelectorAll<HTMLInputElement>('input[type=range]')[which]

/** Drags a handle to an index and holds it there: the pointer is still down. */
function hold(element: LintjeRange, which: 0 | 1, index: number): void {
  const input = handle(element, which)
  input.value = String(index)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Drags a handle to an index and lets it go, as a pointer does and as an arrow key does. */
function drag(element: LintjeRange, which: 0 | 1, index: number): void {
  hold(element, which, index)
  handle(element, which).dispatchEvent(new Event('change', { bubbles: true }))
}

/** Every pair the two handles committed, in order, as `lintje-values-change` carries them. */
function committedPairs(element: LintjeRange, seen: unknown[] = []): unknown[] {
  element.addEventListener('lintje-values-change', (event) => {
    seen.push((event as CustomEvent<Record<string, unknown>>).detail['p.bereik'])
  })
  return seen
}

/** Every step the control committed, in order, as `lintje-values-change` carries them. */
function committed(element: LintjeRange): number[] {
  const seen: number[] = []
  element.addEventListener('lintje-values-change', (event) => {
    seen.push((event as CustomEvent<Record<string, number>>).detail['p.drempel'])
  })
  return seen
}

const slider = (element: LintjeRange): HTMLInputElement =>
  element.renderRoot.querySelector('input[type=range]') as HTMLInputElement

const press = (element: LintjeRange, key: string): void => {
  slider(element).dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  )
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('the single-handle slider', () => {
  it('commits the step itself, not its index', async () => {
    const element = await mount(15)
    const seen = committed(element)
    press(element, 'ArrowRight')
    expect(seen).toEqual([20])
  })

  it('moves one step on an arrow and a tenth of the scale on a page key', async () => {
    const element = await mount(5)
    const seen = committed(element)
    // Six steps: a tenth of five gaps rounds to one, so a page key is one step
    // here — the arithmetic, not a second hardcoded number.
    press(element, 'PageUp')
    press(element, 'ArrowUp')
    expect(seen).toEqual([10, 15])
  })

  it('jumps to the ends with Home and End, and stops there', async () => {
    const element = await mount(15)
    const seen = committed(element)
    press(element, 'End')
    await element.updateComplete
    press(element, 'ArrowRight')
    press(element, 'Home')
    await element.updateComplete
    press(element, 'ArrowLeft')
    expect(seen).toEqual([30, 5])
  })

  it('stays put on a key it does not know, and lets that key through', async () => {
    const element = await mount(15)
    const seen = committed(element)
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    slider(element).dispatchEvent(event)
    expect(seen).toEqual([])
    expect(event.defaultPrevented).toBe(false)
  })

  it('commits nothing while it is dragged and once when it is let go', async () => {
    const element = await mount(5)
    const seen = committed(element)
    const input = slider(element)
    for (const index of ['1', '2', '3']) {
      input.value = index
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    await element.updateComplete
    // The handle has moved — the reader sees step 20 — but nothing is committed.
    expect(seen).toEqual([])
    expect(element.renderRoot.textContent).toContain('20 min')
    input.dispatchEvent(new Event('change', { bubbles: true }))
    expect(seen).toEqual([20])
  })

  it('says its bounds, its value and the value in words', async () => {
    const element = await mount(15)
    const input = slider(element)
    expect(input.getAttribute('role')).toBe('slider')
    expect(input.getAttribute('aria-valuemin')).toBe('5')
    expect(input.getAttribute('aria-valuemax')).toBe('30')
    expect(input.getAttribute('aria-valuenow')).toBe('15')
    expect(input.getAttribute('aria-valuetext')).toBe('15 min')
  })

  it('draws one handle, filled from the lowest step to it', async () => {
    const element = await mount(20)
    expect(element.renderRoot.querySelectorAll('input[type=range]')).toHaveLength(1)
    const fill = element.renderRoot.querySelector<HTMLElement>('.lintje-range__fill')
    expect(fill?.style.left).toBe('0%')
    expect(fill?.style.right).toBe('40%')
  })

  it('bolds the step it stands on, and only that one', async () => {
    const element = await mount(15)
    element.trackWidth = 600
    await element.updateComplete
    const active = [...element.renderRoot.querySelectorAll('.lintje-range__step.is-active')]
    expect(active.map((step) => step.textContent?.trim())).toEqual(['15'])
  })

  it('commits nothing at all when it is disabled', async () => {
    const element = await mount(15)
    element.disabled = true
    await element.updateComplete
    const seen = committed(element)
    press(element, 'ArrowRight')
    expect(seen).toEqual([])
    expect(slider(element).disabled).toBe(true)
  })

  it('draws two handles when it is not single', async () => {
    const element = await mountPair()
    expect(element.renderRoot.querySelectorAll('input[type=range]')).toHaveLength(2)
    expect(element.renderRoot.textContent).toContain('10 – 20')
  })
})

describe('the two handles', () => {
  it('tell their owner and, with a name, the host: the pair of indexes', async () => {
    const element = await mountPair({ name: 'p.bereik' })
    const local: unknown[] = []
    const host: CustomEvent[] = []
    element.addEventListener('lintje-change', (event) => local.push((event as CustomEvent).detail))
    element.addEventListener('lintje-values-change', (event) => host.push(event as CustomEvent))
    drag(element, 1, 4)
    expect(local).toEqual([[1, 4]])
    expect(host.map((event) => event.detail)).toEqual([{ 'p.bereik': [1, 4] }])
    // Composed, or a host outside the shadow root that holds the range never hears it.
    expect(host[0].composed).toBe(true)
  })

  it('commit nothing while one is dragged and once when it is let go', async () => {
    const element = await mountPair({ name: 'p.bereik' })
    const seen = committedPairs(element)
    for (const index of [4, 5, 4]) hold(element, 1, index)
    await element.updateComplete
    // The handle has moved — the reader sees 10 – 25, the stretch runs to it — but
    // nothing is committed.
    expect(seen).toEqual([])
    expect(element.renderRoot.textContent).toContain('10 – 25')
    expect(element.renderRoot.querySelector<HTMLElement>('.lintje-range__fill')?.style.right).toBe(
      '20%',
    )
    handle(element, 1).dispatchEvent(new Event('change', { bubbles: true }))
    expect(seen).toEqual([[1, 4]])
  })

  it('never cross: a handle stops at the other one, and so does the native input', async () => {
    const lower = await mountPair({ name: 'p.bereik' })
    const seen = committedPairs(lower)
    drag(lower, 0, 5)
    expect(handle(lower, 0).value).toBe('3')
    const upper = await mountPair({ name: 'p.bereik' })
    committedPairs(upper, seen)
    drag(upper, 1, 0)
    expect(handle(upper, 1).value).toBe('1')
    expect(seen).toEqual([
      [3, 3],
      [1, 1],
    ])
  })

  it('stand where they were let go until the owner says otherwise', async () => {
    const element = await mountPair()
    drag(element, 0, 2)
    await element.updateComplete
    expect(element.renderRoot.textContent).toContain('15 – 20')
    // The owner answers with another pair: its word ends the draft.
    element.from = 0
    await element.updateComplete
    expect(element.renderRoot.textContent).toContain('5 – 20')
    expect(handle(element, 0).value).toBe('0')
  })

  it('say nothing to the host without a name — the filter bar case', async () => {
    const element = await mountPair()
    const local: unknown[] = []
    const host: unknown[] = []
    element.addEventListener('lintje-change', (event) => local.push((event as CustomEvent).detail))
    element.addEventListener('lintje-values-change', (event) =>
      host.push((event as CustomEvent).detail),
    )
    drag(element, 0, 0)
    expect(local).toEqual([[0, 3]])
    expect(host).toEqual([])
  })

  it('say their step and unit, the hint and the error, not the index', async () => {
    const element = await mountPair({ unit: 'min', hint: 'In minuten', error: 'Te kort' })
    expect(handle(element, 0).getAttribute('aria-valuetext')).toBe('10 min')
    expect(handle(element, 1).getAttribute('aria-valuetext')).toBe('20 min')
    const message = element.renderRoot.querySelector('.lintje-field__error')!
    for (const which of [0, 1] as const) {
      expect(handle(element, which).getAttribute('aria-describedby')).toBe(message.id)
      expect(handle(element, which).getAttribute('aria-invalid')).toBe('true')
    }
  })

  it('move the nearer handle to a press on the track, and focus it', async () => {
    const element = await mountPair({ name: 'p.bereik' })
    const seen = committedPairs(element)
    const track = element.renderRoot.querySelector<HTMLElement>('.lintje-range')!
    // Six steps over 500 px: step n stands at n × 100 px.
    track.getBoundingClientRect = () => new DOMRect(0, 0, 500, 48)
    const pressAt = (x: number, target: Element = track): void => {
      target.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: x, bubbles: true, cancelable: true }),
      )
    }
    pressAt(0)
    expect(seen).toEqual([[0, 3]])
    expect(element.shadowRoot!.activeElement).toBe(handle(element, 0))
    pressAt(490)
    expect(seen).toEqual([
      [0, 3],
      [0, 5],
    ])
    expect(element.shadowRoot!.activeElement).toBe(handle(element, 1))
    // A press on a thumb is the native input's own drag.
    pressAt(100, handle(element, 0))
    expect(seen).toHaveLength(2)
  })

  it('part stacked handles by the side of the press, and raise the lower one at the end', async () => {
    const element = await mountPair({ name: 'p.bereik', from: 2, to: 2 })
    const seen = committedPairs(element)
    const track = element.renderRoot.querySelector<HTMLElement>('.lintje-range')!
    track.getBoundingClientRect = () => new DOMRect(0, 0, 500, 48)
    const pressAt = (x: number): void => {
      track.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, bubbles: true }))
    }
    pressAt(100)
    pressAt(400)
    expect(seen).toEqual([
      [1, 2],
      [1, 4],
    ])
    element.from = 5
    element.to = 5
    await element.updateComplete
    expect(handle(element, 0).classList.contains('is-raised')).toBe(true)
  })
})

describe('in a grid', () => {
  it('takes the columns of its span, as every grid item does', async () => {
    const element = await mountPair({ span: 4 })
    expect(element.getAttribute('span')).toBe('4')
    expect(element.style.getPropertyValue('--lintje-span')).toBe('4')
  })
})

describe('a value that differs from its default', () => {
  it('colours the label and puts the dot before the chosen values', async () => {
    const element = await mountPair({ modified: true })
    const label = element.renderRoot.querySelector('.lintje-label.is-modified')
    expect(label?.textContent).toContain('Wachttijd')
    const dot = label?.querySelector('.lintje-label__dot')
    expect(dot?.textContent?.trim()).toBe('afwijkend van standaard')
    expect(dot?.nextElementSibling?.textContent).toBe('10 – 20')
  })

  it('draws no dot at rest', async () => {
    const element = await mountPair()
    expect(element.renderRoot.querySelector('.lintje-label.is-modified')).toBeNull()
    expect(element.renderRoot.querySelector('.lintje-label__dot')).toBeNull()
  })

  it('leaves both to the field that carries the label when its own is hidden', async () => {
    const element = await mountPair({ modified: true, hideLabel: true })
    expect(element.renderRoot.querySelector('.lintje-label__dot')).toBeNull()
    expect(element.renderRoot.querySelector('.lintje-range__values')?.textContent).toBe('10 – 20')
  })
})
