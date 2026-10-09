/**
 * `LintjeElement` — the base class every `lintje-…` tag extends: prepends the tokens and reset
 * to its styles, resolves the mode onto the host, and emits composed events.
 *
 * The mode resolves in this order: the element's own attribute; the nearest ancestor's
 * `data-mode` (across shadow roots); its `data`; the default.
 */
import {
  LitElement,
  type CSSResultGroup,
  type CSSResultOrNative,
  type PropertyDeclarations,
  type PropertyValues,
} from 'lit'
import { baseStyles, tokenStyles } from './styles'

export type Mode = 'light' | 'dark'

export interface FrameSettings {
  mode?: Mode
}

const connected = new Set<LintjeElement>()

const DATA_SOURCE = ':scope > script[type="application/json"]'

let documentObserver: MutationObserver | null = null

function watchDocument(): void {
  if (documentObserver || typeof MutationObserver === 'undefined') return
  documentObserver = new MutationObserver(() => refreshSettings())
  documentObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-mode'],
  })
}

let refreshQueued = false

/** Re-resolves every connected element once per microtask: n connects mean one sweep. */
function refreshSettings(): void {
  if (refreshQueued) return
  refreshQueued = true
  queueMicrotask(() => {
    refreshQueued = false
    for (const element of connected) element.resolveSettings()
  })
}

/**
 * The nearest ancestor's `data-<name>`, across shadow boundaries (`closest()` stops at the root).
 * The element itself is skipped: it carries the value this lookup produces.
 */
function inheritedSetting(element: Element, name: string): string | null {
  const attribute = `data-${name}`
  let node: Element | null = element.parentElement ?? hostOf(element)
  while (node) {
    const found = node.closest(`[${attribute}]`)
    if (found) return found.getAttribute(attribute)
    node = hostOf(node)
  }
  return null
}

function hostOf(element: Element): Element | null {
  const root = element.getRootNode()
  return root instanceof ShadowRoot ? root.host : null
}

export class LintjeElement extends LitElement {
  static properties: PropertyDeclarations = {
    mode: { type: String },
    resolvedMode: { state: true },
  }

  declare mode?: Mode

  resolvedMode: Mode = 'light'

  protected static finalizeStyles(styles?: CSSResultGroup): Array<CSSResultOrNative> {
    return [tokenStyles, baseStyles, ...super.finalizeStyles(styles)]
  }

  /** The settings the element's `data` carries; a view element overrides it. */
  protected get dataSettings(): FrameSettings | undefined {
    return undefined
  }

  override connectedCallback(): void {
    super.connectedCallback()
    connected.add(this)
    watchDocument()
    this.readDataSources()
    // The parser connects an element before its children: read again once they are there.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.readDataSources(), { once: true })
    }
    // Before the first render: a child reads the value this element reflects.
    this.resolveSettings()
  }

  /**
   * Data from the markup, for a page a server renders: a `<script type="application/json">`
   * child is parsed into the property its `data-prop` names (default `data`) and removed, so no
   * slot sees it. Read when the element connects and before its first render; after that the
   * property is the host's.
   */
  private readDataSources(): void {
    const properties = (this.constructor as typeof LitElement).elementProperties
    for (const source of this.querySelectorAll<HTMLScriptElement>(DATA_SOURCE)) {
      const property = source.dataset.prop ?? 'data'
      source.remove()
      if (!properties.has(property)) {
        console.warn(`<${this.localName}> has no property "${property}" to put its JSON in.`)
        continue
      }
      try {
        ;(this as unknown as Record<string, unknown>)[property] = JSON.parse(source.textContent)
      } catch (error) {
        console.error(`<${this.localName}>: the JSON for "${property}" does not parse.`, error)
      }
    }
  }

  override disconnectedCallback(): void {
    connected.delete(this)
    super.disconnectedCallback()
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    // Children a script appended right after the element are there by the first update.
    if (!this.hasUpdated) this.readDataSources()
    this.resolveSettings()
  }

  /** Resolves the mode and reflects it. Public for the document observer. */
  resolveSettings(): void {
    if (!this.isConnected) return
    const settings = this.dataSettings
    const mode = (this.mode ?? inheritedSetting(this, 'mode') ?? settings?.mode ?? 'light') as Mode
    const changed = mode !== this.resolvedMode
    this.resolvedMode = mode
    if (this.dataset.mode !== mode) this.dataset.mode = mode
    // This element's own value may be what a nested element inherits.
    if (changed) refreshSettings()
  }

  /** Bubbling and composed, so it reaches the host; `false` when a listener cancelled it. */
  protected emit(name: string, detail?: unknown): boolean {
    return this.dispatchEvent(
      new CustomEvent(name, { detail, bubbles: true, composed: true, cancelable: true }),
    )
  }

  /**
   * Reports a link the reader chose as `lintje-navigate`. A host that routes itself cancels the
   * event; otherwise the browser follows the click or, without a click (a key), the element goes
   * there: the one place an element navigates.
   */
  protected followLink(href: string, event?: Event, detail: unknown = { href }): void {
    if (!this.emit('lintje-navigate', detail)) event?.preventDefault()
    else if (!event) window.location.assign(href)
  }

  /** Bubbling but not composed: stops at the shadow root and never reaches a host. */
  protected emitLocal(name: string, detail?: unknown): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }))
  }
}

/** Asks every connected element to render again; called when a late icon arrives. */
export function redrawAllElements(): void {
  for (const element of connected) element.requestUpdate()
}

export function define(tag: string, element: CustomElementConstructor): void {
  if (typeof customElements === 'undefined' || customElements.get(tag)) return
  customElements.define(tag, element)
}
