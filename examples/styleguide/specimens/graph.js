// The graph category (Netwerk): the specimens of its elements.
import { log } from '../shared.js'
import {
  caseGraph,
  groupGraph,
  networkGraph,
  partnerGraph,
  personGraph,
  personGraphWith,
  ruleGraph,
  sourceGraph,
  stateGraph,
} from '../../_data/graph.js'

const GRAPH_TILE = '<lintje-graph></lintje-graph>'
const EVENTS = ['lintje-node-select', 'lintje-node-toggle', 'lintje-node-expand']

/**
 * A host that keeps what the reader chose, folded and opened, as it would in its URL, and loads
 * the neighbours of a node with `more` when asked, a moment later.
 */
function host(tile) {
  tile.addEventListener('lintje-node-select', (event) => {
    tile.data = { ...tile.data, selected: event.detail.id }
  })
  tile.addEventListener('lintje-node-toggle', (event) => {
    const { id, open } = event.detail
    const opened = tile.data.opened ?? []
    const collapsed = tile.data.collapsed ?? []
    if (id.startsWith('groep:')) tile.data = { ...tile.data, opened: [...opened, id] }
    else
      tile.data = {
        ...tile.data,
        collapsed: open ? collapsed.filter((item) => item !== id) : [...collapsed, id],
      }
  })
}

function graphSetup(data, extra = {}) {
  return (stage) => {
    const tile = stage.querySelector('lintje-graph')
    tile.data = {
      footnote: 'Bron: fictieve demogegevens',
      expandable: true,
      download: { filename: 'relaties' },
      ...data,
      ...extra,
    }
    host(tile)
    const say = log(stage)
    for (const name of EVENTS) {
      tile.addEventListener(name, (event) => say(`${name} ${JSON.stringify(event.detail)}`))
    }
  }
}

/** The person graph that grows: the host loads what hangs behind a node when the reader asks. */
function growSetup(stage) {
  graphSetup(personGraph, { title: 'Een persoon en diens relaties', layout: undefined })(stage)
  const tile = stage.querySelector('lintje-graph')
  const loaded = []
  tile.addEventListener('lintje-node-expand', (event) => {
    setTimeout(() => {
      loaded.push(event.detail.id)
      const { nodes, edges } = personGraphWith(loaded)
      tile.data = { ...tile.data, nodes, edges }
    }, 800)
  })
}

/** A small tile for one state of a node. */
function stateSetup(data, extra = {}, after) {
  return (stage) => {
    const tile = stage.querySelector('lintje-graph')
    tile.data = { ...stateGraph, layout: 'layered-down', height: 360, ...data, ...extra }
    host(tile)
    if (after) void tile.updateComplete.then(() => requestAnimationFrame(() => after(tile)))
  }
}

/** The node by its id, in the tile's drawing. */
const nodeIn = (tile, id) => tile.shadowRoot.querySelector(`[data-node="${id}"]`)

export default {
  elements: [
    {
      tag: 'lintje-graph',
      wide: true,
      title: 'Entiteitendiagram: knopen en relaties die zichzelf indelen, in- en uitklappen en zoomen',
      specimens: [
        {
          label: 'Een zaak met haar betrokkenen',
          note: 'Eén knoop houdt de meeste andere vast, dus radiaal: de lijnen buigen om het middelpunt, met het woord van elke relatie erop.',
          html: GRAPH_TILE,
          setup: graphSetup(caseGraph, { title: 'Zaak 2026-04471' }),
        },
        {
          label: 'Waar de cijfers vandaan komen',
          note: 'Een keten van gerichte relaties, dus gelaagd naar rechts; een relatie met een getal tekent dikker.',
          html: GRAPH_TILE,
          setup: graphSetup(sourceGraph, { title: 'Herkomst van de cijfers' }),
        },
        {
          label: 'Gelaagd met haakse lijnen',
          note: 'Met `lines: \'orthogonal\'` tekent een gelaagde indeling in rechte hoeken.',
          html: GRAPH_TILE,
          setup: graphSetup(sourceGraph, { title: 'Herkomst van de cijfers, haaks', lines: 'orthogonal' }),
        },
        {
          label: 'Wie met wie samenwerkt',
          note: 'Een hiërarchie waarin een gemeente en een stichting twee ouders hebben: gelaagd omlaag.',
          html: GRAPH_TILE,
          setup: graphSetup(partnerGraph, { title: 'Samenwerking' }),
        },
        {
          label: 'Regelingen die naar elkaar verwijzen',
          note: 'Een kring en een relatie in beide richtingen: kracht. De status staat onder de naam, met zijn stip.',
          html: GRAPH_TILE,
          setup: graphSetup(ruleGraph, { title: 'Regelingen' }),
        },
        {
          label: 'Een persoon die groeit op aanvraag',
          note: 'Een knoop met `more` haalt zijn relaties op met `lintje-node-expand`; de teller is bezig tot de host ze stuurt. Meer dan vijf van één soort worden een groep.',
          html: GRAPH_TILE,
          setup: growSetup,
        },
        {
          label: 'Een netwerk van tweehonderd knopen',
          note: 'Boven honderd knopen wordt de indeling in een worker berekend; uitgezoomd is een knoop een merkteken en staat rechtsonder het overzicht.',
          html: GRAPH_TILE,
          setup: graphSetup(networkGraph(), { title: 'Netwerk' }),
        },
        {
          label: 'Rust',
          note: 'Niets achter een knoop te zien: geen teller. De "−" van het middelpunt wacht op de aanwijzer.',
          html: GRAPH_TILE,
          setup: stateSetup({ title: 'Rust' }),
        },
        {
          label: 'Onder de aanwijzer',
          note: 'De lichte vulling en de "−"; na 300 ms de tooltip met de relaties als zinnen.',
          html: GRAPH_TILE,
          setup: stateSetup({ title: 'Onder de aanwijzer' }, {}, (tile) =>
            nodeIn(tile, 'rvg')?.dispatchEvent(new PointerEvent('pointerenter')),
          ),
        },
        {
          label: 'Met focus',
          note: 'De focusring, de "−" en de tooltip meteen. Tab gaat van de knoop naar haar teller; de pijltjes gaan naar een buur, Home naar het middelpunt.',
          html: GRAPH_TILE,
          setup: stateSetup({ title: 'Met focus' }, {}, (tile) => {
            // Only where nothing else holds the focus: a reader on the page keeps theirs.
            if (document.activeElement === document.body) nodeIn(tile, 'rvg')?.focus({ preventScroll: true })
          }),
        },
        {
          label: 'Gekozen',
          note: 'De accentrand en de lichte vulling, zonder tooltip: de host toont de relaties van de gekozen knoop. De buren blijven in het licht.',
          html: GRAPH_TILE,
          setup: stateSetup({ title: 'Gekozen', selected: 'rvg' }),
        },
        {
          label: 'Ingeklapt',
          note: 'De "+3" staat altijd; de tooltip noemt eerst wat verborgen is. Wat achter een knoop hangt, bereikt het middelpunt alleen via die knoop.',
          html: GRAPH_TILE,
          setup: stateSetup({ title: 'Ingeklapt', collapsed: ['rvg'] }),
        },
        {
          label: 'Groep',
          note: 'Meer dan vijf van één soort aan één knoop: een stapeltje met de "+12"; een klik op de teller opent ze.',
          html: GRAPH_TILE,
          setup: stateSetup(groupGraph, { title: 'Groep' }),
        },
        {
          label: 'Buiten het licht',
          note: 'Een andere knoop is gekozen: wat er niet aan hangt, stapt terug. Het icoon, de rand en de lijn vervagen tot 45 %, de naam blijft leesbaar.',
          html: GRAPH_TILE,
          setup: stateSetup({ title: 'Buiten het licht', selected: 'dienst' }),
        },
        {
          label: 'Uitgezoomd',
          note: 'Een merkteken met het icoon in de kleur van zijn soort, de naam ernaast waar hij past; ver uitgezoomd alleen het icoon.',
          html: GRAPH_TILE,
          setup: graphSetup(networkGraph(), { title: 'Uitgezoomd', height: 280 }),
        },
      ],
    },
  ],
}
