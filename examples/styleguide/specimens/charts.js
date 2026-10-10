// The charts category (Kerncijfers en grafieken): the specimens of its elements.
import { meta, number, daily, heatmap, desks, breakdowns, hourly } from '../../_data/load.js'

const kpi = meta.kpi

// The week's requests per day as the sparkline of the first KPI; `null` breaks the line.
const requestsPerDay = daily.map((row) => row.requests)
const REQUESTS_SPARKLINE = {
  values: requestsPerDay,
  description: `Afgehandelde aanvragen per dag, afgelopen week: van ${number(requestsPerDay[0])} op maandag tot ${number(requestsPerDay.at(-1))} op zondag, piek ${number(Math.max(...requestsPerDay))}`,
}

const KPIS = [
  {
    label: 'Afgehandelde aanvragen', variable: 'sky-blue',
    value: number(kpi.requests.value),
    trend: { direction: 'up', sentence: 'Gestegen ten opzichte van vorige week' },
    sparkline: REQUESTS_SPARKLINE,
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

// A figure on its scale: occupancy against its norm as an arc, wait time against its norm as a bar.
const GAUGE_ARC = {
  label: 'Bezetting loketten', variable: 'sky-blue', value: `${kpi.staffing.value}%`,
  gauge: { max: 120, target: 100, targetLabel: 'norm' },
  trend: { direction: 'down', sentence: `${100 - kpi.staffing.value} punten onder de norm van 100%` },
  detail: `${kpi.staffing.staffed} van ${kpi.staffing.total} posities bezet`,
}
const GAUGE_LINEAR = {
  label: 'Gemiddelde wachttijd', variable: 'dark-yellow', value: kpi.wait_time.value, suffix: 'min',
  gauge: { shape: 'linear', max: 30, target: kpi.wait_time.threshold, targetLabel: 'norm' },
  trend: {
    direction: 'down', inverted: true,
    sentence: `${kpi.wait_time.threshold - kpi.wait_time.value} min onder de norm van ${kpi.wait_time.threshold} min`,
  },
}

/** One KPI on its own: the attributes that carry, and its trend, gauge and sparkline as properties. */
function single(data) {
  return (stage) => {
    const element = stage.querySelector('lintje-kpi')
    const { trend, gauge, sparkline, ...attributes } = data
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
    if (trend) element.trend = trend
    if (gauge) element.gauge = gauge
    if (sparkline) element.sparkline = sparkline
  }
}

const column = (key) => hourly.map((row) => row[key])

const breakdown = (name) => breakdowns.filter((row) => row.breakdown === name)

const weekdays = daily.map((row) => row.weekday)

const hours = [...new Set(heatmap.map((row) => row.hour))]

const heatmapWeekdays = [...new Set(heatmap.map((row) => row.weekday))]

const heatmapValue = (weekday, hour) =>
  heatmap.find((row) => row.weekday === weekday && row.hour === hour)?.value ?? null

// Processing time of 1,900 requests in classes of two days; the last class is open ("30+").
const processingDays = [40, 120, 260, 310, 280, 220, 170, 130, 95, 70, 52, 40, 30, 22, 16, 45].map(
  (count, i, counts) => ({ from: i * 2, to: i === counts.length - 1 ? null : i * 2 + 2, count }),
)

const processingTime = (bins) => ({
  kind: 'histogram', bins, label: 'Aanvragen', unit: 'dagen',
  axisTitle: 'aanvragen per twee dagen', xTitle: 'doorlooptijd in dagen',
  median: 9.6, threshold: 21, thresholdLabel: 'termijn 21 dagen',
})

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

// Every desk as a point, requests against waiting time, one series per kind of desk; the desks
// that deliver late have no waiting time yet in the second specimen (rule 15).
const DESK_SERIES = [
  { key: 'counter', label: 'Loket' },
  { key: 'service', label: 'Servicepunt' },
]
const deskScatter = (missing = false) => ({
  kind: 'scatter',
  axisTitle: 'gemiddelde wachttijd in minuten', unit: 'min',
  xTitle: 'aanvragen per kwartaal',
  threshold: meta.thresholds.wait_time_threshold,
  dataLabels: ['Amsterdam Centrum'],
  series: DESK_SERIES.map((kind) => ({
    label: kind.label,
    points: desks.filter((desk) => desk.kind === kind.key).map((desk) => ({
      label: desk.map_label, id: desk.id, href: `?loket=${desk.id}`,
      x: desk.requests,
      y: missing && desk.data_status === 'delayed' ? null : desk.wait_time,
    })),
  })),
})
const lateDesks = desks.filter((desk) => desk.data_status === 'delayed').map((desk) => desk.map_label)

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
    id: 'scatter', title: 'Wachttijd tegen drukte',
    description: 'Gemiddelde wachttijd tegen het aantal aanvragen per loket, voor loketten en servicepunten, tegen de norm van 15 minuten. Amsterdam Centrum is het drukst en wacht het langst, 18 minuten.',
    spec: deskScatter(),
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
  {
    id: 'histogram', title: 'Doorlooptijd van aanvragen',
    description: 'Doorlooptijd van 1.900 afgehandelde aanvragen in klassen van twee dagen. De mediaan is 9,6 dagen, de termijn 21 dagen; 153 aanvragen duurden 22 dagen of langer.',
    spec: processingTime(processingDays),
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
  scatter: 'Spreiding',
  heatmap: 'Heatmap',
  histogram: 'Histogram',
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

const TILE = '<lintje-chart></lintje-chart>'

const chartSpecimen = (chart) => ({
  label: `${KIND_NAMES[chart.id]} · kind: ${chart.spec.kind}`,
  html: TILE,
  wide: true,
  setup(stage) {
    stage.querySelector('lintje-chart').data = {
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
    stage.querySelector('lintje-chart').data = {
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
    stage.querySelector('lintje-chart').data = {
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
  {
    label: 'Ontbrekende waarde · spreiding',
    description: `Gemiddelde wachttijd tegen het aantal aanvragen per loket. ${lateDesks.join(' en ')} leveren vertraagd aan: hun wachttijd ontbreekt, dus ze staan niet in de grafiek.`,
    chart: deskScatter(true),
  },
  {
    label: 'Ontbrekende waarde · histogram',
    description: 'Doorlooptijd van afgehandelde aanvragen in klassen van twee dagen. Van de klasse 6 tot 8 dagen ontbreekt het aantal.',
    chart: processingTime(processingDays.map((bin, i) => (i === 3 ? { ...bin, count: null } : bin))),
  },
].map(({ label, description, chart }) => ({
  label,
  html: TILE,
  wide: true,
  setup(stage) {
    stage.querySelector('lintje-chart').data = {
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
          label: 'Met kerncijfers op een schaal · gauge',
          html: '<lintje-kpi-row></lintje-kpi-row>',
          wide: true,
          setup: (stage) => {
            stage.querySelector('lintje-kpi-row').data = {
              kpis: [GAUGE_ARC, KPIS[0], GAUGE_LINEAR, KPIS[2]],
            }
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
          label: 'Met verloop',
          html: '<lintje-kpi></lintje-kpi>',
          setup: single(KPIS[0]),
        },
        {
          label: 'Verloop met een ontbrekende dag',
          html: '<lintje-kpi></lintje-kpi>',
          setup: single({
            label: 'Afwijzingen', variable: 'red', value: kpi.rejections.value,
            trend: { direction: 'up', sentence: 'Gestegen ten opzichte van gisteren', inverted: true },
            sparkline: {
              values: [29, 33, null, 30, 34, 31, kpi.rejections.value],
              description: `Afwijzingen per dag, afgelopen week: van 29 op maandag tot ${kpi.rejections.value} op zondag; woensdag ontbreekt`,
            },
            detail: `Gisteren ${kpi.rejections.yesterday}`,
          }),
        },
        {
          label: 'Verloop, laden',
          html: '<lintje-kpi label="Afgehandelde aanvragen" variable="sky-blue" state="loading"></lintje-kpi>',
          setup: (stage) => { stage.querySelector('lintje-kpi').sparkline = REQUESTS_SPARKLINE },
        },
        {
          label: 'Met achtervoegsel en toelichting',
          html: '<lintje-kpi></lintje-kpi>',
          setup: single(KPIS[4]),
        },
        {
          label: 'Op een schaal: boog',
          html: '<lintje-kpi></lintje-kpi>',
          setup: single(GAUGE_ARC),
        },
        {
          label: 'Op een schaal: balk',
          html: '<lintje-kpi></lintje-kpi>',
          setup: single(GAUGE_LINEAR),
        },
        {
          label: 'Op een schaal, laden',
          html: '<lintje-kpi state="loading"></lintje-kpi>',
          setup: single({ label: GAUGE_ARC.label, gauge: GAUGE_ARC.gauge }),
        },
        {
          label: 'Op een schaal, leeg',
          html: '<lintje-kpi state="empty"></lintje-kpi>',
          setup: single({ label: GAUGE_LINEAR.label, variable: 'dark-yellow', gauge: GAUGE_LINEAR.gauge }),
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
      tag: 'lintje-chart',
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
