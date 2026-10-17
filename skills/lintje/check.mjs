/**
 * Checks a host's own CSS and HTML against Lintje's tokens, so an agent finds what it got wrong
 * before it calls a page done. Plain Node, no dependencies: a host does not install Lintje's
 * tooling.
 *
 *   node check.mjs <tokens.json> <file…>
 *
 * A `.css` file is read whole; any other file only in its `<style>` blocks and `style=""`
 * attributes, and for elements a `lintje-*` tag covers. Exits 1 on an error; a hint does not.
 */
import { readFileSync } from 'node:fs'

const [reference, ...files] = process.argv.slice(2)
if (!reference || !files.length) {
  console.error('node check.mjs <tokens.json> <file…>')
  process.exit(2)
}

const tokens = new Set(
  JSON.parse(readFileSync(reference, 'utf8')).tokens.map((token) => token.name),
)
// The scale is in the names: `--space-<n>` is n × 4 px.
const SPACES = [...tokens]
  .filter((name) => /^--space-\d+$/.test(name))
  .map((name) => ({ name, px: 4 * Number(name.slice(8)) }))
const PRIMITIVE = /^--(neutral|data|status|ink|alpha|ribbon|focus|primary|accent)(-|$)/
// A host adds a theme by setting exactly these two, with a colour of its own.
const THEME = new Set(['--primary', '--accent'])
const SPACING = /^(padding|margin|inset|gap|row-gap|column-gap)(-|$)/
const NAMED =
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
const LITERAL = new RegExp(
  `#[0-9a-f]{3,8}(?![\\w-])|\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\\(|(?<![\\w-])(?:${NAMED.replaceAll(' ', '|')})(?![\\w-])`,
  'gi',
)
const COVERED = {
  table: 'lintje-data-table',
  dialog: 'lintje-dialog of lintje-modal',
  button: 'lintje-button of lintje-icon-button',
  select: 'lintje-select of lintje-combobox',
  input: 'lintje-text-input',
}
const INPUTS = {
  checkbox: 'lintje-checkbox',
  radio: 'lintje-radio-group',
  number: 'lintje-number-input',
  date: 'lintje-date-input',
  time: 'lintje-time-input',
  file: 'lintje-file-upload',
  range: 'lintje-range',
  submit: 'lintje-button',
  button: 'lintje-button',
}

/** Blanks comments, keeping every newline so a finding keeps its line. */
const blank = (text) =>
  text.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '))

/** Where the colour belongs, from the property that names it. */
function colourFor(property) {
  if (/^(color|caret-color|-webkit-text-fill-color)$/.test(property)) return '--color-text-*'
  if (property.startsWith('background')) return '--color-bg-*'
  if (/^(border|outline|column-rule|text-decoration)/.test(property)) return '--color-border-*'
  return 'een --color-*-token'
}

/** The semantic token for a primitive, where its name says which. */
function semanticFor(name, property) {
  const candidates = [
    name.replace(/^--status-/, '--color-'),
    name.replace(/^--data-/, '--color-chart-'),
    name === '--primary' ? '--color-action-primary' : '',
    name === '--accent' ? '--color-accent' : '',
  ]
  return (
    candidates.find((candidate) => candidate !== name && tokens.has(candidate)) ??
    colourFor(property)
  )
}

const nearestSpace = (px) =>
  SPACES.reduce((best, space) => (Math.abs(space.px - px) < Math.abs(best.px - px) ? space : best))

const sources = files.map((file) => ({ file, text: blank(readFileSync(file, 'utf8')) }))
// A host may name its own custom properties, wherever it sets them.
const declared = new Set(
  sources.flatMap(({ text }) =>
    [...text.matchAll(/(--[\w-]+)\s*:|setProperty\(\s*['"`](--[\w-]+)/g)].map((m) => m[1] ?? m[2]),
  ),
)

const findings = []
for (const { file, text } of sources) {
  const lineAt = (index) => text.slice(0, index).split('\n').length
  const report = (index, kind, found, fix) =>
    findings.push({ file, line: lineAt(index), kind, found, fix })

  // The CSS: the whole of a stylesheet, or the style blocks and attributes of anything else.
  const regions = file.endsWith('.css')
    ? [{ start: 0, css: text }]
    : [
        ...[...text.matchAll(/(<style\b[^>]*>)([\s\S]*?)<\/style>/gi)].map((m) => ({
          start: m.index + m[1].length,
          css: m[2],
        })),
        ...[...text.matchAll(/\sstyle\s*=\s*(["'])([\s\S]*?)\1/gi)].map((m) => ({
          start: m.index + m[0].indexOf(m[2]),
          css: m[2],
        })),
      ]

  for (const { start, css } of regions) {
    for (const m of css.matchAll(/([-\w]+)\s*:\s*([^;{}]*)(?=[;}]|$)/g)) {
      const property = m[1].toLowerCase()
      if (THEME.has(property)) continue
      const at = start + m.index
      const value = m[2].replace(/(["'])(?:\\.|(?!\1).)*\1/g, '""')

      for (const literal of value.replace(/--[\w-]+/g, '').matchAll(LITERAL)) {
        report(
          at,
          'fout',
          `${property}: ${literal[0]}`,
          `een literal kleur → ${colourFor(property)}`,
        )
      }
      for (const [, name] of value.matchAll(/var\(\s*(--[\w-]+)/g)) {
        if (tokens.has(name)) continue
        if (PRIMITIVE.test(name)) {
          report(at, 'fout', `var(${name})`, `een primitief → ${semanticFor(name, property)}`)
        } else if (!declared.has(name)) {
          report(at, 'fout', `var(${name})`, 'bestaat niet in tokens.json')
        }
      }
      if (SPACING.test(property)) {
        const sizes = value.replace(/var\([^)]*\)/g, '').matchAll(/(\d*\.?\d+)px/g)
        for (const size of new Set([...sizes].map((px) => Number(px[1])))) {
          if (size && !SPACES.some((space) => space.px === size)) {
            report(
              at,
              'fout',
              `${property}: ${size}px`,
              `buiten de 4 px-schaal → var(${nearestSpace(size).name})`,
            )
          }
        }
      }
    }
  }

  if (file.endsWith('.css')) continue
  // An element a tag covers, unless it stands inside a lintje-* tag, as slotted content.
  let inside = 0
  for (const m of text.matchAll(/<(\/?)([a-z][\w-]*)([^>]*)>/gi)) {
    const [, closing, tag, rest] = m
    const name = tag.toLowerCase()
    if (name.startsWith('lintje-')) {
      if (closing) inside = Math.max(0, inside - 1)
      else if (!rest.trim().endsWith('/')) inside++
      continue
    }
    if (closing || inside || !COVERED[name]) continue
    const type = name === 'input' ? /\btype\s*=\s*["']?(\w+)/i.exec(rest)?.[1]?.toLowerCase() : ''
    if (type === 'hidden') continue
    report(
      m.index,
      'hint',
      `<${name}${type ? ` type="${type}"` : ''}>`,
      `daarvoor is ${INPUTS[type] ?? COVERED[name]}`,
    )
  }
}

for (const { file, line, kind, found, fix } of findings) {
  console.log(`${file}:${line}  ${kind}  ${found}  ${fix}`)
}
const errors = findings.filter((finding) => finding.kind === 'fout').length
const hints = findings.length - errors
console.log(findings.length ? `${errors} fout(en), ${hints} hint(s)` : 'Geen vondsten.')
process.exit(errors ? 1 : 0)
