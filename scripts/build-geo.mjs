/**
 * Builds the map geography (`npm run build:geo`, `--refresh` skips the cache) from Natural Earth
 * Admin-0 1:10m and CBS's `landsdeel` and `provincie` regions on PDOK, cached in `.cache/geo/`.
 * Kadaster's `landgebied` is not used: it fills the Wadden Sea and the IJsselmeer. Overridable for
 * a closed network: `LINTJE_GEO_NATURAL_EARTH_URL`, `LINTJE_GEO_PDOK_URL` (or `--natural-earth=`,
 * `--pdok=`). Output: `world.lonlat.json`, `netherlands.lonlat.json` and `provinces.lonlat.json`,
 * unprojected; the map projects them itself (Web Mercator, as every web map).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(here, '../assets/geo')
const CACHE = resolve(here, '../.cache/geo')

const flag = (name) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
const REFRESH = process.argv.includes('--refresh')

/** Pinned release; raise the tag to take a newer one. 1:10m, because at the tolerance the world's
 * budget allows, 1:50m has less detail left than there is room for. */
const NATURAL_EARTH =
  flag('natural-earth') ??
  process.env.LINTJE_GEO_NATURAL_EARTH_URL ??
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_0_countries.geojson'
const PDOK = (
  flag('pdok') ??
  process.env.LINTJE_GEO_PDOK_URL ??
  'https://api.pdok.nl/cbs/gebiedsindelingen/ogc/v1'
).replace(/\/$/, '')

async function fetched(name, url) {
  const file = resolve(CACHE, name)
  if (!REFRESH && existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  console.log(`fetching ${url}`)
  const response = await fetch(url, {
    headers: { accept: 'application/geo+json, application/json' },
  })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`)
  const text = await response.text()
  mkdirSync(CACHE, { recursive: true })
  writeFileSync(file, text)
  return JSON.parse(text)
}

/* --- Simplification ------------------------------------------------------- */

function distance(p, a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)),
  )
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

/** Douglas-Peucker. */
function simplify(points, tolerance) {
  if (points.length < 3) return points
  let maxDistance = 0
  let index = 0
  for (let i = 1; i < points.length - 1; i++) {
    const d = distance(points[i], points[0], points[points.length - 1])
    if (d > maxDistance) {
      maxDistance = d
      index = i
    }
  }
  if (maxDistance <= tolerance) return [points[0], points[points.length - 1]]
  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ]
}

/** Rough area of a ring, to drop invisible islets. */
function area(ring) {
  let s = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    s += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
  }
  return Math.abs(s / 2)
}

/**
 * Douglas-Peucker over shapes that share their borders vertex for vertex, as CBS's do: a ring is
 * cut wherever the shape on its other side changes, and each stretch is simplified once, in one
 * direction, so two neighbours keep one border and no sliver opens between them.
 */
function simplifyShared(shapes, tolerance) {
  const key = ([x, y]) => `${x.toFixed(7)},${y.toFixed(7)}`
  const edge = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`)
  const add = (map, k, n) => (map.get(k) ?? map.set(k, new Set()).get(k)).add(n)
  const sides = new Map()
  const meets = new Map()
  shapes.forEach((kept, n) => {
    for (const ring of kept) {
      for (let i = 0; i + 1 < ring.length; i++) {
        add(sides, edge(key(ring[i]), key(ring[i + 1])), n)
        add(meets, key(ring[i]), n)
      }
    }
  })
  const owners = (a, b) => [...sides.get(edge(a, b))].sort().join()
  const done = new Map()
  const stretch = (points) => {
    const forward = points.map(key).join(' ')
    const backward = points.map(key).reverse().join(' ')
    const reversed = backward < forward
    const id = reversed ? backward : forward
    if (!done.has(id)) done.set(id, simplify(reversed ? points.toReversed() : points, tolerance))
    return reversed ? done.get(id).toReversed() : done.get(id)
  }
  return shapes.map((kept) =>
    kept.map((ring) => {
      const open = ring.slice(0, -1)
      const keys = open.map(key)
      const n = open.length
      const cut = keys.map(
        (k, i) =>
          meets.get(k).size > 2 ||
          owners(keys[(i + n - 1) % n], k) !== owners(k, keys[(i + 1) % n]),
      )
      // A ring along one neighbour or none starts where that neighbour's ring starts too.
      if (!cut.includes(true)) cut[keys.indexOf(keys.toSorted()[0])] = true
      const first = cut.indexOf(true)
      const out = [open[first]]
      let points = [open[first]]
      for (let step = 1; step <= n; step++) {
        const i = (first + step) % n
        points.push(open[i])
        if (cut[i]) {
          out.push(...stretch(points).slice(1))
          points = [open[i]]
        }
      }
      return out
    }),
  )
}

/* --- Conversion ----------------------------------------------------------- */

function rings(geometry) {
  return geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat()
}

/**
 * Selects and simplifies the surviving rings in lon/lat, once, so both outputs share shapes.
 * `shared` simplifies a border two shapes share once, for both.
 */
function shapesOf(features, { tolerance, minArea, ringFilter, shared = false }) {
  const kept = features.map((f) =>
    rings(f.geometry).filter((ring) => (!ringFilter || ringFilter(ring)) && area(ring) >= minArea),
  )
  const simplified = shared
    ? simplifyShared(kept, tolerance)
    : kept.map((pieces) => pieces.map((ring) => simplify(ring, tolerance)))
  const shapes = []
  features.forEach((f, n) => {
    const pieces = simplified[n].filter((ring) => ring.length >= 4)
    if (pieces.length) {
      shapes.push({
        id: f.properties.ISO_A2,
        name: f.properties.NAME_NL || f.properties.NAME,
        pieces,
      })
    }
  })
  return shapes
}

/** The shapes as GeoJSON. Coordinates are rounded below the tolerance. */
function geojson(features, { tolerance, minArea, ringFilter, shared, precision = 3 }) {
  const factor = 10 ** precision
  const round = (n) => Math.round(n * factor) / factor
  const shapes = shapesOf(features, { tolerance, minArea, ringFilter, shared })
  const all = shapes.flatMap((v) => v.pieces.flat())
  const lons = all.map((p) => p[0])
  const lats = all.map((p) => p[1])
  return {
    type: 'FeatureCollection',
    // The map's home extent, so nothing walks the coordinates at runtime.
    bbox: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)].map(round),
    features: shapes.map((v) => ({
      type: 'Feature',
      id: v.id,
      properties: { id: v.id, name: v.name },
      geometry: {
        type: 'MultiPolygon',
        coordinates: v.pieces.map((ring) => [ring.map(([lon, lat]) => [round(lon), round(lat)])]),
      },
    })),
  }
}

/* --- Dissolve ------------------------------------------------------------- */

/**
 * The outline of polygons sharing borders vertex for vertex: an edge walked in both directions
 * is inner and cancels; the rest is stitched into rings.
 */
function dissolve(features) {
  const key = ([x, y]) => `${x.toFixed(7)},${y.toFixed(7)}`
  const edges = new Map()
  for (const feature of features) {
    for (const ring of rings(feature.geometry)) {
      for (let i = 0; i + 1 < ring.length; i++) {
        const a = key(ring[i])
        const b = key(ring[i + 1])
        if (edges.has(`${b}|${a}`)) edges.delete(`${b}|${a}`)
        else edges.set(`${a}|${b}`, [ring[i], ring[i + 1]])
      }
    }
  }
  const next = new Map()
  for (const [a, b] of edges.values()) {
    if (!next.has(key(a))) next.set(key(a), [])
    next.get(key(a)).push(b)
  }
  const outline = []
  for (const [startKey, targets] of next) {
    while (targets.length) {
      const ring = [startKey.split(',').map(Number)]
      let current = startKey
      while (next.get(current)?.length) {
        const point = next.get(current).pop()
        ring.push(point)
        current = key(point)
        if (current === startKey) break
      }
      if (current === startKey && ring.length >= 4) outline.push(ring)
    }
  }
  return outline
}

/* --- Run ------------------------------------------------------------------ */

// The scale is in the name, so a cache of another scale is fetched again rather than reused.
const countries = await fetched('natural-earth-countries-10m.geojson', NATURAL_EARTH)
// The collection holds every year CBS published; the newest is used.
const regions = await fetched(
  'cbs-landsdeel.geojson',
  `${PDOK}/collections/landsdeel_gegeneraliseerd/items?f=json&limit=1000`,
)
const newestOf = (collection) => {
  const year = Math.max(...collection.features.map((f) => f.properties.jaarcode))
  return collection.features.filter((f) => f.properties.jaarcode === year)
}
const newest = newestOf(regions)
const provinceRegions = newestOf(
  await fetched(
    'cbs-provincie.geojson',
    `${PDOK}/collections/provincie_gegeneraliseerd/items?f=json&limit=1000`,
  ),
)
mkdirSync(OUT, { recursive: true })

// Antarctica is left out: it fills the bottom of the frame without meaning anything.
// The tolerance is the finest that keeps the world within 200 kB as counted below; a new
// release means tuning it again.
const WORLD = {
  features: countries.features.filter((f) => f.properties.ISO_A2 !== 'AQ'),
  options: { tolerance: 0.16, minArea: 1.2, precision: 2 },
}

// The Netherlands separately and finer; its four regions become one outline. Its budget is
// 25 kB and it stays well under, as CBS publishes every year.
const NETHERLANDS = {
  features: [
    {
      type: 'Feature',
      properties: { ISO_A2: 'NL', NAME_NL: 'Nederland' },
      geometry: { type: 'MultiPolygon', coordinates: dissolve(newest).map((ring) => [ring]) },
    },
  ],
  options: {
    tolerance: 0.004,
    minArea: 0.0015,
    // The European part only, should a source include the Caribbean municipalities.
    ringFilter: (ring) => ring.every(([lon]) => lon > 0),
  },
}
// CBS's province codes and the ISO 3166-2 codes a choropleth's ids name the provinces by.
const PROVINCE_ISO = {
  PV20: 'NL-GR',
  PV21: 'NL-FR',
  PV22: 'NL-DR',
  PV23: 'NL-OV',
  PV24: 'NL-FL',
  PV25: 'NL-GE',
  PV26: 'NL-UT',
  PV27: 'NL-NH',
  PV28: 'NL-ZH',
  PV29: 'NL-ZE',
  PV30: 'NL-NB',
  PV31: 'NL-LI',
}
// The twelve provinces, simplified as the Netherlands is, each border once for both sides.
const PROVINCES = {
  features: provinceRegions
    .map((f) => ({
      type: 'Feature',
      properties: { ISO_A2: PROVINCE_ISO[f.properties.statcode], NAME_NL: f.properties.statnaam },
      geometry: f.geometry,
    }))
    .toSorted((a, b) => a.properties.ISO_A2.localeCompare(b.properties.ISO_A2)),
  options: { ...NETHERLANDS.options, shared: true },
}
const found = PROVINCES.features.map((f) => f.properties.ISO_A2)
if (found.join() !== Object.values(PROVINCE_ISO).toSorted().join()) {
  throw new Error(`expected the twelve provinces, got ${found.join(' ')}`)
}

for (const [name, source] of [
  ['world', WORLD],
  ['netherlands', NETHERLANDS],
  ['provinces', PROVINCES],
]) {
  const collection = geojson(source.features, source.options)
  const json = JSON.stringify(collection)
  writeFileSync(`${OUT}/${name}.lonlat.json`, json)
  console.log(
    `${`${name}.lonlat`.padEnd(12)} ${collection.features.length.toString().padStart(4)} features · ` +
      `${' '.repeat(6)}          ${(json.length / 1024).toFixed(1)} kB · ` +
      `bbox ${collection.bbox.join(' ')}`,
  )
}
