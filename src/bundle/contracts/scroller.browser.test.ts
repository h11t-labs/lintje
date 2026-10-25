/**
 * Every scroller the keyboard must reach (WCAG 2.1.1): it is a Tab stop with a role and a name,
 * and the arrow keys scroll it. Safari gives a scroller no Tab stop of its own, so an element
 * that scrolls what the host gave it takes one.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { server, userEvent } from 'vitest/browser'
import { deepActiveElement } from '../../core/focus'
import { TAB } from '../../core/test-keys'
import '../../components/content/code/code'
import '../../components/content/prose/prose'
import '../../components/layout/tile/tile'

interface Row {
  name: string
  /** The element, holding more than its box shows. */
  mount: () => HTMLElement
  scroller: (element: HTMLElement) => HTMLElement | null | undefined
  /** The name a reader hears. */
  label: string
  /** The key that scrolls it. */
  key: '{ArrowRight}' | '{ArrowDown}'
}

const LONG_LINE =
  'GET /api/loketten/amsterdam-centrum/wachttijd?van=2026-10-01&tot=2026-10-07&per=kwartier&mediaan=true'

const ROWS: Row[] = [
  {
    name: 'lintje-code',
    mount: () => Object.assign(document.createElement('lintje-code'), { text: LONG_LINE }),
    scroller: (element) => element.shadowRoot?.querySelector('pre'),
    label: 'Codeblok',
    key: '{ArrowRight}',
  },
  {
    name: 'lintje-prose :: a block of code in its html',
    mount: () =>
      Object.assign(document.createElement('lintje-prose'), {
        html: `<p>Zo vraag je het op:</p><pre><code>${LONG_LINE.replaceAll('&', '&amp;')}</code></pre>`,
      }),
    scroller: (element) => element.shadowRoot?.querySelector('pre'),
    label: 'Codeblok',
    key: '{ArrowRight}',
  },
  {
    name: 'lintje-tile :: content-scroll',
    mount: () => {
      const tile = Object.assign(document.createElement('lintje-tile'), {
        heading: 'Toelichting per loket',
        contentScroll: true,
      })
      tile.style.height = '200px'
      tile.innerHTML = Array.from(
        { length: 12 },
        (_, index) => `<p>Loket ${index + 1}: de wachttijd ligt binnen de norm.</p>`,
      ).join('')
      return tile
    },
    scroller: (element) => element.shadowRoot?.querySelector('.lintje-tile__content'),
    label: 'Toelichting per loket',
    key: '{ArrowDown}',
  },
]

/** The name from `aria-label`, or from what `aria-labelledby` points at in the same root. */
function nameOf(element: HTMLElement): string {
  const label = element.getAttribute('aria-label')
  if (label) return label
  const root = element.getRootNode() as Document | ShadowRoot
  return (element.getAttribute('aria-labelledby') ?? '')
    .split(' ')
    .map((id) => root.getElementById(id)?.textContent?.trim() ?? '')
    .join(' ')
    .trim()
}

afterEach(() => document.body.replaceChildren())

describe.each(ROWS)('$name', (row) => {
  it('is a Tab stop with a role and a name, and scrolls with the arrow keys', async () => {
    const before = Object.assign(document.createElement('button'), { textContent: 'Begin' })
    const box = document.createElement('div')
    box.style.width = '320px'
    const element = row.mount()
    box.append(element)
    document.body.append(before, box)
    await (element as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete
    await expect.poll(() => row.scroller(element)).toBeTruthy()
    const scroller = row.scroller(element)!
    const sideways = row.key === '{ArrowRight}'
    // There is something to scroll to.
    expect(
      sideways
        ? scroller.scrollWidth > scroller.clientWidth
        : scroller.scrollHeight > scroller.clientHeight,
    ).toBe(true)

    // A click, not `focus()`: it gives the test's frame the keyboard in WebKit.
    await userEvent.click(before)
    await userEvent.keyboard(TAB)
    await expect.poll(() => deepActiveElement()).toBe(scroller)
    expect(scroller.getAttribute('role')).toBe('region')
    expect(nameOf(scroller)).toBe(row.label)

    // The browser scrolls a focused scroller itself; Playwright's WebKit delivers the arrow to it
    // only now and then, so there the Tab stop is the proof.
    if (server.browser === 'webkit') return
    await userEvent.keyboard(row.key)
    await expect
      .poll(() => (sideways ? scroller.scrollLeft : scroller.scrollTop))
      .toBeGreaterThan(0)
  })
})
