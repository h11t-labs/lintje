let last = 0

/** An id no other element on the page has: `lintje-menu-3`. */
export function uniqueId(prefix: string): string {
  last += 1
  return `${prefix}-${last}`
}
