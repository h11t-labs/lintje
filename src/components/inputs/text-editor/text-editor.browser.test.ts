/** The text editor in a browser: formats on a real selection, the link popover, and paste. */
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { deepActiveElement } from '../../../core/focus'
import './text-editor'
import type { LintjeTextEditor } from './text-editor'

async function mount(value: string): Promise<LintjeTextEditor> {
  const element = Object.assign(document.createElement('lintje-text-editor'), {
    label: 'Toelichting',
    value,
  })
  const outside = Object.assign(document.createElement('button'), { textContent: 'Verder' })
  document.body.append(element, outside)
  await element.updateComplete
  return element
}

const surface = (element: LintjeTextEditor): HTMLElement =>
  element.shadowRoot!.querySelector('.lintje-text-editor__surface')!
const tool = (element: LintjeTextEditor, label: string): HTMLButtonElement =>
  element.shadowRoot!.querySelector(`.lintje-text-editor__tool[aria-label="${label}"]`)!
const popover = (element: LintjeTextEditor): HTMLElement & { open: boolean } =>
  element.shadowRoot!.querySelector('lintje-popover')!
const linkInput = (element: LintjeTextEditor): HTMLInputElement | null =>
  element
    .shadowRoot!.querySelector('.lintje-text-editor__link-field')
    ?.shadowRoot?.querySelector('input') ?? null

// `selectionchange` is a queued task: the element sees the selection one turn later.
const turn = (): Promise<void> => new Promise((done) => setTimeout(done, 20))

/** Selects `text` in the surface, the way a reader would with the keyboard. */
async function select(element: LintjeTextEditor, text: string): Promise<void> {
  const walker = document.createTreeWalker(surface(element), NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const at = node.textContent!.indexOf(text)
    if (at === -1) continue
    surface(element).focus()
    document.getSelection()!.collapse(node, at)
    await userEvent.keyboard(`{Shift>}${'{ArrowRight}'.repeat(text.length)}{/Shift}`)
    await turn()
    await element.updateComplete
    return
  }
  throw new Error(`"${text}" is not in the surface`)
}

/** Puts the caret in `text` without selecting anything. */
async function caret(element: LintjeTextEditor, text: string): Promise<void> {
  await select(element, text)
  await userEvent.keyboard('{ArrowLeft}')
  await turn()
  await element.updateComplete
}

/** Focus leaves the element, and it commits. */
async function leave(element: LintjeTextEditor): Promise<void> {
  document.querySelector<HTMLButtonElement>('body > button')!.focus()
  await element.updateComplete
}

async function press(element: LintjeTextEditor, label: string): Promise<void> {
  await userEvent.click(tool(element, label))
  await turn()
  await element.updateComplete
}

function changes(element: LintjeTextEditor): string[] {
  const seen: string[] = []
  element.addEventListener('lintje-change', (event) => seen.push((event as CustomEvent).detail))
  return seen
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('lintje-text-editor formats the selection', () => {
  it('sees a selection inside its shadow root', async () => {
    const element = await mount('Het besluit volgt **binnen** acht weken.')
    expect(tool(element, 'Link').getAttribute('aria-disabled')).toBe('true')
    await select(element, 'binnen')
    expect(tool(element, 'Vet').getAttribute('aria-pressed')).toBe('true')
    expect(tool(element, 'Link').hasAttribute('aria-disabled')).toBe(false)
  })

  it('makes the selection bold, keeps it selected, and commits it on leaving', async () => {
    const element = await mount('Het besluit volgt binnen acht weken.')
    const seen = changes(element)
    await select(element, 'acht weken')
    await press(element, 'Vet')
    expect(surface(element).querySelector('b, strong')?.textContent).toBe('acht weken')
    expect(document.getSelection()!.toString()).toBe('acht weken')
    expect(tool(element, 'Vet').getAttribute('aria-pressed')).toBe('true')
    await leave(element)
    expect(seen).toEqual(['Het besluit volgt binnen **acht weken**.'])
  })

  it('makes the selection italic with Ctrl+I', async () => {
    const element = await mount('Het besluit volgt binnen acht weken.')
    await select(element, 'binnen')
    await userEvent.keyboard('{Control>}i{/Control}')
    await turn()
    await leave(element)
    expect(element.value).toBe('Het besluit volgt _binnen_ acht weken.')
  })

  it('turns the paragraph with the caret into a heading, and back', async () => {
    const element = await mount('Aanvraag\n\nHet besluit volgt binnen acht weken.')
    await caret(element, 'Aanvraag')
    await press(element, 'Kop')
    expect(surface(element).querySelector('h3')?.textContent).toBe('Aanvraag')
    expect(tool(element, 'Kop').getAttribute('aria-pressed')).toBe('true')
    await press(element, 'Kop')
    expect(surface(element).querySelector('h3')).toBeNull()
    await press(element, 'Kop')
    await leave(element)
    expect(element.value).toBe('### Aanvraag\n\nHet besluit volgt binnen acht weken.')
  })

  it('turns the paragraph with the caret into a bullet', async () => {
    const element = await mount('Neem mee:\n\nuw paspoort')
    await caret(element, 'paspoort')
    await press(element, 'Opsomming')
    expect(surface(element).querySelector('ul > li')?.textContent).toBe('uw paspoort')
    expect(tool(element, 'Opsomming').getAttribute('aria-pressed')).toBe('true')
    await leave(element)
    expect(element.value).toBe('Neem mee:\n\n- uw paspoort')
  })
})

describe('lintje-text-editor adds a link in a popover', () => {
  it('opens on the selection with the focus in the field, and places the link on Enter', async () => {
    const element = await mount('Lees meer op de website.')
    await select(element, 'de website')
    await press(element, 'Link')
    expect(popover(element).open).toBe(true)
    await expect.poll(() => deepActiveElement()).toBe(linkInput(element))
    await userEvent.keyboard('https://www.rijksoverheid.nl{Enter}')
    await turn()
    await element.updateComplete
    expect(popover(element).open).toBe(false)
    expect(deepActiveElement()).toBe(surface(element))
    const anchor = surface(element).querySelector('a')!
    expect(anchor.getAttribute('href')).toBe('https://www.rijksoverheid.nl')
    expect(anchor.textContent).toBe('de website')
    expect(tool(element, 'Link').getAttribute('aria-pressed')).toBe('true')
    await leave(element)
    expect(element.value).toBe('Lees meer op [de website](https://www.rijksoverheid.nl).')
  })

  it('refuses a script address and stays open with the error', async () => {
    const element = await mount('Lees meer op de website.')
    await select(element, 'de website')
    await press(element, 'Link')
    await expect.poll(() => deepActiveElement()).toBe(linkInput(element))
    await userEvent.keyboard('javascript:alert(1){Enter}')
    await element.updateComplete
    expect(popover(element).open).toBe(true)
    const field = element.shadowRoot!.querySelector('.lintje-text-editor__link-field')!
    expect(field.getAttribute('error')).toMatch(/webadres/)
    expect(surface(element).querySelector('a')).toBeNull()
  })

  it('closes on Escape with the focus and the selection back in the surface', async () => {
    const element = await mount('Lees meer op de website.')
    await select(element, 'de website')
    await press(element, 'Link')
    await expect.poll(() => deepActiveElement()).toBe(linkInput(element))
    await userEvent.keyboard('{Escape}')
    await element.updateComplete
    expect(popover(element).open).toBe(false)
    expect(deepActiveElement()).toBe(surface(element))
    expect(document.getSelection()!.toString()).toBe('de website')
    expect(surface(element).querySelector('a')).toBeNull()
  })

  it('removes a link from the caret, so it can be placed again with another address', async () => {
    const element = await mount('Lees meer op [de website](https://www.example.nl).')
    await caret(element, 'website')
    expect(tool(element, 'Link').getAttribute('aria-pressed')).toBe('true')
    await press(element, 'Link')
    expect(surface(element).querySelector('a')).toBeNull()
    await select(element, 'de website')
    await press(element, 'Link')
    await expect.poll(() => deepActiveElement()).toBe(linkInput(element))
    await userEvent.keyboard('https://www.rijksoverheid.nl{Enter}')
    await turn()
    await leave(element)
    expect(element.value).toBe('Lees meer op [de website](https://www.rijksoverheid.nl).')
  })
})

/** Whether a paste event a script makes carries the data it was given; without it no test can paste. */
const scriptsPaste = ((): boolean => {
  const data = new DataTransfer()
  data.setData('text/plain', 'x')
  return (
    new ClipboardEvent('paste', { clipboardData: data }).clipboardData?.getData('text/plain') ===
    'x'
  )
})()

describe.skipIf(!scriptsPaste)('lintje-text-editor pastes only what it can write', () => {
  async function paste(element: LintjeTextEditor, data: Record<string, string>): Promise<void> {
    const clipboardData = new DataTransfer()
    for (const [type, value] of Object.entries(data)) clipboardData.setData(type, value)
    surface(element).dispatchEvent(
      new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }),
    )
    await turn()
  }

  it('pastes plain text as text, not as markdown', async () => {
    const element = await mount('Totaal: 6')
    await select(element, '6')
    await paste(element, { 'text/plain': '2 * 3 = 6' })
    expect(surface(element).textContent).toBe('Totaal: 2 * 3 = 6')
    await leave(element)
    expect(element.value).toBe('Totaal: 2 \\* 3 = 6')
  })

  it('pastes HTML reduced to the five formats, without scripts, styles or unsafe links', async () => {
    const element = await mount('Start')
    await select(element, 'Start')
    await paste(element, {
      'text/html':
        '<h1 style="color:red">Openingstijden</h1>' +
        '<p>Wij zijn <span style="font-weight:700">maandag</span> open.' +
        '<script>window.pasted = true</script>' +
        '<a href="javascript:window.pasted = true">Klik</a>' +
        '<img src="x" alt="kaart" onerror="window.pasted = true"></p>',
      'text/plain': 'Openingstijden Wij zijn maandag open.',
    })
    const html = surface(element).innerHTML
    expect(html).not.toMatch(/<(script|span|img|h1)\b|style=|onerror|javascript:/)
    expect(surface(element).querySelector('h3')?.textContent).toBe('Openingstijden')
    expect(surface(element).querySelector('b, strong')?.textContent).toBe('maandag')
    expect((window as { pasted?: boolean }).pasted).toBeUndefined()
    await leave(element)
    expect(element.value).toBe('### Openingstijden\n\nWij zijn **maandag** open.Klikkaart')
  })
})
