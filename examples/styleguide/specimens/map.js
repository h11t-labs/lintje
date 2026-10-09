// The map category (Kaart): the specimens of its elements.
import { log } from '../shared.js'
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

const KIND_SERIES = { counter: 'dark-green', service: 'purple' }

// "Overig" has no coordinates in the demo data: it counts towards the scale and draws no flow.
const MAPS = [
  {
    id: 'map-flows', label: 'Stromen · flows', title: 'Aanvragen uit het buitenland',
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
    id: 'map-points', label: 'Punten · points', title: 'Kaart · punten',
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
    id: 'map-series', label: 'Punten in reeksen · series', title: 'Kaart · reeksen',
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
    id: 'map-choropleth', label: 'Choropleet · choropleth', title: 'Kaart · choropleet',
    data: {
      variant: 'choropleth', geo: 'world', unit: 'aanvragen', height: 320,
      values: originCountries,
      description: 'Aanvragen uit het buitenland per land waar de aanvrager woont, in vijf klassen; landen zonder cijfer staan gearceerd.',
    },
  },
  {
    id: 'map-polygons', label: 'Vlakken · polygons', title: 'Kaart · vlakken',
    data: {
      variant: 'polygons', geo: 'netherlands', unit: 'meldingen', height: 320,
      values: ZONES,
      description: 'Meldingen per werkgebied in vijf klassen; Werkgebied Zuidwest heeft geen cijfer en staat gearceerd.',
    },
  },
  {
    // Two layers, one map: the areas at the bottom, the desks on top, each in its own unit.
    id: 'map-plots', label: 'Lagen · plots', title: 'Kaart · lagen',
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
]

const MAP_TILE = '<lintje-map-tile></lintje-map-tile>'

function mapSetup(map, extra = {}) {
  return (stage) => {
    const tile = stage.querySelector('lintje-map-tile')
    tile.data = {
      ...map.data,
      ...extra,
      title: extra.title ?? map.title,
      footnote: 'Bron: fictieve demogegevens',
      expandable: true,
      download: { filename: map.id },
    }
    const say = log(stage)
    for (const name of ['lintje-mark-select', 'lintje-layer-change']) {
      tile.addEventListener(name, (event) => say(`${name} ${JSON.stringify(event.detail)}`))
    }
  }
}

// Development only; in production this is the organization's own GeoServer, and a host reads
// these values from its own configuration.
const DEMO_BASEMAP = {
  kind: 'wms',
  url: 'https://ows.terrestris.de/osm/service',
  layers: 'OSM-WMS',
  attribution: '© OpenStreetMap contributors, via terrestris',
}

export default {
  elements: [
    {
      tag: 'lintje-map-tile',
      title: 'Tegel met een kaart: stromen, punten, reeksen, choropleet, vlakken en lagen',
      specimens: MAPS.map((map) => ({ label: map.label, html: MAP_TILE, wide: true, setup: mapSetup(map) })),
    },
    {
      id: 'map-basemap',
      title: 'Dezelfde kaarten op een ondergrond (Leaflet, WMS)',
      short: 'kaart op ondergrond',
      specimens: MAPS.map((map) => ({
        label: `${map.label} · ondergrond`,
        html: MAP_TILE,
        wide: true,
        // No `height`: the map takes its own, 400 px and 220 on a phone.
        setup: mapSetup(map, { basemap: DEMO_BASEMAP, height: undefined, title: `${map.title} · ondergrond` }),
      })),
    },
  ],
}
