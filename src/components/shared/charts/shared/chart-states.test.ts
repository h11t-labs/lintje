/**
 * The error state of `chart-states.ts`: who announces it. Without an announcement of its own
 * the caller gets the live `<lintje-announcement>`; a host may pass its own.
 */
import { html, render } from 'lit'
import { describe, expect, it } from 'vitest'
import { liveAnnouncement, renderChartError, renderChartSkeleton } from './chart-states'

function mount(template: ReturnType<typeof renderChartError>): HTMLElement {
  const host = document.createElement('div')
  render(template, host)
  return host
}

describe('renderChartError', () => {
  it('writes the live announcement when the caller passes none, never a region full of words', () => {
    const host = mount(renderChartError({ message: 'De bron reageerde niet.' }))
    // A `role="status"` inserted together with its text is not announced: the live
    // `<lintje-announcement>` draws its region empty and fills it.
    expect(host.querySelector('[role="status"]')).toBeNull()
    const notice = host.querySelector('lintje-announcement') as
      | (HTMLElement & { data?: unknown })
      | null
    expect(notice?.data).toEqual({ kind: 'warning', text: 'De bron reageerde niet.', live: true })
  })

  it('takes the announcement a component passes instead, and keeps the last known value', () => {
    const host = mount(
      renderChartError({
        message: 'Weg.',
        lastKnown: 'Laatst bekend: 11 min',
        announcement: (message) => html`<p class="own">${message}</p>`,
      }),
    )
    expect(host.querySelector('.lintje-announcement')).toBeNull()
    expect(host.querySelector('.own')?.textContent).toBe('Weg.')
    expect(host.querySelector('.lintje-chart-state__last-known')?.textContent).toBe(
      'Laatst bekend: 11 min',
    )
  })

  it('liveAnnouncement: a compact warning with `live`, for a load that failed just now', () => {
    const host = mount(renderChartError({ message: 'Weg.', announcement: liveAnnouncement }))
    const notice = host.querySelector('lintje-announcement') as
      | (HTMLElement & { data?: unknown })
      | null
    expect(notice?.hasAttribute('compact')).toBe(true)
    expect(notice?.data).toEqual({ kind: 'warning', text: 'Weg.', live: true })
  })
})

describe('renderChartSkeleton', () => {
  it('says that it loads in words inside its status, not only in a label', () => {
    const host = document.createElement('div')
    render(renderChartSkeleton({ kind: 'bar' }), host)
    const status = host.querySelector('[role="status"]')
    expect(status?.hasAttribute('aria-label')).toBe(false)
    expect(status?.querySelector('.visually-hidden')?.textContent).toBe('Gegevens laden…')
  })
})
