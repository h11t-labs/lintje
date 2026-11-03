/**
 * A shell specimen of the style guide stands in a page of its own, so the guide keeps one `main`
 * and one `h1`. The frame draws at its own width, the one the specimen states or the window's,
 * and is scaled down to its row: the shell takes the breakpoints of that width, and nothing is
 * cut off or scrolls.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

interface Specimen {
  label?: string
  frameWidth?: number
}
interface Guide {
  renderSpecimen: (specimen: Specimen, options: { item: unknown }) => HTMLElement
  frameSources: { base: () => string; styles: string[]; bundle: string; icons: string }
}
interface Elements {
  default: { elements: { tag?: string; specimens: Specimen[] }[] }
}

const [guide] = Object.values(
  import.meta.glob<Guide>('../../examples/styleguide/shared.js', { eager: true }),
)
const [frames] = Object.values(
  import.meta.glob<Elements>('../../examples/styleguide/specimens/frame.js', { eager: true }),
)
const shell = frames!.default.elements.find((item) => item.tag === 'lintje-shell')!
const ROW = 800

const built = { ...guide!.frameSources }
beforeAll(async () => {
  // The frame loads the source as the test server serves it, not the build.
  Object.assign(guide!.frameSources, {
    base: () => `${location.origin}/examples/styleguide/`,
    styles: [
      '../../src/tokens/fonts.css',
      '../../src/tokens/themes.css',
      '../../src/tokens/tokens.css',
    ],
    bundle: '/src/bundle/index.ts',
    icons: '/dist-icons/',
  })
  // The guide's own rule for a frame: no border of the browser's around it.
  const style = document.createElement('style')
  style.textContent = '.guide__frame { display: block; border: 0; }'
  document.head.append(style)
  await page.viewport(1280, 900)
})
afterAll(() => {
  Object.assign(guide!.frameSources, built)
  document.body.replaceChildren()
})

/** The specimen drawn in a row of 800 px, once the shell in its frame has drawn its foot. */
async function draw(label: string): Promise<{ row: HTMLElement; frame: HTMLIFrameElement }> {
  const specimen = shell.specimens.find((entry) => entry.label === label)!
  const row = document.createElement('div')
  row.style.width = `${ROW}px`
  row.append(guide!.renderSpecimen(specimen, { item: shell }))
  document.body.append(row)
  const frame = row.querySelector('iframe')!
  await expect
    .poll(() => foot(frame)?.shadowRoot?.querySelector('.lintje-user-menu__trigger'), {
      timeout: 15_000,
    })
    .toBeTruthy()
  return { row, frame }
}

const foot = (frame: HTMLIFrameElement) =>
  frame.contentDocument
    ?.querySelector('lintje-shell')
    ?.shadowRoot?.querySelector<HTMLElement & { folded: boolean }>('.lintje-nav__user-menu')

describe('a shell specimen in its frame', () => {
  it('shows the wide foot with the name at a 1280 px window, drawn at the 1440 px it states', async () => {
    const { frame } = await draw('Voet van het vaste zijmenu')
    expect(frame.contentWindow!.innerWidth).toBe(1440)
    const menu = foot(frame)!
    await expect.poll(() => menu.folded).toBe(false)
    const name = menu.shadowRoot!.querySelector<HTMLElement>('.lintje-user-menu__trigger-name')!
    expect(name.textContent).toBe('J. de Vries')
    expect(name.checkVisibility()).toBe(true)
  })

  it('scales its frame down to the row, with the scaled height and nothing cut off', async () => {
    const { row, frame } = await draw('Voet in de rail')
    const width = frame.closest('figure')!.clientWidth
    const box = frame.parentElement!.getBoundingClientRect()
    const drawn = frame.getBoundingClientRect()
    expect(width).toBeLessThan(1440)
    expect(box.width).toBeCloseTo(width, 0)
    expect(drawn.width).toBeCloseTo(width, 0)
    expect(drawn.height).toBeCloseTo((frame.offsetHeight * width) / 1440, 0)
    expect(box.height).toBeCloseTo(drawn.height, 0)
    expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth)
  })
})
