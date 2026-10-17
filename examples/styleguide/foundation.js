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
    show: 'colour',
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
        note: 'Wat één element zelf noemt: de QR-code, het beeld van een video, de lijn onder een term, de rand van een gekozen rij, het spoor van een voortgangsbalk, een gekozen optie, de dagen van een gekozen periode, de rand van een gekozen dag, de ring van vandaag in een periode, de tint onder een spreker en het rondje van een persoon.',
        claims: by(/^--(color-(qr|media|term|choice|selected|progress|range|chosen-day|today|avatar)-|tint-)/),
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
        show: 'corner',
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
        note: 'Kort en zonder veer. Druk op Afspelen: een duur loopt met de curve van wat binnenkomt, een curve op viermaal --dur-base, zodat je hem ziet. Wie minder beweging vraagt, krijgt alleen een korte overgang in doorzichtigheid.',
        claims: by(/^--(dur|ease)-/),
        show: 'motion',
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

/** A token's value; `plain` where the colour already stands beside it, larger. */
const valueOf = (name, plain = false) => {
  const value = document.createElement('lintje-token-value')
  value.name = name
  value.noSwatch = plain
  return value
}

/** A shape drawn with the token, for what is seen better than read. */
function shape(kind, style) {
  const node = element('span', `guide__token-shape guide__token-shape--${kind}`)
  node.setAttribute('aria-hidden', 'true')
  Object.assign(node.style, style)
  return node
}

/** A track with a block that crosses it in the token's time or curve, once Afspelen is pressed. */
function motion(name) {
  const track = shape('motion', {})
  const time = name.startsWith('--dur-') ? `var(${name})` : 'calc(4 * var(--dur-base))'
  const curve = name.startsWith('--ease-') ? `var(${name})` : 'var(--ease-in-motion)'
  track.style.setProperty('--guide-time', time)
  track.style.setProperty('--guide-curve', curve)
  track.append(element('span', 'guide__motion-block'))
  return track
}

/** The corner, the focus ring and the menu's edge, each drawn as what it is. */
function corner(name) {
  if (name.startsWith('--radius')) return shape('corner', { borderRadius: `var(${name})` })
  if (name.startsWith('--focus'))
    return shape('focus', {
      outline: 'var(--focus-width) solid var(--color-focus)',
      outlineOffset: 'var(--focus-offset)',
    })
  return shape('edge', { boxShadow: `inset var(${name}) 0 0 var(--color-nav-active-edge)` })
}

/** What a token looks like, beside its value, for a group that draws one. */
function sample(show, name) {
  // A share such as `--tint-speaker` stands among the colours, but is none.
  if (show === 'colour')
    return name.startsWith('--color-') ? shape('colour', { background: `var(${name})` }) : null
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
  if (show === 'space') return shape('bar', { width: `var(${name})` })
  if (show === 'height') return shape('box', { height: `var(${name})` })
  if (show === 'shadow') return shape('shadow', { boxShadow: `var(${name})` })
  if (show === 'corner') return corner(name)
  if (show === 'motion') return motion(name)
  return null
}

/** A token: its name, its value, and what it looks like with its comment. */
function row({ name, comment }, show) {
  const node = element('div', 'guide__token')
  const body = element('div', 'guide__token-body')
  const drawn = sample(show, name)
  if (drawn) body.append(drawn)
  if (comment) body.append(element('p', 'guide__comment', comment))
  const plain = drawn?.classList.contains('guide__token-shape--colour')
  node.append(element('code', 'guide__token-name', name), valueOf(name, plain), body)
  return node
}

/** A data colour's ladder: the colour and its tints as tiles side by side, a row per colour. */
function ladder(tokens) {
  const list = element('div', 'guide__ladders')
  const bases = tokens.filter((token) => !TINT.test(token.name))
  const stepsOf = (base) =>
    tokens.filter(
      (entry) => entry.name === base.name || entry.name.startsWith(`${base.name}-tint-`),
    )
  // The steps' names once, above the tiles: `kleur`, then the suffix of each tint.
  const head = element('div', 'guide__ladder guide__ladder--head')
  const names = element('div', 'guide__ladder-steps')
  for (const step of stepsOf(bases[0] ?? { name: '' })) {
    const label = TINT.test(step.name) ? step.name.match(TINT)[0].slice(1) : 'kleur'
    names.append(element('span', 'guide__key', label))
  }
  head.append(element('span', 'guide__key', '--color-chart-…'), names)
  list.append(head)
  for (const base of bases) {
    const line = element('div', 'guide__ladder')
    line.append(element('code', 'guide__token-name', base.name.replace('--color-chart-', '')))
    const steps = element('div', 'guide__ladder-steps')
    for (const token of stepsOf(base)) {
      const step = element('div', 'guide__ladder-step')
      step.append(shape('tile', { background: `var(${token.name})` }), valueOf(token.name, true))
      steps.append(step)
    }
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
      if (names.has(token))
        cell.append(shape('cell', { background: `var(${token})` }), valueOf(token, true))
      else cell.append('—')
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

/** Plays the movements of a group once more; under reduced motion each block only moves over. */
function playButton(body) {
  const button = document.createElement('lintje-button')
  button.variant = 'secondary'
  button.size = 'compact'
  button.icon = 'multimedia-player-afspelen'
  button.textContent = 'Afspelen'
  button.addEventListener('click', () => {
    body.classList.remove('is-playing')
    void body.offsetWidth
    body.classList.add('is-playing')
  })
  return button
}

/** A Fundament page: its groups as sections, "Op deze pagina" beside them. */
export function renderFoundationPage(host, page, tokens) {
  const toc = []
  const main = element('div', 'guide__main')
  for (const group of groupsOf(page.name, tokens)) {
    // The page's name in front: an id such as `elements` is the guide's own already.
    const node = section(`${page.name}-${group.id}`, group.label, toc)
    if (group.note) node.append(element('p', 'guide__note', group.note))
    const show = group.show ?? PAGES[page.name].show
    const body = element('div', 'guide__tokens')
    if (show === 'ladder') body.append(ladder(group.tokens))
    else if (show === 'status') body.append(...statusTable(group.tokens))
    else body.append(...group.tokens.map((token) => row(token, show)))
    if (show === 'motion') node.querySelector('.guide__section-head').append(playButton(body))
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
