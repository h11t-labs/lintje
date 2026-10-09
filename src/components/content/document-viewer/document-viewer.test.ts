/**
 * The document viewer: the zoom and page arithmetic, the toolbar's ARIA, the keys, the events
 * and the loading and failed states. happy-dom loads no images: `load` and `error` are
 * dispatched by hand.
 */
import { describe, expect, it } from 'vitest'
import './document-viewer'
import {
  clampPage,
  pageLabel,
  parseZoom,
  stepZoom,
  zoomLabel,
  type LintjeDocumentViewer,
} from './document-viewer'

const PAGES = ['/brief/1.png', '/brief/2.png', '/brief/3.png', '/brief/4.png', '/brief/5.png']

async function mount(props: Partial<LintjeDocumentViewer> = {}): Promise<LintjeDocumentViewer> {
  const element = Object.assign(document.createElement('lintje-document-viewer'), {
    name: 'Brief gemeente.pdf',
    pages: PAGES,
    ...props,
  })
  document.body.append(element)
  await element.updateComplete
  return element
}

const root = (element: LintjeDocumentViewer): ShadowRoot => element.shadowRoot!
const button = (element: LintjeDocumentViewer, label: string): HTMLButtonElement =>
  root(element).querySelector(`[aria-label="${label}"]`)!

/** Unavailable but still focusable: `aria-disabled`, never the native `disabled`. */
const off = (element: LintjeDocumentViewer, label: string): boolean =>
  button(element, label).getAttribute('aria-disabled') === 'true' &&
  !button(element, label).disabled

function collect(element: LintjeDocumentViewer, name: string): unknown[] {
  const seen: unknown[] = []
  element.addEventListener(name, (event) => seen.push((event as CustomEvent).detail))
  return seen
}

describe('the zoom and page arithmetic', () => {
  it('steps the zoom by 25 within 50–400', () => {
    expect(stepZoom(100, 1, 100)).toBe(125)
    expect(stepZoom(100, -1, 100)).toBe(75)
    expect(stepZoom(50, -1, 100)).toBe(50)
    expect(stepZoom(400, 1, 100)).toBe(400)
  })

  it('steps from fit to the next multiple of 25 of what fit is', () => {
    expect(stepZoom('fit', 1, 137)).toBe(150)
    expect(stepZoom('fit', -1, 137)).toBe(125)
  })

  it('reads a zoom attribute', () => {
    expect(parseZoom('fit')).toBe('fit')
    expect(parseZoom(null)).toBe('fit')
    expect(parseZoom('150')).toBe(150)
    expect(parseZoom('900%')).toBe(400)
    expect(parseZoom('veel')).toBe('fit')
  })

  it('labels the zoom and the page, and keeps the page inside the document', () => {
    expect(zoomLabel('fit')).toBe('')
    expect(zoomLabel('fit', 87)).toBe('87%')
    expect(zoomLabel(125)).toBe('125%')
    expect(pageLabel(2, 5)).toBe('Pagina 2 van 5')
    expect(clampPage(9, 5)).toBe(5)
    expect(clampPage(0, 5)).toBe(1)
    expect(clampPage(3, 0)).toBe(1)
  })
})

describe('lintje-document-viewer', () => {
  it('draws a named toolbar with the page and the zoom', async () => {
    const element = await mount({ page: 2 })
    const toolbar = root(element).querySelector('[role="toolbar"]')!
    expect(toolbar.getAttribute('aria-label')).toBe('Document')
    expect(toolbar.textContent).toContain('Brief gemeente.pdf')
    expect(toolbar.textContent).toContain('Pagina 2 van 5')
    // "Passend" once: the button, not also the figure between the zoom buttons.
    expect(toolbar.textContent!.match(/Passend/g)).toHaveLength(1)
    const page = root(element).querySelector('[role="img"]')!
    expect(page.getAttribute('aria-label')).toBe('Pagina 2 van 5 van Brief gemeente.pdf')
    expect(root(element).querySelector('img')!.getAttribute('src')).toBe('/brief/2.png')
  })

  it('disables previous on the first page and next on the last', async () => {
    const element = await mount()
    expect(off(element, 'Vorige pagina')).toBe(true)
    expect(off(element, 'Volgende pagina')).toBe(false)
    element.page = 5
    await element.updateComplete
    expect(off(element, 'Volgende pagina')).toBe(true)
  })

  it('leafs on the buttons and the keys, and reports the page', async () => {
    const element = await mount()
    const pages = collect(element, 'lintje-page-change')
    button(element, 'Volgende pagina').click()
    await element.updateComplete
    const view = root(element).querySelector('.lintje-document-viewer__view')!
    view.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    await element.updateComplete
    view.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }))
    await element.updateComplete
    view.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    expect(pages).toEqual([2, 5, 4, 1])
  })

  it('swallows a press on an unavailable button, which keeps the focus', async () => {
    const element = await mount({ page: 5 })
    const pages = collect(element, 'lintje-page-change')
    const next = button(element, 'Volgende pagina')
    next.focus()
    next.click()
    await element.updateComplete
    expect(pages).toEqual([])
    expect(root(element).activeElement).toBe(next)
  })

  it('says a change of page and of zoom in a status region that is there from the start', async () => {
    const element = await mount()
    const status = root(element).querySelector('[role="status"]')!
    expect(status.textContent).toBe('')
    button(element, 'Volgende pagina').click()
    await element.updateComplete
    expect(status.textContent).toBe('Pagina 2 van 5')
    button(element, 'Inzoomen').click()
    await element.updateComplete
    expect(status.textContent).toBe('Zoom 125%')
    root(element).querySelector<HTMLButtonElement>('[aria-pressed]')!.click()
    await element.updateComplete
    expect(status.textContent).toBe('Zoom passend')
  })

  it('reads the text of the page shown after its image', async () => {
    const element = await mount({ texts: ['Geachte heer, mevrouw,', 'Met vriendelijke groet,'] })
    const text = (): string | undefined =>
      root(element).querySelector('.lintje-document-viewer__text')?.textContent?.trim()
    expect(text()).toBe('Geachte heer, mevrouw,')
    element.page = 2
    await element.updateComplete
    expect(text()).toBe('Met vriendelijke groet,')
    element.page = 3
    await element.updateComplete
    expect(text()).toBeUndefined()
  })

  it('lets the page keys scroll a zoomed page that can still scroll that way', async () => {
    const element = await mount({ page: 2 })
    const pages = collect(element, 'lintje-page-change')
    const view = root(element).querySelector<HTMLElement>('.lintje-document-viewer__view')!
    Object.defineProperties(view, {
      scrollTop: { value: 100, configurable: true },
      clientHeight: { value: 400, configurable: true },
      scrollHeight: { value: 1200, configurable: true },
    })
    const press = (key: string): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      view.dispatchEvent(event)
      return event
    }
    expect(press('PageDown').defaultPrevented).toBe(false)
    expect(press('Home').defaultPrevented).toBe(false)
    expect(pages).toEqual([])
    Object.defineProperty(view, 'scrollTop', { value: 800, configurable: true })
    expect(press('PageDown').defaultPrevented).toBe(true)
    expect(pages).toEqual([3])
  })

  it('zooms on the buttons and on + and -, and reports the zoom', async () => {
    const element = await mount()
    const zooms = collect(element, 'lintje-zoom-change')
    button(element, 'Inzoomen').click()
    await element.updateComplete
    const view = root(element).querySelector('.lintje-document-viewer__view')!
    view.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }))
    await element.updateComplete
    view.dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true }))
    await element.updateComplete
    root(element).querySelector<HTMLButtonElement>('[aria-pressed]')!.click()
    expect(zooms).toEqual([125, 150, 125, 'fit'])
    await element.updateComplete
    expect(element.getAttribute('zoom')).toBe('fit')
  })

  it('disables zoom out from fit when fit is already the smallest', async () => {
    const element = await mount()
    expect(off(element, 'Uitzoomen')).toBe(false)
    ;(element as unknown as { fitPercent: number }).fitPercent = 40
    element.requestUpdate()
    await element.updateComplete
    expect(off(element, 'Uitzoomen')).toBe(true)
    expect(off(element, 'Inzoomen')).toBe(false)
  })

  it('holds a zoom property to 50–400', async () => {
    const element = await mount({ zoom: 900 })
    expect(element.zoom).toBe(400)
    expect(off(element, 'Inzoomen')).toBe(true)
    element.zoom = 10
    await element.updateComplete
    expect(element.zoom).toBe(50)
  })

  it('shows the empty state, not a skeleton, with nothing to show', async () => {
    const element = await mount({ pages: [], src: '' })
    expect(root(element).querySelector('lintje-skeleton')).toBeNull()
    const empty = root(element).querySelector('lintje-empty-state')!
    expect(empty.heading).toBe('Er is geen document om te tonen')
    expect(off(element, 'Downloaden')).toBe(true)
  })

  it('shows a skeleton until the page has loaded', async () => {
    const element = await mount()
    expect(root(element).querySelector('lintje-skeleton')).not.toBeNull()
    root(element).querySelector('img')!.dispatchEvent(new Event('load'))
    await element.updateComplete
    expect(root(element).querySelector('lintje-skeleton')).toBeNull()
  })

  it('shows the empty state with Downloaden when a page cannot be shown', async () => {
    const element = await mount({ src: '/bijlage.jpg', pages: [] })
    const downloads = collect(element, 'lintje-download')
    root(element).querySelector('img')!.dispatchEvent(new Event('error'))
    await element.updateComplete
    const empty = root(element).querySelector('lintje-empty-state')!
    expect(empty.heading).toBe('Het document kan niet worden getoond')
    empty.querySelector('lintje-button')!.click()
    button(element, 'Downloaden').click()
    expect(downloads).toHaveLength(2)
  })
})
