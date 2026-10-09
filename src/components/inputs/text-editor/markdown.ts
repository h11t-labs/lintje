/**
 * The text editor's two directions: markdown into the surface, the surface back into markdown.
 * Five formats only; the markdown written is the subset read, so a value survives a round trip.
 * `domToMarkdown()` reads any DOM, so pasted HTML is filtered through it. Pure, no element.
 */

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function safeHref(url: string | null | undefined): string | null {
  // Control characters go first: a URL parser strips them, so `\x01javascript:…` would pass a
  // scheme check that still sees the character and then run as `javascript:` in the link.
  const trimmed = (url ?? '').replace(/\p{Cc}/gu, '').trim()
  if (!trimmed) return null
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed)
  if (scheme && !['http', 'https', 'mailto', 'tel'].includes(scheme[1].toLowerCase())) return null
  // Spaces and parentheses would end the markdown link early.
  return trimmed.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29')
}

// --- markdown → HTML -------------------------------------------------------

const PUNCTUATION = /[\\`*_{}[\]()#+\-.!>~|]/

export function inlineToHtml(source: string): string {
  let out = ''
  let index = 0
  while (index < source.length) {
    const char = source[index]
    if (char === '\\' && PUNCTUATION.test(source[index + 1] ?? '')) {
      out += escapeHtml(source[index + 1])
      index += 2
      continue
    }
    if (char === '\n') {
      out += '<br>'
      index += 1
      continue
    }
    if (source.startsWith('**', index)) {
      const close = findClose(source, '**', index + 2)
      if (close > index + 2) {
        out += `<strong>${inlineToHtml(source.slice(index + 2, close))}</strong>`
        index = close + 2
        continue
      }
    }
    if (char === '*' || char === '_') {
      const close = findClose(source, char, index + 1)
      if (close > index + 1) {
        out += `<em>${inlineToHtml(source.slice(index + 1, close))}</em>`
        index = close + 1
        continue
      }
    }
    if (char === '[') {
      const link = /^\[((?:\\.|[^\]\\])+)\]\(([^()\s]+)\)/.exec(source.slice(index))
      if (link) {
        const href = safeHref(link[2])
        const text = inlineToHtml(link[1])
        out += href ? `<a href="${escapeHtml(href)}">${text}</a>` : text
        index += link[0].length
        continue
      }
    }
    out += escapeHtml(char)
    index += 1
  }
  return out
}

/**
 * Where a marker closes, skipping escaped characters; -1 when it does not. A single `*`
 * does not close on the first half of a `**`, so `*a **b** c*` nests.
 */
function findClose(source: string, marker: string, from: number): number {
  for (let index = from; index < source.length; index++) {
    if (source[index] === '\\') {
      index += 1
      continue
    }
    if (marker === '**' && source.startsWith('**', index)) return index
    if (marker.length === 1 && source[index] === marker) {
      if (marker === '*' && source[index + 1] === '*') {
        const inner = findClose(source, '**', index + 2)
        if (inner === -1) return -1
        index = inner + 1
        continue
      }
      return index
    }
  }
  return -1
}

const HEADING = /^#{1,6}\s+(.*)$/
const ITEM = /^[-*]\s+(.*)$/

export function markdownToHtml(markdown: string | null | undefined): string {
  const lines = (markdown ?? '').replace(/\r\n?/g, '\n').split('\n')
  const html: string[] = []
  let paragraph: string[] = []
  let items: string[] = []

  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${inlineToHtml(paragraph.join('\n'))}</p>`)
    paragraph = []
  }
  const flushList = () => {
    if (items.length) html.push(`<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`)
    items = []
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    const heading = HEADING.exec(line)
    const item = ITEM.exec(line)
    if (line.trim() === '') {
      flushParagraph()
      flushList()
    } else if (heading) {
      flushParagraph()
      flushList()
      html.push(`<h3>${inlineToHtml(heading[1].trim())}</h3>`)
    } else if (item) {
      flushParagraph()
      items.push(inlineToHtml(item[1].trim()))
    } else {
      flushList()
      paragraph.push(line.trim())
    }
  }
  flushParagraph()
  flushList()
  return html.join('')
}

// --- DOM → markdown --------------------------------------------------------

const escapeText = (text: string): string => text.replace(/([\\*_[\]])/g, '\\$1')

const escapeLineStart = (line: string): string => line.replace(/^(\s*)(#|[-*+](?=\s))/, '$1\\$2')

const BLOCKS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'DD',
  'DIV',
  'DL',
  'DT',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'FORM',
  'HEADER',
  'HR',
  'MAIN',
  'NAV',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TBODY',
  'THEAD',
  'TFOOT',
  'TR',
  'TD',
  'TH',
])
const HEADINGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6'])
const LISTS = new Set(['UL', 'OL'])
const SKIPPED = new Set([
  'SCRIPT',
  'STYLE',
  'TEMPLATE',
  'NOSCRIPT',
  'IFRAME',
  'OBJECT',
  'SVG',
  'HEAD',
])

type Block = { kind: 'p' | 'h' | 'li'; text: string }

const isElement = (node: Node): node is HTMLElement => node.nodeType === 1
const isBlock = (node: Node): boolean =>
  isElement(node) &&
  (BLOCKS.has(node.tagName) ||
    HEADINGS.has(node.tagName) ||
    LISTS.has(node.tagName) ||
    node.tagName === 'LI')

function styled(element: HTMLElement): { bold?: boolean; italic?: boolean } {
  const weight = element.style?.fontWeight ?? ''
  const slant = element.style?.fontStyle ?? ''
  return {
    bold: weight === '' ? undefined : weight === 'bold' || Number(weight) >= 600,
    italic: slant === '' ? undefined : slant === 'italic' || slant === 'oblique',
  }
}

function wrap(text: string, marker: string): string {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!
  return match[2] ? `${match[1]}${marker}${match[2]}${marker}${match[3]}` : text
}

/** Wraps text in a marker with its outer spaces outside it: `** x**` is not bold in markdown. */
function inline(node: Node): string {
  if (node.nodeType === 3) return escapeText((node.textContent ?? '').replace(/\s+/g, ' '))
  if (!isElement(node) || SKIPPED.has(node.tagName)) return ''
  if (node.tagName === 'BR') return '\n'
  if (node.tagName === 'IMG') return escapeText(node.getAttribute('alt') ?? '')
  let text = [...node.childNodes].map(inline).join('')
  const tag = node.tagName
  const own = styled(node)
  const bold = own.bold ?? (tag === 'B' || tag === 'STRONG')
  const italic = own.italic ?? (tag === 'I' || tag === 'EM')
  if (tag === 'A') {
    const href = safeHref(node.getAttribute('href'))
    if (href && text.trim()) text = `[${text.trim()}](${href})`
  }
  // `_` for italic, so bold and italic together are `**_x_**` and never an ambiguous `***`.
  if (italic) text = wrap(text, '_')
  if (bold) text = wrap(text, '**')
  return text
}

const tidy = (text: string): string =>
  text
    .split('\n')
    .map((line) => line.replace(/ {2,}/g, ' ').trim())
    .join('\n')
    .replace(/^\n+|\n+$/g, '')

function blocks(container: Node, out: Block[]): Block[] {
  let run: Node[] = []
  const flush = () => {
    const text = tidy(run.map(inline).join(''))
    if (text) out.push({ kind: 'p', text })
    run = []
  }
  for (const child of container.childNodes) {
    if (isElement(child) && SKIPPED.has(child.tagName)) continue
    if (!isBlock(child)) {
      run.push(child)
      continue
    }
    flush()
    const element = child as HTMLElement
    if (HEADINGS.has(element.tagName)) {
      // A heading is plain text in its own weight: bold inside it says nothing more.
      const text = tidy(inline(element).replace(/\n/g, ' ')).replace(/\*\*/g, '')
      if (text) out.push({ kind: 'h', text })
    } else if (LISTS.has(element.tagName) || element.tagName === 'LI') {
      for (const item of element.tagName === 'LI' ? [element] : element.querySelectorAll('li')) {
        // A nested list's items are their own items: read this item without them.
        const own = [...item.childNodes].filter(
          (node) => !(isElement(node) && LISTS.has(node.tagName)),
        )
        const text = tidy(
          own.map((node) => (isBlock(node) ? ` ${inline(node)} ` : inline(node))).join(''),
        )
        if (text) out.push({ kind: 'li', text: text.replace(/\n/g, ' ') })
      }
    } else {
      blocks(element, out)
    }
  }
  flush()
  return out
}

export function domToMarkdown(root: Node): string {
  const parts: string[] = []
  let previous: Block['kind'] | null = null
  for (const block of blocks(root, [])) {
    if (previous) parts.push(previous === 'li' && block.kind === 'li' ? '\n' : '\n\n')
    if (block.kind === 'h') parts.push(`### ${block.text}`)
    else if (block.kind === 'li') parts.push(`- ${block.text}`)
    else parts.push(block.text.split('\n').map(escapeLineStart).join('\n'))
    previous = block.kind
  }
  return parts.join('')
}

export function reduceHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return markdownToHtml(domToMarkdown(doc.body))
}
