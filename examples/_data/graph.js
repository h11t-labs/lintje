// Fictional graphs for the entity diagram: five situations from different applications and a
// network of two hundred nodes. Every name is made up.

const KIND = {
  zaak: { key: 'zaak', label: 'Zaak', plural: 'Zaken', icon: 'op-kantoor-map-vol-documenten' },
  persoon: { key: 'persoon', label: 'Persoon', plural: 'Personen', icon: 'personen-genderneutraal' },
  organisatie: { key: 'organisatie', label: 'Organisatie', plural: 'Organisaties', icon: 'gebouwen-basis-kantoorgebouw' },
  adres: { key: 'adres', label: 'Adres', plural: 'Adressen', icon: 'gebouwen-rijtjeshuis' },
  document: { key: 'document', label: 'Document', plural: 'Documenten', icon: 'op-kantoor-document-met-lijnen' },
  register: { key: 'register', label: 'Register', plural: 'Registers', icon: 'computer-en-internet-basisregistratie' },
  systeem: { key: 'systeem', label: 'Systeem', plural: 'Systemen', icon: 'computer-en-internet-server' },
  toepassing: { key: 'toepassing', label: 'Toepassing', plural: 'Toepassingen', icon: 'computer-en-internet-applicatie' },
  rijk: { key: 'rijk', label: 'Rijksoverheid', plural: 'Rijksorganisaties', icon: 'gebouwen-basis-kantoorgebouw' },
  decentraal: { key: 'decentraal', label: 'Medeoverheid', plural: 'Medeoverheden', icon: 'gebouwen-gemeentehuis' },
  partner: { key: 'partner', label: 'Maatschappelijke organisatie', plural: 'Maatschappelijke organisaties', icon: 'gezondheid-en-zorg-hart-tussen-2-uitgestoken-handen' },
  wet: { key: 'wet', label: 'Wet', plural: 'Wetten', icon: 'criminaliteit-wetboek' },
  besluit: { key: 'besluit', label: 'Besluit', plural: 'Besluiten', icon: 'op-kantoor-document-met-lijnen-en-lint' },
  regeling: { key: 'regeling', label: 'Regeling', plural: 'Regelingen', icon: 'op-kantoor-document-met-vinkjes-en-lijnen' },
}

const STATUS = {
  geldend: { label: 'geldend', tone: 'success' },
  voorbereiding: { label: 'in voorbereiding', tone: 'info' },
  vervallen: { label: 'vervallen', tone: 'subtle' },
}

const node = (id, label, type, extra = {}) => ({ id, label, type, ...extra })
const edge = (from, to, label, direction, extra = {}) => ({
  from,
  to,
  ...(label ? { label } : {}),
  ...(direction ? { direction } : {}),
  ...extra,
})
const many = (prefix, count, label, type) =>
  Array.from({ length: count }, (_, i) => node(`${prefix}${i + 1}`, `${label} ${i + 1}`, type))

/** A case and everyone involved in it: a hub with six parties. */
export const caseGraph = {
  types: [KIND.zaak, KIND.persoon, KIND.organisatie, KIND.adres, KIND.document],
  nodes: [
    node('zaak', 'Zaak 2026-04471', 'zaak'),
    node('adres', 'Dorpsstraat 12, Zutphen', 'adres'),
    node('vries', 'M. de Vries', 'persoon', { initials: 'MV' }),
    node('bureau', 'Bureau Rechtshulp', 'organisatie'),
    node('aanvraag', 'Aanvraag vergunning', 'document'),
    node('gemeente', 'Gemeente Zutphen', 'organisatie'),
    node('bakker', 'J. Bakker', 'persoon', { initials: 'JB' }),
  ],
  edges: [
    edge('zaak', 'adres', 'betreft'),
    edge('zaak', 'vries', 'aanvrager'),
    edge('zaak', 'bureau', 'gemachtigde'),
    edge('zaak', 'aanvraag', 'bijlage'),
    edge('zaak', 'bakker', 'behandelaar'),
    edge('zaak', 'gemeente', 'bevoegd gezag'),
    edge('bureau', 'vries', 'gemachtigde van'),
  ],
  description:
    'Zaak 2026-04471 in het midden, met haar adres, de aanvrager M. de Vries en diens gemachtigde, de aanvraag, de behandelaar en de gemeente als bevoegd gezag.',
}

/** Where the figures of a dashboard come from: directed, with records per day as thickness. */
export const sourceGraph = {
  types: [KIND.register, KIND.systeem, KIND.toepassing],
  nodes: [
    node('reg1', 'Register personen', 'register'),
    node('reg2', 'Register adressen', 'register'),
    node('zaak', 'Zaaksysteem', 'systeem'),
    node('knoop', 'Gegevensknoop', 'systeem'),
    node('dwh', 'Datawarehouse', 'systeem'),
    node('mijn', 'Mijn omgeving', 'toepassing'),
    node('dash', 'Dashboard', 'toepassing'),
    node('rap', 'Rapportage', 'toepassing'),
  ],
  edges: [
    edge('reg1', 'knoop', 'dagelijks', 'to', { value: 12000, unit: 'records per dag' }),
    edge('reg2', 'knoop', 'dagelijks', 'to', { value: 8000, unit: 'records per dag' }),
    edge('zaak', 'dwh', 'elk uur', 'to', { value: 300, unit: 'records per dag' }),
    edge('knoop', 'dwh', 'nachtelijk', 'to', { value: 20000, unit: 'records per dag' }),
    edge('knoop', 'mijn', 'live', 'to', { value: 1500, unit: 'records per dag' }),
    edge('dwh', 'dash', 'nachtelijk', 'to', { value: 20000, unit: 'records per dag' }),
    edge('dwh', 'rap', 'per maand', 'to', { value: 600, unit: 'records per dag' }),
  ],
  description:
    'Twee registers en een zaaksysteem leveren via een gegevensknoop en een datawarehouse aan drie toepassingen; de lijndikte is het aantal records per dag.',
}

/** Who works with whom: a hierarchy in which a municipality and a foundation have two parents. */
export const partnerGraph = {
  types: [KIND.rijk, KIND.decentraal, KIND.partner],
  nodes: [
    node('min', 'Ministerie van Wonen', 'rijk'),
    node('dienst', 'Dienst Subsidies', 'rijk'),
    node('rvg', 'Rijksdienst Gegevens', 'rijk'),
    node('zut', 'Gemeente Zutphen', 'decentraal'),
    node('dev', 'Gemeente Deventer', 'decentraal'),
    node('prov', 'Provincie Overijssel', 'decentraal'),
    node('stich', 'Stichting Welzijn', 'partner'),
  ],
  edges: [
    edge('min', 'dienst', '', 'none'),
    edge('min', 'rvg', '', 'none'),
    edge('dienst', 'zut', '', 'none'),
    edge('dienst', 'dev', '', 'none'),
    edge('rvg', 'dev', '', 'none'),
    edge('rvg', 'prov', '', 'none'),
    edge('dev', 'stich', 'subsidie'),
    edge('zut', 'stich', 'subsidie'),
  ],
  description:
    'Het ministerie werkt via een dienst en een rijksdienst met twee gemeenten en een provincie; Gemeente Deventer en Stichting Welzijn hebben elk twee partners boven zich.',
}

/** Regulations that refer to each other: dense, with a ring, and a status per node. */
export const ruleGraph = {
  types: [KIND.wet, KIND.besluit, KIND.regeling],
  nodes: [
    node('w1', 'Wet basisregistratie', 'wet', { status: STATUS.geldend }),
    node('b1', 'Besluit registraties', 'besluit', { status: STATUS.geldend }),
    node('w2', 'Wet digitale overheid', 'wet', { status: STATUS.geldend }),
    node('r1', 'Regeling aansluiting', 'regeling', { status: STATUS.geldend }),
    node('r3', 'Regeling levering 2026', 'regeling', { status: STATUS.voorbereiding }),
    node('b2', 'Besluit identificatie', 'besluit', { status: STATUS.geldend }),
    node('r2', 'Regeling levering 2018', 'regeling', { status: STATUS.vervallen }),
  ],
  edges: [
    edge('w1', 'b1', 'werkt uit'),
    edge('w1', 'w2', 'verwijzen naar elkaar', 'both'),
    edge('b1', 'r1', 'werkt uit'),
    edge('b1', 'r3', 'werkt uit'),
    edge('w2', 'b2', 'werkt uit'),
    edge('r3', 'r2', 'vervangt'),
    edge('r1', 'w2', 'verwijst naar'),
    edge('b2', 'b1', 'verwijst naar'),
  ],
  description:
    'Twee wetten, twee besluiten en drie regelingen die naar elkaar verwijzen, met hun status: zes geldend of in voorbereiding, één vervallen.',
}

/** A person and their relations: grows on request, the host loads neighbours when asked. */
export const personGraph = {
  types: [KIND.persoon, KIND.adres, KIND.organisatie],
  nodes: [
    node('a', 'A. Jansen', 'persoon', { initials: 'AJ' }),
    node('b', 'B. de Wit', 'persoon', { initials: 'BW' }),
    node('smit', 'Bakkerij Smit', 'organisatie', { more: 12 }),
    node('adres', 'Kerkstraat 8, Deventer', 'adres'),
    node('c', 'C. Jansen', 'persoon', { more: 2, initials: 'CJ' }),
    node('d', 'D. Jansen', 'persoon', { more: 1, initials: 'DJ' }),
    node('corp', 'Corporatie De Marken', 'organisatie', { more: 6 }),
  ],
  edges: [
    edge('a', 'b', 'partner van', 'none'),
    edge('a', 'adres', 'woont op'),
    edge('b', 'adres', 'woont op'),
    edge('a', 'c', 'ouder van'),
    edge('a', 'd', 'ouder van'),
    edge('a', 'smit', 'werkt bij'),
    edge('adres', 'corp', 'eigenaar', 'none'),
  ],
  description:
    'A. Jansen met partner, adres, twee kinderen en werkgever; achter Bakkerij Smit, Corporatie De Marken en de kinderen staan relaties die nog niet geladen zijn.',
}

/** What the host loads for a node of the person graph when the reader asks. */
export const personMore = {
  smit: {
    nodes: many('mw', 12, 'Medewerker', 'persoon'),
    edge: (other) => edge(other.id, 'smit', 'werkt bij'),
  },
  corp: {
    nodes: many('pand', 6, 'Pand', 'adres'),
    edge: (other) => edge('corp', other.id, 'eigenaar', 'none'),
  },
  c: { nodes: many('kc', 2, 'Kleinkind', 'persoon'), edge: (other) => edge('c', other.id, 'ouder van') },
  d: { nodes: many('kd', 1, 'Kleinkind', 'persoon'), edge: (other) => edge('d', other.id, 'ouder van') },
}

/** The person graph with what the host loaded for `ids`, and their `more` gone. */
export function personGraphWith(ids) {
  const loaded = personGraph.nodes.map((item) => (ids.includes(item.id) ? { ...item, more: undefined } : item))
  const extra = ids.flatMap((id) => personMore[id]?.nodes ?? [])
  return {
    ...personGraph,
    nodes: [...loaded, ...extra],
    edges: [...personGraph.edges, ...ids.flatMap((id) => (personMore[id]?.nodes ?? []).map(personMore[id].edge))],
  }
}

/** Two hundred nodes: twelve organisations with people, documents and addresses round them. */
export function networkGraph() {
  let seed = 11
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  const types = [KIND.persoon, KIND.organisatie, KIND.adres, KIND.document]
  const nodes = []
  for (let i = 0; i < 200; i++) {
    const u = random()
    const type = i < 12 ? 'organisatie' : u < 0.5 ? 'persoon' : u < 0.75 ? 'document' : 'adres'
    nodes.push(node(`n${i}`, `${KIND[type].label} ${i + 1}`, type))
  }
  const WORD = {
    'persoon|organisatie': 'werkt bij',
    'persoon|adres': 'woont op',
    'organisatie|adres': 'gevestigd op',
    'document|persoon': 'betreft',
    'document|organisatie': 'betreft',
    'document|adres': 'betreft',
    'persoon|persoon': 'kent',
    'organisatie|organisatie': 'werkt samen met',
    'adres|adres': 'grenst aan',
    'document|document': 'verwijst naar',
  }
  const relate = (a, b) =>
    WORD[`${a.type}|${b.type}`]
      ? edge(a.id, b.id, WORD[`${a.type}|${b.type}`])
      : edge(b.id, a.id, WORD[`${b.type}|${a.type}`] ?? 'verbonden met')
  const seen = new Set()
  const edges = []
  for (let j = 1; j < 200; j++) {
    const parent =
      j < 12
        ? Math.floor(random() * j)
        : random() < 0.75
          ? Math.floor(random() * random() * 12)
          : 12 + Math.floor(random() * (j - 12))
    seen.add(`${j}-${parent}`)
    edges.push(relate(nodes[j], nodes[parent]))
  }
  for (let k = 0; k < 30; k++) {
    const x = Math.floor(random() * 200)
    const y = Math.floor(random() * 200)
    if (x === y || seen.has(`${x}-${y}`) || seen.has(`${y}-${x}`)) continue
    seen.add(`${x}-${y}`)
    edges.push(relate(nodes[x], nodes[y]))
  }
  return {
    types,
    nodes,
    edges,
    description:
      'Een netwerk van tweehonderd personen, organisaties, adressen en documenten rond twaalf organisaties.',
  }
}

/** One node in its states: Rijksdienst Gegevens under a ministry, with three partners. */
export const stateGraph = {
  types: [KIND.rijk, KIND.decentraal, KIND.partner],
  nodes: [
    node('min', 'Ministerie van Wonen', 'rijk'),
    node('dienst', 'Dienst Subsidies', 'rijk'),
    node('rvg', 'Rijksdienst Gegevens', 'rijk'),
    node('toezicht', 'Inspectie Wonen', 'rijk'),
    node('kennis', 'Kenniscentrum Wonen', 'rijk'),
    node('dev', 'Gemeente Deventer', 'decentraal'),
    node('prov', 'Provincie Overijssel', 'decentraal'),
    node('stich', 'Stichting Welzijn', 'partner'),
  ],
  edges: [
    edge('min', 'dienst', '', 'none'),
    edge('min', 'rvg', '', 'none'),
    edge('min', 'toezicht', '', 'none'),
    edge('min', 'kennis', '', 'none'),
    edge('rvg', 'dev', '', 'none'),
    edge('rvg', 'prov', '', 'none'),
    edge('rvg', 'stich', '', 'none'),
  ],
  description:
    'Het Ministerie van Wonen met vier diensten; Rijksdienst Gegevens is verbonden met een gemeente, een provincie en een stichting.',
}

/** A bakery with twelve employees: more than five leaves of one kind, so one group. */
export const groupGraph = {
  types: [KIND.organisatie, KIND.persoon, KIND.adres],
  nodes: [
    node('smit', 'Bakkerij Smit', 'organisatie'),
    node('adres', 'Kerkstraat 8, Deventer', 'adres'),
    node('a', 'A. Jansen', 'persoon', { initials: 'AJ' }),
    ...many('mw', 12, 'Medewerker', 'persoon'),
  ],
  edges: [
    edge('smit', 'adres', 'gevestigd op'),
    edge('a', 'smit', 'eigenaar van'),
    edge('a', 'adres', 'woont op'),
    ...many('mw', 12, 'Medewerker', 'persoon').map((other) => edge(other.id, 'smit', 'werkt bij')),
  ],
  description:
    'Bakkerij Smit op de Kerkstraat, van A. Jansen die er ook woont, met twaalf medewerkers als één groep.',
}
