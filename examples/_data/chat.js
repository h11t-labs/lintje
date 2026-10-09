/**
 * The chat with data in the examples' fictional domain: the sources, the vocabulary
 * and what an answer about the week in `daily.json` holds. The chat example plays these as a
 * conversation; the style guide shows the same parts one state at a time.
 */
import { recogniseTerms } from '../../dist-elements/lintje.js'
import { meta, daily, desks, number } from './load.js'

const sum = (key) => daily.reduce((total, row) => total + row[key], 0)
const weekTotal = sum('requests')
const previousTotal = sum('requests_last_week')
const weekChange = ((weekTotal - previousTotal) / previousTotal) * 100
const busiest = daily.reduce((top, row) => (row.requests > top.requests ? row : top))
const percent = (value) => value.toLocaleString('nl-NL', { maximumFractionDigits: 1 })
const weekdays = daily.map((row) => row.weekday)

export const sourceLine = `Bron: ${meta.as_of.source} · Waarde van ${meta.as_of.date}, ${meta.as_of.time}`

/** The strip under an answer: what it was computed over, and what the reader may change. */
export const weekStrip = (state) => ({
  items: [
    { key: 'source', label: 'Bron', value: 'Aanvragen en wachttijden' },
    {
      key: 'period', label: 'Periode', value: state.period,
      options: [
        { value: 'week', label: '1 t/m 7 sep' },
        { value: 'previous-week', label: '25 t/m 31 aug' },
        { value: 'month', label: 'afgelopen 30 dagen' },
      ],
    },
    {
      key: 'desks', label: 'Loketten', value: state.desks,
      options: [
        { value: 'all', label: `alle ${desks.length}` },
        { value: 'counter', label: 'alleen balies' },
      ],
    },
    { key: 'compare', label: 'Vergelijken', value: 'met 25 t/m 31 aug', pressed: state.compare },
  ],
  details: [
    { term: 'Vergeleken met', description: '25 t/m 31 aug 2026' },
    { term: 'Berekening', description: 'som van afgehandelde aanvragen per dag' },
    { term: 'Peilmoment', description: `${meta.as_of.date}, ${meta.as_of.time}` },
  ],
})

export const weekKpis = (state) => ({
  columns: 3,
  kpis: [
    {
      label: 'Afgehandelde aanvragen', value: number(weekTotal), detail: '1 t/m 7 sep', state,
      trend: { direction: 'up', sentence: `${percent(weekChange)}% ten opzichte van de 7 dagen ervoor` },
    },
    { label: 'Gemiddeld per dag', value: number(Math.round(weekTotal / 7)), detail: '1 t/m 7 sep', state },
    { label: 'Drukste dag', value: number(busiest.requests), detail: `${busiest.weekday} 5 sep`, state },
  ],
})

export const weekChart = (state, compare = false) => ({
  title: 'Aanvragen per dag',
  subtitle: '1 t/m 7 sep · alle loketten',
  description: 'Afgehandelde aanvragen per dag in de week van 1 t/m 7 september.',
  footnote: sourceLine,
  state,
  // The reader may want the same figures as a table: the tile's own switch.
  tableSwitch: true,
  chart: compare
    ? {
        kind: 'grouped-bar', small: true, labels: weekdays,
        axisTitle: 'Afgehandelde aanvragen per dag',
        series: [
          { label: '1 t/m 7 sep', values: daily.map((row) => row.requests) },
          { label: '25 t/m 31 aug', values: daily.map((row) => row.requests_last_week), comparison: true },
        ],
      }
    : {
        kind: 'bar', small: true, labels: weekdays,
        values: daily.map((row) => row.requests),
        axisTitle: 'Afgehandelde aanvragen per dag',
      },
})

export const waitTable = {
  caption: 'De vijf loketten met de langste wachttijd in het laatste uur',
  title: 'Langste wachttijd per loket',
  subtitle: 'Laatste uur · klik op een rij om door te vragen',
  mobileSubtitle: 'Laatste uur · tik op een rij',
  footnote: sourceLine,
  columns: [
    { key: 'name', header: 'Loket' },
    {
      key: 'waitTime', header: 'Wachttijd (min)', align: 'right', mobileMeasure: true,
      threshold: { value: meta.thresholds.wait_time_threshold, caution: meta.thresholds.wait_time_caution },
    },
    { key: 'requests', header: 'Aanvragen', align: 'right' },
  ],
  rows: [...desks]
    .sort((a, b) => b.wait_time - a.wait_time)
    .slice(0, 5)
    .map((desk) => ({ id: desk.id, name: desk.name, waitTime: desk.wait_time, requests: desk.requests })),
  rowKey: 'id',
  defaultSort: { key: 'waitTime', direction: 'desc' },
  mobileSublineTemplate: '{requests} aanvragen',
  clickable: true,
  pageSize: 5,
  download: false,
  expandable: false,
}

/** The sources a question may draw on; a host keeps which are switched on, so each caller gets its own. */
export const chatSources = () => [
  { id: 'requests', label: 'Aanvragen en wachttijden', description: 'Per uur en loket', asOf: 'tot 8 sep, 08:15', selected: true },
  { id: 'rejections', label: 'Afwijzingen', description: 'Per uur, loket en grond', asOf: 'tot 8 sep, 08:15', selected: true },
  { id: 'staffing', label: 'Bezetting', description: 'Ingezette en beschikbare medewerkers', asOf: 'tot 8 sep, 08:15' },
  { id: 'quality', label: 'Aanlevering en datakwaliteit', description: 'Welke loketten compleet aanleveren', asOf: 'tot 8 sep, 08:15' },
]

// The words the question box marks and completes. A term of a source that is
// switched off is dashed, and so is an ambiguous one.
export const vocabulary = [
  { label: 'aanvragen', kind: 'Definitie', source: 'requests' },
  { label: 'wachttijd', kind: 'Definitie', source: 'requests', aliases: ['wachttijden'] },
  { label: 'afwijzingen', kind: 'Definitie', source: 'rejections' },
  { label: 'bezetting', kind: 'Definitie', source: 'staffing' },
  { label: 'afgelopen 7 dagen', kind: 'Periode' },
  { label: 'laatste uur', kind: 'Periode' },
  { label: 'vorige week', kind: 'Periode' },
  { label: 'Amsterdam', kind: 'Loket', ambiguous: true },
  ...desks.map((desk) => ({ label: desk.name, kind: 'Loket' })),
]

/** The terms the vocabulary finds in a text, given the sources that are switched on. */
export const termsOf = (text, sources) =>
  recogniseTerms(text, vocabulary, sources.filter((source) => source.selected).map((source) => source.id))

/** A term range is two offsets into the text; the host finds them. */
export const term = (text, word, kind, certain) => {
  const start = text.indexOf(word)
  return { start, end: start + word.length, kind, certain }
}

export const weekQuestion = 'Hoeveel aanvragen zijn er de afgelopen 7 dagen afgehandeld, en hoe verliep dat per dag?'
export const waitQuestion = 'Welke loketten hadden het laatste uur de langste wachttijd?'
export const weekLead = `In de afgelopen 7 dagen (1 t/m 7 september) zijn ${number(weekTotal)} aanvragen afgehandeld.`
export const weekText = `Dat is ${percent(weekChange)}% meer dan in de 7 dagen ervoor. Zaterdag 5 september was de drukste dag.`

/** The finished answer to the week question, for the strip's state. */
export const weekAnswer = (state) => ({
  lead: weekLead,
  text: weekText,
  strip: weekStrip(state),
  blocks: [
    { kind: 'kpi-row', data: weekKpis('ready') },
    { kind: 'chart-tile', data: weekChart('ready', state.compare) },
  ],
  followUps: [
    { label: 'Hoe is dit verdeeld over de loketten?' },
    { label: 'Hoe verhoudt dit zich tot de week ervoor?' },
  ],
})

/** The answer to the waiting-time question: the five slowest desks as a table. */
export const waitAnswer = (state) => ({
  lead: `${waitTable.rows[0].name} had het laatste uur de langste wachttijd: ${waitTable.rows[0].waitTime} minuten.`,
  text: `De norm is ${meta.thresholds.wait_time_threshold} minuten. De tabel toont de vijf loketten met de langste wachttijd.`,
  strip: weekStrip(state),
  blocks: [{ kind: 'data-table', data: waitTable }],
  followUps: [
    { label: 'Hoe is dit verdeeld over de regio’s?' },
    { label: 'Hoe verhoudt dit zich tot de week ervoor?' },
    { label: 'Kun je deze cijfers als grafiek tonen?' },
  ],
})

/** The start screen of an empty conversation. */
export const chatStart = {
  intro: 'Ik beantwoord vragen over de gegevens in tekst, cijfers, grafieken en tabellen. Bij elk antwoord staan de bron en het peilmoment.',
  note: 'Noem je geen periode of loket, dan ga ik uit van de afgelopen 7 dagen en alle loketten. Het gesprek wordt niet bewaard.',
  starters: [
    { label: 'Hoeveel aanvragen zijn er de afgelopen 7 dagen afgehandeld?' },
    { label: 'Welke loketten waren het drukst?' },
    { label: 'Hoe verliep de wachttijd per dag?' },
    { label: 'Waar werden de meeste aanvragen afgewezen?' },
  ],
}

/**
 * A conversation as a host keeps it, on one `<lintje-chat>`: every turn and every state lives
 * here, and the view gets all of it again whenever something changes. An answer is played the
 * way a host streams one — `data` is set again for every piece.
 */
export function converse(chat, { turns = true } = {}) {
  const sources = chatSources()
  const state = { period: 'week', desks: 'all', compare: false }
  const terms = (text) => termsOf(text, sources)
  const list = turns
    ? [
        { id: 't1', message: { text: weekQuestion, time: '08:20', terms: terms(weekQuestion) }, answer: weekAnswer(state) },
        { id: 't2', message: { text: waitQuestion, time: '08:22', terms: terms(waitQuestion) }, answer: waitAnswer(state) },
      ]
    : []
  let draftTerms
  const render = () => {
    chat.data = { sources, vocabulary, draftTerms, turns: [...list], start: list.length ? undefined : chatStart }
  }

  // The text grows, each block stands as its own skeleton until its figures are there, and
  // a finished block keeps its object so it is not drawn twice.
  let playing = []
  const stop = () => {
    playing.forEach(clearTimeout)
    playing = []
  }
  /** What had arrived stays; a block that was still to come goes. */
  const halt = (turn) => {
    turn.answer = {
      ...turn.answer, state: 'stopped', status: undefined,
      blocks: turn.answer.blocks.filter((block) => (block.data.state ?? block.data.kpis?.[0].state ?? 'ready') === 'ready'),
    }
  }
  const play = (turn) => {
    stop()
    // One answer arrives at a time: one that was still arriving ends where it stands.
    for (const other of list) if (other !== turn && other.answer?.state === 'streaming') halt(other)
    const full = weekAnswer(state)
    const words = `${full.lead} ${full.text}`.split(' ')
    const leadWords = full.lead.split(' ').length
    turn.answer = {
      state: 'streaming', status: 'Vraag lezen · stap 1 van 3',
      blocks: [{ kind: 'kpi-row', data: weekKpis('loading') }, { kind: 'chart-tile', data: weekChart('loading') }],
    }
    render()
    const at = (ms, change) => playing.push(setTimeout(() => {
      turn.answer = { ...turn.answer, ...change() }
      render()
    }, ms))
    words.forEach((_, index) => at(400 + index * 90, () => ({
      lead: words.slice(0, Math.min(index + 1, leadWords)).join(' '),
      text: words.slice(leadWords, index + 1).join(' '),
    })))
    const written = 400 + words.length * 90
    at(written, () => ({ status: 'Cijfers berekenen · stap 2 van 3' }))
    at(written + 900, () => ({ blocks: [full.blocks[0], turn.answer.blocks[1]], status: 'Grafiek tekenen · stap 3 van 3' }))
    at(written + 1800, () => ({ blocks: full.blocks }))
    at(written + 2000, () => ({ ...full, state: 'ready', status: undefined }))
  }
  const ask = (text, found = terms(text)) => {
    const time = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
    const turn = { id: `t${Date.now()}`, message: { text, time, terms: found } }
    list.push(turn)
    draftTerms = undefined
    play(turn)
  }
  const turnOf = (event) => list.find((turn) => turn.id === event.detail.turnId)

  chat.addEventListener('lintje-message-send', (event) => ask(event.detail.text, event.detail.terms))
  chat.addEventListener('lintje-suggestion-select', (event) => ask(event.detail.value ?? event.detail.label))
  chat.addEventListener('lintje-row-click', (event) => ask(`Hoe verliep de wachttijd bij ${event.detail.label ?? 'dit loket'}?`))
  chat.addEventListener('lintje-answer-retry', (event) => play(turnOf(event)))
  chat.addEventListener('lintje-answer-stop', () => {
    stop()
    halt(list[list.length - 1])
    render()
  })
  chat.addEventListener('lintje-message-edit', (event) => {
    const turn = turnOf(event)
    list.length = list.indexOf(turn) + 1
    turn.message = { ...turn.message, text: event.detail.text, terms: event.detail.terms }
    play(turn)
  })
  chat.addEventListener('lintje-strip-change', (event) => {
    state[event.detail.key] = event.detail.value
    const turn = turnOf(event)
    turn.answer = { ...turn.answer, ...(turn.id === 't2' ? { strip: weekStrip(state) } : weekAnswer(state)) }
    render()
  })
  chat.addEventListener('lintje-sources-change', (event) => {
    sources.forEach((source) => { source.selected = event.detail.ids.includes(source.id) })
    render()
  })
  // The host may read the text itself: its ranges win while the text is unchanged.
  // Here it knows one word the vocabulary does not.
  chat.addEventListener('lintje-draft-change', (event) => {
    const text = event.detail.text
    const start = text.toLowerCase().indexOf('gisteren')
    draftTerms = start === -1 ? undefined : {
      text,
      ranges: [...terms(text), { start, end: start + 8, kind: 'Periode (host)' }].sort((a, b) => a.start - b.start),
    }
    render()
  })

  render()
  return { ask }
}
