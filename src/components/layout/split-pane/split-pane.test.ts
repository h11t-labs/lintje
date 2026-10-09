/**
 * The split pane: the grip's ARIA, the keys, the remembered split and the arithmetic.
 * happy-dom has no layout, so a drag is checked on `splitFromPointer()`.
 */
import { afterEach, describe, expect, it } from 'vitest'
import './split-pane'
import { clampSplit, splitFromKey, splitFromPointer, type LintjeSplitPane } from './split-pane'

async function mount(props: Partial<LintjeSplitPane> = {}): Promise<LintjeSplitPane> {
  const element = Object.assign(document.createElement('lintje-split-pane'), {
    startLabel: 'Brontekst',
    endLabel: 'Vertaling',
    ...props,
  })
  element.innerHTML = '<p slot="start">Bron</p><p slot="end">Vertaling</p>'
  document.body.append(element)
  await element.updateComplete
  return element
}

const handle = (element: LintjeSplitPane): HTMLElement =>
  element.shadowRoot!.querySelector('[role="separator"]')!

function press(element: LintjeSplitPane, key: string): void {
  handle(element).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

describe('lintje-split-pane', () => {
  afterEach(() => localStorage.clear())

  it('draws a focusable separator that names the first panel', async () => {
    const element = await mount()
    const grip = handle(element)
    expect(grip.getAttribute('tabindex')).toBe('0')
    expect(grip.getAttribute('aria-orientation')).toBe('vertical')
    expect(grip.getAttribute('aria-label')).toBe('Verdeling aanpassen')
    expect(grip.getAttribute('aria-valuenow')).toBe('50')
    expect(grip.getAttribute('aria-valuemin')).toBe('20')
    expect(grip.getAttribute('aria-valuemax')).toBe('80')
    const controlled = element.shadowRoot!.getElementById(grip.getAttribute('aria-controls')!)!
    expect(controlled.querySelector('slot')!.name).toBe('start')
    const block = element.shadowRoot!.querySelector<HTMLElement>('.lintje-split-pane')!
    expect(block.style.getPropertyValue('--lintje-split')).toBe('50')
  })

  it('reports a double click on the strip once, and only when the split moved', async () => {
    const element = await mount({ value: 65 })
    const heard: number[] = []
    element.addEventListener('lintje-split-change', (event) =>
      heard.push((event as CustomEvent<number>).detail),
    )
    const strip = element.shadowRoot!.querySelector<HTMLElement>('.lintje-split-pane__strip')!
    const click = (): void => {
      strip.dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerId: 1 }))
      strip.dispatchEvent(new PointerEvent('pointerup', { button: 0, pointerId: 1 }))
    }
    click()
    click()
    strip.dispatchEvent(new MouseEvent('dblclick'))
    expect(heard).toEqual([50])
    click()
    click()
    strip.dispatchEvent(new MouseEvent('dblclick'))
    expect(heard).toEqual([50])
  })

  it('lifts the split with a click on the strip and places it with the next click', async () => {
    const element = await mount()
    const heard: number[] = []
    element.addEventListener('lintje-split-change', (event) =>
      heard.push((event as CustomEvent<number>).detail),
    )
    const root = element.shadowRoot!
    const block = root.querySelector<HTMLElement>('.lintje-split-pane')!
    block.getBoundingClientRect = () => ({ left: 0, width: 1000 }) as DOMRect
    const strip = root.querySelector<HTMLElement>('.lintje-split-pane__strip')!
    const pane = root.querySelector<HTMLElement>('.lintje-split-pane__pane--end')!
    const pointer = (target: HTMLElement, type: string, clientX: number): PointerEvent => {
      const event = new PointerEvent(type, {
        button: 0,
        pointerId: 1,
        clientX,
        bubbles: true,
        composed: true,
        cancelable: true,
      })
      target.dispatchEvent(event)
      return event
    }

    pointer(strip, 'pointerdown', 500)
    pointer(strip, 'pointerup', 501)
    pointer(pane, 'pointermove', 640)
    expect(element.value).toBe(64)
    expect(heard).toEqual([])
    pointer(pane, 'pointerdown', 700)
    expect(element.value).toBe(70)
    expect(heard).toEqual([70])
    // The placing click does not also press what it landed on.
    const click = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true })
    pane.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    pointer(strip, 'pointerup', 700)

    // Escape, or a press outside, puts a lifted split back.
    pointer(strip, 'pointerdown', 700)
    pointer(strip, 'pointerup', 700)
    pointer(pane, 'pointermove', 300)
    expect(element.value).toBe(30)
    press(element, 'Escape')
    expect(element.value).toBe(70)
    pointer(strip, 'pointerdown', 700)
    pointer(strip, 'pointerup', 700)
    pointer(pane, 'pointermove', 300)
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    expect(element.value).toBe(70)
    expect(heard).toEqual([70])
    element.remove()
  })

  it('moves with the keys, reports every step that moves it and stops at the limits', async () => {
    const element = await mount()
    const heard: number[] = []
    element.addEventListener('lintje-split-change', (event) =>
      heard.push((event as CustomEvent<number>).detail),
    )
    press(element, 'ArrowRight')
    press(element, 'End')
    press(element, 'ArrowRight')
    press(element, 'Enter')
    press(element, 'Home')
    press(element, 'x')
    await element.updateComplete
    expect(heard).toEqual([55, 80, 50, 20])
    expect(handle(element).getAttribute('aria-valuenow')).toBe('20')
  })

  it('remembers the split under its storage key', async () => {
    localStorage.setItem('vertalen', '35')
    const element = await mount({ storageKey: 'vertalen' })
    expect(element.value).toBe(35)
    press(element, 'ArrowLeft')
    expect(localStorage.getItem('vertalen')).toBe('30')
  })

  it('stores nothing without a key and keeps a stored value within the limits', async () => {
    const element = await mount()
    press(element, 'ArrowLeft')
    expect(localStorage.length).toBe(0)
    localStorage.setItem('smal', '5')
    const clamped = await mount({ storageKey: 'smal' })
    expect(clamped.value).toBe(20)
  })
})

describe('split arithmetic', () => {
  it('clamps to the limits', () => {
    expect(clampSplit(10, 20, 80)).toBe(20)
    expect(clampSplit(90, 20, 80)).toBe(80)
    expect(clampSplit(42, 20, 80)).toBe(42)
  })

  it('reads the split from the pointer, in whole percents', () => {
    expect(splitFromPointer(400, 100, 800, 20, 80)).toBe(38)
    expect(splitFromPointer(120, 100, 800, 20, 80)).toBe(20)
    expect(splitFromPointer(400, 100, 0, 20, 80)).toBe(50)
  })

  it('answers the arrows, Home, End and Enter only', () => {
    expect(splitFromKey('ArrowLeft', 50, 20, 80)).toBe(45)
    expect(splitFromKey('Home', 50, 20, 80)).toBe(20)
    expect(splitFromKey('Enter', 70, 20, 80)).toBe(50)
    expect(splitFromKey('ArrowUp', 50, 20, 80)).toBeNull()
  })
})
