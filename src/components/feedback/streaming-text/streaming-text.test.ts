/** The streaming text: its five states, plain text only, and a screen reader hearing sentences. */
import { describe, expect, it } from 'vitest'
import './streaming-text'
import { sentenceEnd, type LintjeStreamingText } from './streaming-text'

async function mount(props: Record<string, unknown> = {}): Promise<LintjeStreamingText> {
  const element = Object.assign(document.createElement('lintje-streaming-text'), props)
  document.body.append(element)
  await element.updateComplete
  return element
}

async function set(element: LintjeStreamingText, props: Record<string, unknown>): Promise<void> {
  Object.assign(element, props)
  await element.updateComplete
}

const q = (element: LintjeStreamingText, selector: string): Element | null =>
  element.shadowRoot!.querySelector(selector)
const spoken = (element: LintjeStreamingText): string[] =>
  [...element.shadowRoot!.querySelectorAll('[aria-live] p')].map((p) => p.textContent!)

describe('sentenceEnd', () => {
  it('ends after the last stop that white space follows', () => {
    expect(sentenceEnd('Hij kwam aan. Daarna ging')).toBe(14)
    expect(sentenceEnd('Hij kwam om 3.')).toBe(0)
    expect(sentenceEnd('“Ja!” zei hij. En')).toBe(15)
  })
})

describe('lintje-streaming-text', () => {
  it('waits with a spinner and its label', async () => {
    const element = await mount({ label: 'Bezig met vertalen' })
    expect(q(element, 'lintje-spinner')).not.toBeNull()
    expect(q(element, '[role="status"]')!.textContent).toContain('Bezig met vertalen')
  })

  it('streams with a caret and a stop button, and sends lintje-stop', async () => {
    const element = await mount()
    await set(element, { state: 'streaming', text: 'De aanvrager <b>verklaarde</b>' })
    const box = q(element, '.lintje-streaming-text__box')!
    expect(box.getAttribute('aria-busy')).toBe('true')
    expect(box.querySelector('b')).toBeNull()
    expect(box.textContent).toContain('<b>verklaarde</b>')
    expect(q(element, '.lintje-streaming-text__caret')!.getAttribute('aria-hidden')).toBe('true')

    let stopped = 0
    element.addEventListener('lintje-stop', () => stopped++)
    q(element, 'lintje-button')!.dispatchEvent(new MouseEvent('click'))
    expect(stopped).toBe(1)
  })

  it('reads whole sentences, not words, and the rest at the end', async () => {
    const element = await mount({ state: 'streaming' })
    await set(element, { text: 'De aanvrager kwam' })
    expect(spoken(element)).toEqual([])
    await set(element, { text: 'De aanvrager kwam aan. Hij was' })
    expect(spoken(element)).toEqual(['De aanvrager kwam aan.'])
    await set(element, { text: 'De aanvrager kwam aan. Hij was moe', state: 'done' })
    expect(spoken(element)).toEqual(['De aanvrager kwam aan.', 'Hij was moe'])
  })

  it('starts over when the text is replaced', async () => {
    const element = await mount({ state: 'streaming', text: 'Eerste zin. Tweede' })
    expect(spoken(element)).toEqual(['Eerste zin.'])
    await set(element, { text: 'Iets anders. ' })
    expect(spoken(element)).toEqual(['Iets anders.'])
  })

  it('is done without caret or button, with the text as the slot fallback', async () => {
    const element = await mount({ state: 'done', text: 'Klaar.' })
    expect(q(element, '.lintje-streaming-text__caret')).toBeNull()
    expect(q(element, 'lintje-button')).toBeNull()
    expect(q(element, 'slot')!.textContent).toBe('Klaar.')
  })

  it('says it stopped and offers Opnieuw, which sends lintje-retry', async () => {
    const element = await mount({ state: 'streaming', text: 'Half af' })
    await set(element, { state: 'stopped' })
    expect(q(element, '.lintje-streaming-text__note')!.textContent).toBe('Gestopt')
    expect(spoken(element)).toEqual(['Half af', 'Gestopt'])
    let retried = 0
    element.addEventListener('lintje-retry', () => retried++)
    q(element, '.lintje-streaming-text__retry')!.dispatchEvent(new MouseEvent('click'))
    expect(retried).toBe(1)
  })

  it('hands the focus from Stoppen to Opnieuw', async () => {
    const element = await mount({ state: 'streaming', text: 'Half af' })
    q(element, 'lintje-button')!.dispatchEvent(new MouseEvent('click'))
    await set(element, { state: 'stopped' })
    const retry = q(element, '.lintje-streaming-text__retry') as HTMLElement & {
      updateComplete: Promise<unknown>
    }
    await retry.updateComplete
    await Promise.resolve()
    expect(element.shadowRoot!.activeElement).toBe(retry)
    expect(retry.shadowRoot!.activeElement).toBe(retry.shadowRoot!.querySelector('button'))
  })

  it('gives the focus to the finished text when the stream ends under Stoppen', async () => {
    const element = await mount({ state: 'streaming', text: 'Half af' })
    const stop = q(element, '.lintje-streaming-text__stop') as HTMLElement & {
      updateComplete: Promise<unknown>
    }
    await stop.updateComplete
    stop.shadowRoot!.querySelector('button')!.focus()
    await set(element, { state: 'done', text: 'Half af. Nu heel.' })
    expect(element.shadowRoot!.activeElement).toBe(q(element, '.lintje-streaming-text__box'))
  })

  it('says in the error colour that the text is not finished', async () => {
    const element = await mount({ state: 'error', text: 'Half af' })
    const note = q(element, '.lintje-streaming-text__note--error')!
    expect(note.textContent).toBe('De verbinding viel weg. De tekst is niet af.')
    expect(q(element, '.lintje-streaming-text__caret')).toBeNull()
    await set(element, { message: 'De server meldt een fout. De tekst is niet af.' })
    expect(note.textContent).toBe('De server meldt een fout. De tekst is niet af.')
  })
})

describe('lintje-streaming-text variant', () => {
  it('draws the box by default and leaves it out in the plain variant', async () => {
    const boxed = await mount({ text: 'Goedemorgen.', state: 'done' })
    expect(q(boxed, '.lintje-streaming-text--plain')).toBeNull()
    const plain = await mount({ text: 'Goedemorgen.', state: 'done', variant: 'plain' })
    expect(plain.getAttribute('variant')).toBe('plain')
    expect(q(plain, '.lintje-streaming-text--plain .lintje-streaming-text__box')).not.toBeNull()
  })
})
