// The menu: the categories (`src/categories.json`, carried by the bundle) under their headings,
// in the order a page is built: the page around everything, the building blocks, what a reader
// fills in, and what shows data.
import { CATEGORIES } from '../../dist-elements/lintje.js'

export { CATEGORIES }

export const MENU = [...new Set(CATEGORIES.map((category) => category.heading))].map((heading) => ({
  heading,
  items: CATEGORIES.filter((category) => category.heading === heading),
}))

/** The category an address names with `?category=`. */
export const namedIn = (search) => search.get('category') ?? null
