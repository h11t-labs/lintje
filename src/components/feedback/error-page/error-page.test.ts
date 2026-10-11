/** The error page: the code with its mark, a real heading, the reference and the way onward. */
import { describe, expect, it } from 'vitest'
import './error-page'
import type { LintjeErrorPage } from './error-page'

async function mount(props: Partial<LintjeErrorPage>, child = ''): Promise<LintjeErrorPage> {
  const element = Object.assign(document.createElement('lintje-error-page'), props)
  document.body.append(element)
  await element.updateComplete
  // happy-dom fires `slotchange` only for content that arrives after the first render.
  element.innerHTML = child
  await new Promise((resolve) => setTimeout(resolve))
  await element.updateComplete
  return element
}

describe('lintje-error-page', () => {
  it('draws the code line and the heading at its level', async () => {
    const element = await mount({ code: '404', heading: 'Deze pagina bestaat niet' })
    const root = element.shadowRoot!
    expect(root.querySelector('.lintje-error-page__code')!.textContent).toContain('Foutcode 404')
    expect(root.querySelector('h2')!.textContent).toBe('Deze pagina bestaat niet')

    const alone = await mount({ code: '500', heading: 'Er ging iets mis', level: 1 })
    expect(alone.shadowRoot!.querySelector('h1')).not.toBeNull()
    expect(alone.shadowRoot!.querySelector('h2')).toBeNull()
  })

  it('marks no access and a failure, and leaves a missing page unmarked', async () => {
    const mark = async (code: string): Promise<Element | null> =>
      (await mount({ code, heading: 'x' })).shadowRoot!.querySelector('.lintje-error-page__mark')
    expect((await mark('403'))!.classList.contains('lintje-error-page__mark--lock')).toBe(true)
    expect((await mark('503'))!.classList.contains('lintje-error-page__mark--error')).toBe(true)
    expect(await mark('404')).toBeNull()
  })

  it('has no code line without a code', async () => {
    const element = await mount({ heading: 'Meldingen is even niet beschikbaar' })
    expect(element.shadowRoot!.querySelector('.lintje-error-page__code')).toBeNull()
  })

  it('gives a reference with a copy button and the moment', async () => {
    const element = await mount({
      code: '500',
      heading: 'Er ging iets mis',
      reference: '7F3A-91C2-4D0B',
      occurred: '11 oktober 2026, 14.32 uur',
    })
    const root = element.shadowRoot!
    const list = root.querySelector('lintje-description-list')!
    expect(list.items.map((item) => item.label)).toEqual(['Referentie', 'Tijdstip'])
    expect(root.querySelector('lintje-copy-button')!.getAttribute('text')).toBe('7F3A-91C2-4D0B')
  })

  it('hides the actions without an action and shows them with one', async () => {
    const bare = await mount({ heading: 'x' })
    const actions = (el: LintjeErrorPage): Element =>
      el.shadowRoot!.querySelector('.lintje-error-page__actions')!
    expect(actions(bare).classList.contains('is-empty')).toBe(true)
    const withAction = await mount(
      { heading: 'x' },
      '<button slot="actions">Opnieuw proberen</button>',
    )
    expect(actions(withAction).classList.contains('is-empty')).toBe(false)
  })

  it('lists the way onward and reports a plain click as lintje-navigate', async () => {
    const element = await mount({
      heading: 'Deze pagina bestaat niet',
      links: [
        { label: 'Het overzicht', href: '/overzicht' },
        { label: 'Hulp en contact', href: '/hulp' },
      ],
    })
    const root = element.shadowRoot!
    expect(root.querySelector('h3')!.textContent).toBe('Verder naar')
    const links = [...root.querySelectorAll<HTMLAnchorElement>('.lintje-error-page__link')]
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/overzicht', '/hulp'])

    const seen: unknown[] = []
    element.addEventListener('lintje-navigate', (event) => {
      seen.push((event as CustomEvent).detail)
      event.preventDefault()
    })
    links[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
    expect(seen).toEqual([{ href: '/overzicht' }])
  })
})
