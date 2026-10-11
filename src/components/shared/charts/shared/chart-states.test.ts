/**
 * The loading skeleton of `chart-states.ts`: on its own it is the status region, in words; in a
 * tile's `loading` slot it is decoration and the tile's region speaks.
 */
import { render } from 'lit'
import { describe, expect, it } from 'vitest'
import { renderChartSkeleton } from './chart-states'

function mount(template: ReturnType<typeof renderChartSkeleton>): HTMLElement {
  const host = document.createElement('div')
  render(template, host)
  return host
}

describe('renderChartSkeleton', () => {
  it('says that it loads in words inside its status, not only in a label', () => {
    const status = mount(renderChartSkeleton({ kind: 'bar' })).querySelector('[role="status"]')
    expect(status?.hasAttribute('aria-label')).toBe(false)
    expect(status?.querySelector('.visually-hidden')?.textContent).toBe('Gegevens laden…')
  })

  it('is hidden decoration without `status`: the tile around it announces', () => {
    const host = mount(renderChartSkeleton({ kind: 'bar', status: false }))
    expect(host.querySelector('[role="status"]')).toBeNull()
    expect(host.querySelector('.lintje-chart-skeleton')?.getAttribute('aria-hidden')).toBe('true')
    expect(host.textContent?.trim()).toBe('')
  })
})
