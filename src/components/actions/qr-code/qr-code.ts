/**
 * `<lintje-qr-code>` — a QR code a phone camera reads, with a button that copies it as an
 * image.
 *
 * The host sets `value`, the text the code holds, and the element makes the code. A host that
 * makes its own sets `src` instead: an image of only the dark modules, without a margin. The
 * element sets the code on a light quiet zone in every mode and theme, because many camera apps do
 * not read an inverted code.
 *
 * Events: `lintje-copy` after the image is on the clipboard, `lintje-copy-error` when the
 * browser refused.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import '../../../primitives/button/button'
import '../../feedback/toast/toast'
import { ANNOUNCE_GAP, COPIED_FOR } from '../../shared/copied'
import qrCodeCss from './qr-code.css?inline'
import { QrCode } from './qrcodegen'

const LABEL = 'Kopieer als afbeelding'
const COPIED = 'Afbeelding gekopieerd'
const FAILED = 'Kopiëren is niet gelukt. Maak een schermafbeelding van de QR-code.'
const TOO_LONG = 'Deze link is te lang voor een QR-code.'

/** Side of the copied image, sharp when pasted into a document or a chat. */
const IMAGE_SIDE = 480
/** The quiet zone around the code, as a share of its side: four modules of a small code. */
const QUIET = 0.14

/** The code of `text` as an SVG of its dark modules, one path of horizontal runs. */
export function codeImage(text: string, colour: string): string {
  // The lowest level gives the fewest modules; a screen is not a dirty label.
  const code = QrCode.encodeText(text, QrCode.Ecc.LOW)
  let path = ''
  for (let y = 0; y < code.size; y++) {
    for (let x = 0; x < code.size; x++) {
      if (!code.getModule(x, y)) continue
      const start = x
      while (x + 1 < code.size && code.getModule(x + 1, y)) x++
      path += `M${start} ${y}h${x - start + 1}v1H${start}z`
    }
  }
  const fill = colour ? ` fill="${colour}"` : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${code.size}" height="${code.size}" viewBox="0 0 ${code.size} ${code.size}" shape-rendering="crispEdges"><path${fill} d="${path}"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export class LintjeQrCode extends LintjeElement {
  static override styles = shadowCss(qrCodeCss)

  static override properties: PropertyDeclarations = {
    src: { type: String },
    value: { type: String },
    label: { type: String },
    made: { state: true },
    tooLong: { state: true },
    copied: { state: true },
    failed: { state: true },
    status: { state: true },
  }

  /** URL or data URI of an image of the code the host made; it goes before `value`. */
  src: string = ''
  /** The text the code holds, usually a link: the element makes the code. */
  value: string = ''
  /** The image's accessible name: what the code opens. Without it: "QR-code: " and `value`. */
  declare label?: string
  copied: boolean = false
  failed: boolean = false
  protected status: string = ''
  protected made: string = ''
  protected tooLong: boolean = false

  private timer: ReturnType<typeof setTimeout> | undefined
  private gap: ReturnType<typeof setTimeout> | undefined

  /** The image drawn: the host's, or the one made from `value`. */
  private get drawn(): string {
    return this.src || this.made
  }

  protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (!changed.has('value')) return
    this.made = ''
    this.tooLong = false
    if (!this.value) return
    try {
      const colour = getComputedStyle(this).getPropertyValue('--color-qr-fg').trim()
      this.made = codeImage(this.value, colour)
    } catch (error) {
      if (!(error instanceof RangeError)) throw error
      this.tooLong = true
    }
  }

  override disconnectedCallback(): void {
    clearTimeout(this.timer)
    clearTimeout(this.gap)
    super.disconnectedCallback()
  }

  /** The code as a PNG on its quiet zone, in the colour the page resolved for it. */
  private async image(): Promise<Blob> {
    const source = new Image()
    source.src = this.drawn
    await source.decode()
    const quiet = Math.round(IMAGE_SIDE * QUIET)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = IMAGE_SIDE + 2 * quiet
    const context = canvas.getContext('2d')
    if (!context) throw new Error('no canvas')
    context.fillStyle = getComputedStyle(this).getPropertyValue('--color-qr-bg').trim()
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.imageSmoothingEnabled = false
    context.drawImage(source, quiet, quiet, IMAGE_SIDE, IMAGE_SIDE)
    return new Promise((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('no image'))), 'image/png'),
    )
  }

  private async copy(): Promise<void> {
    if (!this.drawn) return
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined')
        throw new Error('no clipboard')
      // Safari keeps the gesture only while the item is made at once, with the image to follow.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': this.image() })])
    } catch {
      this.failed = true
      this.emit('lintje-copy-error')
      return
    }
    this.failed = false
    this.copied = true
    clearTimeout(this.timer)
    clearTimeout(this.gap)
    this.timer = setTimeout(() => {
      this.copied = false
      this.status = ''
    }, COPIED_FOR)
    if (this.status === COPIED) {
      this.status = ''
      this.gap = setTimeout(() => (this.status = COPIED), ANNOUNCE_GAP)
    } else this.status = COPIED
    this.emit('lintje-copy')
  }

  // A camera is no way into the code for everyone: the name holds what it holds.
  private get alt(): string {
    if (this.label) return this.label
    return this.value ? `QR-code: ${this.value}` : 'QR-code'
  }

  private onToastClose(event: Event): void {
    event.stopPropagation()
    this.failed = false
  }

  protected override render(): TemplateResult {
    // Both labels share one grid cell, so the width does not change on copy.
    return html`<div class="lintje-qr-code__zone">
        ${
          this.drawn
            ? html`<img class="lintje-qr-code__image" src=${this.drawn} alt=${this.alt} />`
            : this.tooLong
              ? html`<p class="lintje-qr-code__hint">${TOO_LONG}</p>`
              : nothing
        }
      </div>
      <lintje-button
        variant="secondary"
        icon=${this.copied ? 'functioneel-vinkje' : 'functioneel-kopieren'}
        ?disabled=${!this.drawn}
        @click=${this.copy}
        ><span class="lintje-qr-code__labels"
          ><span class=${classMap({ 'lintje-qr-code__label': true, 'is-hidden': this.copied })}
            >${LABEL}</span
          ><span class=${classMap({ 'lintje-qr-code__label': true, 'is-hidden': !this.copied })}
            >${COPIED}</span
          ></span
        ></lintje-button
      ><span class="visually-hidden" role="status">${this.status || nothing}</span>${
        this.failed
          ? html`<lintje-toast kind="error" @lintje-close=${this.onToastClose}>${FAILED}</lintje-toast>`
          : nothing
      }`
  }
}

define('lintje-qr-code', LintjeQrCode)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-qr-code': LintjeQrCode
  }
}
