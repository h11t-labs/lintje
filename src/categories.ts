/**
 * The categories: the one grouping of the tags. A category is a folder under `components/`, a
 * page of the style guide, an entry of the build (`<name>.js`) and an export of the package.
 * The list is `categories.json`, so the build scripts read it without a compiler.
 */
import list from './categories.json'

export interface Category {
  /** The name in folders, files, addresses and exports. */
  name: string
  /** The style guide's menu heading the category stands under. */
  heading: string
  /** What a reader sees. */
  label: string
  icon: string
  intro: string
  /** Tags without `lintje-`, or the id of a style guide section that shows no single tag. */
  elements: readonly string[]
  /** The composite tags among `elements`; every other tag is a building block. */
  composite?: readonly string[]
}

export const CATEGORIES: readonly Category[] = list

/** The style guide's sections that show no single tag. */
export const SECTIONS: readonly string[] = ['icons']

/** Every composite tag, with its prefix. */
export const COMPOSITE: readonly string[] = list.flatMap((category: Category) =>
  (category.composite ?? []).map((name) => `lintje-${name}`),
)

/** A category's tags, with their prefix. */
export const tagsOf = (category: Category): string[] =>
  category.elements.filter((name) => !SECTIONS.includes(name)).map((name) => `lintje-${name}`)
