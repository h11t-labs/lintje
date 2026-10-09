/**
 * Where the last finished sentence in `text` ends. A stop at the very end does not count yet:
 * the next message may turn "3." into "3.5".
 */
export function sentenceEnd(text: string): number {
  let end = 0
  for (const match of text.matchAll(/[.!?…]+["'”’)\]]*\s+/g)) end = match.index + match[0].length
  return end
}
