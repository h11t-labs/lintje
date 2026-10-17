/**
 * The fictional figures every example draws from: a made-up permit service ("Dienst
 * Vergunningen") with desks in city centres, regions, requests and waiting times. The JSON files
 * next to this module are the source; a page imports what it needs from here and builds its own
 * specs.
 */
const load = async (name) => (await fetch(new URL(`./${name}.json`, import.meta.url))).json()

export const [meta, hourly, daily, desks, regions, breakdowns, origin, originCountries, heatmap, sankey, forecast] =
  await Promise.all(
    ['meta', 'hourly', 'daily', 'desks', 'regions', 'breakdowns', 'origin', 'origin_countries', 'heatmap', 'sankey', 'forecast'].map(load),
  )

/** The satisfaction per desk in two years, on a scale of 1 to 10: a dumbbell's figures. */
export const satisfaction = await load('satisfaction')

/** A number as the interface writes it. */
export const number = (value) => value.toLocaleString('nl-NL')

/** A fictional budget in mld euro: policy areas, some with their sub-posts. */
export const budget = await load('budget')
