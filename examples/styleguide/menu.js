// The menu: the Fundament pages, then the categories (`src/categories.json`, carried by the
// bundle) under their headings, in the order a page is built: the page around everything, the
// building blocks, what a reader fills in, and what shows data.
import { CATEGORIES } from '../../dist-elements/lintje.js'

export { CATEGORIES }

/** The tokens, a page per kind (`foundation.js`); no category, since they are no tags. */
export const FOUNDATION = {
  heading: 'Fundament',
  items: [
    {
      name: 'colour',
      label: 'Kleur',
      icon: 'gebruiksvoorwerpen-kleurenwaaier',
      intro: 'Elke kleur die een component noemt, naar wat hij betekent. Een component noemt nooit een primitief: alleen deze namen.',
    },
    {
      name: 'typography',
      label: 'Typografie',
      icon: 'op-kantoor-boek-opengeslagen',
      intro: 'Twee lettertypen en een vaste set tekststijlen. Een component zet font: var(--text-…), nooit een losse maat of dikte.',
    },
    {
      name: 'size',
      label: 'Maat en beweging',
      icon: 'gebruiksvoorwerpen-potlood-en-liniaal',
      intro: 'De 4 px-schaal voor ruimte, de vaste hoogtes van bedieningselementen, de enige schaduwen en hoe iets beweegt. Geen afgeronde hoeken.',
    },
  ],
}

export const MENU = [...new Set(CATEGORIES.map((category) => category.heading))].map((heading) => ({
  heading,
  items: CATEGORIES.filter((category) => category.heading === heading),
}))

/** The category an address names with `?category=`. */
export const namedIn = (search) => search.get('category') ?? null
