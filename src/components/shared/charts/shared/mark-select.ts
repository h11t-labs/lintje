/**
 * A chart mark that drills. A mark is clickable only when its data point carries a `href`;
 * without one it is inert. It goes to that page, so it is a link, unless the host keeps a
 * selection (`options.choosing`): then it chooses, a toggle with `aria-pressed`.
 *
 * The selection is not kept here: the chosen mark is whatever `options.selectedId` says, so
 * the URL is the only state. Clearing (the chosen mark again, or Escape) emits
 * `{id: null, href: clearHref}`; without a `clearHref` the clear is inert.
 */
import { nothing } from 'lit'
import { isNewTabClick } from '../../../../core/links'
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
  role: 'button' | 'link' | typeof nothing
  tabIndex: 0 | typeof nothing
  pressed: 'true' | 'false' | typeof nothing
  label: string | typeof nothing
  /** Bound to both `click` and `auxclick`: the middle button opens the mark's `href` in a new tab. */
  click: ((event: MouseEvent) => void) | typeof nothing
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
      const choosing = options.choosing ?? options.selectedId !== undefined
      return {
        clickable: true,
        state: `is-clickable ${selected ? 'is-selected' : active != null ? 'is-muted' : ''}`,
        markId: link.id,
        role: choosing ? 'button' : 'link',
        tabIndex: 0,
        pressed: choosing ? (selected ? 'true' : 'false') : nothing,
        label: sentence ?? label,
        // A modifier or middle click opens the href in a new tab, as on a link.
        click: (event: MouseEvent) => {
          if (isNewTabClick(event)) {
            event.preventDefault()
            options.onSelect?.({ id: link.id, label, href: link.href }, true)
          } else if (event.type === 'click') select(link, label)
        },
        // A link answers Enter; a toggle Enter and space, as a button does.
        keydown: (event: KeyboardEvent) => {
          if (event.key !== 'Enter' && (event.key !== ' ' || !choosing)) return
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
