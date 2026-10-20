// The filters category (Filters): the specimens of its elements.
import { log } from '../shared.js'
import { regions } from '../../_data/load.js'

const ALL = { value: 'alle', label: 'Alle regio’s' }

const REGIONS = [ALL, ...regions.map((region) => ({ value: region.id, label: region.name }))]

const KINDS = [
  { value: 'alle', label: 'Alle' },
  { value: 'counter', label: 'Balie' },
  { value: 'service', label: 'Servicepunt' },
  { value: 'mobile', label: 'Mobiel' },
]

/** The sentence the zone and the sheet show for their two controls, built as the filter bar builds it. */
const sentence = (region) => [
  { text: 'Je ziet: ', emphasis: false },
  { text: 'Regio ', emphasis: false },
  { text: REGIONS.find((option) => option.value === region).label, emphasis: true },
  { text: ' · ', emphasis: false },
  { text: 'Soort loket ', emphasis: false },
  { text: 'Alle', emphasis: true },
  { text: '.', emphasis: false },
]

/** The zone and the sheet hold the same two controls, each under its field label. */
const CONTROLS = (stacked) => `
  <lintje-field label="Regio"${stacked ? ' stacked' : ''}>
    <lintje-select label="Regio" hide-label${stacked ? ' stacked' : ''}></lintje-select>
  </lintje-field>
  <lintje-field label="Soort loket"${stacked ? ' stacked' : ''}>
    <lintje-segmented label="Soort loket" hide-label${stacked ? ' stacked' : ''}></lintje-segmented>
  </lintje-field>`

function fillControls(stage, region = ALL.value) {
  const select = stage.querySelector('lintje-select')
  select.options = REGIONS
  select.value = region
  const segmented = stage.querySelector('lintje-segmented')
  segmented.options = KINDS
  segmented.value = 'alle'
}

export default {
  elements: [
{
      tag: 'lintje-filter-bar',
      wide: true,
      title: 'De filterbalk: de filters die de pagina declareert, als zone en als blad',
      // A page holds one filter bar in the shell: one bar per page writes the store that says
      // whether the sheet is open. The style guide page has no other such bar, so this one
      // stands once, full width; the standalone bar under it keeps its own sheet.
      specimens: [
        {
          label: 'Drie filters',
          note: 'Onder de balk staat wat de host hoort.',
          html: '<lintje-filter-bar></lintje-filter-bar>',
          setup(stage) {
            const bar = stage.querySelector('lintje-filter-bar')
            bar.data = {
              open: true,
              filters: [
                {
                  key: 'region',
                  label: 'Regio',
                  kind: 'select',
                  value: 'alle',
                  default: 'alle',
                  options: REGIONS,
                },
                {
                  key: 'kind',
                  label: 'Soort loket',
                  kind: 'segmented',
                  value: 'alle',
                  default: 'alle',
                  options: KINDS,
                },
                {
                  key: 'period',
                  label: 'Periode',
                  kind: 'date-range',
                  value: { from: '2026-09-01', to: '2026-09-08' },
                  default: { from: '2026-09-01', to: '2026-09-08' },
                  max: '2026-09-08',
                },
              ],
            }
            const say = log(stage)
            bar.addEventListener('lintje-values-change', (event) => {
              say(`lintje-values-change ${JSON.stringify(event.detail)}`)
            })
          },
        },
        {
          label: 'Los op de pagina',
          note:
            'Met `standalone` hoort de balk niet bij de schil en schrijft hij daar niets. Onder ' +
            '768 px is de zin een knop die het eigen filterblad van de balk opent.',
          html: '<lintje-filter-bar></lintje-filter-bar>',
          setup(stage) {
            const bar = stage.querySelector('lintje-filter-bar')
            const filters = [
              {
                key: 'region',
                label: 'Regio',
                kind: 'select',
                value: 'alle',
                default: 'alle',
                options: REGIONS,
              },
              {
                key: 'kind',
                label: 'Soort loket',
                kind: 'segmented',
                value: 'alle',
                default: 'alle',
                options: KINDS,
              },
            ]
            bar.data = { standalone: true, open: true, filters }
            const say = log(stage)
            // The host confirms what the bar commits with the next `data`.
            bar.addEventListener('lintje-values-change', (event) => {
              say(`lintje-values-change ${JSON.stringify(event.detail)}`)
              bar.data = {
                ...bar.data,
                filters: filters.map((filter) => ({ ...filter, value: event.detail[filter.key] })),
              }
            })
          },
        },
      ],
    },
    {
      tag: 'lintje-filter-zone',
      wide: true,
      title: 'De zone met de filters en de “Je ziet”-zin, in te klappen',
      specimens: [
        {
          label: 'Open met twee filters',
          html: `<lintje-filter-zone total="2" modified="0">${CONTROLS(false)}</lintje-filter-zone>`,
          setup(stage) {
            const zone = stage.querySelector('lintje-filter-zone')
            zone.sentence = sentence(ALL.value)
            fillControls(stage)
            // The zone reports the reader's wish; its owner keeps `open`.
            zone.addEventListener('lintje-zone-open-change', (event) => (zone.open = event.detail))
          },
        },
        {
          label: 'Dichtgeklapt tot de zin',
          html: `<lintje-filter-zone total="2" modified="1">${CONTROLS(false)}</lintje-filter-zone>`,
          setup(stage) {
            const zone = stage.querySelector('lintje-filter-zone')
            zone.open = false
            // One filter differs from its default: the zone counts it and offers "herstel".
            zone.sentence = sentence(REGIONS[1].value)
            fillControls(stage, REGIONS[1].value)
            stage.querySelector('lintje-field').setAttribute('modified', '')
            zone.addEventListener('lintje-zone-open-change', (event) => (zone.open = event.detail))
          },
        },
        {
          label: 'Dichtgeklapt met een lange zin',
          note:
            'Een zin die niet past, staat met een aanwijzer heel in de tooltip. Op een telefoon ' +
            'loopt hij door.',
          html: `<lintje-filter-zone total="2" modified="0">${CONTROLS(false)}</lintje-filter-zone>`,
          setup(stage) {
            const zone = stage.querySelector('lintje-filter-zone')
            zone.open = false
            zone.sentence = [
              ...sentence(ALL.value).slice(0, -1),
              { text: ' · ', emphasis: false },
              { text: 'Periode ', emphasis: false },
              { text: 'de afgelopen twaalf maanden, zonder de feestdagen en de weken van de zomersluiting', emphasis: true },
              { text: '.', emphasis: false },
            ]
            fillControls(stage)
            zone.addEventListener('lintje-zone-open-change', (event) => (zone.open = event.detail))
          },
        },
      ],
    },
    {
      tag: 'lintje-filter-sheet',
      title: 'Het filterblad onderin beeld: dezelfde filters, gestapeld, met Toepassen',
      specimens: [
        {
          label: 'Gesloten',
          note: 'De knop opent het blad.',
          html: `<lintje-button variant="secondary">Filters openen</lintje-button>
            <lintje-filter-sheet>${CONTROLS(true)}</lintje-filter-sheet>`,
          setup(stage) {
            const sheet = stage.querySelector('lintje-filter-sheet')
            sheet.sentence = sentence(ALL.value)
            fillControls(stage)
            stage.querySelector('lintje-button').addEventListener('click', () => (sheet.open = true))
            // The owner closes the sheet: on the scrim, the cross, Escape and "Toepassen".
            for (const name of ['lintje-sheet-close', 'lintje-filters-apply']) {
              sheet.addEventListener(name, () => (sheet.open = false))
            }
          },
        },
      ],
    },
  ],
}
