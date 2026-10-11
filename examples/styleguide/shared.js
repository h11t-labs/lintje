/**
 * The style guide's contract: what every specimen module uses.
 *
 * A specimen module (`specimens/<name>.js`) exports one object:
 *
 *   export default {
 *     elements: [
 *       {
 *         tag: 'lintje-textarea',
 *         title: 'Meerregelig tekstveld met teller',
 *         specimens: [
 *           { label: 'Rust', html: '<lintje-textarea label="Omschrijving"></lintje-textarea>', preview: true },
 *           { label: 'Fout', html: '…', setup(stage) { stage.querySelector('…').items = [...] } },
 *         ],
 *       },
 *     ],
 *   }
 *
 * `html` is plain markup with the tags and their attributes; `setup(stage)` runs once, after
 * the markup stands, for what an attribute cannot carry: a rich property (`.items`, `.data`)
 * or a listener. It finds its nodes inside `stage`. `wide: true` on a specimen gives it the
 * full row; without it the specimens stand in columns. `columns: 2` or `3` on an element caps
 * them, for an element that reads badly side by side in a narrow column. `preview: true` marks
 * the one specimen the category's overview draws in the element's tile; without it the tile is
 * text.
 *
 * The code under a specimen is read from what it drew (`code.js`): its markup, and what `setup`
 * set, as a script sets it and as JSON in the markup.
 *
 * An element whose tag draws several kinds of one thing (a chart) has `groups`: one at a time
 * is shown, chosen in the URL (`param`), each with its own specimens; `specimens` then holds
 * what every group shares. `states` are drawn once, on the chosen group's first specimen, each
 * merging its `data` into the tag's `data`:
 *
 *   groups: { label: 'Soort', plural: 'soorten', param: 'soort', key: 'kind', question: 'Welke grafiek?',
 *             shared: 'Voor elke soort',
 *             questions: { time: 'Hoe verloopt het in de tijd?' },
 *             items: [{ value: 'line', label: 'Lijn', question: 'time', use, avoid, specimens }] },
 *   states: [{ value: 'ready', label: 'Klaar' }, { value: 'loading', label: 'Laden', data: { state: 'loading' } }],
 *
 * An element has its own page, `?element=<tag without lintje->`; `#el-<tag without lintje->`,
 * the older address, leads there. A section that shows no single tag names its own `id`
 * instead of a `tag`, and a `short` name for the menu. Which category an element stands in is
 * not the module's to say: `src/categories.json` lists them.
 */

/** The id of an element's section, as the older addresses name it. */
export const sectionId = ({ tag, id }) => id ?? `el-${tag.replace('lintje-', '')}`

/** The name of an element in the URL and the menu. */
export const nameOf = ({ tag, id }) => (tag ? tag.replace('lintje-', '') : id)

/** Every specimen of an element: the groups' and the shared ones. */
export const allSpecimens = (item) => [
  ...(item.groups?.items.flatMap((group) => group.specimens) ?? []),
  ...item.specimens,
]

/** Puts a state on the element's own tags in a stage: its `data` merged into theirs. */
export function applyState(stage, item, state) {
  if (!state?.data || !item.tag) return
  for (const node of stage.querySelectorAll(item.tag))
    if (node.data) node.data = { ...node.data, ...state.data }
}

function element(name, className, text) {
  const node = document.createElement(name)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

/**
 * A line under a specimen that shows what the host heard: returns the function that writes it.
 * It is the guide's, so it stands under the stage's frame, not in it.
 */
export function log(stage, text = 'Nog niets gebeurd.') {
  const line = logBlock(text)
  stage.closest('.guide__specimen').append(line)
  return (next) => (line.text = next)
}

/** A block of plain text in `lintje-code`: what the host heard, or what went wrong. */
function logBlock(text) {
  const block = document.createElement('lintje-code')
  block.className = 'guide__log'
  block.wrap = true
  block.label = 'Wat de host hoorde'
  block.text = text
  return block
}

/** A label as an id within its page: `Bezig: de breedte blijft` → `bezig-de-breedte-blijft`. */
export const slug = (text) =>
  text
    .toLocaleLowerCase('nl')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

/**
 * One specimen: its label, the stage the markup stands on, and `setup` run on it. `state`
 * is put on afterwards. The figure's `stage` is the stage, for the page to read what it drew.
 */
export function renderSpecimen({ label, html, setup, wide }, { item, state } = {}) {
  const figure = element('figure', wide ? 'guide__specimen guide__specimen--wide' : 'guide__specimen')
  if (label) {
    figure.id = `vb-${slug(label)}`
    const caption = element('figcaption', 'guide__caption')
    caption.append(element('span', 'guide__label', label))
    figure.append(caption)
  }
  const stage = element('div', 'guide__stage')
  stage.innerHTML = html ?? ''
  figure.append(stage)
  if (setup) {
    try {
      setup(stage)
    } catch (error) {
      console.error(error)
      stage.append(logBlock(String(error)))
    }
  }
  if (item && state) applyState(stage, item, state)
  figure.stage = stage
  return figure
}
