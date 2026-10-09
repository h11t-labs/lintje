/**
 * Loaded by a host while developing: warns once per tag for every `lintje-…` element in the
 * document that no module defined. Shadow roots are not searched.
 */

export function undefinedTags(root: ParentNode = document): string[] {
  const names = new Set<string>()
  for (const element of root.querySelectorAll('*')) {
    const name = element.localName
    if (name.startsWith('lintje-') && !customElements.get(name)) names.add(name)
  }
  return [...names].sort()
}

const reported = new Set<string>()

/** Warns for every undefined tag it has not warned for yet; returns the new ones. */
export function reportUndefinedTags(root: ParentNode = document): string[] {
  const fresh = undefinedTags(root).filter((name) => !reported.has(name))
  for (const name of fresh) {
    reported.add(name)
    console.warn(
      `<${name}> is on the page but not defined. Import its file (tag/${name.replace(/^lintje-/, '')}.js) or its category.`,
    )
  }
  return fresh
}

/** A module may still be on its way after a change. */
const SETTLE_MS = 1000

if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  let timer: ReturnType<typeof setTimeout> | undefined
  // One check per interval from the first change: waiting for silence could wait for ever.
  const schedule = (): void => {
    if (timer !== undefined) return
    timer = setTimeout(() => {
      timer = undefined
      reportUndefinedTags()
    }, SETTLE_MS)
  }
  const start = (): void => {
    schedule()
    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true,
      subtree: true,
    })
  }
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
}
