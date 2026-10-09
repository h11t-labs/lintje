/**
 * Inline styles that survive a strict Content-Security-Policy. `style-src 'self'` makes a browser
 * discard the `style` attribute, which Lit writes; `styleProps` is an element directive that
 * writes through the CSSOM instead. A `null`, `undefined` or `false` value removes the property.
 */
import { nothing } from 'lit'
import { Directive, directive, PartType, type ElementPart, type PartInfo } from 'lit/directive.js'

export type StyleProps = Record<string, string | number | null | undefined | false>

/** `minHeight` → `min-height`, `webkitMask` → `-webkit-mask`; a dashed name is already CSS. */
function cssName(name: string): string {
  if (name.includes('-')) return name
  return name.replace(/(?:^(webkit|moz|ms|o)|)(?=[A-Z])/g, '-$&').toLowerCase()
}

class StylePropsDirective extends Directive {
  /** What this part set last, so a property that disappears is removed and not left behind. */
  private applied = new Set<string>()

  constructor(partInfo: PartInfo) {
    super(partInfo)
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error('styleProps only works on an element')
    }
  }

  render(_props: StyleProps): typeof nothing {
    return nothing
  }

  override update(part: ElementPart, [props]: [StyleProps]): typeof nothing {
    const { style } = part.element as HTMLElement | SVGElement
    const next = new Set<string>()
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue
      const name = cssName(key)
      next.add(name)
      style.setProperty(name, String(value))
    }
    for (const name of this.applied) {
      if (!next.has(name)) style.removeProperty(name)
    }
    this.applied = next
    return nothing
  }
}

/** Applies CSS declarations to the element through the CSSOM. */
export const styleProps = directive(StylePropsDirective)
