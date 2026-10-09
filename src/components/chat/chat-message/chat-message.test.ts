/**
 * `<lintje-chat-message>`: the role is a hidden word, a term is a marked stretch
 * of the text, and editing is an input frame that asks again through an event.
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { describe, expect, it } from 'vitest'
import './chat-message'
import type { LintjeChatMessage } from './chat-message'

// Read from disk, not imported: vitest does not run the CSS pipeline, so an
// `?inline` import comes back empty.
const messageCss = readFileSync(
  resolvePath('src/components/chat/chat-message/chat-message.css'),
  'utf8',
)

async function message(props: Partial<LintjeChatMessage>): Promise<LintjeChatMessage> {
  const element = document.createElement('lintje-chat-message')
  Object.assign(element, { text: 'Hoe lang was de wachttijd in Zuid?' }, props)
  document.body.append(element)
  await element.updateComplete
  return element
}

describe('lintje-chat-message', () => {
  it('carries the role in a visually hidden word', async () => {
    const element = await message({})
    const text = element.renderRoot.querySelector('.lintje-chat-message__text')
    expect(text?.querySelector('.visually-hidden')?.textContent).toBe('Jij: ')
    expect(text?.textContent).toBe('Jij: Hoe lang was de wachttijd in Zuid?')
  })

  it('underlines a term, and marks an uncertain one', async () => {
    const element = await message({
      terms: [
        { start: 16, end: 25, kind: 'Definitie' },
        { start: 29, end: 33, kind: 'Regio of loket?', certain: false },
      ],
    })
    const terms = [...element.renderRoot.querySelectorAll('.lintje-chat-message__term')]
    expect(terms.map((term) => term.textContent)).toEqual(['wachttijd', 'Zuid'])
    expect(terms.map((term) => term.classList.contains('is-uncertain'))).toEqual([false, true])
    expect(terms[0].getAttribute('title')).toBe('Definitie')
  })

  it('shows the edit button only when editable', async () => {
    const fixed = await message({})
    expect(fixed.renderRoot.querySelector('lintje-icon-button')).toBeNull()
    const editable = await message({ editable: true })
    expect(editable.renderRoot.querySelector('lintje-icon-button')?.getAttribute('label')).toBe(
      'Vraag bewerken',
    )
    // The icon button's one box with its 48 px hit area: no size of its own.
    expect(editable.renderRoot.querySelector('lintje-icon-button')?.hasAttribute('size')).toBe(
      false,
    )
  })

  it('edits in the question box and asks again with one event', async () => {
    const element = await message({ editable: true, turnId: 't1' })
    const local: unknown[] = []
    const sent: unknown[] = []
    element.addEventListener('lintje-editing-change', (event) =>
      local.push((event as CustomEvent).detail),
    )
    document.addEventListener('lintje-message-edit', (event) =>
      sent.push((event as CustomEvent).detail),
    )

    element.renderRoot.querySelector<HTMLElement>('lintje-icon-button')?.click()
    await element.updateComplete
    const frame = element.renderRoot.querySelector('lintje-chat-composer')
    expect(frame?.getAttribute('variant')).toBe('edit')
    expect(frame?.text).toBe('Hoe lang was de wachttijd in Zuid?')

    frame?.dispatchEvent(
      new CustomEvent('lintje-submit', {
        detail: { text: 'Hoe lang in Maastricht?', terms: [] },
        bubbles: true,
      }),
    )
    await element.updateComplete

    expect(sent).toEqual([{ turnId: 't1', text: 'Hoe lang in Maastricht?', terms: [] }])
    expect(local).toEqual([
      { turnId: 't1', editing: true },
      { turnId: 't1', editing: false },
    ])
    expect(element.editing).toBe(false)
  })

  it('keeps the question apart with a line when forced colours drop its fill', () => {
    const forced = messageCss.slice(messageCss.indexOf('@media (forced-colors: active)'))
    expect(forced).toMatch(/\.lintje-chat-message__text\s*\{[^}]*outline: 1px solid CanvasText/)
  })

  it('cancels and sends nothing', async () => {
    const element = await message({ editable: true, editing: true })
    const sent: unknown[] = []
    element.addEventListener('lintje-message-edit', (event) => sent.push(event))
    element.renderRoot
      .querySelector('lintje-chat-composer')
      ?.dispatchEvent(new CustomEvent('lintje-cancel', { bubbles: true }))
    await element.updateComplete
    expect(element.editing).toBe(false)
    expect(sent).toEqual([])
  })
})
