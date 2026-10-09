/// <reference types="node" />
/**
 * The colour scheme, checked where the arithmetic happens.
 *
 * `tokens.css` and `themes.css` are read from disk and resolved here: `var()`
 * chains are followed and every `color-mix(in srgb, …)` and the wash's `oklch()` are evaluated, so this
 * file computes the same hexes the browser computes from the same two
 * stylesheets. That is what lets it check things a CSS grep cannot:
 *
 * 1. **The specification table.** Per theme, `--primary-hover` (light and dark),
 *    `--primary-line`, `--primary-tint` and `--primary-tint-text` equal the
 *    specification table to the last digit, and the light neutrals are the
 *    cool-grey ramp.
 * 2. **Contrast.** The line tint exists only to reach 3:1 on the dark surface
 *    and the text tint only to reach 4.5:1 there — and each is the SMALLEST
 *    whole percentage that does, which is what makes them one value and not a
 *    taste. The primary carries white text; the neutral text pairs are AA.
 * 3. **Data and status colour never follow the mode or the theme**, and a
 *    status background is its status colour at 15 % over the surface.
 *
 * **The rounding rule is not the language's.** rijkshuisstijl.nl rounds a
 * channel that lands exactly on `.5` *down* (Violet 75 %: 190.5 → 190 → `BE`;
 * Lintblauw 75 %: 79.5 → 79 → `4F`). `mix()` uses `Math.ceil(x - 0.5)`, which
 * reproduces every one of the derived theme hexes of the specification table and
 * the whole published Lintblauw ladder, and it is what the browser's
 * `color-mix()` computes, so CSS and this file agree.
 *
 * It does **not** reproduce two channels of the published Violet ladder (45 %
 * `#D88CB7` and 30 % `#E5B2CF`: blue 183.9 and 207.6, so 184 and 208 here). No
 * single rounding of a linear sRGB mix reproduces both published tables.
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DATA_COLORS } from './colors'

/* --- the two stylesheets, as the browser reads them ----------------------- */

// Read from disk, not imported: vitest does not run the CSS pipeline, so an
// `import … from './tokens.css?raw'` comes back empty. The runner's working
// directory is ``.
const read = (name: string) => readFileSync(resolvePath(`src/tokens/${name}`), 'utf8')
/** The file with its prose comments stripped, so a `#` in a sentence is not a colour. */
const bare = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

type Block = { selector: string; body: string }

/** The top-level rules of a stylesheet, in order; `@media` and its inside are skipped. */
function blocks(css: string): Block[] {
  const found: Block[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') {
      if (depth === 0) {
        const selector = css.slice(start, i).trim()
        const end = css.indexOf('}', i)
        if (!selector.startsWith('@') && !css.slice(i + 1, end).includes('{')) {
          found.push({ selector, body: css.slice(i + 1, end) })
        }
      }
      depth++
    } else if (css[i] === '}') {
      depth--
      if (depth === 0) start = i + 1
    }
  }
  return found
}

/** The custom properties of one rule body. */
const declarations = (body: string): [string, string][] =>
  [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()])

/** Every declaration of the rules whose selector matches, later ones winning. */
function set(css: string, matches: (selector: string) => boolean): Record<string, string> {
  const values: Record<string, string> = {}
  for (const block of blocks(css)) {
    if (!matches(block.selector)) continue
    for (const [name, value] of declarations(block.body)) values[name] = value
  }
  return values
}

const TOKENS = bare(read('tokens.css'))
const THEMES = bare(read('themes.css'))

const LIGHT = set(TOKENS, (s) => s === ':root')
const DARK = set(TOKENS, (s) => s === "[data-mode='dark']" || s === '[data-mode="dark"]')
const THEME_SELECTOR = /^\[data-theme='([\w-]+)'\]$/
const THEME_BLOCKS: Record<string, Record<string, string>> = Object.fromEntries(
  blocks(THEMES)
    .map((block) => [THEME_SELECTOR.exec(block.selector), block] as const)
    .filter(([match]) => match !== null)
    .map(([match, block]) => [match![1], Object.fromEntries(declarations(block.body))]),
)

/* --- sRGB mixing, the one arithmetic behind every derived colour ---------- */

const WHITE = '#FFFFFF'
const KEYWORDS: Record<string, string> = { white: WHITE, black: '#000000' }

function parseHex(value: string): [number, number, number] {
  const text = value.trim()
  if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(text))
    throw new Error(`not a hex colour: ${value}`)
  const digits = text.length === 4 ? text.slice(1).replace(/./g, (ch) => ch + ch) : text.slice(1)
  return [0, 2, 4].map((i) => Number.parseInt(digits.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ]
}

/** Three channels as upper-case `#RRGGBB` — the spelling the tokens use. */
const toHex = (channels: number[]): string =>
  `#${channels.map((channel) => channel.toString(16).padStart(2, '0').toUpperCase()).join('')}`

/** Round to the nearest integer, `.5` downwards (the Rijkshuisstijl tables). */
const roundHalfDown = (value: number): number => Math.max(0, Math.min(255, Math.ceil(value - 0.5)))

/**
 * `share` of `base` over `other`, per channel in sRGB.
 *
 * `share` is a fraction, not a percentage: `mix('#0E3B6E', 0.88)` is the
 * "+12 % white" dark hover of the spec, `mix('#A90061', 0.75)` the 75 % tint.
 */
function mix(base: string, share: number, other: string = WHITE): string {
  if (!(share >= 0 && share <= 1)) throw new Error(`share must be between 0 and 1, got ${share}`)
  const left = parseHex(base)
  const right = parseHex(other)
  return toHex(left.map((a, i) => roundHalfDown(a * share + right[i] * (1 - share))))
}

/** The Rijkshuisstijl tint ladder: the share of the base colour, in percent. */
const TINT_STEPS = [100, 75, 60, 45, 30, 15]

/** The tint ladder of one colour, strongest first. */
const tints = (base: string, steps: number[] = TINT_STEPS, over: string = WHITE): string[] =>
  steps.map((step) => mix(base, step / 100, over))

/** Relative luminance (WCAG 2.1 §1.4.3). */
function luminance(colour: string): number {
  const channel = (value: number): number => {
    const srgb = value / 255
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = parseHex(colour).map(channel)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The WCAG contrast ratio between two opaque colours (1.0 – 21.0). */
function contrast(first: string, second: string): number {
  const a = luminance(first)
  const b = luminance(second)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/* --- resolving the stylesheets -------------------------------------------- */

/** The innermost `color-mix(in srgb, …)` of a value: no nested parenthesis in it. */
const MIX = /color-mix\(\s*in\s+srgb\s*,\s*([^()]*?)\s*\)/i
/** One side of a mix: a colour plus an optional percentage, in either order. */
const SIDE = /^(?:([\d.]+)%\s+)?(#[0-9a-fA-F]{3,6}|white|black)(?:\s+([\d.]+)%)?$/i
const VAR = /var\(\s*(--[\w-]+)\s*\)/g
/** A reference with a fallback that is itself resolved already: `var(--name, #hex)`. */
const VAR_WITH_FALLBACK = /var\(\s*(--[\w-]+)\s*,\s*([^(),]+?)\s*\)/g

/** A `color-mix()` argument as `[hex, percentage or null]`, or null when unsupported. */
function side(text: string): [string, number | null] | null {
  const match = SIDE.exec(text.trim())
  if (match === null) return null
  const colour = KEYWORDS[match[2].toLowerCase()] ?? match[2]
  const raw = match[1] ?? match[3]
  return [colour, raw === undefined ? null : Number.parseFloat(raw)]
}

/**
 * Replace every resolvable `color-mix(in srgb, …)` by its hex.
 *
 * Innermost first, so a mix of a mix collapses. A mix that still holds a
 * `var()` the token set does not define, or a colour space other than `srgb`,
 * is left standing exactly as it was — the CSS is still valid and the browser
 * evaluates it; only this evaluator cannot.
 */
function evaluateColorMix(value: string): string {
  for (;;) {
    const match = MIX.exec(value)
    if (match === null) return value
    const parts = match[1].split(',')
    if (parts.length !== 2) return value
    const left = side(parts[0])
    const right = side(parts[1])
    if (left === null || right === null) return value
    // CSS Color 5 §3.1: a missing percentage is 100 % minus the other one, or
    // 50 % when neither side carries one; the pair is then normalised.
    const first = left[1] ?? 100 - (right[1] ?? 50)
    const second = right[1] ?? 100 - first
    const total = first + second
    if (total <= 0) return value
    const mixed = mix(left[0], first / total, right[0])
    value = `${value.slice(0, match.index)}${mixed}${value.slice(match.index + match[0].length)}`
  }
}

/**
 * The OKLCH forms the tokens use: `oklch(from #hex L C h)`, where L is a number or
 * `max(l, N)` and C is `c` or `min(c, N)`.
 */
const OKLCH_FROM =
  /oklch\(\s*from\s+(#[0-9a-fA-F]{3,6})\s+(?:([\d.]+)|max\(\s*l\s*,\s*([\d.]+)\s*\))\s+(?:c|min\(\s*c\s*,\s*([\d.]+)\s*\))\s+h\s*\)/i

const toLinear = (srgb: number): number =>
  srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
const toGamma = (linear: number): number =>
  linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055

/** Lightness, chroma and hue (radians) of a hex, per Ottosson's Oklab. */
function oklch(colour: string): [number, number, number] {
  const [r, g, b] = parseHex(colour).map((channel) => toLinear(channel / 255))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    Math.hypot(a, bb),
    Math.atan2(bb, a),
  ]
}

/**
 * Replace an `oklch(from #hex …)` form by its hex. A result outside sRGB throws: the browser
 * gamut-maps it and this file could no longer say which hex it draws.
 */
function evaluateOklch(value: string): string {
  const match = OKLCH_FROM.exec(value)
  if (match === null) return value
  const [own, chroma, hue] = oklch(match[1])
  const lightness =
    match[2] === undefined
      ? Math.max(own, Number.parseFloat(match[3]))
      : Number.parseFloat(match[2])
  const c = match[4] === undefined ? chroma : Math.min(chroma, Number.parseFloat(match[4]))
  const a = c * Math.cos(hue)
  const b = c * Math.sin(hue)
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  const channels = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(toGamma)
  // The tolerance absorbs the round trip of a colour on the sRGB edge, such as Defensie's orange.
  if (channels.some((channel) => channel < -1e-4 || channel > 1 + 1e-4))
    throw new Error(`outside sRGB: ${match[0]}`)
  const hex = toHex(channels.map((channel) => Math.round(Math.min(1, Math.max(0, channel)) * 255)))
  return `${value.slice(0, match.index)}${hex}${value.slice(match.index + match[0].length)}`
}

/** Resolve references and `color-mix()`, preserve unknowns and reject cycles. */
function resolveTokens(values: Record<string, string>): Record<string, string> {
  const resolved: Record<string, string> = {}
  const active: string[] = []

  const visit = (name: string): string => {
    if (name in resolved) return resolved[name]
    if (active.includes(name))
      throw new Error(`Token reference cycle: ${[...active, name].join(' -> ')}`)
    active.push(name)
    const substituted = values[name]
      .replace(VAR, (whole, referenced: string) =>
        referenced in values ? visit(referenced) : whole,
      )
      // The fallback is what the browser takes when the property is not set.
      .replace(VAR_WITH_FALLBACK, (_whole, referenced: string, fallback: string) =>
        referenced in values ? visit(referenced) : fallback,
      )
    active.pop()
    resolved[name] = evaluateOklch(evaluateColorMix(substituted))
    return resolved[name]
  }

  for (const name of Object.keys(values)) visit(name)
  return resolved
}

/**
 * The resolved tokens for one mode and one theme.
 *
 * The theme's four properties are merged in FIRST, so every `color-mix()` that
 * reads `--primary` collapses to that theme's hex — exactly what the browser
 * does with `themes.css` on `<html>` and `tokens.css` everywhere below it.
 */
function tokensFor(
  mode: 'light' | 'dark',
  theme: string = 'rijksoverheid',
): Record<string, string> {
  const base = { ...THEME_BLOCKS[theme], ...LIGHT }
  return resolveTokens(mode === 'light' ? base : { ...base, ...DARK })
}

/* --- the specification ---------------------------------------------------- */

/** The dark page and tile surface; the line tint is defined against exactly this. */
const DARK_SURFACE = '#282828'

/**
 * The lightest neutral surface coloured TEXT stands on in dark (neutral-2: the
 * filter zone, a sorted column header). The text tint is sized against this one,
 * so a word reads everywhere a line does.
 */
const DARK_TEXT_SURFACE = '#333333'

/**
 * The specification: theme → primary, hover in light (−30 %, black), hover
 * in dark (+12 % white), line (+22 %), line tint (3:1 on #282828), text tint
 * (4.5:1 on #333333), accent.
 */
const SPECIFICATION: Record<string, [string, string, string, string, string, string, string]> = {
  rijksoverheid: ['#01689B', '#01496C', '#1F7AA7', '#3989B1', '#2179AD', '#59AAE1', '#E17000'],
  marechaussee: ['#0E3B6E', '#0A294D', '#2B537F', '#43668E', '#4773AB', '#76A4DF', '#E17000'],
  landmacht: ['#00423C', '#002E2A', '#1F5953', '#386C67', '#467D76', '#76AEA6', '#E17000'],
  marine: ['#0E61AA', '#0A4477', '#2B74B4', '#4384BD', '#2874BE', '#5CA6F4', '#E17000'],
  luchtmacht: ['#005187', '#00395E', '#1F6695', '#3877A1', '#3376AF', '#65A7E4', '#E17000'],
  defensie: ['#E17000', '#9D4E00', '#E5811F', '#E88F38', '#E17000', '#F07E22', '#007BC7'],
}

/**
 * The light neutrals are the cool-grey ramp of
 * rijksoverheid.nl (`--gray-*`), white and steps 50, 100, 200, 400, 600, 900.
 * Neutral-5 is 600, not 500: it carries muted text, and #64748B is 4.34:1 on
 * neutral-2. The dark neutrals are the Logius range and are pinned here too.
 */
const NEUTRALS_LIGHT = ['#FFFFFF', '#F8FAFC', '#F1F5F9', '#E2E8F0', '#94A3B8', '#475569', '#0F172A']
const NEUTRALS_DARK = ['#282828', '#1D1D1D', '#333333', '#4A4A4A', '#7A7A7A', '#B0B0B0', '#FFFFFF']
const NEUTRAL_NAMES = NEUTRALS_LIGHT.map((_, step) => `--neutral-${step}`)

const THEME_NAMES = Object.keys(SPECIFICATION)

/** The floor each of the two tints is sized against (WCAG 1.4.11 and 1.4.3). */
const TINT_FLOORS: [string, number, string][] = [
  ['--primary-tint', 3.0, DARK_SURFACE],
  ['--primary-tint-text', 4.5, DARK_TEXT_SURFACE],
]

/** `colour` at a perceived lightness of at least `lightness`, as `max(l, N)` draws it. */
const lift = (colour: string, lightness: number, chroma?: number): string =>
  evaluateOklch(
    `oklch(from ${colour} max(l, ${lightness}) ${chroma === undefined ? 'c' : `min(c, ${chroma})`} h)`,
  )

/** The `N` of a token written `oklch(from var(--x) max(l, N) …)` in one mode. */
function liftOf(token: string, mode: 'light' | 'dark'): number {
  const raw = (mode === 'dark' ? (DARK[token] ?? LIGHT[token]) : LIGHT[token]) ?? ''
  const match = /max\(\s*l\s*,\s*([\d.]+)\s*\)/.exec(raw)
  if (match === null) throw new Error(`${token} is not a lifted oklch(): ${raw}`)
  return Number.parseFloat(match[1])
}

/**
 * A lift is the smallest hundredth that clears `floor` for every colour it lifts: one
 * hundredth less fails for at least one of them (or leaves sRGB), so the lightness is not a taste.
 */
function expectSmallestLift(
  token: string,
  colours: string[],
  surface: (colour: string) => string,
  floor: number,
  chroma?: number,
): void {
  const lightness = liftOf(token, 'dark')
  for (const colour of colours) {
    expect(
      contrast(lift(colour, lightness, chroma), surface(colour)),
      `${token} on ${colour}`,
    ).toBeGreaterThanOrEqual(floor)
  }
  const lower = Math.round(lightness * 100 - 1) / 100
  const fails = colours.some((colour) => {
    try {
      return contrast(lift(colour, lower, chroma), surface(colour)) < floor
    } catch {
      return true
    }
  })
  expect(fails, `${token} could be max(l, ${lower})`).toBe(true)
}

describe('the mixer', () => {
  it('reproduces the Rijkshuisstijl tint ladders', () => {
    // Lintblauw exactly.
    expect(tints('#154273').slice(1)).toEqual([
      '#4F7196',
      '#738EAB',
      '#96AAC0',
      '#B9C6D5',
      '#DCE3EA',
    ])
    // Violet with the two documented one-off channels: the published table says
    // #D88CB7 / #E5B2CF, the linear sRGB mix says 183.9 and 207.6. No rounding of
    // a linear mix gives both tables; half-down is the rule that fits everything else.
    const violet = tints('#A90061').slice(1)
    expect([violet[0], violet[1], violet[4]]).toEqual(['#BE4088', '#CB66A0', '#F2D9E7'])
    expect([violet[2], violet[3]]).toEqual(['#D88CB8', '#E5B2D0'])
  })

  it('evaluates the color-mix() forms the tokens use', () => {
    expect(evaluateColorMix('color-mix(in srgb, #0E3B6E, white 12%)')).toBe('#2B537F')
    expect(evaluateColorMix('color-mix(in srgb, #0E3B6E, white 50%)')).toBe('#869DB6')
    expect(evaluateColorMix('color-mix(in srgb, #007BC7 75%, white)')).toBe('#409CD5')
    expect(evaluateColorMix('color-mix(in srgb, #D52B1E 15%, #282828)')).toBe('#422826')
    // Nested, and a mix that still holds an unresolved var() is left standing.
    expect(evaluateColorMix('color-mix(in srgb, color-mix(in srgb, #000000, white), white)')).toBe(
      mix(mix('#000000', 0.5), 0.5),
    )
    const unresolved = 'color-mix(in srgb, var(--nope), white 12%)'
    expect(evaluateColorMix(unresolved)).toBe(unresolved)
  })

  it('evaluates the oklch() form the wash uses', () => {
    expect(evaluateOklch('oklch(from #0E3B6E 0.955 min(c, 0.02) h)')).toBe('#E7F1FE')
    expect(evaluateOklch('oklch(from #E17000 0.955 min(c, 0.02) h)')).toBe('#FCEDE4')
    expect(() => evaluateOklch('oklch(from #0E3B6E 0.955 min(c, 0.2) h)')).toThrow(/outside sRGB/)
  })

  it('evaluates the lifted oklch() form the dark tints use', () => {
    expect(evaluateOklch('oklch(from #01689B max(l, 0.71) c h)')).toBe(lift('#01689B', 0.71))
    // A colour that is lighter already keeps its own lightness: Defensie's orange.
    expect(evaluateOklch('oklch(from #E17000 max(l, 0.55) c h)')).toBe('#E17000')
    expect(oklch(lift('#0E3B6E', 0.71))[1]).toBeCloseTo(oklch('#0E3B6E')[1], 2)
  })
})

describe('the theme layer', () => {
  it('is the six themes of the specification', () => {
    expect(Object.keys(THEME_BLOCKS)).toEqual(THEME_NAMES)
  })

  for (const theme of THEME_NAMES) {
    for (const mode of ['light', 'dark'] as const) {
      it(`derives ${theme}'s colours onto the specification in ${mode}`, () => {
        const [primary, hoverLight, hoverDark, line, tint, tintText, accent] = SPECIFICATION[theme]
        const hover = mode === 'light' ? hoverLight : hoverDark
        const values = tokensFor(mode, theme)
        expect(values['--primary']).toBe(primary)
        expect(values['--accent']).toBe(accent)
        expect([
          values['--primary-hover'],
          values['--primary-line'],
          values['--primary-tint'],
          values['--primary-tint-text'],
        ]).toEqual([hover, line, tint, tintText])
      })
    }
  }
})

describe('the header of the top layout', () => {
  it('draws the navigation bar on the menu’s colours, with no theme colour of its own', () => {
    expect(read('themes.css')).not.toMatch(/--primary-bar/)
    const header = readFileSync('src/components/frame/shell/header.css', 'utf8')
    expect(header).toMatch(/\.lintje-navbar \{[^}]*background: var\(--color-nav-bg\)/)
    for (const theme of THEME_NAMES) {
      const light = tokensFor('light', theme)
      expect(light['--color-navbar-hover']).toBe(light['--color-nav-hover'])
      expect(light['--color-navbar-active']).toBe(light['--color-nav-active'])
      expect(light['--color-navbar-active-edge']).toBe(light['--color-nav-active-edge'])
    }
  })

  it('names no menu token in the bar’s own: the bar points the menu’s at them', () => {
    // On an element that declares the tokens again, `--color-nav-hover: var(--color-navbar-hover)`
    // and a bar token that read `--color-nav-hover` would refer to each other and both be lost.
    const own = read('tokens.css').match(/--color-navbar-[\w-]+:[^;]+;/g) ?? []
    expect(own.length).toBeGreaterThan(0)
    for (const declaration of own) expect(declaration).not.toMatch(/var\(--color-nav-/)
  })

  it('stands a panel and its tabs on the hero lighter than the hero, in dark too', () => {
    // Lighter is higher in dark: menu, hero, panel (surface), inactive tab (subtle).
    for (const theme of THEME_NAMES) {
      const dark = tokensFor('dark', theme)
      const ladder = [
        '--color-nav-bg',
        '--color-hero-bg',
        '--color-bg-surface',
        '--color-bg-subtle',
      ]
      const lightness = ladder.map((token) => oklch(dark[token])[0])
      for (let i = 1; i < ladder.length; i++) {
        expect(lightness[i], `${theme}: ${ladder[i]} above ${ladder[i - 1]}`).toBeGreaterThan(
          lightness[i - 1] + 0.02,
        )
      }
    }
  })

  it('keeps the menu in dark neutral and apart from the logo bar', () => {
    for (const theme of THEME_NAMES) {
      const dark = tokensFor('dark', theme)
      expect(dark['--color-nav-bg'], theme).toBe(dark['--neutral-1'])
      expect(dark['--color-nav-bg'], theme).not.toBe(dark['--color-logobar-bg'])
    }
  })

  it('tells an entry’s hover and active from the bar, the logo bar and the page in dark', () => {
    for (const theme of THEME_NAMES) {
      const dark = tokensFor('dark', theme)
      for (const fill of [dark['--color-navbar-hover'], dark['--color-navbar-active']]) {
        expect(fill).not.toBe(dark['--color-nav-bg'])
        expect(fill).not.toBe(dark['--color-logobar-bg'])
        expect(fill).not.toBe(dark['--color-bg-page'])
        expect(contrast(dark['--color-nav-text'], fill), theme).toBeGreaterThanOrEqual(4.5)
        expect(contrast(dark['--color-navbar-active-edge'], fill), theme).toBeGreaterThanOrEqual(
          3.0,
        )
      }
    }
  })

  it('puts the logo on the surface in both modes: white in light, the dark page in dark', () => {
    const light = tokensFor('light', 'rijksoverheid')
    const dark = tokensFor('dark', 'rijksoverheid')
    expect(light['--color-logobar-bg']).toBe('#FFFFFF')
    expect(dark['--color-logobar-bg']).toBe(dark['--color-bg-surface'])
    expect(dark['--color-logobar-bg']).toBe('#282828')
  })

  it('puts the page a step below the surface in light, and on it in dark', () => {
    const light = tokensFor('light', 'rijksoverheid')
    const dark = tokensFor('dark', 'rijksoverheid')
    expect(light['--color-bg-page']).toBe(light['--neutral-1'])
    expect(dark['--color-bg-page']).toBe(dark['--color-bg-surface'])
  })

  it('draws the ribbon in lintblauw in light and in the house style’s #004A8D in dark', () => {
    for (const theme of THEME_NAMES) {
      expect(tokensFor('light', theme)['--color-logo-ribbon'], theme).toBe('#154273')
      expect(tokensFor('dark', theme)['--color-logo-ribbon'], theme).toBe('#004A8D')
    }
  })

  it('writes the name beside the ribbon in the text colour, at 4.5:1 in every theme and mode', () => {
    for (const mode of ['light', 'dark'] as const) {
      for (const theme of THEME_NAMES) {
        const values = tokensFor(mode, theme)
        expect(values['--color-logobar-text']).toBe(values['--color-text-primary'])
        expect(
          contrast(values['--color-logobar-text'], values['--color-logobar-bg']),
          `${mode} ${theme}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})

describe('contrast', () => {
  for (const theme of THEME_NAMES) {
    it(`holds where the scheme promises it, for ${theme}`, () => {
      const light = tokensFor('light', theme)
      const dark = tokensFor('dark', theme)
      // Each tint's whole reason to exist:
      // 3:1 for a line (WCAG 1.4.11), 4.5:1 for a word (1.4.3).
      expect(contrast(dark['--primary-tint'], DARK_SURFACE)).toBeGreaterThanOrEqual(3.0)
      expect(contrast(dark['--primary-tint-text'], DARK_TEXT_SURFACE)).toBeGreaterThanOrEqual(4.5)
      // A primary fill carries white content in both modes.
      for (const values of [light, dark]) {
        expect(
          contrast(values['--color-action-primary-text'], values['--color-action-primary']),
        ).toBeGreaterThanOrEqual(3.0)
      }
      // The light hover is darker than the primary, so white text on a hovered
      // button or menu row reads at AA in every theme (Defensie 5.96:1, was 2.80).
      expect(light['--primary-hover']).toBe(mix(light['--primary'], 0.7, '#000000'))
      for (const token of [
        '--color-action-primary-hover',
        '--color-nav-hover',
        '--color-nav-active',
      ]) {
        expect(light[token]).toBe(light['--primary-hover'])
        expect(contrast('#FFFFFF', light[token]), `white on ${token}`).toBeGreaterThanOrEqual(4.5)
      }
      expect(light['--color-link-hover']).toBe(light['--primary-hover'])
      // Dark keeps the lighter hover (+12 % white) and its neutral link hover.
      expect(dark['--primary-hover']).toBe(mix(dark['--primary'], 0.88))
      expect(dark['--color-action-primary-hover']).toBe(dark['--primary-hover'])
      expect(dark['--color-link-hover']).toBe(dark['--neutral-6'])
      // The focus ring is orange on every neutral surface, in every theme.
      expect(light['--color-focus']).toBe('#E17000')
      expect(dark['--color-focus']).toBe('#E17000')
    })

    it(`draws ${theme}'s focus ring on the theme fill at 3:1`, () => {
      // Orange is 1.89:1 on the rijksoverheid menu and 1:1 on Defensie's: on the
      // theme fill the ring is white in light. In dark the menu is neutral-1, and
      // the ring there is the orange of every other surface.
      const light = tokensFor('light', theme)
      const dark = tokensFor('dark', theme)
      expect(light['--color-nav-bg']).toBe(light['--primary'])
      expect(light['--color-focus-on-theme']).toBe('#FFFFFF')
      expect(
        contrast(light['--color-focus-on-theme'], light['--color-nav-bg']),
      ).toBeGreaterThanOrEqual(3.0)
      expect(dark['--color-focus-on-theme']).toBe(dark['--color-focus'])
      expect(
        contrast(dark['--color-focus-on-theme'], dark['--color-nav-bg']),
      ).toBeGreaterThanOrEqual(3.0)
    })

    it(`sets ${theme}'s hero apart from the menu, with its text and ring legible on it`, () => {
      for (const mode of ['light', 'dark'] as const) {
        const values = tokensFor(mode, theme)
        const band = values['--color-hero-bg']
        expect(band, mode).not.toBe(values['--color-nav-bg'])
        expect(contrast(values['--color-hero-text'], band), mode).toBeGreaterThanOrEqual(4.5)
        expect(contrast(values['--color-hero-focus'], band), mode).toBeGreaterThanOrEqual(3.0)
      }
    })

    it(`lifts ${theme}'s tints in lightness only, never darker than the primary`, () => {
      const values = tokensFor('dark', theme)
      const [lightness, chroma, hue] = oklch(values['--primary'])
      for (const [tint, floor, surface] of TINT_FLOORS) {
        expect(values[tint]).toBe(lift(values['--primary'], liftOf(tint, 'dark')))
        expect(contrast(values[tint], surface)).toBeGreaterThanOrEqual(floor)
        const [l, c, h] = oklch(values[tint])
        expect(l).toBeGreaterThanOrEqual(lightness - 0.005)
        expect(c).toBeCloseTo(chroma, 2)
        if (chroma > 0.02) expect(h).toBeCloseTo(hue, 1)
      }
    })

    it(`draws coloured text in ${theme}'s text tint and never in its line tint`, () => {
      // `--color-accent-line` is an outline, an edge, a ring, the filled stretch of
      // a slider; `--color-accent-text` and `--color-link` are words. Drawing a word
      // in the line token is exactly the bug the text tint fixes — the top bar's
      // breadcrumb came out at 3.07:1 that way.
      const dark = tokensFor('dark', theme)
      expect(dark['--color-accent-line']).toBe(dark['--primary-tint'])
      expect(dark['--color-accent-text']).toBe(dark['--primary-tint-text'])
      expect(dark['--color-link']).toBe(dark['--primary-tint-text'])
      for (const token of ['--color-accent-text', '--color-link']) {
        expect(contrast(dark[token], DARK_TEXT_SURFACE)).toBeGreaterThanOrEqual(4.5)
      }
      // In light there is one primary and all three names are it.
      const light = tokensFor('light', theme)
      for (const token of [
        '--color-accent',
        '--color-accent-line',
        '--color-accent-text',
        '--color-link',
      ]) {
        expect(light[token]).toBe(light['--primary'])
      }
      // As a word on the light page and the subtle surface it reaches AA —
      // except Defensie's orange, 3.08:1 on neutral-1 and 2.94:1 on neutral-2,
      // an accepted shortfall.
      if (theme !== 'defensie') {
        for (const surface of ['--neutral-0', '--neutral-1', '--neutral-2']) {
          expect(
            contrast(light['--color-link'], light[surface]),
            `link on ${surface}`,
          ).toBeGreaterThanOrEqual(4.5)
        }
      }
    })
  }

  it('takes the light neutrals from the cool-grey ramp and keeps the dark ones', () => {
    const light = tokensFor('light')
    const dark = tokensFor('dark')
    expect(NEUTRAL_NAMES.map((name) => light[name])).toEqual(NEUTRALS_LIGHT)
    expect(NEUTRAL_NAMES.map((name) => dark[name])).toEqual(NEUTRALS_DARK)
    // Near-black ink on a light fill follows neutral-6, in both modes.
    expect(light['--ink-black']).toBe(NEUTRALS_LIGHT[6])
    expect(dark['--ink-black']).toBe(NEUTRALS_LIGHT[6])
  })

  for (const mode of ['light', 'dark'] as const) {
    it(`makes muted text AA on every surface it stands on in ${mode}`, () => {
      const values = tokensFor(mode)
      for (const surface of ['--neutral-0', '--neutral-1', '--neutral-2']) {
        expect(
          contrast(values['--color-text-muted'], values[surface]),
          `muted text on ${surface}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    })

    it(`makes the neutral text pairs AA in ${mode}`, () => {
      const values = tokensFor(mode)
      for (const surface of ['--neutral-0', '--neutral-1', '--neutral-2']) {
        expect(contrast(values['--neutral-6'], values[surface])).toBeGreaterThanOrEqual(4.5)
        expect(contrast(values['--neutral-5'], values[surface])).toBeGreaterThanOrEqual(4.5)
      }
    })

    it(`makes a form control's edge and placeholder readable in ${mode}`, () => {
      // WCAG 1.4.11: the edge is what says "type here", so a field box reaches 3:1
      // on the surface and on the filter band, a checkbox or radio on the surface.
      // The same edge bounds the pager's buttons and the toggle's off track.
      // WCAG 1.4.3: a placeholder is text, 4.5:1.
      const values = tokensFor(mode)
      for (const surface of ['--neutral-0', '--neutral-2']) {
        expect(
          contrast(values['--color-border-field'], values[surface]),
          `field border on ${surface}`,
        ).toBeGreaterThanOrEqual(3.0)
      }
      expect(
        contrast(values['--color-border-choice'], values['--neutral-0']),
      ).toBeGreaterThanOrEqual(3.0)
      expect(
        contrast(values['--color-text-placeholder'], values['--neutral-0']),
      ).toBeGreaterThanOrEqual(4.5)
      // A disabled field keeps the quiet edge; the field edge is its own token.
      expect(values['--color-border-strong']).toBe(values['--neutral-3'])
    })
  }
})

describe('the dark lifts', () => {
  it('sizes each primary tint at the smallest lightness that clears its floor in every theme', () => {
    // One lightness for every theme, so a tint is equally light whatever the primary; one
    // hundredth less fails in at least one theme.
    const primaries = THEME_NAMES.map((theme) => SPECIFICATION[theme][0])
    for (const [tint, floor, surface] of TINT_FLOORS) {
      expectSmallestLift(tint, primaries, () => surface, floor)
    }
  })

  it('lifts each status mark to 3:1 on its own tint', () => {
    const dark = tokensFor('dark')
    for (const status of ['error', 'info', 'success']) {
      const token = `--color-${status}-line`
      const colour = dark[`--status-${status}`]
      expect(dark[token]).toBe(lift(colour, liftOf(token, 'dark')))
      expectSmallestLift(token, [colour], () => dark[`--color-${status}-bg`], 3.0)
    }
  })
})

describe('the danger action', () => {
  for (const mode of ['light', 'dark'] as const) {
    it(`carries white text on its fill and its hover in ${mode}`, () => {
      const values = tokensFor(mode)
      expect(values['--color-action-danger']).toBe(values['--status-error'])
      for (const token of ['--color-action-danger', '--color-action-danger-hover']) {
        expect(
          contrast(values['--color-text-on-fill'], values[token]),
          `white on ${token} in ${mode}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    })
  }

  it('splits its hover per mode as the primary does', () => {
    const light = tokensFor('light')
    const dark = tokensFor('dark')
    expect(light['--color-action-danger-hover']).toBe(mix(light['--status-error'], 0.7, '#000000'))
    // Lighter in dark, by the most white that keeps white text at 4.5:1.
    expect(dark['--color-action-danger-hover']).toBe(mix(dark['--status-error'], 0.92))
    expect(contrast('#FFFFFF', mix(dark['--status-error'], 0.91))).toBeLessThan(4.5)
  })

  it('draws its border in the fill in light and in a 3:1 tint in dark', () => {
    const light = tokensFor('light')
    const dark = tokensFor('dark')
    expect(light['--color-action-danger-border']).toBe(light['--color-action-danger'])
    // The red itself is 2.94:1 on the dark surface; the tint is the smallest lift that clears 3:1.
    expect(contrast(dark['--status-error'], DARK_SURFACE)).toBeLessThan(3.0)
    const lightness = liftOf('--color-action-danger-border', 'dark')
    expect(dark['--color-action-danger-border']).toBe(lift(dark['--status-error'], lightness))
    expectSmallestLift(
      '--color-action-danger-border',
      [dark['--status-error']],
      () => DARK_SURFACE,
      3.0,
    )
  })
})

describe('the danger outline (danger-secondary)', () => {
  for (const mode of ['light', 'dark'] as const) {
    it(`draws its word and its edge at 4.5:1, at rest and on hover, in ${mode}`, () => {
      // `button.css`: word and edge are both `--color-action-danger-text` — the red in light, a
      // tint of it in dark, where the red itself is 2.94:1 on #282828. The hover is
      // `--color-bg-subtle`: on `--color-error-bg` the word was 3.96:1 in light.
      const values = tokensFor(mode)
      for (const surface of ['--color-bg-surface', '--color-bg-subtle']) {
        expect(
          contrast(values['--color-action-danger-text'], values[surface]),
          surface,
        ).toBeGreaterThanOrEqual(4.5)
      }
    })
  }

  it('takes the smallest tint that reaches 4.5:1 on the dark hover surface', () => {
    const light = tokensFor('light')
    const dark = tokensFor('dark')
    expect(light['--color-action-danger-text']).toBe(light['--status-error'])
    const lightness = liftOf('--color-action-danger-text', 'dark')
    expect(dark['--color-action-danger-text']).toBe(lift(dark['--status-error'], lightness, 0.18))
    expectSmallestLift(
      '--color-action-danger-text',
      [dark['--status-error']],
      () => dark['--color-bg-subtle'],
      4.5,
      0.18,
    )
  })
})

/** The token a stylesheet names for `property` under `selector`; a later rule wins. */
function inkOf(file: string, selector: string, property = 'color'): string {
  const css = bare(readFileSync(file, 'utf8'))
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const declaration = new RegExp(`(?:^|[;{\\s])${property}:\\s*var\\((--[\\w-]+)\\)`)
  let found: string | undefined
  for (const rule of css.matchAll(new RegExp(`${escaped}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, 'g'))) {
    found = declaration.exec(rule[1])?.[1] ?? found
  }
  if (found === undefined) throw new Error(`${file}: no ${property} token for ${selector}`)
  return found
}

describe('the status words', () => {
  const STATUSES = ['error', 'success'] as const

  for (const mode of ['light', 'dark'] as const) {
    it(`draws an error or success word at 4.5:1 on the page, the surface and the subtle surface in ${mode}`, () => {
      const values = tokensFor(mode)
      for (const status of STATUSES) {
        for (const surface of ['--color-bg-page', '--color-bg-surface', '--color-bg-subtle']) {
          expect(
            contrast(values[`--color-${status}-text`], values[surface]),
            `${status} on ${surface}`,
          ).toBeGreaterThanOrEqual(4.5)
        }
      }
    })
  }

  it('keeps the red in light and darkens the green by the smallest whole percentage', () => {
    const light = tokensFor('light')
    expect(light['--color-error-text']).toBe(light['--status-error'])
    // The green itself is 4.13:1 on neutral-2; one percent less black fails there.
    expect(light['--color-success-text']).toBe(mix(light['--status-success'], 0.95, '#000000'))
    expect(
      contrast(mix(light['--status-success'], 0.96, '#000000'), light['--color-bg-subtle']),
    ).toBeLessThan(4.5)
  })

  it('lifts each in dark to the smallest tint that reaches 4.5:1 on the subtle surface', () => {
    const dark = tokensFor('dark')
    for (const status of STATUSES) {
      const token = `--color-${status}-text`
      const colour = dark[`--status-${status}`]
      expect(contrast(colour, DARK_SURFACE), `${status} itself`).toBeLessThan(4.5)
      expect(dark[token]).toBe(lift(colour, liftOf(token, 'dark'), 0.18))
      expectSmallestLift(token, [colour], () => dark['--color-bg-subtle'], 4.5, 0.18)
    }
  })

  it('is the token every status word is drawn in', () => {
    const WORDS: [string, string, string][] = [
      ['src/components/inputs/shared/input.css', '.lintje-field__error', 'error'],
      ['src/components/inputs/textarea/textarea.css', '.lintje-textarea__counter.is-over', 'error'],
      ['src/components/inputs/file-upload/file-upload.css', '.lintje-file-upload__reason', 'error'],
      [
        'src/primitives/progress-bar/progress-bar.css',
        '.lintje-progress--error .lintje-progress__label',
        'error',
      ],
      ['src/components/forms/stepper/stepper.css', '.lintje-stepper__errors', 'error'],
      [
        'src/components/feedback/streaming-text/streaming-text.css',
        '.lintje-streaming-text__note--error',
        'error',
      ],
      [
        'src/components/actions/menu-button/menu-button.css',
        '.lintje-menu__row.is-danger',
        'error',
      ],
      [
        'src/components/tables/data-table/data-table.css',
        '.lintje-data-table__change--down',
        'error',
      ],
      [
        'src/components/tables/data-table/data-table.css',
        '.lintje-data-table__edit-error',
        'error',
      ],
      [
        'src/components/tables/data-table/data-table.css',
        '.lintje-data-table__mobile-status--outside',
        'error',
      ],
      [
        'src/components/tables/data-table/data-table.css',
        '.lintje-data-table__change--up',
        'success',
      ],
    ]
    for (const [file, selector, status] of WORDS) {
      expect(inkOf(file, selector), selector).toBe(`--color-${status}-text`)
    }
  })
})

describe('the table cell above its threshold', () => {
  for (const theme of THEME_NAMES) {
    for (const mode of ['light', 'dark'] as const) {
      it(`draws its figure at 4.5:1 on the error fill in ${mode} for ${theme}`, () => {
        const css = 'src/components/tables/data-table/data-table.css'
        const selector = '.lintje-threshold-cell--above-threshold'
        const values = tokensFor(mode, theme)
        expect(
          contrast(values[inkOf(css, selector)], values[inkOf(css, selector, 'background')]),
        ).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})

describe('the inline user menu', () => {
  for (const theme of THEME_NAMES) {
    for (const mode of ['light', 'dark'] as const) {
      it(`draws the role and the version at 4.5:1 on the menu in ${mode} for ${theme}`, () => {
        const values = tokensFor(mode, theme)
        const css = 'src/components/frame/user-menu/user-menu.css'
        for (const part of ['role', 'version']) {
          const ink = inkOf(css, `.lintje-user-menu__panel.is-inline .lintje-user-menu__${part}`)
          // Defensie's white on orange is the menu's accepted shortfall (3.22:1).
          expect(contrast(values[ink], values['--color-nav-bg']), part).toBeGreaterThanOrEqual(
            theme === 'defensie' && mode === 'light' ? 3.0 : 4.5,
          )
        }
      })
    }
  }
})

describe('the badge', () => {
  /** Each `lintje-badge` tone as `badge.css` draws it: [ink, fill]. */
  const TONES: Record<string, [string, string]> = {
    neutral: ['--color-text-primary', '--color-bg-surface'],
    subtle: ['--color-text-primary', '--color-bg-subtle'],
    success: ['--color-text-on-fill', '--color-success'],
    error: ['--color-text-on-fill', '--color-error'],
    info: ['--color-text-on-fill', '--color-info'],
    warning: ['--color-text-on-light-fill', '--color-warning'],
    attention: ['--color-text-on-light-fill', '--color-attention'],
    count: ['--color-text-primary', '--color-bg-subtle'],
    unread: ['--color-nav-badge-text', '--color-nav-badge-bg'],
  }

  for (const theme of THEME_NAMES) {
    for (const mode of ['light', 'dark'] as const) {
      it(`draws every tone's word at 4.5:1 in ${mode} for ${theme}`, () => {
        const values = tokensFor(mode, theme)
        for (const [tone, [ink, fill]] of Object.entries(TONES)) {
          expect(
            contrast(values[ink], values[fill]),
            `${tone}: ${ink} on ${fill}`,
          ).toBeGreaterThanOrEqual(4.5)
        }
        // `busy` is the primary fill and `--nav` the menu's own pair: they promise what the
        // primary button and the menu promise, white on the theme at 3:1 (Defensie 3.22:1,
        // an accepted shortfall).
        for (const [ink, fill] of [
          ['--color-action-primary-text', '--color-action-primary'],
          ['--color-nav-bg', '--color-nav-text'],
        ]) {
          expect(contrast(values[ink], values[fill]), `${ink} on ${fill}`).toBeGreaterThanOrEqual(
            3.0,
          )
        }
      })
    }
  }
})

describe('the menu’s second line', () => {
  it('reads at 4.5:1 on the theme’s fill in light', () => {
    // `--color-nav-text-sub` is white over the menu's fill: the section heading, the metric and the
    // role. 70 % white was 3.83:1 on the rijksoverheid blue. Defensie is left out: white itself is
    // 3.22:1 on its orange, the accepted shortfall of the menu.
    for (const theme of THEME_NAMES.filter((name) => name !== 'defensie')) {
      const light = tokensFor('light', theme)
      const alpha = /rgba\(255, 255, 255, ([\d.]+)\)/.exec(light['--color-nav-text-sub'])
      expect(alpha, light['--color-nav-text-sub']).not.toBeNull()
      const fill = light['--color-nav-bg']
      const ink = mix(WHITE, Number.parseFloat(alpha![1]), fill)
      expect(contrast(ink, fill), theme).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('data and status colour', () => {
  // Restated, not imported from `colors.ts`: the list and the stylesheet are checked against
  // each other, and against this.
  const DATA = [
    'sky-blue',
    'dark-yellow',
    'red',
    'green',
    'mint-green',
    'violet',
    'orange',
    'pink',
    'dark-green',
    'purple',
    'ruby-red',
    'yellow',
    'dark-brown',
    'brown',
    'dark-blue',
    'light-blue',
    'moss-green',
  ]
  const FIXED = [
    ...DATA.map((name) => `--data-${name}`),
    '--data-dark-yellow-text',
    ...['success', 'warning', 'attention', 'error', 'info'].map((name) => `--status-${name}`),
    ...DATA.flatMap((name) => [75, 60, 45, 30, 15].map((step) => `--data-${name}-${step}`)),
    ...DATA.map((name) => `--color-chart-${name}`),
    ...DATA.flatMap((name) => [2, 3, 4, 5].map((step) => `--color-chart-${name}-tint-${step}`)),
    ...[1, 2, 3, 4, 5].map((step) => `--color-chart-tint-${step}`),
    '--color-chart-default',
  ]

  it('writes out the sky-blue ladder as the tints of its base', () => {
    // Literals, so the map's areas draw in without flashing; they stay the mix they replace.
    const steps = [75, 60, 45, 30, 15]
    const ladder = tints(LIGHT['--data-sky-blue'], steps)
    for (const [i, step] of steps.entries()) {
      expect(LIGHT[`--data-sky-blue-${step}`]).toBe(ladder[i])
    }
  })

  it('is the one list of names, in its order, and the stylesheet has no colour beside it', () => {
    expect([...DATA_COLORS]).toEqual(DATA)
    const ROLES = ['comparison', 'other', 'dark-yellow-text', 'grid', 'emphasis']
    const primitives = Object.keys(LIGHT)
      .filter((token) => /^--data-[a-z-]+$/.test(token) && !/-\d+$/.test(token))
      .map((token) => token.slice('--data-'.length))
      .filter((name) => !ROLES.includes(name))
    expect(primitives).toEqual(DATA)
  })

  it('gives every colour its own ladder on the Rijkshuisstijl steps', () => {
    const values = tokensFor('light')
    for (const name of DATA) {
      const ladder = [2, 3, 4, 5].map((step) => values[`--color-chart-${name}-tint-${step}`])
      expect(ladder, name).toEqual(tints(values[`--data-${name}`]).slice(1, 5))
      expect(values[`--color-chart-${name}`], name).toBe(values[`--data-${name}`])
    }
  })

  it('carries a label on each colour in white or in ink, whichever reaches 4.5:1', () => {
    // Restates the stacked bar's DARK_FILLS: a label on these is white, on the rest ink.
    const WHITE_ON = [
      'sky-blue',
      'red',
      'green',
      'violet',
      'dark-green',
      'purple',
      'ruby-red',
      'dark-brown',
      'brown',
      'dark-blue',
      'moss-green',
    ]
    const values = tokensFor('light')
    for (const name of DATA) {
      const ink = WHITE_ON.includes(name) ? '--color-text-on-fill' : '--color-text-on-light-fill'
      expect(contrast(values[ink], values[`--data-${name}`]), name).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps the shared ladder as the sky blue’s, the default colour', () => {
    const values = tokensFor('light')
    expect(values['--color-chart-default']).toBe(values['--color-chart-sky-blue'])
    expect([1, 2, 3, 4, 5].map((step) => values[`--color-chart-tint-${step}`])).toEqual([
      values['--color-chart-sky-blue'],
      ...[2, 3, 4, 5].map((step) => values[`--color-chart-sky-blue-tint-${step}`]),
    ])
  })

  for (const theme of THEME_NAMES) {
    it(`never follows the mode or the theme, for ${theme}`, () => {
      // Principle 6: one data colour, one status colour, everywhere.
      const reference = tokensFor('light')
      for (const mode of ['light', 'dark'] as const) {
        const values = tokensFor(mode, theme)
        for (const token of FIXED) {
          expect(values[token], `${token} moved in ${mode}/${theme}`).toBe(reference[token])
        }
      }
    })

    it(`lets ${theme}'s two data grays follow the neutrals`, () => {
      // The documented exception to "data colour never follows the mode":
      // as a fixed gray the comparison line was 2.69:1 on #282828 and the hardest
      // thing on a dark page to read.
      const light = tokensFor('light', theme)
      expect([light['--data-comparison'], light['--data-other']]).toEqual(['#475569', '#94A3B8'])
      for (const mode of ['light', 'dark'] as const) {
        const values = tokensFor(mode, theme)
        expect(values['--data-comparison']).toBe(values['--neutral-5'])
        expect(values['--data-other']).toBe(values['--neutral-4'])
      }
      const dark = tokensFor('dark', theme)
      expect(contrast(dark['--data-comparison'], DARK_SURFACE)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(dark['--data-other'], DARK_SURFACE)).toBeGreaterThanOrEqual(3.0)
    })
  }

  for (const [mode, surface] of [
    ['light', '#FFFFFF'],
    ['dark', DARK_SURFACE],
  ] as const) {
    it(`puts a status background at 15 % over the ${mode} surface`, () => {
      const values = tokensFor(mode)
      expect(values['--neutral-0']).toBe(surface)
      for (const [name, token] of [
        ['attention', '--color-attention-bg'],
        ['error', '--color-error-bg'],
        ['info', '--color-info-bg'],
        ['success', '--color-success-bg'],
        ['warning', '--color-warning-bg'],
      ]) {
        expect(values[token]).toBe(mix(values[`--status-${name}`], 0.15, surface))
      }
    })
  }

  it('puts the five status surfaces at their specified values', () => {
    const SURFACES: Record<string, [string, string]> = {
      '--color-attention-bg': ['#FAEAD9', '#443322'],
      '--color-error-bg': ['#F9DFDD', '#422826'],
      '--color-info-bg': ['#D9EBF7', '#223440'],
      '--color-success-bg': ['#E1EDDB', '#2B3624'],
      '--color-warning-bg': ['#FFF4DB', '#483D25'],
    }
    const light = tokensFor('light')
    const dark = tokensFor('dark')
    for (const [token, [inLight, inDark]] of Object.entries(SURFACES)) {
      expect(light[token]?.toUpperCase(), `${token} in light`).toBe(inLight)
      expect(dark[token]?.toUpperCase(), `${token} in dark`).toBe(inDark)
    }
  })

  for (const mode of ['light', 'dark'] as const) {
    it(`draws the attention badge's figures in the near-black, AA on the orange, in ${mode}`, () => {
      // On a yellow or orange fill the text is --color-text-on-light-fill. White on
      // #E17000 is 3.2:1; the attention number badge takes the near-black.
      const values = tokensFor(mode)
      expect(
        contrast(values['--color-text-on-light-fill'], values['--color-attention']),
      ).toBeGreaterThanOrEqual(4.5)
      expect(contrast(values['--color-text-on-fill'], values['--color-attention'])).toBeLessThan(
        4.5,
      )
    })
  }
})

describe('the lines a chart reads by', () => {
  for (const mode of ['light', 'dark'] as const) {
    it(`draws the zero line and the hatch of missing data at 3:1 on the ${mode} surface`, () => {
      const values = tokensFor(mode)
      for (const token of ['--color-chart-zero', '--color-chart-hatch']) {
        expect(contrast(values[token], values['--color-bg-surface'])).toBeGreaterThanOrEqual(3)
      }
      // Still darker than the grid it is drawn on.
      expect(contrast(values['--color-chart-zero'], values['--color-bg-surface'])).toBeGreaterThan(
        contrast(values['--color-chart-grid'], values['--color-bg-surface']),
      )
    })

    it(`outlines a map area with a figure at 3:1 against the ${mode} land`, () => {
      const values = tokensFor(mode)
      const border = values['--color-map-border-data']
      expect(contrast(border, values['--color-map-land'])).toBeGreaterThanOrEqual(3)
      // In light the lightest class is the land's twin; the outline is what tells them apart.
      if (mode === 'light') {
        expect(contrast(border, values['--color-chart-seq-1'])).toBeGreaterThanOrEqual(3)
      }
    })
  }
})
