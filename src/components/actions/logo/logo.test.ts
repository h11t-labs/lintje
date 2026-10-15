/**
 * The logo's name beside the ribbon: a ribbon never stands without its sender's name, and the
 * name is text — with its byline under it — never a drawn wordmark.
 */
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { putIcons, resetIcons } from '../../../icons/loader'
import './logo'
import type { LintjeLogo } from './logo'

const css = readFileSync('src/components/actions/logo/logo.css', 'utf8')

const RIBBON_ONLY = { viewBox: '0 0 50 100', body: '<path d="M0 0h50v100H0z"/>', attributes: {} }
const EMBLEM = { viewBox: '0 0 346 75', body: '<path d="M154 0h38v75h-38z"/>', attributes: {} }

async function mount(set: (logo: LintjeLogo) => void): Promise<LintjeLogo> {
  const logo = document.createElement('lintje-logo')
  set(logo)
  document.body.append(logo)
  await logo.updateComplete
  return logo
}

const nameOf = (logo: LintjeLogo) =>
  logo.shadowRoot!.querySelector<HTMLElement>('.lintje-logo__name')

/** A length the logo writes, in px, as a browser resolves it where no one sets the ribbon. */
function px(length: string): number {
  const match =
    /^(?:calc\()?var\(--lintje-logo-ribbon, ([\d.]+)px\)(?: \* (\d+) \/ (\d+)\))?$/.exec(length)
  if (!match) throw new Error(`not a length of the ribbon: ${length}`)
  const [, ribbon, units, per] = match
  return units ? (Number(ribbon) * Number(units)) / Number(per) : Number(ribbon)
}

beforeEach(() => {
  putIcons([
    ['embleem-lint', RIBBON_ONLY],
    ['embleem-org', EMBLEM],
  ])
})

afterEach(() => {
  document.body.innerHTML = ''
  resetIcons()
})

describe('lintje-logo: the name beside the ribbon', () => {
  it('writes the name as text in the logo bar', async () => {
    const logo = await mount((el) => {
      el.name = 'embleem-lint'
      el.alt = 'Rijksoverheid'
      el.full = true
      el.width = 48
    })
    const name = nameOf(logo)!
    expect(name.textContent?.trim()).toBe('Rijksoverheid')
    // The drawing already carries the name; the text is not read a second time.
    expect(name.getAttribute('aria-hidden')).toBe('true')
    expect(logo.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).toBe('Rijksoverheid')
    // It starts where the ribbon ends: the whole file is the ribbon.
    expect(px(name.style.left)).toBe(48)
  })

  it('writes it in the open menu too', async () => {
    const logo = await mount((el) => {
      el.name = 'embleem-lint'
      el.alt = 'Rijksoverheid'
      el.open = true
    })
    expect(nameOf(logo)!.textContent?.trim()).toBe('Rijksoverheid')
  })

  it('writes nothing in the rail, where only the ribbon is in frame', async () => {
    const logo = await mount((el) => {
      el.name = 'embleem-lint'
      el.alt = 'Rijksoverheid'
    })
    expect(nameOf(logo)).toBeNull()
  })

  it('writes the name where the ribbon ends in the whole emblem drawing', async () => {
    const logo = await mount((el) => {
      el.name = 'embleem-org'
      el.alt = 'Dienst Vergunningen'
      el.full = true
      el.width = 38
    })
    // In the whole drawing the ribbon ends at 154 + 38 of 346 units; at 38 px wide that is 192 px.
    expect(px(nameOf(logo)!.style.left)).toBe(192)
    expect(nameOf(logo)!.textContent?.trim()).toBe('Dienst Vergunningen')
  })

  it('writes the byline as a second line under the name', async () => {
    const logo = await mount((el) => {
      el.name = 'embleem-org'
      el.alt = 'Dienst Vergunningen'
      el.byline = 'Ministerie van Binnenlandse Zaken en Koninkrijksrelaties'
      el.full = true
    })
    const lines = [...nameOf(logo)!.children].map((line) => [line.className, line.textContent])
    expect(lines).toEqual([
      ['lintje-logo__name-line', 'Dienst Vergunningen'],
      ['lintje-logo__byline', 'Ministerie van Binnenlandse Zaken en Koninkrijksrelaties'],
    ])
    expect(css).toMatch(/\.lintje-logo__byline\s*\{[^}]*font-style:\s*italic/)
  })

  it('writes nothing without a name to write', async () => {
    const logo = await mount((el) => {
      el.name = 'embleem-lint'
      el.full = true
    })
    expect(nameOf(logo)).toBeNull()
  })

  it('takes the text colour of where it stands and hangs outside the drawing', () => {
    expect(css).toMatch(/\.lintje-logo__name\s*\{[^}]*color:\s*inherit/)
    expect(css).toMatch(/\.lintje-logo__name\s*\{[^}]*position:\s*absolute/)
    expect(css).not.toMatch(/font-size:\s*\d+px/)
  })
})

describe('lintje-logo: its size', () => {
  const size = (element: Element | null) => {
    const { width, height } = (element as HTMLElement).style
    return [px(width), px(height)]
  }

  // The sizes `width` gave in whole px before the ribbon became a CSS length.
  it('keeps the sizes of `width` where no one sets the ribbon', async () => {
    const full = await mount((el) => {
      el.name = 'embleem-org'
      el.alt = 'Rijksoverheid'
      el.full = true
      el.width = 48
    })
    const root = full.shadowRoot!
    const [frameWidth, frameHeight] = size(root.querySelector('.lintje-logo__frame'))
    expect(frameWidth).toBeCloseTo(437, 0)
    expect(frameHeight).toBeCloseTo(95, 0)
    expect(size(root.querySelector('svg'))[0]).toBeCloseTo(437, 0)
    expect(px(nameOf(full)!.style.left)).toBeCloseTo(243, 0)

    const rail = await mount((el) => {
      el.name = 'embleem-org'
      el.width = 44
    })
    const [railWidth, railHeight] = size(rail.shadowRoot!.querySelector('.lintje-logo__frame'))
    expect(railWidth).toBe(44)
    expect(railHeight).toBeCloseTo(87, 0)
    expect(size(rail.shadowRoot!.querySelector('svg'))[0]).toBeCloseTo(222, 0)

    // A file on its own viewBox keeps its own ratio.
    const own = await mount((el) => {
      el.name = 'embleem-lint'
      el.width = 32
    })
    expect(size(own.shadowRoot!.querySelector('svg'))).toEqual([32, 64])

    const image = await mount((el) => {
      el.src = 'data:image/svg+xml,%3Csvg%2F%3E'
      el.width = 48
    })
    const [imageWidth, imageHeight] = size(image.shadowRoot!.querySelector('img'))
    expect(imageWidth).toBe(48)
    expect(imageHeight).toBeCloseTo(95, 0)
  })

  it('takes the ribbon from `--lintje-logo-ribbon` where a surrounding element sets it', async () => {
    const logo = await mount((el) => {
      el.name = 'embleem-org'
      el.full = true
    })
    const frame = logo.shadowRoot!.querySelector<HTMLElement>('.lintje-logo__frame')!
    expect(frame.style.width).toContain('var(--lintje-logo-ribbon, 44px)')
  })
})

describe('lintje-logo: the ribbon in dark', () => {
  it('draws the lintblauw ribbon of the emblem file in the ribbon token, and nothing else', async () => {
    putIcons([
      [
        'embleem-blauw',
        {
          ...EMBLEM,
          body: '<path fill="#154273" d="M154 0h38v75h-38z"/><path fill="#FFF" d="M160 40h1v1z"/>',
        },
      ],
    ])
    const logo = await mount((el) => {
      el.name = 'embleem-blauw'
      el.full = true
    })
    const rule = css.match(/\.lintje-logo (\[fill=[^\]]+\])\s*\{([^}]*)\}/)!
    expect(rule[2]).toMatch(/fill:\s*var\(--color-logo-ribbon\)/)
    const hit = logo.shadowRoot!.querySelectorAll(`.lintje-logo ${rule[1]}`)
    expect([...hit].map((el) => el.getAttribute('d'))).toEqual(['M154 0h38v75h-38z'])
  })
})
