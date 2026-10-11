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
 *           { label: 'Rust', html: '<lintje-textarea label="Omschrijving"></lintje-textarea>' },
 *           { label: 'Over de limiet', note: 'De teller zegt hoeveel korter.', html: '…' },
 *           { label: 'Fout', html: '…', setup(stage) { stage.querySelector('…').items = [...] } },
 *         ],
 *       },
 *     ],
 *   }
 *
 * `html` is plain markup with the tags and their attributes; `setup(stage)` runs once, after
 * the markup stands, for what an attribute cannot carry: a rich property (`.items`, `.data`)
 * or a listener. It finds its nodes inside `stage`. `label` is the specimen's title: short and
 * descriptive, at most 40 characters, without a colon, bracket or comma. `note` explains, when
 * that is needed, in one or two whole sentences: what it shows, when it applies, how to try it.
 * A specimen stands beside its title; `wide: true`, on a specimen or on its element, puts the
 * title above it and gives it the row's width, for an element that needs the room of a page.
 * The category's overview draws each element as a sketch, from its recipe in `sketches.js`.
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
  // A stage in a frame of its own logs under that frame, on the page.
  const figure =
    stage.closest('.guide__specimen') ??
    stage.ownerDocument.defaultView.frameElement?.closest('.guide__specimen')
  figure.append(line)
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

// A framed specimen's page: the tokens, the bundle and the little the stage lays out with.
const FRAME_STYLE = `
  body { margin: 0; background: var(--color-bg-surface); color: var(--color-text-primary);
    font: var(--text-ui); font-family: var(--font-ui); }
  .guide__stage { padding: var(--space-8); }
  .guide__row { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; }
  .guide__stack { display: flex; flex-direction: column; gap: var(--space-3); }`

function frameDocument(html) {
  const root = document.documentElement
  return `<!doctype html><html lang="nl" data-mode="${root.dataset.mode ?? 'light'}"
    data-theme="${root.dataset.theme ?? ''}"><head><meta charset="utf-8">
    <base href="${new URL('.', location.href)}">
    <link rel="stylesheet" href="../../src/tokens/fonts.css">
    <link rel="stylesheet" href="../../dist-elements/tokens.css">
    <style>${FRAME_STYLE}</style></head>
    <body><div class="guide__stage">${html ?? ''}</div><script type="module">
    import { setIconSource } from '../../dist-elements/lintje.js'
    setIconSource({ base: '../../dist-icons/' })
    </script></body></html>`
}

/** Runs a specimen's `setup` and puts its state on; an error shows on its stage. */
function prepare(stage, setup, item, state) {
  if (setup) {
    try {
      setup(stage)
    } catch (error) {
      console.error(error)
      stage.append(logBlock(String(error)))
    }
  }
  if (item && state) applyState(stage, item, state)
}

/**
 * One specimen: the stage its markup stands on, with `setup` run on it, in a figure that holds
 * what the guide adds around it. `state` is put on afterwards. The figure's `stage` is the
 * stage, for the page to read what it drew.
 *
 * `frame` draws it in a page of its own, open: an overlay is `position: fixed` and traps the
 * focus, so on the guide's page it would cover the guide and hold its keyboard. `true` opens the
 * element's own tags, a selector the ones it names. The frame is inert while the overlay opens,
 * so its focus does not pull the guide's page along.
 */
export function renderSpecimen({ label, html, setup, frame: own }, { item, state } = {}) {
  const figure = element('figure', 'guide__specimen')
  const frame = own ?? item?.frame
  if (frame) {
    const iframe = element('iframe', 'guide__frame')
    iframe.title = label ?? item?.tag ?? 'Voorbeeld'
    iframe.inert = true
    iframe.srcdoc = frameDocument(html)
    // Until the frame stands, the code is read from the markup alone.
    figure.stage = element('div')
    figure.stage.innerHTML = html ?? ''
    iframe.addEventListener(
      'load',
      async () => {
        const stage = iframe.contentDocument.querySelector('.guide__stage')
        prepare(stage, setup, item, state)
        const open = frame === true ? item?.tag : frame
        const overlays = open ? [...stage.querySelectorAll(open)] : []
        for (const node of overlays) node.open = true
        await Promise.all(overlays.map((node) => node.updateComplete))
        figure.stage = stage
        // A dialog moves its focus once its fields have drawn; one that still reaches out of the
        // frame gives it back, as the page had it.
        setTimeout(() => {
          iframe.inert = false
          if (document.activeElement === iframe) iframe.blur()
        }, 300)
      },
      { once: true },
    )
    figure.append(iframe)
    return figure
  }
  const stage = element('div', 'guide__stage')
  stage.innerHTML = html ?? ''
  figure.append(stage)
  prepare(stage, setup, item, state)
  figure.stage = stage
  return figure
}
