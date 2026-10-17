/**
 * Forced colours, as a contrast theme of Windows draws them: the reader's palette replaces every
 * colour and drops fills. What a fill said is drawn again in system colours: an edge in Highlight
 * for a button that is on, and the forced text colour for an icon from a file.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { commands } from 'vitest/browser'
import '../../components/actions/icon/icon'
import '../../components/actions/icon-button/icon-button'
import '../../components/map/map/map'
import type { MapData } from '../../types'

declare module 'vitest/browser' {
  interface BrowserCommands {
    emulateForcedColors: (on: boolean) => Promise<void>
  }
}

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

/** A system colour as the browser resolves it while forced colours are on. */
function system(name: string): string {
  const probe = document.createElement('i')
  probe.style.cssText = `forced-color-adjust: none; color: ${name}`
  document.body.append(probe)
  const colour = getComputedStyle(probe).color
  probe.remove()
  return colour
}

/** Reads `read` with forced colours on; false when the engine does not emulate them. */
async function forced<R>(read: () => R): Promise<R | false> {
  await commands.emulateForcedColors(true)
  await frame()
  try {
    return matchMedia('(forced-colors: active)').matches ? read() : false
  } finally {
    await commands.emulateForcedColors(false)
    await frame()
  }
}

/** The part of an element that draws the state, and what it should read in forced colours. */
interface Row {
  name: string
  part: () => Promise<Element>
  check: (part: Element) => void
}

const shadow = (element: Element, selector: string): Element =>
  element.shadowRoot!.querySelector(selector)!

/** An edge on every side in Highlight: what a dropped primary fill said, drawn again. */
const highlightEdge = (part: Element): void => {
  const style = getComputedStyle(part)
  expect(style.borderTopStyle).toBe('solid')
  expect(Number.parseFloat(style.borderTopWidth)).toBeGreaterThanOrEqual(1)
  expect(style.borderTopColor).toBe(system('Highlight'))
}

const MAP: MapData = {
  variant: 'points',
  geo: 'netherlands',
  values: [{ id: 'utr', label: 'Utrecht', value: 12, lon: 5.12, lat: 52.09 }],
  unit: 'aantal',
  description: 'Loketten in Nederland.',
  controls: { circle: true },
}

const SVG =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>',
  )

const ROWS: Row[] = [
  ...(['flat', 'tile'] as const).map((variant): Row => ({
    name: `lintje-icon-button ${variant}, aan`,
    part: async () => {
      const element = await mount<Lit & { active: boolean }>('lintje-icon-button', (button) => {
        button.setAttribute('variant', variant)
        button.setAttribute('icon', 'lichaam-duim-omhoog')
        button.setAttribute('label', 'Goed antwoord')
        button.active = true
      })
      return shadow(element, '.lintje-icon-button')
    },
    check: highlightEdge,
  })),
  {
    name: 'lintje-map, tekenknop aan',
    part: async () => {
      const element = await mount<Lit & { data: MapData }>('lintje-map', (map) => {
        map.style.cssText = 'display: block; width: 640px'
        map.data = MAP
      })
      await expect
        .poll(() => element.shadowRoot!.querySelector('.lintje-map-chart__tool'))
        .not.toBeNull()
      const tool = shadow(element, '.lintje-map-chart__tool') as HTMLButtonElement
      tool.click()
      await element.updateComplete
      await expect.poll(() => tool.classList.contains('is-active')).toBe(true)
      return tool
    },
    check: (part) => expect(getComputedStyle(part).borderTopColor).toBe(system('Highlight')),
  },
  {
    name: 'lintje-icon met src',
    part: async () => {
      const element = await mount<Lit & { src: string }>('lintje-icon', (icon) => {
        icon.src = SVG
        icon.setAttribute('label', 'Eigen icoon')
      })
      return shadow(element, '.lintje-icon--file')
    },
    // The mask paints its fill; kept from the palette, that fill is the forced text colour.
    check: (part) => {
      const style = getComputedStyle(part)
      expect(style.forcedColorAdjust).toBe('none')
      expect(style.backgroundColor).toBe(getComputedStyle(part.parentElement ?? part).color)
      expect(style.backgroundColor).not.toBe(system('Canvas'))
    },
  },
]

afterEach(async () => {
  await commands.emulateForcedColors(false)
  document.body.replaceChildren()
})

describe.each(ROWS)('$name', (row) => {
  it('draws its state again in system colours', async ({ skip }) => {
    const part = await row.part()
    const checked = await forced(() => {
      row.check(part)
      return true
    })
    if (checked === false) skip('this engine does not emulate forced colours')
  })
})
