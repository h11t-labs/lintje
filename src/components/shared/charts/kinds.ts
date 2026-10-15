/**
 * Which chart answers which question: the reader's question first, then the kinds that answer
 * it, each with what it is for and when another kind fits better. The style guide reads it; a
 * host may show the names.
 */
import type { ChartKind } from './shared/types'

export type ChartQuestion = 'time' | 'compare' | 'parts' | 'spread' | 'relation' | 'target'

/** The questions in the order a page asks them, as a reader would put them. */
export const CHART_QUESTIONS: Readonly<Record<ChartQuestion, string>> = {
  time: 'Hoe verloopt het in de tijd?',
  compare: 'Hoe verhouden groepen zich?',
  parts: 'Uit welke delen bestaat het geheel, en waar komen ze terecht?',
  spread: 'Hoe is het verdeeld?',
  relation: 'Hangen twee maten samen?',
  target: 'Halen we het doel?',
}

export interface ChartKindGuide {
  /** The kind's Dutch name. */
  label: string
  question: ChartQuestion
  /** What the kind is for. */
  use: string
  /** When another kind fits better, and which. */
  avoid: string
}

// `satisfies` keeps the list complete: a new kind in `ChartSpec` does not compile without its entry.
export const CHART_KINDS = {
  line: {
    label: 'Lijn',
    question: 'time',
    use: 'Het verloop van een of meer reeksen over de tijd, met een vergelijking in grijs, een peilmoment of wat er gebeurde.',
    avoid: 'Een paar losse groepen zonder volgorde: neem staven.',
  },
  'stacked-area': {
    label: 'Gestapeld vlak',
    question: 'time',
    use: 'Hoe de delen van één variabele samen het totaal vormen, door de tijd.',
    avoid:
      'Delen die je los wilt volgen: alleen de onderste laag staat op de nullijn. Neem lijnen.',
  },
  'dual-axis': {
    label: 'Twee assen',
    question: 'time',
    use: 'Twee maten met een andere eenheid over dezelfde periode, zoals aantallen en een wachttijd met norm.',
    avoid:
      'Twee maten in dezelfde eenheid: neem een lijn met twee reeksen. Waar de lijnen elkaar kruisen, kiest de schaal, niet de data.',
  },
  bar: {
    label: 'Staven',
    question: 'compare',
    use: 'Eén waarde per groep of per periode, als de losse waarden tellen, met datalabels of een trendlijn.',
    avoid: 'Lange namen of veel groepen: neem horizontale staven.',
  },
  'horizontal-bar': {
    label: 'Horizontale staven',
    question: 'compare',
    use: 'Groepen met lange namen, op grootte, met een norm die laat zien wie erboven zit.',
    avoid: 'Een verloop in de tijd: tijd loopt van links naar rechts. Neem staven of een lijn.',
  },
  'grouped-bar': {
    label: 'Gegroepeerde staven',
    question: 'compare',
    use: 'Twee of drie reeksen naast elkaar per groep, om ze binnen de groep te vergelijken.',
    avoid: 'Meer dan drie reeksen: de groepen worden onleesbaar. Neem een lijn of een tabel.',
  },
  radar: {
    label: 'Spinnendiagram',
    question: 'compare',
    use: 'Het profiel van één tot drie eenheden over vijf tot acht maten op één schaal, tegen een vergelijking in grijs of een norm.',
    avoid:
      'Maten met elk een eigen eenheid, of meer dan drie eenheden: neem horizontale staven of een tabel. Precies aflezen: een tabel.',
  },
  'stacked-bar': {
    label: 'Gestapelde staven',
    question: 'parts',
    use: 'De samenstelling per groep of per periode, in aantallen of op 100 %.',
    avoid:
      'Eén geheel op één moment: neem een taart. Een deel boven de onderste laag precies vergelijken: neem gegroepeerde staven.',
  },
  pie: {
    label: 'Taart of donut',
    question: 'parts',
    use: 'De delen van één geheel op één moment, tot vijf; meer vouwt tot "Overig". Een donut toont ook het deel van een geheel, met het cijfer in het midden.',
    avoid: 'Een verloop in de tijd, of delen die bijna even groot zijn: neem gestapelde staven.',
  },
  sankey: {
    label: 'Sankey',
    question: 'parts',
    use: 'Hoe één aantal zich over twee tot vier stappen van een proces verdeelt, zoals aanvragen van indiening tot uitkomst. Ook wel stroomdiagram.',
    avoid: 'Stromen tussen plaatsen: neem de kaart. Eén geheel op één moment: neem een taart.',
  },
  histogram: {
    label: 'Histogram',
    question: 'spread',
    use: 'Hoe waarden over klassen vallen, zoals doorlooptijden, met een mediaan of een termijn.',
    avoid: 'Groepen zonder volgorde of zonder doorlopende as: neem staven.',
  },
  heatmap: {
    label: 'Heatmap',
    question: 'spread',
    use: 'Een waarde over twee indelingen tegelijk, zoals uur en dag, in vijf klassen.',
    avoid: 'Precieze waarden aflezen: klassen ronden af. Neem een tabel.',
  },
  scatter: {
    label: 'Spreiding',
    question: 'relation',
    use: 'Of twee maten samenhangen: een punt per eenheid, met een norm op de verticale as.',
    avoid: 'Een verloop in de tijd: neem een lijn.',
  },
  'target-progress': {
    label: 'Voortgang tegen een doel',
    question: 'target',
    use: 'Hoe ver een paar onderdelen zijn tegen één doel.',
    avoid: 'Eén kerncijfer tegen een doel: dat is een KPI op een schaal, in lintje-kpi.',
  },
} as const satisfies Record<ChartKind, ChartKindGuide>
