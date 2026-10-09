/**
 * `<lintje-text-editor>` — formatted text (bold, italic, one heading, a bullet list, a link);
 * the value is markdown (`markdown.ts`). Formatting uses `document.execCommand`, the one API
 * every browser has for a `contenteditable` selection; the markdown writer reads only the five
 * formats from whatever markup it leaves. Commits when the surface loses focus, if changed.
 * A link is http(s), mailto, tel or relative; any other scheme is dropped.
 *
 * Events: `lintje-change` with the markdown; with a `name` also the composed `lintje-values-change`.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { define } from '../../../core/element'
import { standsIn } from '../../../core/focus'
import { shadowCss } from '../../../core/styles'
import { iconStyles } from '../../../icons/render'
import { LintjeInputElement } from '../shared/input'
import '../../../primitives/popover/popover'
import '../../../primitives/button/button'
import '../text-input/text-input'
import inputCss from '../shared/input.css?inline'
import proseCss from '../../content/prose/prose.css?inline'
import textEditorCss from './text-editor.css?inline'
import { domToMarkdown, markdownToHtml, reduceHtml, safeHref } from './markdown'

export type EditorFormat = 'bold' | 'italic' | 'heading' | 'list' | 'link'

interface Tool {
  format: EditorFormat
  label: string
  text: string
}

const TOOLS: readonly Tool[] = [
  { format: 'bold', label: 'Vet', text: 'B' },
  { format: 'italic', label: 'Cursief', text: 'I' },
  { format: 'heading', label: 'Kop', text: 'H' },
  { format: 'list', label: 'Opsomming', text: 'Opsomming' },
  { format: 'link', label: 'Link', text: 'Link' },
]

const CARRIERS: Record<EditorFormat, readonly string[]> = {
  bold: ['B', 'STRONG'],
  italic: ['I', 'EM'],
  heading: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'],
  list: ['UL', 'LI'],
  link: ['A'],
}

function exec(command: string, value?: string): void {
  if (typeof document.execCommand === 'function') document.execCommand(command, false, value)
}

// WebKit ignores `addRange()` with a range in a shadow root; it does take the four points.
function select(selection: Selection, range: Range): void {
  const { startContainer, startOffset, endContainer, endOffset } = range
  selection.setBaseAndExtent(startContainer, startOffset, endContainer, endOffset)
}

// WebKit starts a selection at the end of the text before it: read the text it begins with.
function firstNode(range: Range): Node {
  const { startContainer: node, startOffset: offset } = range
  if (range.collapsed || node.nodeType !== 3 || offset < (node.textContent ?? '').length)
    return node
  const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT)
  walker.currentNode = node
  return walker.nextNode() ?? node
}

export class LintjeTextEditor extends LintjeInputElement {
  static override styles = [
    iconStyles,
    shadowCss(inputCss),
    shadowCss(proseCss),
    shadowCss(textEditorCss),
  ]

  static override properties: PropertyDeclarations = {
    value: { type: String },
    active: { state: true },
    collapsed: { state: true },
    toolIndex: { state: true },
    linkOpen: { state: true },
    linkError: { state: true },
  }

  value: string = ''

  protected active: ReadonlySet<EditorFormat> = new Set()
  protected collapsed: boolean = true
  protected toolIndex: number = 0
  protected linkOpen: boolean = false
  protected linkError: string = ''

  private shown: string | null = null
  private range: Range | null = null

  private get surface(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.lintje-text-editor__surface')
  }

  private selection(): Selection | null {
    const root = this.renderRoot as ShadowRoot & { getSelection?: () => Selection | null }
    return root.getSelection?.() ?? document.getSelection()
  }

  // WebKit's `getRangeAt()` stops at the host; the composed range reaches into this root.
  private selectedRange(): Range | null {
    const selection = this.selection()
    if (!selection?.rangeCount) return null
    let composed: StaticRange | undefined
    try {
      composed = selection.getComposedRanges?.({ shadowRoots: [this.renderRoot as ShadowRoot] })[0]
    } catch {
      // An older WebKit may take the roots as arguments only: it keeps `getRangeAt()`.
    }
    if (!composed) return selection.getRangeAt(0)
    const range = document.createRange()
    range.setStart(composed.startContainer, composed.startOffset)
    range.setEnd(composed.endContainer, composed.endOffset)
    return range
  }

  private readonly onSelectionChange = (): void => {
    const surface = this.surface
    const range = this.selectedRange()
    if (!surface || !range) return
    if (!surface.contains(range.commonAncestorContainer)) return
    this.range = range.cloneRange()
    this.collapsed = range.collapsed
    this.active = this.formatsAt(firstNode(range))
  }

  override connectedCallback(): void {
    super.connectedCallback()
    document.addEventListener('selectionchange', this.onSelectionChange)
  }

  override disconnectedCallback(): void {
    document.removeEventListener('selectionchange', this.onSelectionChange)
    super.disconnectedCallback()
  }

  private formatsAt(node: Node | null): Set<EditorFormat> {
    const found = new Set<EditorFormat>()
    const surface = this.surface
    for (let at = node; at && at !== surface; at = at.parentNode) {
      if (at.nodeType !== 1) continue
      const tag = (at as Element).tagName
      for (const tool of TOOLS) if (CARRIERS[tool.format].includes(tag)) found.add(tool.format)
    }
    return found
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    const surface = this.surface
    if (surface && this.value !== this.shown) {
      surface.innerHTML = markdownToHtml(this.value)
      this.shown = this.value
    }
  }

  // `redraw` only when focus leaves: a redraw replaces the nodes the kept selection points into.
  private settle(redraw: boolean): void {
    const surface = this.surface
    if (!surface) return
    const markdown = domToMarkdown(surface)
    const tidy = markdownToHtml(markdown)
    if (redraw && surface.innerHTML !== tidy) surface.innerHTML = tidy
    this.shown = markdown
    if (markdown === this.value) return
    this.value = markdown
    this.commit(markdown)
  }

  private onFocusOut(event: FocusEvent): void {
    if (this.disabled) return
    const next = event.relatedTarget as Node | null
    const stays = next !== null && this.renderRoot.contains(next)
    if (event.target === this.surface || !stays) this.settle(!stays)
  }

  private restore(): void {
    const surface = this.surface
    const selection = this.selection()
    if (!surface) return
    surface.focus()
    if (this.range && selection) select(selection, this.range)
  }

  private apply(format: EditorFormat): void {
    if (this.disabled) return
    if (format === 'link') return this.link()
    this.restore()
    exec('defaultParagraphSeparator', 'p')
    if (format === 'bold') exec('bold')
    if (format === 'italic') exec('italic')
    if (format === 'list') exec('insertUnorderedList')
    if (format === 'heading') exec('formatBlock', this.active.has('heading') ? '<p>' : '<h3>')
    this.onSelectionChange()
  }

  private link(): void {
    if (this.active.has('link')) {
      this.restore()
      const selection = this.selection()
      let anchor: Node | null = this.range ? firstNode(this.range) : null
      while (anchor && (anchor as Element).tagName !== 'A') anchor = anchor.parentNode
      if (anchor && selection) {
        const whole = document.createRange()
        whole.selectNodeContents(anchor)
        select(selection, whole)
      }
      exec('unlink')
      this.onSelectionChange()
      return
    }
    if (this.collapsed) return
    this.linkError = ''
    this.linkOpen = true
    void this.updateComplete.then(() =>
      this.renderRoot
        .querySelector('.lintje-text-editor__link-field')
        ?.shadowRoot?.querySelector<HTMLInputElement>('input')
        ?.focus(),
    )
  }

  private onLinkChange(event: CustomEvent<string>): void {
    event.stopPropagation()
    const href = safeHref(event.detail)
    if (!href) {
      this.linkError = 'Vul een webadres in, zoals https://www.rijksoverheid.nl'
      return
    }
    this.linkOpen = false
    this.restore()
    exec('createLink', href)
    this.onSelectionChange()
  }

  // The link is placed with the focus back in the surface: Enter must not break the line there.
  private onLinkKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.isComposing) event.preventDefault()
  }

  // The link dialog closes once the focus leaves it. A press that takes no focus blurs to nothing,
  // or to a focusable box around the element: neither is leaving.
  private onLinkFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null
    const popover = event.currentTarget as Element
    if (!this.linkOpen || !next || standsIn(next, popover) || standsIn(this, next)) return
    this.linkOpen = false
  }

  private onLinkClose(event: Event): void {
    event.stopPropagation()
    this.linkOpen = false
    this.restore()
  }

  private onSurfaceKeydown(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return
    const format = ({ b: 'bold', i: 'italic', k: 'link' } as const)[event.key.toLowerCase()]
    if (!format) return
    event.preventDefault()
    this.apply(format)
  }

  private onPaste(event: ClipboardEvent): void {
    const data = event.clipboardData
    if (!data) return
    event.preventDefault()
    const pasted = data.getData('text/html')
    if (pasted) exec('insertHTML', reduceHtml(pasted))
    else exec('insertText', data.getData('text/plain'))
  }

  private onToolbarKeydown(event: KeyboardEvent): void {
    const last = TOOLS.length - 1
    const moves: Record<string, number> = {
      ArrowRight: this.toolIndex === last ? 0 : this.toolIndex + 1,
      ArrowLeft: this.toolIndex === 0 ? last : this.toolIndex - 1,
      Home: 0,
      End: last,
    }
    const next = moves[event.key]
    if (next === undefined) return
    event.preventDefault()
    this.toolIndex = next
    void this.updateComplete.then(() => {
      const buttons = this.renderRoot.querySelectorAll<HTMLButtonElement>(
        '.lintje-text-editor__tool',
      )
      buttons[next]?.focus()
    })
  }

  private renderTool(tool: Tool, index: number): TemplateResult {
    const pressed = this.active.has(tool.format)
    const idle = tool.format === 'link' && this.collapsed && !pressed
    return html`<button
      type="button"
      class=${classMap({
        'lintje-text-editor__tool': true,
        [`lintje-text-editor__tool--${tool.format}`]: true,
        'lintje-text-editor__tool--word': tool.text.length > 1,
        'is-pressed': pressed,
        'is-idle': idle,
      })}
      tabindex=${index === this.toolIndex ? '0' : '-1'}
      aria-label=${tool.label}
      aria-pressed=${pressed ? 'true' : 'false'}
      aria-disabled=${idle ? 'true' : nothing}
      ?disabled=${this.disabled}
      @mousedown=${(event: MouseEvent) => event.preventDefault()}
      @click=${() => {
        this.toolIndex = index
        this.apply(tool.format)
      }}
    >
      ${tool.text}
    </button>`
  }

  protected override render(): TemplateResult {
    return html`<div class="lintje-field" @focusout=${this.onFocusOut}>
      ${this.renderLabel()}
      <div
        class=${classMap({
          'lintje-text-editor': true,
          'is-error': Boolean(this.error),
          'is-disabled': this.disabled,
        })}
      >
        <div
          class="lintje-text-editor__toolbar"
          role="toolbar"
          aria-label="Opmaak"
          @keydown=${this.onToolbarKeydown}
        >
          ${TOOLS.map((tool, index) => this.renderTool(tool, index))}
        </div>
        <lintje-popover
          ?open=${this.linkOpen}
          placement="bottom-end"
          panel-role="dialog"
          label="Link toevoegen"
          @lintje-close=${this.onLinkClose}
          @focusout=${this.onLinkFocusOut}
        >
          ${
            this.linkOpen
              ? html`<div class="lintje-text-editor__link" @keydown=${this.onLinkKeydown}>
                <lintje-text-input
                  class="lintje-text-editor__link-field"
                  label="Adres van de link"
                  placeholder="https://"
                  hint="Enter plaatst de link"
                  error=${this.linkError || nothing}
                  @lintje-change=${this.onLinkChange}
                ></lintje-text-input>
              </div>`
              : nothing
          }
        </lintje-popover>
        <div
          id=${this.controlId}
          class="lintje-text-editor__surface lintje-prose"
          role="textbox"
          aria-multiline="true"
          aria-labelledby=${this.labelId}
          aria-describedby=${this.describedBy}
          aria-invalid=${this.error ? 'true' : nothing}
          aria-required=${this.required ? 'true' : nothing}
          aria-disabled=${this.disabled ? 'true' : nothing}
          contenteditable=${this.disabled ? 'false' : 'true'}
          tabindex=${this.disabled ? '-1' : '0'}
          @keydown=${this.onSurfaceKeydown}
          @paste=${this.onPaste}
        ></div>
      </div>
      ${this.renderFoot()}
    </div>`
  }
}

define('lintje-text-editor', LintjeTextEditor)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-text-editor': LintjeTextEditor
  }
}
