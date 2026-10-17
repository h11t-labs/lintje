/** The words of a search, shared by the app search, the combobox, the tag input and the multiselect. */

/** The label split around the first case-insensitive occurrence of the term; null when absent. */
export function splitMatch(label: string, query: string): [string, string, string] | null {
  const term = query.trim()
  if (!term) return null
  const at = label.toLocaleLowerCase('nl').indexOf(term.toLocaleLowerCase('nl'))
  if (at < 0) return null
  return [label.slice(0, at), label.slice(at, at + term.length), label.slice(at + term.length)]
}

/** "1 resultaat", "3 resultaten". */
export function resultsText(count: number): string {
  return count === 1 ? '1 resultaat' : `${count} resultaten`
}
