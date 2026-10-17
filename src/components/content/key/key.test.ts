/** The key: a `kbd` with Lintje's key class, its text from the content or from `key`. */
import { describe, expect, it } from 'vitest'
import './key'

async function mount(props: Record<string, unknown>, text = ''): Promise<HTMLElement> {
  const element = Object.assign(document.createElement('lintje-key'), props)
  element.textContent = text
  document.body.append(element)
  await element.updateComplete
  return element
}

/** The text the key shows: what its slot holds, else the slot's fallback. */
function shown(element: HTMLElement): string {
  const slot = element.shadowRoot!.querySelector('kbd slot') as HTMLSlotElement
  const assigned = slot.assignedNodes()
  return (assigned.length ? assigned : [...slot.childNodes])
    .filter((node) => node.nodeType !== Node.COMMENT_NODE)
    .map((node) => node.textContent)
    .join('')
    .trim()
}

describe('lintje-key', () => {
  it('draws a kbd with the class lintje-key', async () => {
    const element = await mount({}, 'Ctrl')
    const kbd = element.shadowRoot!.querySelector('kbd')!
    expect(kbd.classList.contains('lintje-key')).toBe(true)
    expect(shown(element)).toBe('Ctrl')
  })

  it('takes its text from key when it has no content', async () => {
    const element = await mount({ key: '/' })
    expect(shown(element)).toBe('/')
  })

  it('prefers the content over key', async () => {
    const element = await mount({ key: 'S' }, 'Enter')
    expect(shown(element)).toBe('Enter')
  })

  it('is no control: nothing in it takes the focus', async () => {
    const element = await mount({}, '↑')
    expect(element.shadowRoot!.querySelector('button, [tabindex]')).toBeNull()
    expect(element.hasAttribute('tabindex')).toBe(false)
  })
})
