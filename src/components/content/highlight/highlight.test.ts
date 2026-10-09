/** The highlight: the right element per kind, words for a screen reader, a term as a button. */
import { describe, expect, it } from 'vitest'
import './highlight'

async function mount(props: Record<string, unknown>, text = 'maandag'): Promise<ShadowRoot> {
  const element = Object.assign(document.createElement('lintje-highlight'), props)
  element.textContent = text
  document.body.append(element)
  await element.updateComplete
  return element.shadowRoot!
}

const hidden = (root: ShadowRoot): string[] =>
  [...root.querySelectorAll('.visually-hidden')].map((node) => node.textContent!.trim())

describe('lintje-highlight', () => {
  it('marks low confidence with words before and after', async () => {
    const root = await mount({ kind: 'uncertain' }, 'roostermaker')
    const mark = root.querySelector('mark')!
    expect(mark.classList.contains('lintje-highlight--uncertain')).toBe(true)
    expect(hidden(root)).toEqual(['begin markering lage zekerheid,', ', einde markering'])
  })

  it('frames the current search match and says which one it is', async () => {
    const other = await mount({ kind: 'match' })
    expect(other.querySelector('mark.is-current')).toBeNull()
    expect(hidden(other)[0]).toBe('begin markering zoekresultaat,')
    const current = await mount({ kind: 'match', current: true })
    expect(current.querySelector('mark.is-current')).not.toBeNull()
    expect(hidden(current)[0]).toBe('begin markering huidig zoekresultaat,')
  })

  it('draws a difference as del and ins, and says which in hidden words', async () => {
    const removed = await mount({ kind: 'removed' }, 'half uur')
    expect(removed.querySelector('del.lintje-highlight--removed')).not.toBeNull()
    expect(hidden(removed)).toEqual(['verwijderd:'])
    const added = await mount({ kind: 'added' }, 'kwartier')
    expect(added.querySelector('ins.lintje-highlight--added')).not.toBeNull()
    expect(hidden(added)).toEqual(['toegevoegd:'])
    const mine = await mount({ kind: 'removed', label: 'jouw versie' }, 'half uur')
    expect(hidden(mine)).toEqual(['jouw versie:'])
  })

  it('is a term mark without an explanation and a button with a tooltip with one', async () => {
    const plain = await mount({ kind: 'term' }, 'verblijfsvergunning')
    expect(plain.querySelector('mark.lintje-highlight--term')).not.toBeNull()
    expect(plain.querySelector('button')).toBeNull()

    const root = await mount(
      { kind: 'term', explanation: 'Woordenlijst: residence permit wordt verblijfsvergunning' },
      'verblijfsvergunning',
    )
    const tooltip = root.querySelector('lintje-tooltip')!
    await tooltip.updateComplete
    const button = tooltip.querySelector('button')!
    expect(button.getAttribute('type')).toBe('button')
    expect(button.classList.contains('lintje-highlight--control')).toBe(true)
    expect(button.getAttribute('aria-description')).toBe(
      'Woordenlijst: residence permit wordt verblijfsvergunning',
    )
  })
})
