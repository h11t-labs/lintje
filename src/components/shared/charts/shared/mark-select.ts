/**
 * A chart mark that drills. A mark is clickable only when its data point carries a `href`
 * (a `role="button"` with `aria-pressed`); without one it is inert.
 *
 * The selection is not kept here: the chosen mark is whatever `options.selectedId` says, so
 * the URL is the only state. Clearing (the chosen mark again, or Escape) emits
 * `{id: null, href: clearHref}`; without a `clearHref` the clear is inert.
 */
import { nothing } from 'lit'
import type { ChartOptions } from './controller'
import type { ChartLink } from './types'

/** What travels to the host on a click. */
export interface ChartSelection {
  id: string
  label: string
  href?: string
}

/** What a renderer writes onto its mark. `nothing` removes the attribute. */
export interface MarkAttributes {
  clickable: boolean
  /** The `is-*` states, to chain onto the mark's own BEM class. */
  state: string
  markId: string | typeof nothing
  role: 'button' | typeof nothing
  tabIndex: 0 | typeof nothing
  pressed: 'true' | 'false' | typeof nothing
  label: string | typeof nothing
  click: (() => void) | typeof nothing
  keydown: ((event: KeyboardEvent) => void) | typeof nothing
}

const INERT: MarkAttributes = {
  clickable: false,
  state: '',
  markId: nothing,
  role: nothing,
  tabIndex: nothing,
  pressed: nothing,
  label: nothing,
  click: nothing,
  keydown: nothing,
}

export interface MarkSelection {
  active: string | null
  /** Some mark is a button: the drawing around them is then a group, not an image. */
  interactive: boolean
  /** The attributes of one mark; `sentence` is what a screen reader hears, default the label. */
  of(link: ChartLink | null | undefined, label: string, sentence?: string): MarkAttributes
  escape(event: KeyboardEvent): void
}

/**
 * The selection of one chart; without an `onSelect` every mark is inert. A `selectedId`
 * that names none of `links` is not a selection: muting every mark for a highlight that is
 * nowhere would leave a grey chart.
 */
export function markSelection(
  options: ChartOptions,
  links: Iterable<ChartLink | null | undefined>,
): MarkSelection {
  const drawn = new Set<string>()
  for (const link of links) if (link?.href) drawn.add(link.id)
  const active =
    options.selectedId != null && drawn.has(options.selectedId) ? options.selectedId : null
  const clear = () => {
    if (active != null) options.onClear?.(active)
  }
  const select = (link: ChartLink, label: string) => {
    if (link.id === active) return clear()
    options.onSelect?.({ id: link.id, label, href: link.href })
  }
  return {
    active,
    interactive: Boolean(options.onSelect) && drawn.size > 0,
    of(link, label, sentence) {
      if (!link?.href || !options.onSelect) {
        // Still dimmed when another mark is chosen, so the highlight stands out.
        return active != null ? { ...INERT, state: 'is-muted' } : INERT
      }
      const selected = link.id === active
      return {
        clickable: true,
        state: `is-clickable ${selected ? 'is-selected' : active != null ? 'is-muted' : ''}`,
        markId: link.id,
        role: 'button',
        tabIndex: 0,
        pressed: selected ? 'true' : 'false',
        label: sentence ?? label,
        click: () => select(link, label),
        keydown: (event: KeyboardEvent) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          select(link, label)
        },
      }
    },
    escape(event) {
      // Only while something is chosen, so an enclosing modal keeps Escape otherwise.
      if (event.key !== 'Escape' || active == null) return
      event.stopPropagation()
      clear()
    },
  }
}
