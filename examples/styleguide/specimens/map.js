// The map category (Kaart): the specimens of its elements.
import { linkLog, log } from '../shared.js'
import { originCountries, desks, origin, meta } from '../../_data/load.js'

// The nine data colours after the first eight, with the Dutch name the legend shows.
const SERIES = [
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

// Fictional work areas, rough rings of [lon, lat] over the country; one has no figure.
const ZONES = [
  ['wg-noord', 'Werkgebied Noord', 214, [[5.2, 52.75], [7.2, 52.75], [7.2, 53.45], [6.2, 53.5], [5.2, 53.25]]],
  ['wg-oost', 'Werkgebied Oost', 132, [[5.6, 51.85], [6.9, 51.85], [7.05, 52.7], [5.6, 52.65]]],
  ['wg-midden', 'Werkgebied Midden', 87, [[5.05, 51.85], [5.55, 51.85], [5.55, 52.65], [5.05, 52.5]]],
  ['wg-west', 'Werkgebied West', 301, [[4.1, 51.85], [5.0, 51.85], [5.0, 52.7], [4.55, 52.7]]],
  ['wg-zuidwest', 'Werkgebied Zuidwest', null, [[3.4, 51.2], [4.3, 51.2], [4.3, 51.75], [3.4, 51.75]]],
  ['wg-zuid', 'Werkgebied Zuid', 45, [[4.4, 50.75], [6.1, 50.75], [6.1, 51.8], [4.4, 51.8]]],
].map(([id, label, value, polygon]) => ({
  id, label, value, polygon,
  detail: value == null ? undefined : `${Math.round(value / 7)} per dag`,
}))

// Fictional figures per province, by its ISO 3166-2 code; one has no figure.
const PROVINCES = [
  ['NL-GR', 'Groningen', 412],
  ['NL-FR', 'Fryslân', 365],
  ['NL-DR', 'Drenthe', 248],
  ['NL-OV', 'Overijssel', 690],
  ['NL-FL', 'Flevoland', 231],
  ['NL-GE', 'Gelderland', 1204],
  ['NL-UT', 'Utrecht', 958],
  ['NL-NH', 'Noord-Holland', 1873],
  ['NL-ZH', 'Zuid-Holland', 2116],
  ['NL-ZE', 'Zeeland', null],
  ['NL-NB', 'Noord-Brabant', 1342],
  ['NL-LI', 'Limburg', 587],
].map(([id, label, value]) => ({ id, label, value }))

const KIND_SERIES = { counter: 'dark-green', service: 'purple' }
const LIGHT_SERIES = [
  ['mint-green', 'Mintgroen'],
  ['pink', 'Roze'],
  ['light-blue', 'Lichtblauw'],
]
// The same kinds as series keys of their own, styled rather than named after a colour.
const KIND_STYLED = { counter: 'balie', service: 'servicepunt' }

// "Overig" has no coordinates in the demo data: it counts towards the scale and draws no flow.
const MAPS = [
  {
    id: 'map-flows', label: 'Stromen', title: 'Aanvragen uit het buitenland',
    note: 'De variant `flows` trekt lijnen naar één bestemming.',
    data: {
      variant: 'flows', geo: 'world', unit: 'aanvragen', height: 320,
      destination: { lon: meta.head_office.lon, lat: meta.head_office.lat, label: meta.head_office.label },
      values: origin.map((place) => ({
        id: place.id ?? 'other',
        label: place.label,
        value: place.value,
        detail: `${place.files} dossiers`,
        lon: place.lon ?? undefined,
        lat: place.lat ?? undefined,
      })),
      description: 'Aanvragen uit het buitenland, van de woonplaats van de aanvrager naar het hoofdkantoor in Den Haag; de lijndikte is het aantal aanvragen.',
      subtitle: 'Vandaag · naar woonplaats van de aanvrager',
    },
  },
  {
    id: 'map-points', label: 'Punten', title: 'Kaart · punten',
    note: 'De variant `points` zet een stip op elke plek.',
    data: {
      variant: 'points', geo: 'netherlands', unit: 'aanvragen', height: 320,
      values: desks.map((point) => ({
        id: point.id, label: point.map_label, value: point.requests,
        detail: `${point.wait_time} min wachttijd`, lon: point.lon, lat: point.lat,
      })),
      description: 'Loketten in Nederland; de grootte van de stip is het aantal aanvragen.',
    },
  },
  {
    // Every point a series: the nine newer data colours, each with its own shape (rule 13).
    id: 'map-series', label: 'Punten in reeksen', title: 'Kaart · reeksen',
    note: 'De variant `points` met `series` geeft elke reeks een eigen kleur en vorm.',
    data: {
      variant: 'points', geo: 'netherlands', unit: 'aanvragen', height: 320,
      values: desks.map((point, i) => ({
        id: point.id, label: point.map_label, value: point.requests,
        detail: `${point.wait_time} min wachttijd`, lon: point.lon, lat: point.lat,
        series: SERIES[i % SERIES.length][0],
      })),
      seriesLabels: Object.fromEntries(SERIES),
      description: 'Loketten in Nederland in negen reeksen, elk met een eigen kleur en vorm; de grootte van het teken is het aantal aanvragen.',
    },
  },
  {
    id: 'map-choropleth', label: 'Choropleet', title: 'Kaart · choropleet',
    note: 'De variant `choropleth` kleurt landen in klassen.',
    data: {
      variant: 'choropleth', geo: 'world', unit: 'aanvragen', height: 320,
      values: originCountries,
      description: 'Aanvragen uit het buitenland per land waar de aanvrager woont, in vijf klassen; landen zonder cijfer staan gearceerd.',
    },
  },
  {
    id: 'map-provinces', label: 'Provincies', title: 'Kaart · choropleet per provincie',
    note: 'De variant `choropleth` met `geo: provinces` kleurt de twaalf provincies in klassen, elk met haar ISO-code als id.',
    data: {
      variant: 'choropleth', geo: 'provinces', unit: 'aanvragen', height: 320,
      values: PROVINCES,
      description: 'Aanvragen per provincie in vijf klassen; Zeeland heeft geen cijfer en staat gearceerd.',
    },
  },
  {
    id: 'map-polygons', label: 'Vlakken', title: 'Kaart · vlakken',
    note: 'De variant `polygons` kleurt eigen vlakken in klassen.',
    data: {
      variant: 'polygons', geo: 'netherlands', unit: 'meldingen', height: 320,
      values: ZONES,
      description: 'Meldingen per werkgebied in vijf klassen; Werkgebied Zuidwest heeft geen cijfer en staat gearceerd.',
    },
  },
  {
    // Two layers, one map: the areas at the bottom, the desks on top, each in its own unit.
    id: 'map-plots', label: 'Lagen', title: 'Kaart · lagen',
    note: 'De variant `plots` legt vlakken en punten op één kaart.',
    data: {
      variant: 'plots', geo: 'netherlands', unit: 'aanvragen', height: 320, values: [],
      plots: [
        { variant: 'polygons', label: 'Werkgebieden', unit: 'meldingen', values: ZONES },
        {
          variant: 'points', label: 'Loketten',
          seriesLabels: { 'dark-green': 'Balie', purple: 'Servicepunt' },
          values: desks.map((point) => ({
            id: point.id, label: point.map_label, value: point.requests,
            detail: `${point.wait_time} min wachttijd`, lon: point.lon, lat: point.lat,
            series: KIND_SERIES[point.kind],
          })),
        },
      ],
      description: 'Meldingen per werkgebied in vijf klassen, met daarover de loketten: de grootte van het teken is het aantal aanvragen, de kleur en vorm het soort loket.',
    },
  },
  {
    // The light colours: in light each point has an edge in its own dark colour, for 3:1 on the land.
    id: 'map-light-colours', label: 'Lichte kleuren', title: 'Kaart · lichte kleuren',
    note: 'Mintgroen, roze en lichtblauw krijgen in licht een rand in hun eigen donkere kleur.',
    data: {
      variant: 'points', geo: 'netherlands', unit: 'aanvragen', height: 320,
      values: desks.map((point, i) => ({
        id: point.id, label: point.map_label, value: point.requests,
        lon: point.lon, lat: point.lat,
        series: LIGHT_SERIES[i % LIGHT_SERIES.length][0],
      })),
      seriesLabels: Object.fromEntries(LIGHT_SERIES),
      description: 'Loketten in Nederland in drie reeksen in lichte kleuren, elk met een eigen vorm; de grootte van het teken is het aantal aanvragen.',
    },
  },
  {
    id: 'map-point-size', label: 'Puntgrootte', title: 'Kaart · puntgrootte met de zoom',
    note: 'Met `size` is het aantal geen grootte (`by: none`) en groeit een punt mee met de zoom (`zoom: true`): zoom in en de punten blijven bij hun plek horen.',
    data: {
      variant: 'points', geo: 'netherlands', unit: 'loketten', height: 320,
      size: { by: 'none', min: 5, zoom: true },
      values: desks.map((point) => ({
        id: point.id, label: point.map_label, value: 1,
        detail: `${point.wait_time} min wachttijd`, lon: point.lon, lat: point.lat,
      })),
      description: 'Elk loket als één punt van vaste grootte, die met de zoom meegroeit.',
    },
  },
  {
    id: 'map-series-style', label: 'Reeksen in één kleur', title: 'Kaart · reeksen in één kleur',
    note: 'Met `seriesStyles` draagt de vorm het onderscheid en is de kleur neutraal: de bron is geen schaal.',
    data: {
      variant: 'points', geo: 'netherlands', unit: 'aanvragen', height: 320,
      seriesLabels: { balie: 'Balie', servicepunt: 'Servicepunt' },
      seriesStyles: {
        balie: { color: 'neutral', shape: 'square' },
        servicepunt: { color: 'neutral', shape: 'diamond' },
      },
      values: desks.map((point) => ({
        id: point.id, label: point.map_label, value: point.requests,
        detail: `${point.wait_time} min wachttijd`, lon: point.lon, lat: point.lat,
        series: KIND_STYLED[point.kind],
      })),
      description: 'Loketten per soort in één neutrale kleur: een vierkant is een balie, een ruit een servicepunt; de grootte is het aantal aanvragen.',
    },
  },
]

const MAP_TILE = '<lintje-map></lintje-map>'

function mapSetup(map, extra = {}) {
  return (stage) => {
    const tile = stage.querySelector('lintje-map')
    tile.data = {
      ...map.data,
      ...extra,
      title: extra.title ?? map.title,
      footnote: 'Bron: fictieve demogegevens',
      expandable: true,
      download: { filename: map.id },
      controls: { lasso: true, circle: true, rect: true },
    }
    const say = log(stage)
    // A host keeps the area in its URL and sends it back; the specimen does the same.
    tile.addEventListener('lintje-area-select', (event) => {
      tile.data = { ...tile.data, selectedArea: event.detail.area }
    })
    for (const name of ['lintje-mark-select', 'lintje-layer-change', 'lintje-area-select']) {
      tile.addEventListener(name, (event) => say(`${name} ${JSON.stringify(event.detail)}`))
    }
  }
}

// Development only; in production this is the organization's own GeoServer, and a host reads
// these values from its own configuration. The dark style is another layer of the same service.
const DEMO_BASEMAP = {
  kind: 'wms',
  url: 'https://ows.terrestris.de/osm/service',
  layers: 'OSM-WMS',
  attribution: '© OpenStreetMap contributors, via terrestris',
  dark: { layers: 'Dark' },
}

export default {
  elements: [
    {
      tag: 'lintje-map',
      wide: true,
      title: 'Tegel met een kaart: stromen, punten, reeksen, choropleet, vlakken en lagen, ook op een ondergrond (WMS)',
      specimens: [
        ...MAPS.map((map) => ({
          label: map.label,
          note: map.note,
          html: MAP_TILE,
          setup: mapSetup(map),
        })),
        {
          label: 'Punten met een link',
          note: 'Elke stip heeft een `href`. Een klik of Enter gaat erheen als de host het event niet annuleert; Cmd- of Ctrl-klik opent een nieuw tabblad.',
          html: MAP_TILE,
          setup(stage) {
            const tile = stage.querySelector('lintje-map')
            const points = MAPS.find((map) => map.id === 'map-points')
            tile.data = {
              ...points.data,
              title: 'Kaart · punten met een link',
              values: points.data.values.map((value) => ({ ...value, href: `?loket=${value.id}` })),
              footnote: 'Bron: fictieve demogegevens',
            }
            linkLog(stage, tile, ['lintje-mark-select'])
          },
        },
        ...MAPS.map((map) => ({
          label: `${map.label} op een ondergrond`,
          note: `${map.note} De ondergrond is een WMS-kaart, in donker de donkere stijl van dezelfde dienst.`,
          html: MAP_TILE,
          // No `height`: the map takes its own, 400 px and 280 on a phone.
          setup: mapSetup(map, { basemap: DEMO_BASEMAP, height: undefined, title: `${map.title} · ondergrond` }),
        })),
      ],
    },
  ],
}
