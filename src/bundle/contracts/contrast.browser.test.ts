/**
 * Text that has to be read reaches 4.5:1 on what it stands on, in light and in dark and in both
 * house styles, with every opacity of its ancestors counted in: the line numbers of a code block,
 * the word above the answers an edit replaces, the figures of a map layer switched off, the label
 * on a photo, the chosen chip of an answered question. A search match is told by a line under it,
 * not by its yellow fill alone.
 */
import { afterEach, describe, expect, it } from 'vitest'
import '../../components/chat/chat/chat'
import '../../components/chat/chat-questions/chat-questions'
import '../../components/content/code/code'
import '../../components/content/highlight/highlight'
import '../../components/map/map/map'
import '../../components/content/photo-wall/photo-wall'
import type { ChatData, ChatQuestionsData, MapData, PhotoWallItem } from '../../types'
import '../../components/inputs/range/range'
import '../../components/content/audio-player/audio-player'
import '../../components/content/video-player/video-player'

type Lit = HTMLElement & { updateComplete: Promise<unknown> }

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))

async function mount<T extends Lit>(tag: string, setup: (element: T) => void): Promise<T> {
  const element = document.createElement(tag) as T
  setup(element)
  document.body.append(element)
  await element.updateComplete
  await frame()
  return element
}

const parent = (node: Element): Element | null =>
  node.parentElement ?? ((node.getRootNode() as ShadowRoot).host as Element | undefined) ?? null

const paint = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!

/** The colour as `[r, g, b, a]`, from the browser's own serialisation; a colour the browser keeps
 *  in another space (a token in `oklch`) is painted to read it in sRGB. */
function rgba(colour: string): [number, number, number, number] {
  const probe = document.createElement('i')
  probe.style.color = colour
  document.body.append(probe)
  const computed = getComputedStyle(probe).color
  probe.remove()
  if (computed.startsWith('rgb')) {
    const [r, g, b, a = 1] = (computed.match(/[\d.]+/g) ?? []).map(Number)
    return [r, g, b, a]
  }
  paint.clearRect(0, 0, 1, 1)
  paint.fillStyle = computed
  paint.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = paint.getImageData(0, 0, 1, 1).data
  return [r, g, b, a / 255]
}

/** The opacity the element is drawn with: its own and every ancestor's, across shadow roots. */
function opacityOf(element: Element): number {
  let opacity = 1
  for (let node: Element | null = element; node; node = parent(node)) {
    opacity *= Number(getComputedStyle(node).opacity)
  }
  return opacity
}

/** The first background behind the element that is not see-through; else the tile's surface. */
function groundOf(element: Element): [number, number, number] {
  for (let node: Element | null = element; node; node = parent(node)) {
    const [r, g, b, a] = rgba(getComputedStyle(node).backgroundColor)
    if (a > 0) return [r, g, b]
  }
  const [r, g, b] = rgba('var(--color-bg-surface)')
  return [r, g, b]
}

const luminance = ([r, g, b]: number[]): number => {
  const linear = (value: number) => {
    const c = value / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** The contrast of `colour`, faded by `opacity`, over `ground`. */
function contrastOf(colour: string, opacity: number, ground: [number, number, number]): number {
  const [r, g, b, a] = rgba(colour)
  const share = a * opacity
  const drawn = [r, g, b].map((channel, i) => channel * share + ground[i] * (1 - share))
  const [lighter, darker] = [luminance(drawn), luminance(ground)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

interface Row {
  name: string
  /** The text to read, and its colour (a pseudo-element names its own). */
  text: () => Promise<{ element: Element; colour: string }>
}

const shadow = (element: Element, selector: string): Element =>
  element.shadowRoot!.querySelector(selector)!

const TURNS: ChatData['turns'] = [
  { id: 't1', message: { text: 'Hoeveel aanvragen?' }, answer: { lead: 'Het zijn er 148.230.' } },
  { id: 't2', message: { text: 'En per loket?' }, answer: { lead: 'Amsterdam was het drukst.' } },
]

const layer = (label: string, value: number) => ({
  variant: 'points' as const,
  label,
  unit: 'aanvragen',
  values: [
    { id: `${label}-1`, label: 'Utrecht', value, lon: 5.12, lat: 52.09 },
    { id: `${label}-2`, label: 'Zwolle', value: value * 4, lon: 6.09, lat: 52.51 },
  ],
})

const MAP: MapData = {
  variant: 'plots',
  geo: 'netherlands',
  unit: 'aanvragen',
  values: [],
  plots: [layer('Loketten', 30), layer('Servicepunten', 10)],
  description: 'Loketten en servicepunten.',
}

const ROWS: Row[] = [
  {
    name: 'de regelnummers van lintje-code',
    text: async () => {
      const element = await mount<Lit & { text: string; numbered: boolean }>(
        'lintje-code',
        (code) => {
          code.numbered = true
          code.text = '{\n  "a": 1\n}'
        },
      )
      const line = shadow(element, '.lintje-code__line')
      return { element: line, colour: getComputedStyle(line, '::before').color }
    },
  },
  {
    name: 'een antwoord dat een bewerking vervangt, en het woord erboven',
    text: async () => {
      const element = await mount<Lit & { data: ChatData }>('lintje-chat', (chat) => {
        chat.data = { turns: TURNS }
      })
      const message = element.shadowRoot!.querySelector<Lit>('lintje-chat-message')!
      await message.updateComplete
      message.shadowRoot!.querySelector<HTMLElement>('lintje-icon-button')!.click()
      await expect.poll(() => element.shadowRoot!.querySelector('.is-replaced')).not.toBeNull()
      // The answer itself stands at full strength; its word is the text to read.
      expect(opacityOf(element.shadowRoot!.querySelector('.is-replaced')!)).toBe(1)
      const note = shadow(element, '.lintje-chat__replaced-note')
      return { element: note, colour: getComputedStyle(note).color }
    },
  },
  {
    name: 'de getallen van een uitgezette laag op lintje-map',
    text: async () => {
      const element = await mount<Lit & { data: MapData }>('lintje-map', (map) => {
        map.style.cssText = 'display: block; width: 640px'
        map.data = MAP
      })
      await expect
        .poll(() => element.shadowRoot!.querySelector('.lintje-map-legend__layer'))
        .not.toBeNull()
      shadow(element, '.lintje-map-legend__layer').dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
      await expect
        .poll(() => element.shadowRoot!.querySelector('.lintje-map-legend__keys.is-off'))
        .not.toBeNull()
      const figure = shadow(element, '.lintje-map-legend__keys.is-off .lintje-map-legend__figure')
      return { element: figure, colour: getComputedStyle(figure).color }
    },
  },
  {
    name: 'de gekozen chip van een beantwoorde vraag in lintje-chat-questions',
    text: async () => {
      const question = {
        id: 'periode',
        label: 'Periode',
        text: 'Welke periode bedoel je?',
        kind: 'one' as const,
        options: [
          { value: '12m', label: 'Afgelopen 12 maanden' },
          { value: '2025', label: 'Heel 2025' },
        ],
      }
      const element = await mount<Lit & { data: ChatQuestionsData }>(
        'lintje-chat-questions',
        (box) => {
          box.data = { questions: [question] }
        },
      )
      shadow(element, '.lintje-chat-questions__chip').dispatchEvent(new MouseEvent('click'))
      element.data = { questions: [question], state: 'sending' }
      await element.updateComplete
      const chip = shadow(element, '.lintje-chat-questions__chip.is-chosen')
      return { element: chip, colour: getComputedStyle(chip).color }
    },
  },
  {
    name: 'het label op een foto van lintje-photo-wall',
    text: async () => {
      const element = await mount<Lit & { items: PhotoWallItem[] }>('lintje-photo-wall', (wall) => {
        wall.items = [{ src: 'data:,', alt: 'Een balie', caption: 'Het loket' }]
      })
      const caption = shadow(element, '.lintje-photo-wall__caption')
      return { element: caption, colour: getComputedStyle(caption).color }
    },
  },
]

afterEach(() => {
  document.documentElement.dataset.mode = 'light'
  delete document.documentElement.dataset.styleVersion
  document.body.replaceChildren()
})

/** Both house styles in both modes; the earlier style is the page without the attribute. */
const LOOKS = (['classic', 'new'] as const).flatMap((style) =>
  (['light', 'dark'] as const).map((mode) => [style, mode] as const),
)

function look(style: 'classic' | 'new', mode: 'light' | 'dark'): void {
  document.documentElement.dataset.mode = mode
  if (style === 'new') document.documentElement.dataset.styleVersion = 'new'
}

describe.each(ROWS)('$name', (row) => {
  it.each(LOOKS)('reaches 4.5:1 in the %s style, %s', async (style, mode) => {
    look(style, mode)
    const { element, colour } = await row.text()
    // What fades, fades over a duration: read its end state.
    const root = element.getRootNode() as ShadowRoot | Document
    await Promise.all(root.getAnimations().map((animation) => animation.finished))
    await frame()
    const ratio = contrastOf(colour, opacityOf(element), groundOf(element))
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })
})

describe('a search match in lintje-highlight', () => {
  it.each(LOOKS)(
    'has a line under it in the %s style, %s, not only its fill',
    async (style, mode) => {
      look(style, mode)
      const element = await mount<Lit & { kind: string }>('lintje-highlight', (highlight) => {
        highlight.setAttribute('kind', 'match')
        highlight.textContent = 'vergunning'
      })
      const mark = shadow(element, '.lintje-highlight--match')
      const drawn = getComputedStyle(mark)
      expect(drawn.borderBottomStyle).toBe('solid')
      expect(Number.parseFloat(drawn.borderBottomWidth)).toBeGreaterThanOrEqual(2)
      // The line reaches 3:1 on the fill it underlines.
      expect(
        contrastOf(
          drawn.borderBottomColor,
          1,
          rgba(drawn.backgroundColor).slice(0, 3) as [number, number, number],
        ),
      ).toBeGreaterThanOrEqual(3)
    },
  )
})

// The track of a slider is a grey line under the accent fill: 3:1 on what it stands on, and not
// the fill's colour, so the chosen stretch stands apart from it.
interface Track {
  name: string
  parts: () => Promise<{ track: Element; fill: Element }>
}

const TRACKS: Track[] = [
  {
    name: 'de baan van lintje-range',
    parts: async () => {
      const element = await mount<Lit & { single: boolean; steps: number[]; value: number }>(
        'lintje-range',
        (range) => {
          range.single = true
          range.steps = [5, 10, 15, 20]
          range.value = 10
        },
      )
      return {
        track: shadow(element, '.lintje-range__track'),
        fill: shadow(element, '.lintje-range__fill'),
      }
    },
  },
  {
    name: 'de positiebalk van lintje-video-player',
    parts: async () => {
      const element = await mount<Lit & { ready: boolean }>('lintje-video-player', (player) => {
        player.style.width = '640px'
      })
      // Ready as with a loaded recording; a bar that waits for one keeps its own grey.
      element.ready = true
      await element.updateComplete
      return {
        track: shadow(element, '.lintje-player__bar'),
        fill: shadow(element, '.lintje-player__bar-fill'),
      }
    },
  },
  {
    name: 'de volumebalk van lintje-audio-player',
    parts: async () => {
      const element = await mount<Lit>('lintje-audio-player', (player) => {
        player.style.width = '800px'
      })
      return {
        track: shadow(element, '.lintje-audio-player__level'),
        fill: shadow(element, '.lintje-audio-player__level-fill'),
      }
    },
  },
]

describe.each(TRACKS)('$name', (row) => {
  it.each(LOOKS)(
    'reaches 3:1 in the %s style, %s, in another colour than its fill',
    async (style, mode) => {
      look(style, mode)
      const { track, fill } = await row.parts()
      const drawn = getComputedStyle(track).backgroundColor
      const ground = groundOf(parent(track)!)
      expect(contrastOf(drawn, 1, ground)).toBeGreaterThanOrEqual(3)
      expect(rgba(getComputedStyle(fill).backgroundColor)).not.toEqual(rgba(drawn))
    },
  )
})
