/** The map's own geometry, unprojected: the surface projects it, an area tests against it. */
import worldGeo from '../../../../../assets/geo/world.lonlat.json'
import netherlandsGeo from '../../../../../assets/geo/netherlands.lonlat.json'

export type FeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.MultiPolygon,
  { id: string; name: string }
>

export const GEOS: Record<string, FeatureCollection> = {
  world: worldGeo as unknown as FeatureCollection,
  netherlands: netherlandsGeo as unknown as FeatureCollection,
}

export function geoOf(name: string | undefined): FeatureCollection {
  return GEOS[name ?? 'world'] ?? GEOS.world
}
