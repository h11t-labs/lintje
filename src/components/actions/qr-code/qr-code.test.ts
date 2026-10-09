/** The QR code: made from its text or the host's image, on its quiet zone, and copying it. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './qr-code'
import { codeImage, type LintjeQrCode } from './qr-code'
import { QrCode } from './qrcodegen'

const SRC = '/examples/data/qr-overzicht.svg'

async function mount(props: Record<string, unknown>): Promise<LintjeQrCode> {
  const element = Object.assign(document.createElement('lintje-qr-code'), props)
  document.body.append(element)
  await element.updateComplete
  return element
}

const button = (element: LintjeQrCode): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('lintje-button')!

async function press(element: LintjeQrCode): Promise<void> {
  button(element).click()
  for (let tick = 0; tick < 4; tick++) await Promise.resolve()
  await element.updateComplete
}

describe('lintje-qr-code', () => {
  const write = vi.fn<(items: unknown[]) => Promise<void>>()

  beforeEach(() => {
    write.mockReset().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true })
    vi.stubGlobal(
      'ClipboardItem',
      class {
        constructor(readonly items: Record<string, Promise<Blob>>) {
          // The image promise is not awaited here; keep a rejection from going unhandled.
          for (const item of Object.values(items)) item.catch(() => {})
        }
      },
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('shows the image of the host, named by its label', async () => {
    const element = await mount({ src: SRC, label: 'QR-code naar deze weergave' })
    const image = element.shadowRoot!.querySelector('img')!
    expect(image.getAttribute('src')).toBe(SRC)
    expect(image.alt).toBe('QR-code naar deze weergave')
    expect(button(element).hasAttribute('disabled')).toBe(false)
  })

  it('makes the code of its text, and the host image goes before it', async () => {
    const element = await mount({ value: 'https://example.nl/' })
    const image = element.shadowRoot!.querySelector('img')!
    expect(image.getAttribute('src')).toMatch(/^data:image\/svg\+xml,/)
    // Without a label of the host's, the name says what the code holds.
    expect(image.alt).toBe('QR-code: https://example.nl/')
    expect(button(element).hasAttribute('disabled')).toBe(false)
    element.src = SRC
    await element.updateComplete
    expect(image.getAttribute('src')).toBe(SRC)
  })

  it('says so when the text is too long for a code', async () => {
    const element = await mount({ value: `https://example.nl/?q=${'x'.repeat(3000)}` })
    expect(element.shadowRoot!.querySelector('img')).toBeNull()
    expect(element.shadowRoot!.textContent).toContain('te lang voor een QR-code')
    expect(button(element).hasAttribute('disabled')).toBe(true)
  })

  it('draws every dark module and nothing else, without a margin', () => {
    const text = 'https://example.nl/overzicht?jaar=2025'
    const code = QrCode.encodeText(text, QrCode.Ecc.LOW)
    const svg = decodeURIComponent(codeImage(text, '#000').slice('data:image/svg+xml,'.length))
    expect(svg).toContain(`viewBox="0 0 ${code.size} ${code.size}"`)
    expect(svg).toContain('fill="#000"')
    const dark = new Set<string>()
    for (const [, x, y, run] of svg.matchAll(/M(\d+) (\d+)h(\d+)/g))
      for (let i = 0; i < Number(run); i++) dark.add(`${Number(x) + i},${y}`)
    for (let y = 0; y < code.size; y++)
      for (let x = 0; x < code.size; x++) expect(dark.has(`${x},${y}`)).toBe(code.getModule(x, y))
  })

  it('disables the button without an image', async () => {
    const element = await mount({})
    expect(element.shadowRoot!.querySelector('img')).toBeNull()
    expect(button(element).hasAttribute('disabled')).toBe(true)
  })

  it('puts a PNG on the clipboard, says so and sends lintje-copy', async () => {
    const element = await mount({ src: SRC })
    const copied = vi.fn()
    element.addEventListener('lintje-copy', copied)
    await press(element)
    expect(write).toHaveBeenCalledTimes(1)
    const [item] = write.mock.calls[0][0] as { items: Record<string, unknown> }[]
    expect(Object.keys(item.items)).toEqual(['image/png'])
    expect(copied).toHaveBeenCalled()
    expect(element.shadowRoot!.querySelector('[role="status"]')!.textContent).toContain(
      'Afbeelding gekopieerd',
    )
  })

  it('shows an error toast and sends lintje-copy-error when the browser refuses', async () => {
    write.mockRejectedValue(new Error('denied'))
    const element = await mount({ src: SRC })
    const refused = vi.fn()
    element.addEventListener('lintje-copy-error', refused)
    await press(element)
    expect(refused).toHaveBeenCalled()
    expect(element.shadowRoot!.querySelector('lintje-toast')!.textContent).toContain(
      'schermafbeelding',
    )
  })
})
