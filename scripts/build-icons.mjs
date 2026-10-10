/**
 * Assembles `dist-icons/` and writes `src/icons/register.ts` (`npm run build:icons`, and on
 * `npm install`). The folder is RVO's set (`@nl-rvo/assets`), each `<category>/<name>.svg` as
 * `<category>-<name>.svg`, with `assets/icons/` over it: the generic controls RVO lacks and the
 * emblems. The register holds what a component draws itself; every other name is fetched by name
 * (`src/icons/loader.ts`).
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { normaliseSvg } from '../src/icons/normalise.mjs'

const RVO_DIR = fileURLToPath(new URL('../node_modules/@nl-rvo/assets/icons/', import.meta.url))
const OWN_DIR = fileURLToPath(new URL('../assets/icons/', import.meta.url))
const ICON_DIR = fileURLToPath(new URL('../dist-icons/', import.meta.url))
const OUT = fileURLToPath(new URL('../src/icons/register.ts', import.meta.url))

const svgs = (dir) => readdirSync(dir).filter((file) => file.endsWith('.svg'))

/** One flat folder; two RVO files that flatten to one name are an error, an own file wins. */
function assemble() {
  rmSync(ICON_DIR, { recursive: true, force: true })
  mkdirSync(ICON_DIR)
  const from = new Map()
  for (const category of readdirSync(RVO_DIR, { withFileTypes: true })) {
    if (!category.isDirectory()) continue
    for (const file of svgs(`${RVO_DIR}${category.name}`)) {
      const name = `${category.name}-${file}`.toLowerCase()
      if (from.has(name)) throw new Error(`Two RVO files are both "${name}"`)
      from.set(name, `${RVO_DIR}${category.name}/${file}`)
    }
  }
  for (const file of svgs(OWN_DIR)) from.set(file.toLowerCase(), `${OWN_DIR}${file}`)
  for (const [name, source] of from) copyFileSync(source, `${ICON_DIR}${name}`)
}

/** Every icon by file name. */
function readIcons() {
  const icons = new Map()
  for (const file of svgs(ICON_DIR).sort()) {
    const name = file.slice(0, -'.svg'.length)
    icons.set(name, {
      name,
      file,
      ...normaliseSvg(name, readFileSync(`${ICON_DIR}${file}`, 'utf8')),
    })
  }
  return icons
}

/**
 * The icons a component draws by name itself. Keep it tight: every other name is fetched. A name
 * without a category RVO knows (`multimedia-`, `kantoor-label`) or one RVO draws otherwise is an
 * own file: a control RVO lacks, or one of a pair or family that must look alike.
 */
const COMPONENT_ICONS = [
  'functioneel-foto-vergroten', // the tile's Vergroot
  'functioneel-downloaden', // the tile's Download
  'functioneel-kruis', // modal, sheet, chip, announcement, toast
  'functioneel-vinkje', // selected
  'functioneel-delta-omlaag', // select, accordion, table sort, filter toggle
  'functioneel-delta-rechts', // drilldown, pagination
  'functioneel-waarschuwing', // the warning announcement's mark, error state, input error
  'functioneel-foutmelding', // the outage announcement's and the error toast's mark
  'functioneel-info', // the info announcement's mark; inline alert
  'functioneel-cirkel-vinkje', // the ok announcement's and the ok toast's mark
  'functioneel-zoek', // search field
  'functioneel-kalender', // date range
  'lichaam-oog', // the "Je ziet" sentence
  'functioneel-externe-link', // share menu: link to this view
  'functioneel-menu', // mobile header
  'functioneel-refresh', // map: the reset, whole area and nothing chosen
  'functioneel-lasso', // map: choose with a lasso
  'functioneel-cirkelselectie', // map: choose with a circle
  'functioneel-rechthoekselectie', // map: choose with a rectangle
  'functioneel-selectie', // map: the select button, no shape in hand yet
  'functioneel-locatiemarker', // map: set as scope
  'functioneel-minus', // the number field's stepper (also the map's zoom out)
  'functioneel-plus', // the number field's stepper (also the map's zoom in)
  'functioneel-filters', // the filter bar and the mobile Filters button
  'functioneel-instellingen', // the table's column chooser
  'gebruiksvoorwerpen-hangslot-dicht', // a menu entry without access
  'functioneel-printer', // share menu: print
  'functioneel-mail', // share menu: send as e-mail; the feedback row
  'functioneel-smartphone', // share menu: open on my phone
  'functioneel-terug', // share menu: back from the QR code
  'functioneel-darkmode', // top bar: the Weergave button; follow the system
  'functioneel-punaise-outline', // the menu's pin, loose
  'functioneel-punaise', // the menu's pin, fixed
  'functioneel-delen', // top bar: the Delen button
  'functioneel-uitloggen', // Afmelden, in the user block
  'functioneel-upload', // file upload
  'functioneel-kopieren', // copy button; chat: copy an answer
  'functioneel-wissel-horizontaal', // translator: swap the languages
  'functioneel-klok', // time input; recording status: the running time
  'beeld-en-geluid-microfoon', // recording status: the sound
  'functioneel-verwijderen', // repeater row, menu: remove
  'functioneel-meer', // row menu, list row actions
  'functioneel-sleep', // sortable list: the grip
  'functioneel-vergrootglas-plus', // document viewer: zoom in
  'functioneel-vergrootglas-minus', // document viewer: zoom out
  'functioneel-bewerken', // editable cell, transcript segment; chat: edit a sent question
  'functioneel-bel', // notifications
  'functioneel-dubbel-delta-rechts', // audio player: skip 15 s (flipped for back)
  'functioneel-geluid-aan', // audio player: mute
  'functioneel-geluid-uit', // audio player: muted
  'multimedia-player-vooruitspoelen', // audio player: before the speed
  'multimedia-player-afspelen', // audio and video player: play
  'multimedia-player-pauze', // audio and video player: pause
  'multimedia-player-full-screen', // video player: full screen
  'multimedia-player-full-screen-uitgaan', // video player: leave full screen
  'functioneel-geluid-aan', // video player: mute
  'functioneel-geluid-uit', // video player: sound on again
  'op-kantoor-document-blanco', // file upload: a file row
  'functioneel-refresh', // chat: answer again, try again; video player: load again
  'lichaam-duim-omhoog', // chat: a good answer
  'lichaam-duim-omlaag', // chat: a bad answer
  'functioneel-verzenden', // chat: send the question
  'multimedia-player-stop', // chat: stop an answer that is arriving
  'functioneel-pijl-omlaag', // chat: to the newest turn
  'gereedschap-half-tandwiel-half-brein', // AI label: made by a model
]

assemble()
const icons = readIcons()

const chosen = [...icons.values()].filter((icon) => COMPONENT_ICONS.includes(icon.name))

const missing = COMPONENT_ICONS.filter((name) => !icons.has(name))
if (missing.length) throw new Error(`No file in dist-icons/ for: ${missing.join(', ')}`)

const line = (icon) => {
  const attributes = JSON.stringify(icon.attributes)
  const body = JSON.stringify(icon.body)
  return `  '${icon.name}': { viewBox: '${icon.viewBox}', attributes: ${attributes}, body: ${body} },`
}

writeFileSync(
  OUT,
  `/**
 * Generated by \`npm run build:icons\` — do not edit.
 *
 * The icons the bundle carries itself: the chrome a component draws by name.
 * Every other icon is fetched by name when a name needs it
 * (\`src/icons/loader.ts\`); the name is always the file name.
 *
 * ${chosen.length} icons, of ${icons.size} in \`dist-icons/\`.
 */

export interface IconGlyph {
  /** The file's own viewBox: 64 or 48 in RVO's set, 24 for an own icon, 346x75 for an emblem. */
  viewBox: string
  /** The root attributes that carry the drawing style (fill, stroke, …). */
  attributes: Record<string, string>
  /** The markup inside the \`<svg>\`. */
  body: string
}

export const ICONS: Record<string, IconGlyph> = {
${chosen.map(line).join('\n')}
}

/** The names the bundle carries. Every other name goes through the loader. */
export type IconName = keyof typeof ICONS
`,
)

console.log(`${chosen.length} of ${icons.size} icons → src/icons/register.ts`)
