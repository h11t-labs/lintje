/** The badge: the word is the status; a bare number gets words for a screen reader. */
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { render } from 'lit'
import { describe, expect, it } from 'vitest'
import { LintjeBadge, badgeStyles, renderBadge } from './badge'

async function mount(props: Record<string, unknown>, text: string): Promise<HTMLElement> {
  const element = Object.assign(document.createElement('lintje-badge'), props)
  element.textContent = text
  document.body.append(element)
  await element.updateComplete
  return element.shadowRoot!.querySelector<HTMLElement>('.lintje-badge')!
}

describe('lintje-badge', () => {
  it('takes its tone as a class', async () => {
    const badge = await mount({ tone: 'error' }, 'Mislukt')
    expect(badge.classList.contains('lintje-badge--error')).toBe(true)
    expect(badge.classList.contains('lintje-badge--label')).toBe(true)
  })

  it('a counter ignores the tone and reads its label instead of the number', async () => {
    const badge = await mount({ variant: 'unread', tone: 'error', label: '12 ongelezen' }, '12')
    expect(badge.classList.contains('lintje-badge--unread')).toBe(true)
    expect(badge.classList.contains('lintje-badge--error')).toBe(false)
    expect(badge.querySelector('.visually-hidden')!.textContent).toBe('12 ongelezen')
    expect(badge.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('draws info and attention as status fills', async () => {
    const info = await mount({ tone: 'info' }, 'Nieuw')
    expect(info.classList.contains('lintje-badge--info')).toBe(true)
    const attention = await mount({ tone: 'attention' }, 'Let op')
    expect(attention.classList.contains('lintje-badge--attention')).toBe(true)
  })
})

describe('renderBadge', () => {
  it('draws the same badge in another root, with its classes and its spoken label', () => {
    const host = document.createElement('div')
    document.body.append(host)
    render(
      renderBadge({
        value: 3,
        variant: 'unread',
        surface: 'nav',
        muted: true,
        label: '3 nieuwe meldingen',
        className: 'a__badge a__badge--count',
      }),
      host,
    )
    const badge = host.querySelector<HTMLElement>('.lintje-badge')!
    expect([...badge.classList].sort()).toEqual(
      [
        'a__badge',
        'a__badge--count',
        'is-muted',
        'lintje-badge',
        'lintje-badge--nav',
        'lintje-badge--unread',
      ].sort(),
    )
    expect(badge.querySelector('[aria-hidden="true"]')!.textContent).toBe('3')
    expect(badge.querySelector('.visually-hidden')!.textContent).toBe('3 nieuwe meldingen')
  })

  it('shares one stylesheet with the element and holds no host rule', () => {
    expect(LintjeBadge.styles).toContain(badgeStyles)
    // Read from disk: vitest hands a `?inline` stylesheet over empty.
    const css = readFileSync(resolvePath('src/primitives/badge/badge.css'), 'utf8')
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain(':host')
  })
})
