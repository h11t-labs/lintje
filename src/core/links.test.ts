/** A link an element reports: the host may take it over, else it is followed. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LintjeElement, define } from './element'

class LinkProbe extends LintjeElement {
  follow(href: string, event?: Event): void {
    this.followLink(href, event)
  }
}
define('lintje-link-probe', LinkProbe)

const mount = (): LinkProbe => {
  const element = document.createElement('lintje-link-probe') as LinkProbe
  document.body.append(element)
  return element
}
const click = (): MouseEvent => new MouseEvent('click', { bubbles: true, cancelable: true })

afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

describe('followLink', () => {
  it('reports the link and leaves the click to the browser', () => {
    const element = mount()
    const heard: unknown[] = []
    element.addEventListener('lintje-navigate', (event) =>
      heard.push((event as CustomEvent).detail),
    )
    const event = click()
    element.follow('/opnames', event)
    expect(heard).toEqual([{ href: '/opnames' }])
    expect(event.defaultPrevented).toBe(false)
  })

  it('cancels the click when the host cancels the event: the host routes itself', () => {
    const element = mount()
    document.addEventListener('lintje-navigate', (event) => event.preventDefault(), { once: true })
    const event = click()
    element.follow('/opnames', event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('goes there itself when there is no click to follow, unless the host cancels', () => {
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
    const element = mount()
    element.follow('/opnames')
    expect(assign).toHaveBeenCalledWith('/opnames')

    element.addEventListener('lintje-navigate', (event) => event.preventDefault())
    element.follow('/wachtrij')
    expect(assign).toHaveBeenCalledTimes(1)
  })
})
