/**
 * An icon with a label keeps its text alternative: while its file loads the empty box is the
 * labelled image, and `<lintje-icon label>` without a file says its label as hidden text.
 */
import { html, nothing, render } from 'lit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadIcon, resetIcons, setIconSource } from '../../../icons/loader'
import { renderIcon } from '../../../icons/render'
import './icon'
import type { LintjeIcon } from './icon'

const NAME = 'functioneel-niet-in-de-bundel'

beforeEach(() => {
  resetIcons()
  setIconSource({ base: '/icons/' })
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetIcons()
  document.body.innerHTML = ''
})

/** A fetch that never answers: the file stays on its way. */
const loading = (): void => {
  vi.stubGlobal('fetch', () => new Promise(() => {}))
}

/** A fetch that answers 404: the name has no file. */
const absent = async (): Promise<void> => {
  vi.stubGlobal('fetch', async () => ({ ok: false, status: 404, text: async () => '' }))
  await loadIcon(NAME)
}

function drawn(template: ReturnType<typeof renderIcon>): HTMLElement {
  const host = document.createElement('div')
  document.body.append(host)
  render(template === nothing ? nothing : html`${template}`, host)
  return host
}

async function mount(label?: string): Promise<LintjeIcon> {
  const icon = document.createElement('lintje-icon')
  icon.name = NAME
  if (label) icon.label = label
  document.body.append(icon)
  await icon.updateComplete
  return icon
}

describe('renderIcon while the file loads', () => {
  it('makes the empty box the image with the label', () => {
    loading()
    const box = drawn(renderIcon(NAME, { label: 'Gelukt' })).querySelector('svg')!
    expect(box.classList.contains('lintje-icon--pending')).toBe(true)
    expect(box.getAttribute('role')).toBe('img')
    expect(box.getAttribute('aria-label')).toBe('Gelukt')
    expect(box.hasAttribute('aria-hidden')).toBe(false)
  })

  it('hides the empty box without a label', () => {
    loading()
    const box = drawn(renderIcon(NAME)).querySelector('svg')!
    expect(box.getAttribute('aria-hidden')).toBe('true')
    expect(box.hasAttribute('role')).toBe(false)
  })

  it('draws nothing without a file, so the component shows its own word', async () => {
    await absent()
    expect(renderIcon(NAME, { label: 'Gelukt' })).toBe(nothing)
  })
})

describe('<lintje-icon label>', () => {
  it('carries the label while the file loads', async () => {
    loading()
    const box = (await mount('Gelukt')).shadowRoot!.querySelector('svg')!
    expect(box.getAttribute('role')).toBe('img')
    expect(box.getAttribute('aria-label')).toBe('Gelukt')
  })

  it('says the label as hidden text without a file', async () => {
    await absent()
    const root = (await mount('Gelukt')).shadowRoot!
    expect(root.querySelector('svg')).toBeNull()
    const text = root.querySelector('.visually-hidden')!
    expect(text.textContent).toBe('Gelukt')
  })

  it('draws nothing without a file and without a label: it was decorative', async () => {
    await absent()
    const root = (await mount()).shadowRoot!
    expect(root.querySelector('svg, .visually-hidden')).toBeNull()
  })
})
