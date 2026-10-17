/**
 * What a treemap draws, from the host's parts: the parts that have an area, largest first, with
 * the parts under 1 % of the whole folded into one grey "Overig" (at the top and inside a part),
 * the total of what is drawn and what is missing from it. Also the table's rows, which keep
 * every part apart.
 */
import type { ChartSpec, TreemapPart } from '../shared/types'

type TreemapSpec = Extract<ChartSpec, { kind: 'treemap' }>

/** A part under this share of the whole folds into "Overig", if another one does too. */
export const FOLD_SHARE = 0.01

/** A part folded into an "Overig", for its tooltip. */
export interface FoldedPart {
  label: string
  value: number
}

/** One area of the drawing: a part without sub-parts, a sub-part, or an "Overig". */
export interface TreemapArea {
  label: string
  value: number
  /** Grey and never labelled: the parts under 1 % together. */
  other: boolean
  folded: FoldedPart[]
}

/** A part of the whole as drawn: one area, or its sub-parts' areas inside it. */
export interface TreemapGroup {
  label: string
  /** What is drawn of it: its value, or the sum of its sub-parts that have one. */
  value: number
  /** Its identity for a choice: its `id`, else its label. */
  id: string
  href?: string
  other: boolean
  folded: FoldedPart[]
  /** With sub-parts, their areas, largest first and their own "Overig" last; else empty. */
  areas: TreemapArea[]
  /** Sub-parts without data: its sum is without them. */
  missing: string[]
  /** Its place among the parts that take a tint, darkest first; -1 for "Overig". */
  rank: number
}

export interface TreemapModel {
  groups: TreemapGroup[]
  /** The sum of what is drawn. */
  total: number
  /** The decimals of the most precise value the host sent. */
  decimals: number
  /** What has no data, in the host's order: a part, or a sub-part by its own name. */
  missing: string[]
  /** Some parts fold into an "Overig". */
  folded: boolean
  /** Some part has sub-parts. */
  nested: boolean
}

const fractionDigits = (value: number): number =>
  Number.isInteger(value) ? 0 : Math.min(4, String(value).split('.')[1]?.length ?? 0)

const hasParts = (part: TreemapPart): boolean => Array.isArray(part.parts) && part.parts.length > 0

/** The value a part draws: positive only; a part with sub-parts is their sum. */
function drawnValue(part: TreemapPart): number {
  if (!hasParts(part)) return Math.max(0, part.value ?? 0)
  return part.parts!.reduce((sum, sub) => sum + Math.max(0, sub.value ?? 0), 0)
}

/** A part without any data: its value, or every one of its sub-parts. */
export function isMissing(part: TreemapPart): boolean {
  return hasParts(part) ? part.parts!.every((sub) => sub.value == null) : part.value == null
}

/** Largest first; equal values keep the host's order (the sort is stable). */
const bySize = <T extends { value: number }>(items: T[]): T[] =>
  [...items].sort((a, b) => b.value - a.value)

/** The small ones, if two or more, become one "Overig" after the rest. */
function fold<T extends { label: string; value: number }>(
  items: T[],
  threshold: number,
  other: (folded: FoldedPart[]) => T,
): { items: T[]; folded: boolean } {
  const small = items.filter((item) => item.value < threshold)
  if (small.length < 2) return { items, folded: false }
  const folded = small.map(({ label, value }) => ({ label, value }))
  return {
    items: [...items.filter((item) => item.value >= threshold), other(folded)],
    folded: true,
  }
}

const sum = (parts: FoldedPart[]): number => parts.reduce((total, part) => total + part.value, 0)

export function treemapModel(spec: Pick<TreemapSpec, 'parts'>): TreemapModel {
  const parts = spec.parts ?? []
  const total = parts.reduce((acc, part) => acc + drawnValue(part), 0)
  const threshold = total * FOLD_SHARE
  const values = parts.flatMap((part) =>
    hasParts(part) ? part.parts!.map((sub) => sub.value) : [part.value],
  )
  const decimals = Math.max(
    0,
    ...values.filter((value): value is number => typeof value === 'number').map(fractionDigits),
  )
  const missing = parts.flatMap((part) => {
    if (isMissing(part)) return [part.label]
    return hasParts(part) ? part.parts!.filter((sub) => sub.value == null).map((s) => s.label) : []
  })

  let foldedAny = false
  const drawn: TreemapGroup[] = bySize(
    parts
      .filter((part) => drawnValue(part) > 0)
      .map((part) => {
        const value = drawnValue(part)
        let areas: TreemapArea[] = []
        if (hasParts(part)) {
          const subs = bySize(
            part
              .parts!.filter((sub) => (sub.value ?? 0) > 0)
              .map((sub) => ({ label: sub.label, value: sub.value!, other: false, folded: [] })),
          )
          const result = fold<TreemapArea>(subs, threshold, (folded) => ({
            label: 'Overig',
            value: sum(folded),
            other: true,
            folded,
          }))
          areas = result.items
          foldedAny ||= result.folded
        }
        return {
          label: part.label,
          value,
          id: part.id ?? part.label,
          href: part.href,
          other: false,
          folded: [],
          areas,
          missing: hasParts(part)
            ? part.parts!.filter((sub) => sub.value == null).map((sub) => sub.label)
            : [],
          rank: 0,
        }
      }),
  )
  const top = fold<TreemapGroup>(drawn, threshold, (folded) => ({
    label: 'Overig',
    value: sum(folded),
    id: 'Overig',
    other: true,
    folded,
    areas: [],
    missing: [],
    rank: -1,
  }))
  let rank = 0
  const groups = top.items.map((group) => (group.other ? group : { ...group, rank: rank++ }))
  return {
    groups,
    total,
    decimals,
    missing,
    folded: foldedAny || top.folded,
    nested: parts.some(hasParts),
  }
}

/**
 * The table's and the CSV's rows, header first: a row per sub-part, or per part without them,
 * in the drawn order and those without an area after them. What the drawing folds stays apart.
 */
export function treemapRows(spec: TreemapSpec): (string | number | null)[][] {
  const { total, nested } = treemapModel(spec)
  const parts = spec.parts ?? []
  const ordered = <T>(items: T[], value: (item: T) => number): T[] => [
    ...bySize(
      items.filter((item) => value(item) > 0).map((item) => ({ item, value: value(item) })),
    ).map(({ item }) => item),
    ...items.filter((item) => !(value(item) > 0)),
  ]
  const share = (value: number | null | undefined): number | string | null => {
    if (value == null) return null
    if (value < 0 || total <= 0) return ''
    return Number(((value / total) * 100).toFixed(1))
  }
  const name = spec.label ?? 'Waarde'
  const header = [
    spec.labelHeader ?? 'Deel',
    ...(nested ? ['Onderdeel'] : []),
    spec.unit ? `${name} (${spec.unit})` : name,
    'Aandeel in het totaal (%)',
  ]
  const rows = ordered(parts, drawnValue).flatMap((part) => {
    if (!hasParts(part)) {
      const value = part.value ?? null
      return [[part.label, ...(nested ? [''] : []), value, share(value)]]
    }
    return ordered(part.parts!, (sub) => sub.value ?? 0).map((sub) => [
      part.label,
      sub.label,
      sub.value ?? null,
      share(sub.value),
    ])
  })
  return [header, ...rows]
}
