/**
 * The token reference: every name of layers 2 and 3 in `tokens.css`, the ones a component may
 * name, in the order of the file, with the comment that stands above it or behind it and the
 * section it stands in. The values are not here: only a browser resolves them, in its own mode
 * and theme.
 */

const BLOCK = /Layers 2 and 3[\s\S]*?\*\/\s*:root\s*\{([^}]*)\}/
const PARTS = /\/\*([\s\S]*?)\*\/|(--[\w-]+)\s*:[^;]*;/g

const clean = (comment) => comment.replace(/\s+/g, ' ').trim()
/** `--- Semantic: surfaces -----` → `Semantic: surfaces`. */
const heading = (text) => text.replace(/^-+\s*|\s*-+$/g, '')

/** The tokens of layers 2 and 3 in a `tokens.css`, each as `{ name, comment, group }`. */
export function tokensOf(css) {
  const block = BLOCK.exec(css)?.[1]
  if (!block) throw new Error('tokens.css: no ":root" block under "Layers 2 and 3"')
  const tokens = []
  let pending = ''
  let group = ''
  let last = null
  let end = 0
  for (const match of block.matchAll(PARTS)) {
    const gap = block.slice(end, match.index)
    end = match.index + match[0].length
    if (match[2]) {
      // A comment that a blank line parts from its declaration describes the lines before.
      const comment = /\n\s*\n/.test(gap) ? '' : pending
      tokens.push((last = { name: match[2], comment, group }))
      pending = ''
      continue
    }
    const text = clean(match[1])
    // A section's heading, and the notes for design tooling, describe no single token.
    if (text.startsWith('---') || text.includes('@kind')) {
      if (text.startsWith('---')) {
        group = heading(text)
        last = null
      }
      pending = ''
    } else if (last && !gap.includes('\n')) {
      last.comment = last.comment ? `${last.comment} ${text}` : text
    } else {
      pending = pending && !/\n\s*\n/.test(gap) ? `${pending} ${text}` : text
      last = null
    }
  }
  return tokens
}
