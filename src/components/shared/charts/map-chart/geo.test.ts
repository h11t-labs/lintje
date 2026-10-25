import { describe, expect, it } from 'vitest'
import { GEOS, geoOf } from './geo'

describe('the built-in geometry', () => {
  it('has the twelve provinces, by their ISO 3166-2 code and Dutch name', () => {
    const provinces = geoOf('provinces').features.map((feature) => [
      feature.id,
      feature.properties.id,
      feature.properties.name,
    ])
    expect(provinces.map(([id]) => id)).toEqual([
      'NL-DR',
      'NL-FL',
      'NL-FR',
      'NL-GE',
      'NL-GR',
      'NL-LI',
      'NL-NB',
      'NL-NH',
      'NL-OV',
      'NL-UT',
      'NL-ZE',
      'NL-ZH',
    ])
    expect(provinces.every(([id, own]) => id === own)).toBe(true)
    expect(Object.fromEntries(provinces.map(([id, , name]) => [id, name]))).toMatchObject({
      'NL-FR': 'Fryslân',
      'NL-NB': 'Noord-Brabant',
      'NL-UT': 'Utrecht',
    })
  })

  it('frames the provinces as it frames the country', () => {
    expect(GEOS.provinces.bbox).toEqual(GEOS.netherlands.bbox)
  })
})
