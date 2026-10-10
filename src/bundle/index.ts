/**
 * The bundle: one module a plain HTML page includes; every `lintje-…` tag is registered.
 * `define()` leaves a tag another copy already defined alone. `tokens.css` and `fonts.css` stay
 * files: themes are document-level and a shadow root ignores `@font-face`. A page takes this
 * module or the category/tag entries (`core.ts`, `forms.ts`, `tag/<name>.js`), never both: they
 * do not share module state.
 */
import '../icons/icon/icon'
import { CATEGORIES, tagsOf } from '../categories'

export * from './core'
export { LintjeIcon, ICON_NAMES } from '../icons/icon/icon'
export * from '../primitives'
export * from '../components'
export * from '../components/shared/charts'
export { CATEGORIES, SECTIONS, tagsOf } from '../categories'
export type { Category } from '../categories'
export type * from '../types'

/** Every tag this bundle defines, for a host that wants to check. */
export const LINTJE_TAGS: readonly string[] = CATEGORIES.flatMap(tagsOf)

/** The views a host mounts: the tags that take a `data` object straight from the host. */
export const LINTJE_VIEWS = [
  'shell',
  'page-header',
  'filter-bar',
  'kpi-row',
  'chart',
  'data-table',
  'announcement',
  'map',
  'explainer',
  'note',
  'chat',
] as const

export type LintjeViewName = (typeof LINTJE_VIEWS)[number]

/** The tag of a view: `lintje-` plus its name. */
export const tagFor = (view: LintjeViewName): string => `lintje-${view}`

export const LINTJE_VIEW_TAGS: readonly string[] = LINTJE_VIEWS.map(tagFor)
