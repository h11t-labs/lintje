/** The AI label: made by a model, then checked by a person; no colour, no control. */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { describe, expect, it } from 'vitest'
import './ai-label'

async function mount(props: Record<string, unknown> = {}): Promise<ShadowRoot> {
  const element = Object.assign(document.createElement('lintje-ai-label'), props)
  document.body.append(element)
  await element.updateComplete
  return element.shadowRoot!
}

const words = (root: ShadowRoot): string =>
  root.querySelector('.lintje-ai-label__badge')!.textContent!.trim()
const hint = (root: ShadowRoot): string | undefined =>
  root.querySelector('.lintje-ai-label__hint')?.textContent?.trim()

describe('lintje-ai-label', () => {
  it('says a model made it, in a neutral badge with the gear-and-brain mark, with the advice behind it', async () => {
    const root = await mount()
    expect(words(root)).toBe('Gemaakt door AI')
    expect(root.querySelector('.lintje-badge')!.classList.contains('lintje-badge--neutral')).toBe(
      true,
    )
    expect(root.querySelector('svg')).not.toBeNull()
    expect(hint(root)).toBe('Controleer de tekst voor je hem gebruikt')
  })

  it('names who checked it and drops the advice', async () => {
    const root = await mount({ checkedBy: 'J. de Vries' })
    expect(words(root)).toBe('Gecontroleerd door J. de Vries')
    expect(root.querySelector('.lintje-badge')!.classList.contains('lintje-badge--neutral')).toBe(
      true,
    )
    expect(hint(root)).toBeUndefined()
  })

  it('takes a hint of its own', async () => {
    const root = await mount({ hint: 'Vertaald uit het Engels' })
    expect(hint(root)).toBe('Vertaald uit het Engels')
  })

  it('is plain text: no button, no live region', async () => {
    const root = await mount()
    expect(root.querySelector('button, [role], [aria-live]')).toBeNull()
  })

  it('lets its own badge wrap, so a long name stays inside a 390 px screen', async () => {
    const root = await mount({ checkedBy: 'mr. dr. A.B.C. van den Heuvel-Oosterbroek' })
    const box = root.querySelector('.lintje-badge')!
    // Drawn in the label's own root, so the label's stylesheet reaches the box.
    expect(root.querySelector('lintje-badge')).toBeNull()
    expect(box.classList.contains('lintje-ai-label__box')).toBe(true)
    expect(box.textContent).toContain('van den Heuvel-Oosterbroek')
    // Read from disk: vitest does not run the CSS pipeline.
    const css = readFileSync(resolvePath('src/components/feedback/ai-label/ai-label.css'), 'utf8')
    const rule = /\.lintje-ai-label__box\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(rule).toMatch(/white-space:\s*normal/)
    expect(rule).toMatch(/max-width:\s*100%/)
    expect(rule).toMatch(/min-height:\s*1\.5rem/)
  })
})
