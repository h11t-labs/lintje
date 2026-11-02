// The charts category (Kerncijfers en grafieken): the specimens of its elements.
import { CHART_KINDS, CHART_QUESTIONS } from '../../../dist-elements/lintje.js'
import { meta, number, daily, heatmap, desks, breakdowns, hourly, satisfaction, budget, sankey, forecast } from '../../_data/load.js'
import { linkLog } from '../shared.js'

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

// Requests per week by channel, one variable in parts. Only the post of week 29 is missing, and
// that one part breaks the whole stack there.
const CHANNELS = [
  { label: 'Online', values: [610, 625, 640, 660, 650, 675, 700, 690, 710, 705, 720, 735] },
  { label: 'Balie', values: [330, 320, 325, 310, 300, 298, 295, 290, 296, 285, 280, 276] },
  { label: 'Post', values: [140, 135, 130, 128, 125, null, 120, 118, 115, 112, 110, 108] },
  { label: 'Telefoon', values: [90, 92, 88, 85, 86, 83, 80, 82, 78, 80, 76, 75] },
]

// Fifteen desks in the order of the data: the pie sorts them, keeps the four largest and folds
// the other eleven into one "Overig" that is not clickable.
const deskParts = desks.map((point) => ({
  label: point.map_label, value: point.requests, id: point.id, href: `?loket=${point.id}`,
}))
const largestDesks = [...deskParts].sort((a, b) => b.value - a.value).slice(0, 4)
const foldedDesks = deskParts.reduce((sum, part) => sum + part.value, 0)
  - largestDesks.reduce((sum, part) => sum + part.value, 0)
const staffing = meta.kpi.staffing

// Requests per week this year against last year, weeks 14 to 39, with what happened.
const WEEKS = Array.from({ length: 26 }, (_, i) => `wk ${14 + i}`)
const THIS_YEAR = [
  920, 940, 930, 960, 955, 970, 980, 990, 1180, 1210, 1240, 1230, 1260,
  1250, 1270, 1290, 1300, 820, 1150, 1280, 1300, 1310, 1295, 1320, 1330, 1340,
]
const LAST_YEAR = [
  950, 960, 955, 970, 980, 975, 990, 1000, 1010, 1005, 1020, 1015, 1030,
  1025, 1040, 1035, 1050, 1045, 1060, 1055, 1070, 1065, 1080, 1075, 1090, 1085,
]

// Every desk as a point, requests against waiting time, one series per kind of desk; the desks
// that deliver late have no waiting time yet in the second specimen (rule 15).
const DESK_SERIES = [
  { key: 'counter', label: 'Loket', color: 'sky-blue' },
  { key: 'service', label: 'Servicepunt', color: 'dark-yellow' },
]
const deskScatter = (missing = false) => ({
  kind: 'scatter',
  axisTitle: 'gemiddelde wachttijd in minuten', unit: 'min',
  xTitle: 'aanvragen per kwartaal',
  threshold: meta.thresholds.wait_time_threshold,
  dataLabels: ['Amsterdam Centrum'],
  series: DESK_SERIES.map((kind) => ({
    label: kind.label,
    color: kind.color,
    points: desks.filter((desk) => desk.kind === kind.key).map((desk) => ({
      label: desk.map_label, id: desk.id, href: `?loket=${desk.id}`,
      x: desk.requests,
      y: missing && desk.data_status === 'delayed' ? null : desk.wait_time,
    })),
  })),
})
// The quality of service per aspect on a scale of 0 to 10: one quarter against the same one a
// year before, and three regions; fictional scores.
const ASPECTS = ['Bereikbaarheid', 'Tijdigheid', 'Duidelijkheid', 'Juistheid', 'Deskundigheid', 'Bejegening']
const QUALITY = [7.8, 6.1, 7.4, 8.6, 8.2, 8.9]
const quality = (missing = false) => ({
  kind: 'radar', axes: ASPECTS, max: 10, threshold: 7,
  series: [
    { label: 'Q3 2026', values: missing ? QUALITY.map((v, i) => (i === 1 ? null : v)) : QUALITY },
    { label: 'Q3 2025', values: [7.4, 6.6, 6.9, 8.4, 8.1, 8.8], comparison: true },
  ],
})
// The satisfaction per desk in 2024 and 2026 on a scale of 1 to 10, against a norm of 7.
const SATISFACTION = satisfaction.map((row) => ({ label: row.desk, from: row.from, to: row.to }))
const SATISFACTION_NORM = 7
/** Each desk opens its own page. */
const LINKED_SATISFACTION = SATISFACTION.map((row) => {
  const id = row.label.toLowerCase().replace(/\s+/g, '-')
  return { ...row, id, href: `?loket=${id}` }
})
const satisfactionSpec = (rows = SATISFACTION, axis = {}) => ({
  kind: 'dumbbell', fromLabel: '2024', toLabel: '2026', threshold: SATISFACTION_NORM, rows, ...axis,
})
const score = (value) => value.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const signedScore = (value) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${score(Math.abs(value))}`
const desksCount = (count, one, more) => `${count} ${count === 1 ? one : more}`

/**
 * The description a dumbbell's host writes: how many rows rise, fall and stay, the largest rise
 * and fall, what is under the norm, which rows lack figures and which value is beyond the axis.
 */
function describeSatisfaction({ rows, min = 0, max = Infinity }) {
  const known = rows
    .filter((row) => row.from != null && row.to != null)
    .map((row) => ({ ...row, change: Math.round((row.to - row.from) * 10) / 10 }))
  const up = known.filter((row) => row.change > 0)
  const down = known.filter((row) => row.change < 0)
  const ranked = [...known].sort((a, b) => b.change - a.change)
  const below = rows.filter((row) => row.to != null && row.to < SATISFACTION_NORM)
  const missing = rows.filter((row) => row.from == null || row.to == null)
  const beyond = rows.flatMap((row) =>
    [['2024', row.from], ['2026', row.to]]
      .filter(([, value]) => value != null && (value < min || value > max))
      .map(([year, value]) => `${row.label} ${year} valt met ${score(value)} buiten de as.`),
  )
  return [
    'Gemiddeld rapportcijfer per loket in 2024 en 2026, op een schaal van 1 tot 10.',
    `${desksCount(up.length, 'loket stijgt', 'loketten stijgen')}, ${desksCount(down.length, 'daalt', 'dalen')} en ${desksCount(known.length - up.length - down.length, 'blijft', 'blijven')} gelijk.`,
    up.length ? `De grootste stijging is ${ranked[0].label} (${signedScore(ranked[0].change)}).` : '',
    down.length ? `De grootste daling is ${ranked.at(-1).label} (${signedScore(ranked.at(-1).change)}).` : '',
    below.length
      ? `Onder de norm van ${score(SATISFACTION_NORM)} in 2026: ${below.map((row) => `${row.label} (${score(row.to)})`).join(', ')}.`
      : '',
    missing.length ? `Van ${missing.map((row) => row.label).join(' en ')} ontbreekt een cijfer.` : '',
    ...beyond,
  ].filter(Boolean).join(' ')
}

// Requests and objections per year, × 1,000: measured up to 2025, then a forecast to 2030 with
// its 80 % margin. Fictional figures.
const YEARS = forecast.map((row) => row.year)
const FORECAST_FROM = forecast.findIndex((row) => row.forecast)
const yearly = (key) => ({
  values: forecast.map((row) => row[key]),
  forecast: {
    low: forecast.map((row) => row[`${key}_low`]),
    high: forecast.map((row) => row[`${key}_high`]),
  },
})
const lastMeasured = forecast[FORECAST_FROM - 1]
const lastYear = forecast.at(-1)
/**
 * The first and last measured value, and where the forecast ends with its margin. Where measuring
 * stops the chart adds to its description itself.
 */
const forecastSentence = (key, name) =>
  `${name}: ${number(forecast[0][key])} in ${forecast[0].year} en ${number(lastMeasured[key])} in ${lastMeasured.year}. De raming loopt tot ${number(lastYear[key])} in ${lastYear.year}, met een marge van ${number(lastYear[`${key}_low`])} tot ${number(lastYear[`${key}_high`])}.`
// Requests per month of this year, measured up to August, against last year: a comparison is
// measured to the end. Fictional figures.
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const THIS_YEAR_MONTHS = [612, 640, 701, 688, 720, 695, 590, 610, 735, 760, 742, 705]
const LAST_YEAR_MONTHS = [580, 601, 655, 662, 690, 671, 560, 575, 702, 731, 720, 690]
const lateDesks = desks.filter((desk) => desk.data_status === 'delayed').map((desk) => desk.map_label)

// A fictional budget in mld euro: twelve policy areas, three with their sub-posts. `missing`
// names what has no figures: a policy area or a sub-post (rule 15).
const budgetValue = (part) => part.parts ? part.parts.reduce((sum, sub) => sum + sub.value, 0) : part.value
const budgetSpec = ({ nested = false, links = false, missing = [], ...extra } = {}) => ({
  kind: 'treemap', label: 'Uitgaven', unit: 'mld euro', labelHeader: 'Beleidsterrein',
  parts: budget.map((part) => ({
    label: part.label, id: part.id,
    ...(links ? { href: `?terrein=${part.id}` } : {}),
    ...(nested && part.parts
      ? { parts: part.parts.map((sub) => ({ label: sub.label, value: missing.includes(sub.label) ? null : sub.value })) }
      : { value: missing.includes(part.label) ? null : Math.round(budgetValue(part) * 10) / 10 }),
  })),
  ...extra,
})
const mld = (value) => value.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
// The total, the three largest with amount and share, what folds into "Overig" and what is missing.
const budgetDescription = (missing = []) => {
  const known = (part) => budgetValue(part) - (part.parts ?? []).filter((sub) => missing.includes(sub.label)).reduce((sum, sub) => sum + sub.value, 0)
  const parts = budget.filter((part) => !missing.includes(part.label)).map((part) => ({ label: part.label, value: known(part) }))
  const total = parts.reduce((sum, part) => sum + part.value, 0)
  const share = (value) => `${mld((value / total) * 100)} %`
  const [a, b, c] = [...parts].sort((x, y) => y.value - x.value)
  const small = parts.filter((part) => part.value < total / 100).map((part) => part.label)
  return `Uitgaven per beleidsterrein, totaal ${mld(total)} mld euro${missing.length ? `, zonder ${missing.join(' en ')}: daarvan zijn geen gegevens` : ''}. ` +
    `De grootste: ${a.label} ${mld(a.value)} (${share(a.value)}), ${b.label} ${mld(b.value)} (${share(b.value)}) en ${c.label} ${mld(c.value)} (${share(c.value)}). ` +
    `${small.join(' en ')}, elk onder 1 %, staan samen als Overig.`
}

// Requests of a fictional permit service from submission to outcome. A flow is changed by its
// two ends: `{ 'compleet>ingetrokken': 12 }`.
const process = (name, changes = {}) => ({
  ...sankey[name],
  flows: sankey[name].flows.map((flow) => {
    const key = `${flow.from}>${flow.to}`
    return key in changes ? { ...flow, value: changes[key] } : flow
  }),
})
const sankeySpec = (data, extra = {}) => ({ kind: 'sankey', label: 'Aanvragen', ...data, ...extra })
/** Every node and every flow opens its own page, as a drilldown does. */
const linked = (data) => ({
  steps: data.steps.map((step) => ({
    ...step,
    nodes: step.nodes.map((node) => ({ ...node, href: `?knoop=${node.id}` })),
  })),
  flows: data.flows.map((flow) => ({ ...flow, href: `?stroom=${flow.from}-${flow.to}` })),
})

/**
 * What a host writes as the sankey's description: the whole, every node of every step with its
 * count and share, the largest flow after the first step, and the flows without data.
 */
function sankeyDescription({ steps, flows }) {
  const nodes = new Map(steps.flatMap((step, s) => step.nodes.map((node) => [node.id, { ...node, s }])))
  const known = (list) => list.reduce((sum, flow) => sum + (flow.value ?? 0), 0)
  const size = (node) => {
    if (node.value != null) return node.value
    const into = flows.filter((flow) => flow.to === node.id)
    const out = flows.filter((flow) => flow.from === node.id)
    return Math.max(known(into), known(out))
  }
  const partial = (node) => node.value == null && flows.some((flow) => flow.to === node.id && flow.value == null)
  const unknown = (node) => node.value == null && flows.every((flow) => (flow.to !== node.id && flow.from !== node.id) || flow.value == null)
  const total = steps[0].nodes.reduce((sum, node) => sum + size(nodes.get(node.id)), 0)
  const share = (part) => `${Math.round((part / total) * 100)}%`
  const perStep = steps.map((step) => `${step.label}: ${step.nodes
    .map((node) => {
      const item = nodes.get(node.id)
      if (unknown(item)) return `${node.label} geen gegevens`
      return partial(item)
        ? `${node.label} minstens ${number(size(item))}`
        : `${node.label} ${number(size(item))} (${share(size(item))})`
    })
    .join(', ')}`)
  const later = flows.filter((flow) => nodes.get(flow.from).s > 0 && flow.value != null)
  const largest = later.reduce((best, flow) => (flow.value > (best?.value ?? -1) ? flow : best), null)
  const missing = flows.filter((flow) => flow.value == null)
  return [
    `${number(total)} aanvragen, van ${steps[0].label.toLowerCase()} tot ${steps.at(-1).label.toLowerCase()}.`,
    `${perStep.join('. ')}.`,
    largest ? `De grootste stroom daarna is ${nodes.get(largest.from).label} naar ${nodes.get(largest.to).label}, ${number(largest.value)}.` : '',
    missing.length
      ? `Geen gegevens van ${missing.map((flow) => `${nodes.get(flow.from).label} naar ${nodes.get(flow.to).label}`).join(' en ')}.`
      : '',
  ].filter(Boolean).join(' ')
}

const SANKEYS = [
  { id: 'sankey', title: 'Aanvragen van indiening tot uitkomst', data: process('three') },
  { id: 'sankey-four', title: 'Aanvragen tot en met bezwaar', data: process('four') },
  {
    id: 'sankey-small', title: 'Met een kleine stroom',
    data: process('three', { 'compleet>ingetrokken': 12, 'compleet>in-behandeling': 888 }),
  },
  {
    id: 'sankey-missing', title: 'Met een ontbrekende stroom',
    data: process('three', { 'onvolledig>in-behandeling': null }),
  },
  { id: 'sankey-first-missing', title: 'Aanvragen per kanaal', data: process('firstMissing') },
  { id: 'sankey-six', title: 'Zes uitkomsten', data: process('six') },
  { id: 'sankey-no-share', title: 'Alleen aantallen', data: process('three'), extra: { share: false } },
  { id: 'sankey-phone', title: 'Op een telefoon', data: process('three') },
  { id: 'sankey-links', title: 'Aanvragen van indiening tot uitkomst', data: linked(process('three')) },
  {
    id: 'sankey-chosen', title: 'Aanvragen van indiening tot uitkomst',
    data: linked(process('three')), selectedId: 'compleet',
  },
  {
    id: 'sankey-zero', title: 'Aanvragen van indiening tot uitkomst',
    data: process('three', {
      'compleet>in-behandeling': 0, 'onvolledig>in-behandeling': 0,
      'compleet>ingetrokken': null, 'onvolledig>ingetrokken': null,
    }),
  },
  { id: 'sankey-color', title: 'Aanvragen van indiening tot uitkomst', data: process('three'), extra: { color: 'violet' } },
].map(({ id, title, data, extra, selectedId }) => ({
  id, title, selectedId,
  description: sankeyDescription(data),
  spec: sankeySpec(data, extra),
}))

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
    id: 'line-events', title: 'Aanvragen per week',
    subtitle: 'Dit jaar tegen vorig jaar, met wat er gebeurde',
    description: 'Aanvragen per week dit jaar tegen vorig jaar, week 14 tot en met 39.',
    spec: {
      kind: 'line', labels: WEEKS, axisTitle: 'aanvragen',
      series: [
        { label: '2026', values: THIS_YEAR, area: true },
        { label: '2025', values: LAST_YEAR, comparison: true },
      ],
      events: [
        { index: 8, label: 'Online aanvragen open voor iedereen' },
        { index: 17, label: 'Storing inlogdienst, twee dagen' },
      ],
    },
  },
  {
    id: 'line-forecast', title: 'Aanvragen per jaar',
    subtitle: '× 1.000, gemeten tot en met 2025, daarna raming',
    description: `Lijn, aanvragen per jaar, × 1.000. ${forecastSentence('requests', 'Aanvragen')} De marge is een interval van 80 %.`,
    spec: {
      kind: 'line', labels: YEARS, axisTitle: 'aanvragen × 1.000',
      forecastFrom: FORECAST_FROM, intervalLabel: 'Marge 80 %',
      series: [{ label: 'Aanvragen', color: 'sky-blue', ...yearly('requests') }],
    },
  },
  {
    id: 'line-forecast-two', title: 'Aanvragen en bezwaren per jaar',
    subtitle: '× 1.000, gemeten tot en met 2025, daarna raming',
    description: `Lijn, aanvragen en bezwaren per jaar, × 1.000. ${forecastSentence('requests', 'Aanvragen')} ${forecastSentence('objections', 'Bezwaren')}`,
    spec: {
      kind: 'line', labels: YEARS, axisTitle: 'aantal × 1.000',
      forecastFrom: FORECAST_FROM, intervalLabel: 'Marge 80 %',
      series: [
        { label: 'Aanvragen', color: 'sky-blue', ...yearly('requests') },
        { label: 'Bezwaren', color: 'dark-yellow', ...yearly('objections') },
      ],
    },
  },
  {
    id: 'line-forecast-plain', title: 'Aanvragen per jaar',
    subtitle: '× 1.000, gemeten tot en met 2025, daarna raming',
    description: `Lijn, aanvragen per jaar, × 1.000. Van ${number(forecast[0].requests)} in ${forecast[0].year} naar ${number(lastMeasured.requests)} in ${lastMeasured.year}. De raming loopt op tot ${number(lastYear.requests)} in ${lastYear.year}, zonder marge.`,
    spec: {
      kind: 'line', labels: YEARS, axisTitle: 'aanvragen × 1.000',
      forecastFrom: FORECAST_FROM,
      series: [{ label: 'Aanvragen', color: 'sky-blue', values: yearly('requests').values }],
    },
  },
  {
    id: 'line-forecast-gap', title: 'Aanvragen per jaar',
    subtitle: '× 1.000, gemeten tot en met 2025, daarna raming',
    description: `Lijn, aanvragen per jaar, × 1.000. ${forecastSentence('requests', 'Aanvragen')} Voor 2028 is er geen raming en geen marge.`,
    spec: {
      kind: 'line', labels: YEARS, axisTitle: 'aanvragen × 1.000',
      forecastFrom: FORECAST_FROM, intervalLabel: 'Marge 80 %',
      series: [(() => {
        const { values, forecast: margin } = yearly('requests')
        const gap = YEARS.indexOf('2028')
        const without = (list) => list.map((value, i) => (i === gap ? null : value))
        return {
          label: 'Aanvragen', color: 'sky-blue', values: without(values),
          forecast: { low: without(margin.low), high: without(margin.high) },
        }
      })()],
    },
  },
  {
    id: 'line-forecast-comparison', title: 'Aanvragen per maand',
    subtitle: '2026 gemeten tot en met augustus, daarna raming, tegen 2025',
    description: `Lijn, aanvragen per maand in 2026 tegen 2025. 2026 loopt van ${number(THIS_YEAR_MONTHS[0])} in januari tot ${number(THIS_YEAR_MONTHS[7])} in augustus; de raming gaat tot ${number(THIS_YEAR_MONTHS[11])} in december. 2025 is helemaal gemeten, van ${number(LAST_YEAR_MONTHS[0])} tot ${number(LAST_YEAR_MONTHS[11])}.`,
    spec: {
      kind: 'line', labels: MONTHS, axisTitle: 'aanvragen', forecastFrom: 8, intervalLabel: 'Marge 80 %',
      series: [
        {
          label: '2026', color: 'sky-blue', values: THIS_YEAR_MONTHS,
          forecast: {
            low: THIS_YEAR_MONTHS.map((value, i) => (i < 8 ? null : value - 20 - (i - 8) * 10)),
            high: THIS_YEAR_MONTHS.map((value, i) => (i < 8 ? null : value + 20 + (i - 8) * 10)),
          },
        },
        { label: '2025', values: LAST_YEAR_MONTHS, comparison: true },
      ],
    },
  },
  {
    id: 'line-forecast-last', title: 'Aanvragen per jaar',
    subtitle: '× 1.000, gemeten tot en met 2029, daarna raming',
    description: `Lijn, aanvragen per jaar, × 1.000. Van ${number(forecast[0].requests)} in ${forecast[0].year} naar ${number(forecast.at(-2).requests)} in ${forecast.at(-2).year}, en ${number(lastYear.requests)} geraamd voor ${lastYear.year}.`,
    spec: {
      kind: 'line', labels: YEARS, axisTitle: 'aanvragen × 1.000', forecastFrom: YEARS.length - 1,
      series: [{ label: 'Aanvragen', color: 'sky-blue', values: yearly('requests').values }],
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
    id: 'bar-trend-gap', title: 'Staven met een onderbroken trendlijn',
    description: 'Afgehandelde aanvragen per dag deze week, met de vorige week als trendlijn. Van woensdag en zaterdag vorige week zijn geen gegevens, dus daar breekt de trendlijn.',
    spec: {
      kind: 'bar', labels: weekdays, values: daily.map((row) => row.requests),
      axisTitle: 'Afgehandelde aanvragen per dag',
      // Wednesday and Saturday are missing: two pieces of line and a lone point on Sunday.
      trend: daily.map((row, i) => (i === 2 || i === 5 ? null : row.requests_last_week)),
    },
  },
  {
    id: 'bar-forecast', title: 'Aanvragen per jaar',
    subtitle: '× 1.000, gemeten tot en met 2025, daarna raming',
    description: `Staven, aanvragen per jaar, × 1.000. ${forecastSentence('requests', 'Aanvragen')} De marge is een interval van 80 %.`,
    spec: {
      kind: 'bar', labels: YEARS, axisTitle: 'Aanvragen × 1.000', color: 'sky-blue',
      forecastFrom: FORECAST_FROM, intervalLabel: 'Marge 80 %',
      ...yearly('requests'),
    },
  },
  {
    id: 'bar-forecast-chosen', title: 'Aanvragen per jaar',
    subtitle: '× 1.000, gemeten tot en met 2025, daarna raming',
    description: `Staven, aanvragen per jaar, × 1.000. ${forecastSentence('requests', 'Aanvragen')} Elk jaar opent zijn eigen pagina.`,
    spec: {
      kind: 'bar', labels: YEARS, axisTitle: 'Aanvragen × 1.000', color: 'sky-blue',
      forecastFrom: FORECAST_FROM, intervalLabel: 'Marge 80 %',
      ...yearly('requests'),
      links: YEARS.map((year) => ({ id: year, href: `?jaar=${year}` })),
    },
    selectedId: '2027',
  },
  {
    id: 'bar-forecast-gap', title: 'Aanvragen per jaar',
    subtitle: '× 1.000, gemeten tot en met 2025, daarna raming',
    description: `Staven, aanvragen per jaar, × 1.000. ${forecastSentence('requests', 'Aanvragen')} Voor 2028 is er geen raming.`,
    spec: (() => {
      const { values, forecast: margin } = yearly('requests')
      const gap = YEARS.indexOf('2028')
      const without = (list) => list.map((value, i) => (i === gap ? null : value))
      return {
        kind: 'bar', labels: YEARS, axisTitle: 'Aanvragen × 1.000', color: 'sky-blue',
        forecastFrom: FORECAST_FROM, intervalLabel: 'Marge 80 %',
        values: without(values), forecast: { low: without(margin.low), high: without(margin.high) },
      }
    })(),
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
        { label: 'Deze week', values: daily.map((row) => row.requests), color: 'sky-blue' },
        { label: 'Vorige week', values: daily.map((row) => row.requests_last_week), comparison: true },
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
    id: 'stacked-bar-other', title: 'Gestapelde staven met overig en de rest',
    description: 'Aanvragen per maand naar stand: toegekend, overig en nog open, als aandeel van alle aanvragen.',
    spec: {
      kind: 'stacked-bar', labels: ['jan', 'feb', 'mrt', 'apr'],
      axisTitle: 'Aandeel per stand', normalized: true,
      series: [
        { label: 'Toegekend', values: [48, 52, 57, 63], color: 'sky-blue' },
        { label: 'Overig', values: [22, 20, 18, 17], color: 'other' },
        { label: 'Nog open', values: [30, 28, 25, 20], color: 'remainder' },
      ],
    },
  },
  {
    id: 'stacked-area', title: 'Aanvragen per kanaal',
    subtitle: 'Per week, week 24 tot en met 35',
    description: 'Aanvragen per week naar kanaal, week 24 tot en met 35. Online groeit van 610 naar 735, balie, post en telefoon dalen licht. Van de post in week 29 zijn geen gegevens, dus die week ontbreekt het totaal.',
    spec: {
      kind: 'stacked-area', axisTitle: 'aanvragen',
      labels: Array.from({ length: 12 }, (_, i) => `wk ${24 + i}`),
      series: CHANNELS,
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
    id: 'pie-legend', title: 'Taart zonder legendatabel',
    description: 'Aanvragen naar kanaal: online 412, balie 236, telefoon 158, post 61, overig 33.',
    spec: {
      kind: 'pie', legendTable: false,
      segments: [
        { label: 'Balie', value: 236 },
        { label: 'Online', value: 412 },
        { label: 'Overig', value: 33 },
        { label: 'Post', value: 61 },
        { label: 'Telefoon', value: 158 },
      ],
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
      left: { label: 'Aanvragen', values: column('requests'), unit: 'aanvragen', color: 'sky-blue' },
      right: { label: 'Wachttijd', values: column('wait_time'), unit: 'min', color: 'dark-yellow' },
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
    id: 'radar', title: 'Kwaliteit van de dienstverlening',
    subtitle: 'Gemiddelde score per aspect, schaal 0–10',
    description: 'Gemiddelde score per aspect in Q3 2026 tegen Q3 2025, op een schaal van 0 tot 10. Bejegening scoort het hoogst (8,9), Tijdigheid het laagst (6,1) en als enige onder de norm van 7,0.',
    spec: quality(),
  },
  {
    id: 'radar-layers', title: 'Kwaliteit per regio',
    subtitle: 'Gemiddelde score per aspect, schaal 0–10, Q3 2026',
    description: 'Gemiddelde score per aspect in drie regio’s, op een schaal van 0 tot 10. Noord scoort het hoogst op Bejegening (8,7), Zuid op Deskundigheid (8,6), Oost op Bejegening (8,0).',
    spec: {
      kind: 'radar', axes: ASPECTS, max: 10, threshold: 7,
      series: [
        { label: 'Regio Noord', values: [7.9, 6.4, 7.1, 8.5, 8.0, 8.7], color: 'sky-blue' },
        { label: 'Regio Zuid', values: [7.1, 7.4, 7.8, 8.1, 8.6, 8.2], color: 'dark-yellow' },
        { label: 'Regio Oost', values: [6.8, 7.0, 6.6, 7.9, 7.4, 8.0], color: 'red' },
      ],
    },
  },
  ...SANKEYS,
  {
    id: 'treemap', title: 'Uitgaven per beleidsterrein',
    subtitle: 'Begroting, fictief',
    description: budgetDescription(),
    spec: budgetSpec(),
  },
  {
    id: 'treemap-nested', title: 'Uitgaven per beleidsterrein en post',
    subtitle: 'Begroting, fictief',
    description: budgetDescription(),
    spec: budgetSpec({ nested: true }),
  },
  {
    id: 'treemap-chosen', title: 'Uitgaven per beleidsterrein',
    subtitle: 'Begroting, fictief',
    description: budgetDescription(),
    spec: budgetSpec({ links: true }),
    selectedId: 'onderwijs',
  },
  {
    id: 'treemap-nested-chosen', title: 'Uitgaven per beleidsterrein en post',
    subtitle: 'Begroting, fictief',
    description: budgetDescription(),
    spec: budgetSpec({ nested: true, links: true }),
    selectedId: 'zorg',
  },
  {
    id: 'treemap-no-labels', title: 'Uitgaven per beleidsterrein',
    subtitle: 'Begroting, fictief',
    description: budgetDescription(),
    spec: budgetSpec({ nested: true, dataLabels: false }),
  },
  {
    id: 'treemap-phone', title: 'Uitgaven per beleidsterrein en post',
    subtitle: 'Begroting, fictief',
    description: budgetDescription(),
    spec: budgetSpec({ nested: true, links: true }),
    // On a phone the first part stands open, as after a tap on its button.
    setup: async (element) => {
      await element.updateComplete
      element.renderRoot.querySelector('.lintje-treemap__toggle')?.click()
    },
  },
  {
    id: 'treemap-yellow-chosen', title: 'Uitgaven per beleidsterrein',
    subtitle: 'Begroting, fictief',
    description: budgetDescription(),
    spec: budgetSpec({ links: true, color: 'yellow' }),
    selectedId: 'zorg',
  },
  {
    id: 'treemap-small-links', title: 'Uitgaven per beleidsterrein',
    subtitle: 'Begroting, fictief',
    description: budgetDescription(),
    spec: budgetSpec({ links: true, small: true }),
  },
  {
    id: 'treemap-phone-chosen', title: 'Uitgaven per beleidsterrein en post',
    subtitle: 'Begroting, fictief',
    description: budgetDescription(),
    spec: budgetSpec({ nested: true, links: true }),
    selectedId: 'zorg',
    // On a phone the chosen part stands open too.
    setup: async (element) => {
      await element.updateComplete
      element.renderRoot.querySelector('.lintje-treemap__toggle[aria-label="Onderdelen van Zorg"]')?.click()
    },
  },
  {
    id: 'dumbbell', title: 'Tevredenheid per loket',
    subtitle: 'Gemiddeld rapportcijfer, 2024 en 2026',
    spec: satisfactionSpec(),
  },
  {
    id: 'dumbbell-links', title: 'Tevredenheid per loket',
    subtitle: 'Gemiddeld rapportcijfer, 2024 en 2026',
    spec: satisfactionSpec(LINKED_SATISFACTION),
  },
  {
    id: 'dumbbell-chosen', title: 'Tevredenheid per loket',
    subtitle: 'Gemiddeld rapportcijfer, 2024 en 2026',
    spec: satisfactionSpec(LINKED_SATISFACTION),
    selectedId: 'utrecht',
  },
  {
    id: 'dumbbell-both-hidden', title: 'Tevredenheid per loket',
    subtitle: 'Gemiddeld rapportcijfer, 2024 en 2026',
    spec: satisfactionSpec(),
    // Both moments switched off in the legend, one after the other.
    toggle: [0, 1],
  },
  {
    id: 'dumbbell-phone-long', title: 'Tevredenheid per loket',
    subtitle: 'Gemiddeld rapportcijfer, 2024 en 2026',
    spec: satisfactionSpec(
      [
        ...SATISFACTION.slice(0, 3),
        { label: 'Servicepunt in het gemeentehuis van de oostelijke wijken', from: 6.4, to: 7.1 },
      ],
      { min: 5, max: 9 },
    ),
  },
  {
    id: 'dumbbell-unchanged', title: 'Tevredenheid per loket',
    subtitle: 'Gemiddeld rapportcijfer, 2024 en 2026',
    spec: satisfactionSpec(
      [
        { label: 'Zwolle', from: 7.2, to: 7.2 },
        { label: 'Amsterdam Centrum', from: 6.9, to: 7.0 },
        { label: 'Den Haag', from: 6.6, to: 7.2 },
      ],
      { min: 5, max: 9 },
    ),
  },
  {
    id: 'dumbbell-short', title: 'Tevredenheid per loket',
    subtitle: 'Gemiddeld rapportcijfer, 2024 en 2026, as van 5 tot 9',
    spec: satisfactionSpec(SATISFACTION, { min: 5, max: 9 }),
  },
  {
    id: 'dumbbell-off-axis', title: 'Tevredenheid per loket',
    subtitle: 'Gemiddeld rapportcijfer, 2024 en 2026, as van 5 tot 9',
    spec: satisfactionSpec(
      SATISFACTION.map((row) => (row.label === 'Utrecht' ? { ...row, from: 3.8, to: 6.1 } : row)),
      { min: 5, max: 9 },
    ),
  },
  {
    id: 'dumbbell-hidden', title: 'Tevredenheid per loket',
    subtitle: 'Gemiddeld rapportcijfer, 2024 en 2026',
    spec: satisfactionSpec(),
    // The earlier moment switched off in the legend, as a reader does.
    toggle: 0,
  },
  {
    id: 'dumbbell-phone', title: 'Tevredenheid per loket',
    subtitle: 'Gemiddeld rapportcijfer, 2024 en 2026',
    spec: satisfactionSpec(SATISFACTION.slice(0, 5), { min: 5, max: 9 }),
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
    id: 'heatmap-labels', title: 'Heatmap met lange rijlabels',
    description: 'Wachtenden per loket in de ochtend. Een lange naam staat heel in de tooltip, en loopt op een telefoon door.',
    spec: {
      kind: 'heatmap', columnLabels: ['9:00', '10:00', '11:00'],
      rowLabels: ['Servicepunt in het gemeentehuis van de oostelijke wijken', 'Servicepunt west', 'Stadskantoor'],
      values: [[12, 18, 9], [6, 11, 14], [8, 7, 10]],
      unit: 'wachtenden',
    },
  },
  {
    id: 'histogram', title: 'Doorlooptijd van aanvragen',
    description: 'Doorlooptijd van 1.900 afgehandelde aanvragen in klassen van twee dagen. De mediaan is 9,6 dagen, de termijn 21 dagen; 153 aanvragen duurden 22 dagen of langer.',
    spec: processingTime(processingDays),
  },
  {
    id: 'line-light-colours', title: 'Afspraken per regio',
    description: 'Gemaakte afspraken per maand in drie regio’s, januari tot en met juni. Noord loopt op van 410 naar 520, Midden van 380 naar 455, Zuid daalt van 300 naar 260.',
    spec: {
      kind: 'line', labels: ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun'], axisTitle: 'afspraken',
      series: [
        { label: 'Noord', values: [410, 432, 455, 470, 498, 520], color: 'mint-green' },
        { label: 'Midden', values: [380, 395, 402, 420, 438, 455], color: 'pink' },
        { label: 'Zuid', values: [300, 296, 288, 281, 270, 260], color: 'light-blue' },
      ],
    },
  },
]

// What sets each specimen apart within its kind, for its label.
const VARIANT_NAMES = {
  line: 'Met vergelijking en peilmoment',
  'line-events': 'Met gebeurtenissen',
  'line-forecast': 'Met raming en marge',
  'line-forecast-two': 'Twee reeksen met raming',
  'line-forecast-plain': 'Raming zonder marge',
  'line-forecast-gap': 'Raming met een ontbrekend jaar',
  'line-forecast-comparison': 'Raming met een vergelijking',
  'line-forecast-last': 'Raming van alleen het laatste jaar',
  bar: 'Met trendlijn',
  'bar-forecast': 'Met raming en marge',
  'bar-forecast-chosen': 'Geraamde staaf met link en keuze',
  'bar-forecast-gap': 'Een ontbrekende geraamde staaf',
  'bar-trend-gap': 'Trendlijn met ontbrekende dagen',
  'horizontal-bar': 'Met norm',
  'target-progress': 'Tegen een doel van 100 %',
  'grouped-bar': 'Twee reeksen per groep',
  'stacked-bar': 'In aantallen',
  'stacked-bar-normalized': 'Op 100 %',
  'stacked-bar-other': 'Met overig en de rest',
  'stacked-area': 'Per kanaal met een ontbrekende week',
  pie: 'Taart',
  donut: 'Donut met legendatabel',
  'pie-color': 'In de kleur van haar variabele',
  'pie-legend': 'Zonder legendatabel',
  'pie-folded': 'Meer dan vijf delen',
  'donut-remainder': 'Donut met de rest van een geheel',
  'dual-axis': 'Aantallen en wachttijd met norm',
  scatter: 'Wachttijd tegen drukte met norm',
  radar: 'Eén variabele met vergelijking en norm',
  'radar-layers': 'Drie lagen',
  heatmap: 'Met klassenlegenda',
  dumbbell: 'Twee momenten met norm',
  'dumbbell-unchanged': 'Een rij zonder verandering',
  'dumbbell-short': 'Ingekorte as',
  'dumbbell-off-axis': 'Waarde buiten de as',
  'dumbbell-hidden': 'Eén moment uitgezet',
  'dumbbell-phone': 'Op een telefoon',
  'dumbbell-links': 'Rijen met een link',
  'dumbbell-chosen': 'Een gekozen rij',
  'dumbbell-both-hidden': 'Beide momenten uitgezet',
  'dumbbell-phone-long': 'Een lange naam op een telefoon',
  'heatmap-labels': 'Met lange rijlabels',
  histogram: 'Met mediaan en termijn',
  treemap: 'Eén niveau',
  'treemap-nested': 'Twee niveaus',
  'treemap-chosen': 'Een gekozen vlak',
  'treemap-nested-chosen': 'Gekozen hoofdpost met onderposten',
  'treemap-no-labels': 'Zonder datalabels',
  'treemap-phone': 'Op een telefoon met een open hoofdpost',
  'treemap-yellow-chosen': 'In geel met een gekozen vlak',
  'treemap-small-links': 'Klein formaat met links',
  'treemap-phone-chosen': 'Gekozen hoofdpost op een telefoon',
  sankey: 'Drie stappen',
  'sankey-four': 'Vier stappen met een eindigende stroom',
  'sankey-small': 'Een kleine stroom',
  'sankey-missing': 'Een ontbrekende stroom',
  'sankey-first-missing': 'Twee ontbrekende stromen uit één knoop',
  'sankey-six': 'Zes knopen in één stap',
  'sankey-no-share': 'Zonder aandeel',
  'sankey-phone': 'Op een telefoon',
  'sankey-links': 'Links op knopen en stromen',
  'sankey-chosen': 'Een gekozen knoop',
  'sankey-zero': 'Een knoop met 0 en een zonder gegevens',
  'sankey-color': 'In de kleur van haar variabele',
  'line-light-colours': 'In lichte kleuren met hun rand',
}

// What a label cannot say, for the note under it.
const VARIANT_NOTES = {
  'heatmap-labels': 'Met een aanwijzer staat een lange naam heel in de tooltip; zonder hover en op een telefoon loopt hij door.',
  line: 'De laatste twee uren zijn nog niet compleet en staan gearceerd.',
  'bar-trend-gap': 'Van woensdag en zaterdag vorige week zijn geen gegevens; daar breekt de trendlijn.',
  'line-forecast': 'Na 2025 loopt de lijn gestippeld door, met haar marge eromheen. Een geraamd punt heeft een open hoverpunt.',
  'line-forecast-two': 'Wijs een reeks aan in de legenda: haar marge kleurt en de andere reeks stapt terug.',
  'line-forecast-plain': 'Een raming zonder marge: alleen de stippels en de sleutel "Raming".',
  'line-forecast-gap': 'Voor 2028 is er geen raming: de stippels en de marge breken af.',
  'bar-forecast': 'Een geraamde staaf is open, met haar marge als lijn met kapjes.',
  'stacked-area': 'Van de post in week 29 zijn geen gegevens, dus die week ontbreekt het totaal.',
  'pie-folded': 'De taart houdt de vier grootste delen en vouwt de rest in “Overig”.',
  'pie-legend': 'De legenda staat boven de taart; aantal en aandeel staan in de tooltip.',
  'radar-layers': 'Wijs een regio aan in de legenda: haar vlak kleurt en de andere lagen stappen terug.',
  'dumbbell-unchanged': 'Zonder verandering valt de stip binnen de ring; bij een klein verschil ligt ze erover.',
  'dumbbell-short': 'Een halter draagt een positie, geen lengte: de host mag de as inkorten.',
  'dumbbell-off-axis': 'Utrecht 2024 valt buiten de as: het punt staat op de rand met een afkapteken, de tooltip en de tabel geven 3,8.',
  'dumbbell-hidden': '2024 staat uit in de legenda: de ringen, de verbindingen en de verschillen verdwijnen, de as blijft.',
  'dumbbell-phone': 'Onder 768 px staat de naam boven de halter, die de volle breedte krijgt.',
  treemap: 'Cultuur en media en Sport zijn elk kleiner dan 1 % van het geheel en staan samen als “Overig”.',
  'treemap-nested': 'Een klik in een onderpost kiest de hoofdpost; de pijltoetsen lopen langs de onderposten.',
  'treemap-nested-chosen': 'De omlijning staat om de hele hoofdpost; de andere stappen terug.',
  'treemap-no-labels': 'Naam en bedrag staan in de tooltip en de tabel.',
  'treemap-phone': 'Onder 768 px: het geheel als strook en een rij per hoofdpost; de eerste staat open. Op een breder scherm de gewone treemap.',
  'sankey-four': 'Toegekend gaat niet verder naar bezwaar: die aanvragen eindigen in de derde stap.',
  'sankey-small': 'Compleet → Ingetrokken is 12 aanvragen: de band is 2 px, het getal staat in de tooltip en de tabel.',
  'sankey-missing': 'Van Onvolledig naar In behandeling zijn geen gegevens: een gearceerde stomp, en In behandeling is minstens het bekende deel.',
  'sankey-first-missing': 'Van de balie is alleen het totaal bekend (`value`), niet hoe het zich verdeelt: één stomp voor beide stromen.',
  'sankey-six': 'De tekening wordt hoger met de stap met de meeste knopen, zodat elke naam zijn ruimte houdt.',
  'sankey-no-share': 'Met `share: false` staat alleen het aantal naast de naam.',
  'sankey-phone': 'Smaller dan 768 px wordt elke overgang een staaf per bron, met een rij per doel eronder.',
  'line-light-colours': 'Mintgroen, roze en lichtblauw halen als lijn geen 3:1 op wit; in licht ligt er een rand in hun eigen donkere kleur onder.',
  'line-forecast-comparison': 'De vergelijking is tot het eind gemeten. Met de pijltoetsen staat “raming” bij de waarde van 2026, niet bij de maand.',
  'line-forecast-last': 'Alleen 2030 is geraamd. Op een telefoon past “Raming” niet rechts van de grens en staat het een regel hoger, nooit over de lijn of over “Gemeten”.',
  'bar-forecast-chosen': 'Elk jaar heeft een `href`. De gekozen staaf 2027 is geraamd en dus open; de andere stappen terug.',
  'bar-forecast-gap': 'Voor 2028 is er geen raming: de plek is gearceerd, zonder marge.',
  'treemap-yellow-chosen': 'In de tinten van geel, met Zorg gekozen: de omlijning staat erom en de andere vlakken stappen terug.',
  'treemap-small-links': 'Met `small: true` op de lage hoogte, elk vlak met zijn eigen `href`.',
  'treemap-phone-chosen': 'Onder 768 px is de rij van Zorg gekozen en opengeklapt. Elk aandeel is een aandeel in het geheel, ook bij een onderpost.',
  'dumbbell-links': 'Elke rij heeft een `href`. Een klik of Enter op de halter gaat erheen als de host het event niet annuleert.',
  'dumbbell-chosen': 'Utrecht is gekozen; de andere rijen stappen terug.',
  'dumbbell-both-hidden': '2024 en 2026 staan allebei uit in de legenda: de as, de norm en de namen blijven.',
  'dumbbell-phone-long': 'Een lange naam loopt onder 768 px door over meer regels, boven zijn halter.',
  'sankey-links': 'Elke knoop en elke stroom heeft een `href`. In de tekening zegt elke knop zijn naam en aantal; de labels ernaast hoort een schermlezer niet nog eens.',
  'sankey-chosen': 'Compleet is gekozen: wat erdoor stroomt staat vol, de rest stapt terug.',
  'sankey-zero': 'In behandeling telt 0 en heeft geen knoop, alleen zijn label. Van Ingetrokken zijn geen gegevens: twee gearceerde stompen en “geen gegevens”.',
  'sankey-color': 'In violet: de knopen en banden in die kleur, op een telefoon de tinten ervan.',
}

// The states a chart tile can be in, put on each specimen of a kind: the tile keeps its size
// in all of them, so a page does not jump while the figures arrive, and the skeleton has the
// shape of the kind that is coming.
const CHART_STATES = [
  { value: 'ready', label: 'Klaar' },
  { value: 'loading', label: 'Laden', data: { state: 'loading' } },
  {
    value: 'empty', label: 'Leeg',
    data: { state: 'empty', message: 'Geen gegevens voor deze selectie. Kies een ruimere periode of een ander bereik.' },
  },
  {
    value: 'error', label: 'Fout',
    data: {
      state: 'error',
      message: 'De bron levert sinds 07:41 niet aan. De cijfers hieronder zijn van vóór dat moment.',
      lastKnown: 'Laatste waarde 07:00 · 141.260 aanvragen',
    },
  },
]

const TILE = '<lintje-chart></lintje-chart>'

const chartSpecimen = (chart) => ({
  label: VARIANT_NAMES[chart.id],
  note: VARIANT_NOTES[chart.id],
  html: TILE,
  setup(stage) {
    const element = stage.querySelector('lintje-chart')
    if (chart.toggle != null) {
      void element.updateComplete.then(async () => {
        for (const index of [chart.toggle].flat()) {
          element.renderRoot.querySelectorAll('.lintje-legend__button')[index]?.click()
          await element.updateComplete
        }
      })
    }
    element.data = {
      chart: chart.spec,
      description: chart.description ?? describeSatisfaction(chart.spec),
      title: chart.title,
      subtitle: chart.subtitle,
      footnote: 'Bron: fictieve demogegevens',
      expandable: true,
      download: { filename: `demo-${chart.id}` },
      selectedId: chart.selectedId,
    }
    // A chart with links says under the tile where a click would go, and stays on this page. As a
    // host would, it keeps the chosen mark and hands it back: the chart holds no selection itself.
    if (JSON.stringify(chart.spec).includes('"href"')) {
      linkLog(stage, element, ['lintje-mark-select'])
      element.addEventListener('lintje-mark-select', (event) => {
        element.data = { ...element.data, selectedId: event.detail.id ?? undefined }
      })
    }
    chart.setup?.(element)
  },
})

// Missing is never zero (rule 15): a line breaks at the gap, a bar's slot is hatched. Two lines
// in colour carry their colour's shape at the end (rule 13); the dark yellow one is edged.
const share = (part) => daily.map((row, i) => (i === 3 ? null : Math.round(row.requests * part)))

// A bar per day with its own `href`: where a click on it goes, shown under the specimen.
const linkedMarks = [
  {
    kind: 'bar',
    label: 'Staven met een link',
    note: 'Elke staaf heeft een `href`. Een klik of Enter gaat erheen als de host het event niet annuleert; Cmd- of Ctrl-klik opent een nieuw tabblad.',
    html: TILE,
    setup(stage) {
      const element = stage.querySelector('lintje-chart')
      element.data = {
        chart: {
          kind: 'bar', labels: weekdays, values: daily.map((row) => row.requests),
          axisTitle: 'Afgehandelde aanvragen per dag',
          links: weekdays.map((day) => ({ id: day, href: `?dag=${encodeURIComponent(day)}` })),
        },
        description: 'Afgehandelde aanvragen per dag deze week; elke staaf opent die dag.',
        title: 'Aanvragen per dag',
        footnote: 'Bron: fictieve demogegevens',
      }
      linkLog(stage, element, ['lintje-mark-select'])
    },
  },
]

const missingValues = [
  {
    label: 'Ontbrekende waarde',
    note: 'Twee lijnen in kleur breken af waar donderdag ontbreekt.',
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
    label: 'Ontbrekende waarde',
    note: 'De plek van donderdag is gearceerd.',
    description: 'Afgehandelde aanvragen per dag deze week. Donderdag ontbreekt.',
    chart: { kind: 'bar', labels: weekdays, values: share(1), axisTitle: 'Afgehandelde aanvragen per dag' },
  },
  {
    label: 'Ontbrekende waarde',
    note: 'Loketten die vertraagd aanleveren, missen hun wachttijd en staan er niet in.',
    description: `Gemiddelde wachttijd tegen het aantal aanvragen per loket. ${lateDesks.join(' en ')} leveren vertraagd aan: hun wachttijd ontbreekt, dus ze staan niet in de grafiek.`,
    chart: deskScatter(true),
  },
  {
    label: 'Ontbrekende waarde',
    note: 'De lijn breekt bij Tijdigheid, het vlak vervalt en de spaak is gearceerd.',
    description: 'Gemiddelde score per aspect in Q3 2026 tegen Q3 2025. Van Tijdigheid zijn geen gegevens.',
    chart: quality(true),
  },
  {
    label: 'Ontbrekende waarde',
    note: 'Van Wonen en van Jeugdzorg zijn geen gegevens: ze hebben geen vlak, en de totaalregel noemt ze.',
    description: budgetDescription(['Wonen', 'Jeugdzorg']),
    chart: budgetSpec({ nested: true, missing: ['Wonen', 'Jeugdzorg'] }),
  },
  {
    label: 'Ontbrekende waarde',
    note: 'Van de klasse 6 tot 8 dagen ontbreekt het aantal.',
    description: 'Doorlooptijd van afgehandelde aanvragen in klassen van twee dagen. Van de klasse 6 tot 8 dagen ontbreekt het aantal.',
    chart: processingTime(processingDays.map((bin, i) => (i === 3 ? { ...bin, count: null } : bin))),
  },
  {
    label: 'Ontbrekende waarde',
    note: 'Van Arnhem ontbreekt 2026: geen verbinding en geen verschil, de rij is gearceerd.',
    chart: satisfactionSpec(SATISFACTION.map((row) => (row.label === 'Arnhem' ? { ...row, to: null } : row))),
  },
].map(({ label, note, description, chart }) => ({
  kind: chart.kind,
  label,
  note,
  html: TILE,
  setup(stage) {
    stage.querySelector('lintje-chart').data = {
      chart,
      description: description ?? describeSatisfaction(chart),
      title: label,
      footnote: 'Bron: fictieve demogegevens',
    }
  },
}))

export default {
  elements: [
    {
      tag: 'lintje-kpi-row',
      wide: true,
      title: 'De kerncijfers van de pagina in één rij',
      specimens: [
        {
          label: 'Drie kerncijfers',
          html: '<lintje-kpi-row></lintje-kpi-row>',
          setup: (stage) => {
            stage.querySelector('lintje-kpi-row').data = { kpis: KPIS.slice(0, 3) }
          },
        },
        {
          label: 'Kerncijfers op een schaal',
          note: 'Twee kerncijfers staan met `gauge` op een schaal: als boog en als balk.',
          html: '<lintje-kpi-row></lintje-kpi-row>',
          setup: (stage) => {
            stage.querySelector('lintje-kpi-row').data = {
              kpis: [GAUGE_ARC, GAUGE_LINEAR, KPIS[2]],
            }
          },
        },
        {
          label: 'Elke datakleur als accent',
          note: 'Het veld `variable` kiest de kleur van een kerncijfer.',
          html: '<lintje-kpi-row></lintje-kpi-row>',
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
          label: 'Verloop tijdens laden',
          html: '<lintje-kpi label="Afgehandelde aanvragen" variable="sky-blue" state="loading"></lintje-kpi>',
          setup: (stage) => { stage.querySelector('lintje-kpi').sparkline = REQUESTS_SPARKLINE },
        },
        {
          label: 'Met achtervoegsel en toelichting',
          html: '<lintje-kpi></lintje-kpi>',
          setup: single(KPIS[4]),
        },
        {
          label: 'Op een schaal als boog',
          html: '<lintje-kpi></lintje-kpi>',
          setup: single(GAUGE_ARC),
        },
        {
          label: 'Op een schaal als balk',
          html: '<lintje-kpi></lintje-kpi>',
          setup: single(GAUGE_LINEAR),
        },
        {
          label: 'Balk met het doel aan het eind',
          note: 'Het doel staat boven de balk naast zijn streep, zodat het het eindgetal nooit raakt.',
          html: '<lintje-kpi></lintje-kpi>',
          setup: single({
            label: 'Afgehandeld binnen 2 dagen', variable: 'ruby-red', value: '71%',
            gauge: { shape: 'linear', max: 100, target: 95, targetLabel: 'norm' },
          }),
        },
        {
          label: 'Op een schaal tijdens laden',
          html: '<lintje-kpi state="loading"></lintje-kpi>',
          setup: single({ label: GAUGE_ARC.label, gauge: GAUGE_ARC.gauge }),
        },
        {
          label: 'Op een schaal zonder waarde',
          html: '<lintje-kpi state="empty"></lintje-kpi>',
          setup: single({ label: GAUGE_LINEAR.label, variable: 'dark-yellow', gauge: GAUGE_LINEAR.gauge }),
        },
        {
          label: 'Laden',
          html: '<lintje-kpi label="Afwijzingen" variable="red" state="loading"></lintje-kpi>',
        },
        {
          label: 'Leeg',
          html: '<lintje-kpi label="Afwijzingen" variable="red" state="empty" message="Nog geen aanvragen vandaag"></lintje-kpi>',
        },
        {
          label: 'Fout',
          html: '<lintje-kpi label="Afwijzingen" variable="red" state="error" message="Bron niet bereikbaar" last-known="21.542 op 8 sep"></lintje-kpi>',
        },
      ],
    },
{
      tag: 'lintje-chart',
      wide: true,
      title: 'Een grafiek in haar tegel: veertien soorten, één tag',
      // One kind at a time, chosen by the question it answers; the states switch on its specimens.
      groups: {
        label: 'Soort',
        plural: 'soorten',
        question: 'Welke grafiek?',
        param: 'soort',
        key: 'kind',
        shared: 'Voor elke soort',
        questions: CHART_QUESTIONS,
        items: Object.entries(CHART_KINDS).map(([kind, guide]) => ({
          value: kind,
          ...guide,
          specimens: [
            ...CHARTS.filter((chart) => chart.spec.kind === kind).map(chartSpecimen),
            ...missingValues.filter((specimen) => specimen.kind === kind),
            ...linkedMarks.filter((specimen) => specimen.kind === kind),
          ],
        })),
      },
      states: CHART_STATES,
      specimens: [],
    },
    {
      tag: 'lintje-note',
      title: 'Duiding van de analist bij de cijfers',
      specimens: [
        {
          label: 'Met datum en auteur',
          html: '<lintje-note></lintje-note>',
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
