import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './find'
import type { LintjeFind } from './find'

async function mount(props: Partial<LintjeFind> = {}): Promise<LintjeFind> {
  const element = document.createElement('lintje-find')
  Object.assign(element, props)
  document.body.append(element)
  await element.updateComplete
  return element
}

const part = <T extends Element = HTMLElement>(element: LintjeFind, selector: string): T | null =>
  element.renderRoot.querySelector<T>(selector)

const control = (element: LintjeFind): HTMLInputElement => part(element, '.lintje-find__control')!
const count = (element: LintjeFind): string =>
  part(element, '.lintje-find__count')?.textContent?.trim() ?? ''
const button = (element: LintjeFind, kind: string): HTMLButtonElement =>
  part(element, `.lintje-find__button--${kind}`)!
const status = (element: LintjeFind): string =>
  part(element, '[role="status"]')?.textContent?.trim() ?? ''

function listen(element: LintjeFind, name: string): unknown[] {
  const seen: unknown[] = []
  element.addEventListener(name, (event) => seen.push((event as CustomEvent).detail))
  return seen
}

function type(element: LintjeFind, text: string): void {
  const input = control(element)
  input.value = text
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function press(element: LintjeFind, key: string, shiftKey = false): void {
  control(element).dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }))
}

/** Every update done, also the one a status region asks for from `updated()`. */
async function settled(element: LintjeFind): Promise<void> {
  while (!(await element.updateComplete));
}

/** A host that counts: busy on a new term, then its answer, with no hits. */
async function answerNone(element: LintjeFind, term: string): Promise<void> {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  type(element, term)
  vi.advanceTimersByTime(300)
  vi.useRealTimers()
  await settled(element)
  element.busy = false
  element.total = 0
  element.current = 0
  await settled(element)
}

/** Two frames: the status region is emptied, then filled a frame later. */
async function spoken(element: LintjeFind): Promise<string> {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  await element.updateComplete
  return status(element)
}

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.useRealTimers()
})

describe('lintje-find count', () => {
  it('shows no count and no buttons while empty', async () => {
    const element = await mount()
    expect(part(element, '.lintje-find__count')).toBeNull()
    expect(part(element, '.lintje-find__button')).toBeNull()
  })

  it('names the current hit of the total', async () => {
    const element = await mount({ value: 'timeout', total: 7, current: 2 })
    expect(count(element)).toBe('2 van 7')
  })

  it('counts the hits before one is current', async () => {
    const element = await mount({ value: 'timeout', total: 1248, current: 0 })
    expect(count(element)).toBe('1.248 treffers')
  })

  it('says there are no hits, and cannot step', async () => {
    const element = await mount({ value: 'certificaat', total: 0 })
    expect(count(element)).toBe('Geen treffers')
    expect(button(element, 'previous').getAttribute('aria-disabled')).toBe('true')
    expect(button(element, 'next').getAttribute('aria-disabled')).toBe('true')
    expect(button(element, 'clear').hasAttribute('aria-disabled')).toBe(false)
  })

  it('says it is searching while the host counts', async () => {
    const element = await mount({ value: 'aanvraag', busy: true, total: 7, current: 1 })
    expect(count(element)).toBe('Zoeken…')
    expect(part(element, 'lintje-spinner')).not.toBeNull()
    expect(button(element, 'next').getAttribute('aria-disabled')).toBe('true')
  })

  it('points the field at the count', async () => {
    const element = await mount({ value: 'timeout', total: 7, current: 2 })
    const id = control(element).getAttribute('aria-describedby')
    expect(part(element, `#${id}`)?.textContent?.trim()).toBe('2 van 7')
  })
})

describe('lintje-find typing', () => {
  it('sends the term once, 300 ms after the last key', async () => {
    vi.useFakeTimers()
    const element = await mount()
    const seen = listen(element, 'lintje-change')
    type(element, 'tim')
    vi.advanceTimersByTime(200)
    type(element, 'timeout')
    vi.advanceTimersByTime(299)
    expect(seen).toEqual([])
    vi.advanceTimersByTime(1)
    expect(seen).toEqual(['timeout'])
  })

  it('tells a host with a name the term as a filter value', async () => {
    vi.useFakeTimers()
    const element = await mount({ name: 'zoek' })
    const seen = listen(element, 'lintje-values-change')
    type(element, 'timeout')
    vi.advanceTimersByTime(300)
    expect(seen).toEqual([{ zoek: 'timeout' }])
  })

  it('sends a pending term on Enter instead of stepping', async () => {
    vi.useFakeTimers()
    const element = await mount()
    const terms = listen(element, 'lintje-change')
    const steps = listen(element, 'lintje-find-step')
    type(element, 'timeout')
    press(element, 'Enter')
    expect(terms).toEqual(['timeout'])
    expect(steps).toEqual([])
  })
})

describe('lintje-find steps', () => {
  it('steps forward on Enter and back on Shift+Enter', async () => {
    const element = await mount({ value: 'timeout', total: 7, current: 2 })
    const steps = listen(element, 'lintje-find-step')
    press(element, 'Enter')
    press(element, 'Enter', true)
    expect(steps).toEqual([1, -1])
  })

  it('steps with the buttons', async () => {
    const element = await mount({ value: 'timeout', total: 7, current: 2 })
    const steps = listen(element, 'lintje-find-step')
    button(element, 'next').click()
    button(element, 'previous').click()
    expect(steps).toEqual([1, -1])
  })

  it('does not step without hits', async () => {
    const element = await mount({ value: 'certificaat', total: 0 })
    const steps = listen(element, 'lintje-find-step')
    press(element, 'Enter')
    button(element, 'next').click()
    expect(steps).toEqual([])
  })

  it('sends the step out of a shadow root to the host', async () => {
    const element = await mount({ value: 'timeout', total: 7, current: 2 })
    let composed = false
    element.addEventListener('lintje-find-step', (event) => (composed = event.composed))
    button(element, 'next').click()
    expect(composed).toBe(true)
  })
})

describe('lintje-find clearing', () => {
  it('clears on Escape and with the button, and sends the empty term', async () => {
    const element = await mount({ value: 'timeout', total: 7, current: 2 })
    const seen = listen(element, 'lintje-change')
    press(element, 'Escape')
    await element.updateComplete
    expect(element.value).toBe('')
    expect(seen).toEqual([''])
    expect(part(element, '.lintje-find__button')).toBeNull()
  })

  it('leaves Escape alone when the field is empty, for a dialog around it', async () => {
    const element = await mount()
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    control(element).dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })
})

describe('lintje-find status region', () => {
  it('reads the count out once after the host answers a term', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const element = await mount()
    element.addEventListener('lintje-change', () => {
      element.total = 7
      element.current = 1
    })
    type(element, 'timeout')
    vi.advanceTimersByTime(300)
    vi.useRealTimers()
    expect(await spoken(element)).toBe('1 van 7')
    element.total = 8
    expect(await spoken(element)).toBe('1 van 7')
  })

  it('reads out the position after a step', async () => {
    const element = await mount({ value: 'timeout', total: 7, current: 2 })
    element.addEventListener('lintje-find-step', (event) => {
      element.current += (event as CustomEvent<number>).detail
    })
    button(element, 'next').click()
    expect(await spoken(element)).toBe('3 van 7')
  })

  it('says when a step wraps round to the first hit', async () => {
    const element = await mount({ value: 'timeout', total: 7, current: 7 })
    element.addEventListener('lintje-find-step', () => (element.current = 1))
    press(element, 'Enter')
    expect(await spoken(element)).toBe('Terug bij de eerste treffer, 1 van 7')
  })

  it('says when a step back wraps round to the last hit', async () => {
    const element = await mount({ value: 'timeout', total: 7, current: 1 })
    element.addEventListener('lintje-find-step', () => (element.current = 7))
    press(element, 'Enter', true)
    expect(await spoken(element)).toBe('Terug bij de laatste treffer, 7 van 7')
  })

  it('says no hits twice when the host answers two terms in a row with none', async () => {
    const element = await mount()
    element.addEventListener('lintje-change', () => (element.busy = true))
    await answerNone(element, 'certificaat')
    expect(status(element)).toBe('')
    expect(await spoken(element)).toBe('Geen treffers')
    await answerNone(element, 'certificaten')
    expect(status(element)).toBe('')
    expect(await spoken(element)).toBe('Geen treffers')
  })

  it('stays empty when the field is cleared while a message is on its way', async () => {
    const element = await mount()
    element.addEventListener('lintje-change', () => (element.busy = true))
    await answerNone(element, 'certificaat')
    press(element, 'Escape')
    await settled(element)
    expect(element.value).toBe('')
    expect(await spoken(element)).toBe('')
  })

  it('stays quiet when the host changes the count on its own', async () => {
    const element = await mount({ value: 'timeout', total: 7, current: 2 })
    element.total = 9
    element.current = 3
    expect(await spoken(element)).toBe('')
  })
})
