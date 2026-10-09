// The charts category (Kerncijfers en grafieken): the specimens of its elements.
import { meta, number, daily, heatmap, desks, breakdowns, hourly } from '../../_data/load.js'

const kpi = meta.kpi

const KPIS = [
  {
    label: 'Afgehandelde aanvragen', variable: 'sky-blue',
    value: number(kpi.requests.value),
    trend: { direction: 'up', sentence: 'Gestegen ten opzichte van vorige week' },
    detail: `Vorige week ${number(kpi.requests.previous)} (+${kpi.requests.change}%)`,
  },
  {
    label: 'Gemiddelde wachttijd', variable: 'dark-yellow',
    value: `${kpi.wait_time.value} min`,
    trend: { direction: 'down', sentence: 'Gedaald ten opzichte van gisteren', inverted: true },
    detail: `Norm ${kpi.wait_time.threshold} min · piek ${kpi.wait_time.peak} min om ${kpi.wait_time.peak_time}`,
  },
  {
    label: 'Afwijzingen', variable: 'red', value: kpi.rejections.value,
    trend: { direction: 'up', sentence: 'Gestegen ten opzichte van gisteren', inverted: true },
    detail: `Gisteren ${kpi.rejections.yesterday} · ${kpi.rejections.in_progress} nog in behandeling`,
  },
  {
    label: 'Bezetting loketten', variable: 'green', value: `${kpi.staffing.value}%`,
    trend: { direction: 'flat', sentence: 'Op sterkte, gelijk aan gisteren' },
    detail: `${kpi.staffing.staffed} van ${kpi.staffing.total} posities bezet`,
  },
  {
    label: 'Loketten met complete gegevens', variable: 'coverage',
    value: kpi.coverage.complete, suffix: `van ${kpi.coverage.total}`,
    note: 'Twee loketten leveren vertraagd aan',
    detail: `${kpi.coverage.overdue.join(', ')} · zie Let op`,
  },
]

// The nine data colours that came after the first eight, each as the accent of one variable.
const NEWER_COLOURS = [
  ['dark-green', 'Donkergroen'],
  ['purple', 'Paars'],
  ['ruby-red', 'Robijnrood'],
  ['yellow', 'Geel'],
  ['dark-brown', 'Donkerbruin'],
  ['brown', 'Bruin'],
  ['dark-blue', 'Donkerblauw'],
  ['light-blue', 'Lichtblauw'],
  ['moss-green', 'Mosgroen'],
]
const COLOUR_KPIS = NEWER_COLOURS.map(([variable, name], i) => ({
  label: name, variable, value: number(1200 + i * 345), detail: `variable: ${variable}`,
}))

/** One KPI on its own: the attributes of the first entry that carry, and its trend as a property. */
function single(data) {
  return (stage) => {
    const element = stage.querySelector('lintje-kpi')
    const { trend, ...attributes } = data
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
    if (trend) element.trend = trend
  }
}

const column = (key) => hourly.map((row) => row[key])

const breakdown = (name) => breakdowns.filter((row) => row.breakdown === name)

const weekdays = daily.map((row) => row.weekday)

const hours = [...new Set(heatmap.map((row) => row.hour))]

const heatmapWeekdays = [...new Set(heatmap.map((row) => row.weekday))]

const heatmapValue = (weekday, hour) =>
  heatmap.find((row) => row.weekday === weekday && row.hour === hour)?.value ?? null

// Requests per region split by the kind of desk: one variable in tints, which is what a
// stacked bar is for (rule 10).
const KINDS = [
  { key: 'counter', label: 'Balie' },
  { key: 'service', label: 'Servicepunt' },
]

const regionIds = [...new Set(desks.map((point) => point.region_id))]

const regionLabel = (id) =>
  id.replace('reg-', '').replace(/(^|-)([a-z])/g, (_, lead, letter) =>
    lead === '-' ? `-${letter.toUpperCase()}` : letter.toUpperCase())

const kindSeries = KINDS.map((kind) => ({
  label: kind.label,
  values: regionIds.map((region) => desks
    .filter((point) => point.region_id === region && point.kind === kind.key)
    .reduce((sum, point) => sum + point.requests, 0)),
}))

// Fifteen desks in the order of the data: the pie sorts them, keeps the four largest and folds
// the other eleven into one "Overig" that is not clickable.
const deskParts = desks.map((point) => ({
  label: point.map_label, value: point.requests, id: point.id, href: `?loket=${point.id}`,
}))
const largestDesks = [...deskParts].sort((a, b) => b.value - a.value).slice(0, 4)
const foldedDesks = deskParts.reduce((sum, part) => sum + part.value, 0)
  - largestDesks.reduce((sum, part) => sum + part.value, 0)
const staffing = meta.kpi.staffing

const CHARTS = [
  {
    id: 'line', title: 'Lijn met vergelijking en peilmoment',
    description: 'Aanvragen per uur, landelijk, vandaag. De laatste twee uren zijn nog niet compleet en staan gearceerd.',
    spec: {
      kind: 'line', labels: column('hour'), unit: 'aanvragen',
      axisTitle: 'Afgehandelde aanvragen per uur',
      asOfIndex: meta.national_complete_until,
      asOfLabel: meta.as_of.time,
      pendingHours: meta.national_pending_hours,
      series: [
        { label: 'Vandaag', values: column('requests'), area: true },
        { label: 'Vorige week', values: column('requests_last_week'), comparison: true },
      ],
    },
  },
  {
    id: 'bar', title: 'Staven met datalabels en trendlijn',
    description: 'Afgehandelde aanvragen per dag deze week, met de vorige week als trendlijn.',
    spec: {
      kind: 'bar', labels: weekdays, values: daily.map((row) => row.requests),
      axisTitle: 'Afgehandelde aanvragen per dag',
      trend: daily.map((row) => row.requests_last_week),
    },
  },
  {
    id: 'horizontal-bar', title: 'Horizontale staven met norm',
    description: 'Wachttijd in het laatste uur per loket, tegen de norm van 15 minuten.',
    spec: {
      kind: 'horizontal-bar',
      rows: breakdown('wait_time_last_hour').map((row) => ({ label: row.label, value: row.value })),
      threshold: meta.thresholds.wait_time_threshold, unit: 'min',
    },
  },
  {
    id: 'target-progress', title: 'Voortgang tegen een doel',
    description: 'Bezetting per regio als percentage van de norm; de stippellijn is de norm van 100 %.',
    spec: {
      kind: 'target-progress',
      rows: breakdown('staffing_per_region').map((row) => ({ label: row.label, value: row.value })),
      target: 100,
    },
  },
  {
    id: 'grouped-bar', title: 'Gegroepeerde staven',
    description: 'Afgehandelde aanvragen per dag, deze week naast vorige week.',
    spec: {
      kind: 'grouped-bar', labels: weekdays, axisTitle: 'Afgehandelde aanvragen per dag',
      series: [
        { label: 'Deze week', values: daily.map((row) => row.requests) },
        { label: 'Vorige week', values: daily.map((row) => row.requests_last_week) },
      ],
    },
  },
  {
    id: 'stacked-bar', title: 'Gestapelde staven',
    description: 'Afgehandelde aanvragen per regio, verdeeld over balie en servicepunt.',
    spec: {
      kind: 'stacked-bar', labels: regionIds.map(regionLabel),
      axisTitle: 'Afgehandelde aanvragen per regio', series: kindSeries,
    },
  },
  {
    id: 'stacked-bar-normalized', title: 'Gestapelde staven op 100 %',
    description: 'Aandeel van balie en servicepunt in de afgehandelde aanvragen per regio.',
    spec: {
      kind: 'stacked-bar', labels: regionIds.map(regionLabel),
      axisTitle: 'Aandeel per soort loket', series: kindSeries, normalized: true,
    },
  },
  {
    id: 'pie', title: 'Taart',
    description: 'Afwijzingen naar grond: onvolledig dossier 14, niet aan voorwaarden voldaan 9, termijn verstreken 6, onjuiste gegevens 5, overig 3.',
    spec: {
      kind: 'pie', labelHeader: 'Grond',
      segments: breakdown('rejection_grounds').map((row) => ({ label: row.label, value: row.value })),
    },
  },
  {
    id: 'donut', title: 'Donut met legendatabel',
    description: 'Afwijzingen naar grond: onvolledig dossier 14, niet aan voorwaarden voldaan 9, termijn verstreken 6, onjuiste gegevens 5, overig 3.',
    spec: {
      kind: 'pie', donut: true, size: 180, labelHeader: 'Grond', legendTable: true,
      segments: breakdown('rejection_grounds').map((row) => ({ label: row.label, value: row.value })),
    },
  },
  {
    id: 'pie-color', title: 'Taart in de kleur van haar variabele',
    description: 'Afwijzingen naar grond: onvolledig dossier 14, niet aan voorwaarden voldaan 9, termijn verstreken 6, onjuiste gegevens 5, overig 3.',
    spec: {
      kind: 'pie', labelHeader: 'Grond', color: 'dark-blue',
      segments: breakdown('rejection_grounds').map((row) => ({ label: row.label, value: row.value })),
    },
  },
  {
    id: 'pie-folded', title: 'Taart met meer dan vijf delen',
    description: `Afgehandelde aanvragen per loket: ${largestDesks
      .map((part) => `${part.label} ${number(part.value)}`)
      .join(', ')}, en de andere ${deskParts.length - 4} loketten samen ${number(foldedDesks)}.`,
    spec: { kind: 'pie', labelHeader: 'Loket', segments: deskParts },
  },
  {
    id: 'donut-remainder', title: 'Donut met de rest van een geheel',
    description: `Bezetting van de posities: ${staffing.staffed} van de ${staffing.total} bezet, ${staffing.total - staffing.staffed} open.`,
    spec: {
      kind: 'pie', donut: true, size: 180, labelHeader: 'Positie',
      centerValue: `${staffing.value}%`, centerLabel: 'bezet',
      segments: [
        { label: 'Open', value: staffing.total - staffing.staffed, remainder: true },
        { label: 'Bezet', value: staffing.staffed },
      ],
    },
  },
  {
    id: 'dual-axis', title: 'Twee assen',
    description: 'Afgehandelde aanvragen per uur als staven op de linkeras, wachttijd als lijn op de rechteras, tegen de norm van 15 minuten.',
    spec: {
      kind: 'dual-axis', labels: column('hour'),
      left: { label: 'Aanvragen', values: column('requests'), unit: 'aanvragen' },
      right: { label: 'Wachttijd', values: column('wait_time'), unit: 'min' },
      threshold: meta.thresholds.wait_time_threshold,
      pendingHours: meta.national_pending_hours,
    },
  },
  {
    id: 'heatmap', title: 'Heatmap met klassenlegenda',
    description: 'Aanvragen per uur naar dag van de week en uur van de dag, in vijf klassen.',
    spec: {
      kind: 'heatmap', columnLabels: hours, rowLabels: heatmapWeekdays,
      values: heatmapWeekdays.map((weekday) => hours.map((hour) => heatmapValue(weekday, hour))),
      unit: 'aanvragen per uur',
      // Below 768 px the days become the columns and the hours the rows (C8).
      mobile: {
        columnLabels: heatmapWeekdays, rowLabels: hours,
        values: hours.map((hour) => heatmapWeekdays.map((weekday) => heatmapValue(weekday, hour))),
      },
    },
  },
]

// The Dutch name of each kind, for the specimen's label.
const KIND_NAMES = {
  line: 'Lijn',
  bar: 'Staven',
  'horizontal-bar': 'Horizontale staven',
  'target-progress': 'Voortgang',
  'grouped-bar': 'Gegroepeerde staven',
  'stacked-bar': 'Gestapelde staven',
  'stacked-bar-normalized': 'Gestapelde staven op 100 %',
  pie: 'Taart',
  donut: 'Donut',
  'pie-color': 'Taart · color',
  'pie-folded': 'Taart · meer dan vijf delen',
  'donut-remainder': 'Donut · remainder',
  'dual-axis': 'Twee assen',
  heatmap: 'Heatmap',
}

// The three states a chart tile can be in: the tile keeps its size in all of them, so a page
// does not jump while the figures arrive.
const CHART_STATES = [
  { label: 'Laden', state: 'loading', description: 'De grafiek wordt geladen.' },
  {
    label: 'Leeg', state: 'empty',
    description: 'Er zijn geen gegevens voor deze selectie.',
    message: 'Geen gegevens voor deze selectie. Kies een ruimere periode of een ander bereik.',
  },
  {
    label: 'Fout', state: 'error',
    description: 'De bron levert niet aan.',
    message: 'De bron levert sinds 07:41 niet aan. De cijfers hieronder zijn van vóór dat moment.',
    lastKnown: 'Laatste waarde 07:00 · 141.260 aanvragen',
  },
]

const TILE = '<lintje-chart-tile></lintje-chart-tile>'

const chartSpecimen = (chart) => ({
  label: `${KIND_NAMES[chart.id]} · kind: ${chart.spec.kind}`,
  html: TILE,
  wide: true,
  setup(stage) {
    stage.querySelector('lintje-chart-tile').data = {
      chart: chart.spec,
      description: chart.description,
      title: chart.title,
      footnote: 'Bron: fictieve demogegevens',
      expandable: true,
      download: { filename: `demo-${chart.id}` },
    }
  },
})

const stateSpecimen = ({ label, state, description, message, lastKnown }) => ({
  label: `${label} · state: ${state}`,
  html: TILE,
  wide: true,
  setup(stage) {
    // The spec still travels: the skeleton is drawn for the kind that is coming.
    stage.querySelector('lintje-chart-tile').data = {
      chart: CHARTS[0].spec,
      description,
      title: `Staat · ${label.toLowerCase()}`,
      state,
      message,
      lastKnown,
    }
  },
})

// "Grafiek" / "Tabel": the same figures as a table, the rows the CSV writes. Sunday is not in
// yet, so it is missing — "—" in the table, never 0.
const tableSwitch = {
  label: 'Grafiek of tabel · tableSwitch',
  html: TILE,
  wide: true,
  setup(stage) {
    stage.querySelector('lintje-chart-tile').data = {
      chart: {
        kind: 'line', labels: weekdays, axisTitle: 'Afgehandelde aanvragen per dag',
        series: [
          {
            label: 'Deze week',
            values: daily.map((row, i) => (i === daily.length - 1 ? null : row.requests)),
          },
          { label: 'Vorige week', values: daily.map((row) => row.requests_last_week), comparison: true },
        ],
      },
      description: 'Afgehandelde aanvragen per dag deze week, tegen vorige week. Zondag is nog niet binnen.',
      title: 'Grafiek of tabel',
      footnote: 'Bron: fictieve demogegevens',
      tableSwitch: true,
    }
  },
}

// Missing is never zero (rule 15): a line breaks at the gap, a bar's slot is hatched. Two lines
// in colour carry their colour's shape at the end (rule 13); the dark yellow one is edged.
const share = (part) => daily.map((row, i) => (i === 3 ? null : Math.round(row.requests * part)))

const missingValues = [
  {
    label: 'Ontbrekende waarde · lijnen in kleur',
    description: 'Afgehandelde aanvragen per dag aan de balie en bij het servicepunt. Donderdag ontbreekt.',
    chart: {
      kind: 'line', labels: weekdays, axisTitle: 'Afgehandelde aanvragen per dag',
      series: [
        { label: 'Balie', color: 'sky-blue', values: share(0.6) },
        { label: 'Servicepunt', color: 'dark-yellow', values: share(0.4) },
      ],
    },
  },
  {
    label: 'Ontbrekende waarde · staven',
    description: 'Afgehandelde aanvragen per dag deze week. Donderdag ontbreekt.',
    chart: { kind: 'bar', labels: weekdays, values: share(1), axisTitle: 'Afgehandelde aanvragen per dag' },
  },
].map(({ label, description, chart }) => ({
  label,
  html: TILE,
  wide: true,
  setup(stage) {
    stage.querySelector('lintje-chart-tile').data = {
      chart,
      description,
      title: label,
      footnote: 'Bron: fictieve demogegevens',
    }
  },
}))

export default {
  elements: [
    {
      tag: 'lintje-kpi-row',
      title: 'De kerncijfers van de pagina in één rij',
      specimens: [
        {
          label: 'Vijf kerncijfers',
          html: '<lintje-kpi-row></lintje-kpi-row>',
          wide: true,
          setup: (stage) => {
            stage.querySelector('lintje-kpi-row').data = { kpis: KPIS }
          },
        },
        {
          label: 'Elke datakleur als accent · variable',
          html: '<lintje-kpi-row></lintje-kpi-row>',
          wide: true,
          setup: (stage) => {
            stage.querySelector('lintje-kpi-row').data = { kpis: COLOUR_KPIS, columns: 3 }
          },
        },
      ],
    },
    {
      tag: 'lintje-kpi',
      title: 'Eén kerncijfer: label, waarde, trend, toelichting en staat',
      specimens: [
        {
          label: 'Waarde met detail',
          html: '<lintje-kpi></lintje-kpi>',
          setup: single({ label: 'Afgehandelde aanvragen', variable: 'sky-blue', value: number(kpi.requests.value), detail: `Vorige week ${number(kpi.requests.previous)}` }),
        },
        {
          label: 'Met trend',
          html: '<lintje-kpi></lintje-kpi>',
          setup: single(KPIS[1]),
        },
        {
          label: 'Met achtervoegsel en toelichting',
          html: '<lintje-kpi></lintje-kpi>',
          setup: single(KPIS[4]),
        },
        {
          label: 'Laden',
          html: '<lintje-kpi label="Afwijzingen" variable="red" state="loading"></lintje-kpi>',
        },
        {
          label: 'Leeg',
          html: '<lintje-kpi label="Afwijzingen" variable="red" state="empty"></lintje-kpi>',
        },
        {
          label: 'Fout',
          html: '<lintje-kpi label="Afwijzingen" variable="red" state="error"></lintje-kpi>',
        },
      ],
    },
{
      tag: 'lintje-chart-tile',
      title: 'Tegel met een grafiek: elke soort, de drie staten, de tabelweergave en ontbrekende waarden',
      specimens: [
        ...CHARTS.map(chartSpecimen),
        ...CHART_STATES.map(stateSpecimen),
        tableSwitch,
        ...missingValues,
      ],
    },
    {
      tag: 'lintje-note',
      title: 'Duiding van de analist bij de cijfers',
      specimens: [
        {
          label: 'Met datum en auteur',
          html: '<lintje-note></lintje-note>',
          wide: true,
          setup: (stage) => {
            stage.querySelector('lintje-note').data = {
              title: 'Duiding van de analist',
              date: meta.analyst_note.date,
              text: meta.analyst_note.text,
              author: meta.analyst_note.author,
            }
          },
        },
      ],
    },
    {
      tag: 'lintje-explainer',
      title: 'Uitklapbare uitleg van hoe de cijfers worden berekend',
      specimens: [
        {
          label: 'Begrippen en omschrijvingen',
          html: '<lintje-explainer></lintje-explainer>',
          wide: true,
          setup: (stage) => {
            stage.querySelector('lintje-explainer').data = {
              title: 'Hoe deze cijfers worden berekend',
              items: meta.calculation_notes.map((note) => ({ term: note.term, description: note.description })),
            }
          },
        },
      ],
    },
  ],
}
