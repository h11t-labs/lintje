/** The document viewer in a browser: "Passend" follows the width of the view. */
import { afterEach, describe, expect, it } from 'vitest'
import './document-viewer'
import type { LintjeDocumentViewer } from './document-viewer'

// A page 600 px wide, so "Passend" is the view's room as a share of 600.
const PAGE =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="white"/></svg>',
  )

const loops: string[] = []
const onError = (event: ErrorEvent): void => {
  if (/ResizeObserver loop/.test(event.message)) loops.push(event.message)
}

async function mount(width: number): Promise<LintjeDocumentViewer> {
  window.addEventListener('error', onError)
  const box = document.body.appendChild(document.createElement('div'))
  box.style.width = `${width}px`
  box.style.height = '600px'
  const element = box.appendChild(document.createElement('lintje-document-viewer'))
  element.name = 'Brief gemeente.pdf'
  element.pages = [PAGE]
  await element.updateComplete
  await expect.poll(() => element.shadowRoot!.querySelector('lintje-skeleton')).toBeNull()
  return element
}

const percent = (element: LintjeDocumentViewer): number =>
  parseInt(element.shadowRoot!.querySelector('.lintje-document-viewer__zoom')!.textContent!, 10)

afterEach(() => {
  window.removeEventListener('error', onError)
  loops.length = 0
  document.body.replaceChildren()
})

describe('lintje-document-viewer measures "Passend" again', () => {
  it('when the view grows narrower or wider, without an event and without a loop', async () => {
    const element = await mount(800)
    const zooms: unknown[] = []
    element.addEventListener('lintje-zoom-change', (event) =>
      zooms.push((event as CustomEvent).detail),
    )
    const start = percent(element)
    expect(start).toBeGreaterThan(0)

    element.parentElement!.style.width = '500px'
    await expect.poll(() => percent(element)).toBeLessThan(start)
    const narrow = percent(element)

    element.parentElement!.style.width = '1000px'
    await expect.poll(() => percent(element)).toBeGreaterThan(start)

    // Zooming in starts from what fits now, not from the width at load.
    element.parentElement!.style.width = '500px'
    await expect.poll(() => percent(element)).toBe(narrow)
    element.shadowRoot!.querySelector<HTMLButtonElement>('[aria-label="Inzoomen"]')!.click()
    expect(zooms).toEqual([Math.floor(narrow / 25) * 25 + 25])
    // A frame for an observer to report a loop, had there been one.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    expect(loops).toEqual([])
  })
})
