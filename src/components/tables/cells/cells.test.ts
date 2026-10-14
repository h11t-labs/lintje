/** The cells: the facts of one thing, each a label above its value, with the meter in its words. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import './cells'
import type { LintjeCells } from './cells'
import type { LintjeLevelMeter } from '../../feedback/level-meter/level-meter'

async function mount(props: Partial<LintjeCells>): Promise<LintjeCells> {
  const element = Object.assign(document.createElement('lintje-cells'), props)
  document.body.append(element)
  await element.updateComplete
  return element
}

afterEach(() => document.body.replaceChildren())

describe('lintje-cells', () => {
  it('sets each fact as a label above its value, the key figure large', async () => {
    const element = await mount({
      items: [
        { label: 'Looptijd', value: '12:04', large: true, icon: 'functioneel-klok' },
        { label: 'Zaaknummer', value: '2026-04812' },
      ],
    })
    const root = element.shadowRoot!
    const cells = root.querySelectorAll('.lintje-cells__cell')
    expect(cells).toHaveLength(2)
    expect(cells[0]!.querySelector('dt')!.textContent).toContain('Looptijd')
    expect(cells[0]!.querySelector('dd')!.textContent).toContain('12:04')
    expect(cells[0]!.classList.contains('is-large')).toBe(true)
    expect(root.querySelector('.lintje-cells--grid')).toBeNull()
  })

  it('aligns the cells in a grid with columns, a wide one over two', async () => {
    const element = await mount({
      columns: 3,
      items: [
        { label: 'Naam', value: 'Uit het gesprek', span: 2 },
        { label: 'Taal', value: 'NL' },
      ],
    })
    const list = element.shadowRoot!.querySelector<HTMLElement>('.lintje-cells--grid')!
    expect(list.style.getPropertyValue('--lintje-columns')).toBe('3')
    expect(list.querySelector('.lintje-cells__cell.is-wide')).not.toBeNull()
    expect(element.getAttribute('columns')).toBe('3')
  })

  it('shows a dash for what it lacks, never zero, and says so, also beside a meter without a measure', async () => {
    const element = await mount({
      items: [
        { label: 'Resterend', value: null },
        { label: 'Geluid', value: null, meter: { level: null } },
      ],
    })
    const missing = element.shadowRoot!.querySelectorAll('.lintje-cells__missing')
    expect(missing).toHaveLength(2)
    expect(missing[1]!.textContent).toContain('—')
    expect(missing[1]!.textContent).toContain('geen waarde')
  })

  it('draws a meter before the word, hidden from the reader, and counts its steps in words', async () => {
    const element = await mount({
      items: [
        {
          label: 'Verbinding',
          value: 'Zwak',
          detail: '3 seconden achter',
          meter: { level: 0.5, steps: 4, tone: 'warning' },
        },
      ],
    })
    const dd = element.shadowRoot!.querySelector('dd')!
    const meter = dd.querySelector<LintjeLevelMeter>('lintje-level-meter')!
    expect(meter.getAttribute('aria-hidden')).toBe('true')
    expect(meter.steps).toBe(4)
    expect(meter.tone).toBe('warning')
    expect(meter.words).toBe(false)
    expect(dd.textContent!.replace(/\s+/g, ' ')).toContain('Zwak, 2 van 4')
    expect(dd.querySelector('.lintje-cells__detail')!.textContent).toBe('3 seconden achter')
  })

  it('carries a tone as a glyph, and what changed as "Aangepast" with its way back', async () => {
    const element = await mount({
      items: [
        { label: 'Termijn', value: 'Nog 3 dagen', tone: 'warning' },
        {
          label: 'Sprekers',
          value: '3, vast',
          tone: 'changed',
          action: { href: '#terug', label: 'Terugzetten' },
        },
        { label: 'Woordenlijsten', tags: ['Afkortingen', 'Namen'] },
      ],
    })
    const cells = element.shadowRoot!.querySelectorAll('.lintje-cells__cell')
    expect(cells[0]!.classList.contains('is-warning')).toBe(true)
    expect(cells[0]!.querySelector('dd .lintje-icon')).not.toBeNull()
    expect(cells[1]!.textContent).toContain('Aangepast')
    const action = cells[1]!.querySelector<HTMLAnchorElement>('.lintje-cells__action')!
    expect(action.textContent).toBe('Terugzetten')
    expect(action.getAttribute('aria-label')).toBe('Sprekers terugzetten')
    expect(cells[2]!.querySelectorAll('.lintje-cells__tag')).toHaveLength(2)
  })

  it('sends a plain click on a link as lintje-navigate and lets the host cancel it', async () => {
    const element = await mount({
      items: [{ label: 'Behandelaar', value: 'S. de Vries', href: '/mensen/1' }],
    })
    const seen = vi.fn((event: Event) => event.preventDefault())
    element.addEventListener('lintje-navigate', seen)
    const link = element.shadowRoot!.querySelector<HTMLAnchorElement>('.lintje-cells__link')!
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(click)
    expect(seen).toHaveBeenCalledOnce()
    expect((seen.mock.calls[0]![0] as CustomEvent).detail).toEqual({ href: '/mensen/1' })
    expect(click.defaultPrevented).toBe(true)
  })

  it('draws a slot under the value for what a string cannot say', async () => {
    const element = await mount({
      items: [{ label: 'Microfoon', value: 'We horen niets', tone: 'warning', slot: 'mic' }],
    })
    expect(
      element.shadowRoot!.querySelector('.lintje-cells__extra slot[name="mic"]'),
    ).not.toBeNull()
  })
})
