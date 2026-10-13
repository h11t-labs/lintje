/**
 * The Fundament pages: the tokens a component may name (`tokens.json`, read from `tokens.css`
 * by the build), grouped by what they are for. Each shows its value as the reader's mode and
 * theme compute it, through `<lintje-token-value>`, and its comment from the source. A token
 * stands on the first page and in the first group that claim it; what no group claims stands
 * under "Overige", so a new token is never left out.
 */
import { follow, section } from './page.js'

const TINT = /-tint-\d+$/
const STATUS = /^--color-(success|warning|attention|error|info)(-bg|-line|-text)?$/
const STATUS_ROWS = [
  ['success', 'Succes'],
  ['warning', 'Waarschuwing'],
  ['attention', 'Aandacht'],
  ['error', 'Fout'],
  ['info', 'Informatie'],
]
const STATUS_ROLES = [
  ['', 'Kleur'],
  ['-bg', 'Vlak'],
  ['-line', 'Lijn'],
  ['-text', 'Woord'],
]

/** A group that claims the names its pattern matches. */
const by = (pattern) => (name) => pattern.test(name)
/** A data colour and its tints: what has a ladder. */
const laddered = (name, names) =>
  name.startsWith('--color-chart-') && (TINT.test(name) || names.has(`${name}-tint-2`))

/**
 * What each page claims, by its name, and its groups; its label and intro stand in `menu.js`.
 * `show` is how a group draws its tokens beside their value; without it, the value is enough.
 */
const PAGES = {
  colour: {
    claims: by(/^--(color|tint)-/),
    groups: [
      {
        id: 'surfaces',
        label: 'Vlakken',
        note: 'Waar alles op staat: de pagina, de tegel en de vlakken die iets afbakenen of afdekken.',
        claims: by(/^--color-(bg|overlay)-/),
      },
      {
        id: 'text',
        label: 'Tekst',
        note: 'Op het oppervlak haalt elke tekstkleur 4.5:1, ook de placeholder.',
        claims: by(/^--color-text-/),
      },
      {
        id: 'borders',
        label: 'Lijnen',
        note: 'Een rand die alleen scheidt, en een die gezien moet worden: 3:1.',
        claims: by(/^--color-border-/),
      },
      {
        id: 'action',
        label: 'Actie en accent',
        note: 'Uit het thema. In donker splitst het accent in een vlak, een lijn (3:1) en een woord (4.5:1).',
        claims: by(/^--color-(action-|link|accent|focus$)/),
      },
      {
        id: 'status',
        label: 'Status',
        note: 'Vijf statussen in de rollen die ze hebben: de kleur zelf, een vlak, een lijn en een woord. Altijd met een glyph of tekst ernaast.',
        claims: by(STATUS),
        show: 'status',
      },
      {
        id: 'navigation',
        label: 'Menu, kop en voet',
        note: 'De themavulling van het menu, de balk, de hero en de voet; in donker neutraal.',
        claims: by(/^--color-(nav|navbar|logobar|logo-|hero|footer|focus-on)/),
      },
      {
        id: 'data',
        label: 'Datakleuren',
        note: 'Eén kleur per variabele, genoemd naar de Rijkshuisstijlkleur die hij is, met zijn tintladder. Gelijk in licht, donker en elk thema.',
        claims: laddered,
        show: 'ladder',
      },
      {
        id: 'chart',
        label: 'Grafiek',
        note: 'Grijs voor vergelijking, de nullijn, het raster en de nadruk voor trend, drempel en doel.',
        claims: by(/^--color-chart-/),
      },
      {
        id: 'map',
        label: 'Kaart',
        note: 'Land, water en grenzen onder de lagen van een kaart.',
        claims: by(/^--color-map-/),
      },
      {
        id: 'elements',
        label: 'Voor één element',
        note: 'Wat één element zelf noemt: de QR-code, de lijn onder een term, een gekozen optie en de tint onder een spreker.',
        claims: by(/^--(color-(qr|term|choice)-|tint-)/),
      },
    ],
  },
  typography: {
    claims: by(/^--(font|text|label|kpi)-/),
    groups: [
      {
        id: 'fonts',
        label: 'Lettertypen',
        note: 'De RijksSans uit de huisstijl, met Source Sans 3 als terugval; monospace voor code en tokens.',
        claims: by(/^--font-/),
        show: 'family',
      },
      {
        id: 'headings',
        label: 'Koppen',
        note: 'Van de titel van een startpagina tot de kop van een tegel. Onder 768 px neemt een kop zijn mobiele maat.',
        claims: by(/^--text-(dashboard|h\d|tile-title)/),
        show: 'text',
      },
      {
        id: 'figures',
        label: 'Cijfers en assen',
        note: 'Kerncijfers groot en vet; aslabels en datalabels op 12 px.',
        claims: by(/^--text-(kpi|axis)/),
        show: 'text',
      },
      {
        id: 'body',
        label: 'Tekst',
        note: 'Lopende tekst leest op 1.5; bediening en tabellen staan dichter.',
        claims: by(/^--text-/),
        show: 'text',
      },
      {
        id: 'labels',
        label: 'Labels en spatiëring',
        note: 'Een label in hoofdletters boven een groep, en de spatiëring van een kerncijfer.',
        claims: by(/^--(label|kpi)-/),
      },
    ],
  },
  size: {
    claims: () => true,
    groups: [
      {
        id: 'space',
        label: 'Ruimte',
        note: 'Elke marge en elke tussenruimte is een stap van deze schaal.',
        claims: by(/^--space-/),
        show: 'space',
      },
      {
        id: 'heights',
        label: 'Hoogtes',
        note: 'Een veld, een knop en een tabelrij zijn even hoog, zodat ze op één lijn staan.',
        claims: by(/^--h-/),
        show: 'height',
      },
      {
        id: 'widths',
        label: 'Breedtes',
        note: 'Het menu, de tekstkolom, de inhoud en wat een lijst van kaarten smaller maakt.',
        claims: by(/^--w-/),
      },
      {
        id: 'page',
        label: 'Pagina, tegel en grafiek',
        note: 'De marges van de pagina en de tegel, en de hoogtes van een grafiek.',
        claims: by(/^--(page|tile|chart-h|grid|hero|lintje)-/),
      },
      {
        id: 'corner',
        label: 'Hoek, rand en focus',
        note: 'Geen afgeronde hoeken; alleen een stip of avatar is rond. De rand van de open pagina in het menu, en de focus: altijd 3 px, nooit geanimeerd.',
        claims: by(/^--(radius|focus|nav-edge)/),
      },
      {
        id: 'shadows',
        label: 'Schaduwen',
        note: 'Alleen deze: iets ligt boven de pagina of scrollt verder. Nooit een zwevende kaart.',
        claims: by(/^--shadow-/),
        show: 'shadow',
      },
      {
        id: 'motion',
        label: 'Beweging',
        note: 'Kort en zonder veer. Wie minder beweging vraagt, krijgt alleen een korte overgang in doorzichtigheid.',
        claims: by(/^--(dur|ease)-/),
      },
    ],
  },
}

/** The name of the page a token stands on. */
export const pageOf = (token) => Object.keys(PAGES).find((page) => PAGES[page].claims(token))

/** A page's groups with their tokens, in the order of `tokens.css`; "Overige" for the rest. */
export function groupsOf(page, tokens) {
  const names = new Set(tokens.map((token) => token.name))
  const groups = PAGES[page].groups.map((group) => ({ ...group, tokens: [] }))
  const rest = { id: 'other', label: 'Overige', note: '', tokens: [] }
  for (const token of tokens) {
    if (pageOf(token.name) !== page) continue
    const group = groups.find((entry) => entry.claims(token.name, names)) ?? rest
    group.tokens.push(token)
  }
  return [...groups, rest].filter((group) => group.tokens.length)
}

function element(name, className, text) {
  const node = document.createElement(name)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

const valueOf = (name) => {
  const value = document.createElement('lintje-token-value')
  value.name = name
  return value
}

/** What a token looks like, beside its value, for a group that draws one. */
function sample(show, name) {
  if (show === 'family') {
    const node = element('span', 'guide__token-sample', 'Aa Bb Cc 0123456789')
    node.style.fontFamily = `var(${name})`
    return node
  }
  if (show === 'text') {
    const text = /kpi/.test(name)
      ? '12.480'
      : /axis/.test(name)
        ? 'jan feb mrt apr'
        : 'Aanvragen per regio'
    const node = element('span', 'guide__token-sample', text)
    node.style.font = `var(${name})`
    return node
  }
  const shape = { space: 'bar', height: 'box', shadow: 'shadow' }[show]
  if (!shape) return null
  const node = element('span', `guide__token-shape guide__token-shape--${shape}`)
  node.setAttribute('aria-hidden', 'true')
  if (shape === 'bar') node.style.width = `var(${name})`
  if (shape === 'box') node.style.height = `var(${name})`
  if (shape === 'shadow') node.style.boxShadow = `var(${name})`
  return node
}

/** A token: its name, its value, and what it looks like with its comment. */
function row({ name, comment }, show) {
  const node = element('div', 'guide__token')
  const body = element('div', 'guide__token-body')
  const drawn = sample(show, name)
  if (drawn) body.append(drawn)
  if (comment) body.append(element('p', 'guide__comment', comment))
  node.append(element('code', 'guide__token-name', name), valueOf(name), body)
  return node
}

/** A data colour's ladder: the colour and its tints side by side, a row per colour. */
function ladder(tokens) {
  const list = element('div', 'guide__ladders')
  const bases = tokens.filter((token) => !TINT.test(token.name))
  for (const base of bases) {
    const line = element('div', 'guide__ladder')
    line.append(element('code', 'guide__token-name', base.name))
    const steps = element('div', 'guide__ladder-steps')
    const own = (entry) => entry.name === base.name || entry.name.startsWith(`${base.name}-tint-`)
    for (const token of tokens.filter(own)) steps.append(valueOf(token.name))
    line.append(steps)
    list.append(line)
  }
  return list
}

/** The statuses against their roles; a role a status does not have is a dash. */
function statusTable(tokens) {
  const names = new Set(tokens.map((token) => token.name))
  const table = element('table', 'guide__status')
  table.append(element('caption', 'guide__meta', 'Elke status in haar rollen; een streep waar ze een rol niet heeft'))
  const head = table.createTHead().insertRow()
  head.append(element('th', '', 'Status'))
  for (const [suffix, label] of STATUS_ROLES) {
    const cell = element('th', '', label)
    cell.append(' ', element('code', 'guide__key', suffix || '--color-*'))
    head.append(cell)
  }
  const body = table.createTBody()
  for (const [status, label] of STATUS_ROWS) {
    const line = body.insertRow()
    const name = element('th', '', label)
    name.scope = 'row'
    line.append(name)
    for (const [suffix] of STATUS_ROLES) {
      const cell = line.insertCell()
      const token = `--color-${status}${suffix}`
      cell.append(names.has(token) ? valueOf(token) : '—')
    }
  }
  const wrap = element('div', 'guide__status-wrap')
  wrap.append(table)
  const notes = tokens
    .filter((token) => token.comment)
    .map((token) => element('p', 'guide__comment', `${token.name}: ${token.comment}`))
  if (!notes.length) return [wrap]
  const below = element('div', 'guide__token-notes')
  below.append(...notes)
  return [wrap, below]
}

/** A Fundament page: its groups as sections, "Op deze pagina" beside them. */
export function renderFoundationPage(host, page, tokens) {
  const toc = []
  const main = element('div', 'guide__main')
  for (const group of groupsOf(page.name, tokens)) {
    // The page's name in front: an id such as `elements` is the guide's own already.
    const node = section(`${page.name}-${group.id}`, group.label, toc)
    if (group.note) node.append(element('p', 'guide__note', group.note))
    const body = element('div', 'guide__tokens')
    if (group.show === 'ladder') body.append(ladder(group.tokens))
    else if (group.show === 'status') body.append(...statusTable(group.tokens))
    else body.append(...group.tokens.map((token) => row(token, group.show)))
    node.append(body)
    main.append(node)
  }
  const nav = document.createElement('lintje-sub-nav')
  nav.className = 'guide__toc'
  nav.expanded = true
  nav.label = 'Op deze pagina'
  const layout = element('div', 'guide__page')
  layout.append(main, nav)
  host.append(layout)
  follow(nav, toc)
}
