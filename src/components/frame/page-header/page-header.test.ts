/**
 * The heading outline of a page: the shell's name is the one `h1`, the page header's title the
 * `h2`, a tile's title an `h3`.
 *
 * happy-dom has no layout, so in the side layout both the top bar and the mobile header are in
 * the tree; on a real page one of the two is `display: none` at every width. The outline is
 * therefore read twice — once without the mobile header (the desktop path) and once without the
 * top bar (below 768 px).
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import '../shell/shell'
import './page-header'
import { getFrameState } from '../../../core/frame-state'
import '../../../primitives/tile/tile'
import type { LintjeShell } from '../shell/shell'
import type { LintjePageHeader } from './page-header'
import type { LintjeTile } from '../../../primitives/tile/tile'

beforeAll(() => {
  // The shell observes its navigation bar and the page header its title; happy-dom has neither.
  const Stub = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver ??= Stub as unknown as typeof ResizeObserver
  globalThis.IntersectionObserver ??= Stub as unknown as typeof IntersectionObserver
})

const mounted: HTMLElement[] = []
afterEach(() => {
  for (const element of mounted.splice(0)) element.remove()
})

async function mountPage(): Promise<HTMLElement> {
  const page = document.createElement('div')
  const shell = document.createElement('lintje-shell') as LintjeShell
  shell.data = {
    name: 'Dashboard Vergunningen',
    layout: 'side',
    navigation: [],
    user: { initials: 'HP', name: 'H. van Pelt', role: 'Analist' },
    pageName: 'Overzicht',
  }
  const header = document.createElement('lintje-page-header') as LintjePageHeader
  header.slot = 'header'
  header.data = { kicker: 'Dashboard Vergunningen', title: 'Overzicht' }
  const tile = document.createElement('lintje-tile') as LintjeTile
  tile.heading = 'Aanvragen per uur'
  shell.append(header, tile)
  page.append(shell)
  document.body.append(page)
  mounted.push(page)
  await Promise.all([shell.updateComplete, header.updateComplete, tile.updateComplete])
  return page
}

/**
 * Every heading in document order, through shadow roots, skipping `skip`. The light DOM is walked
 * after the shadow root, so the slotted header and tile land in `main`'s place.
 */
function outline(node: Element, skip: string): string[] {
  if (node.matches(skip)) return []
  const own = /^H[1-6]$/.test(node.tagName) ? [`${node.tagName}:${node.textContent?.trim()}`] : []
  const children = [...(node.shadowRoot?.children ?? []), ...node.children]
  return [...own, ...children.flatMap((child) => outline(child, skip))]
}

describe('the heading outline', () => {
  it('runs h1 → h2 → h3 on the desktop path', async () => {
    const page = await mountPage()
    expect(outline(page, '.lintje-mobile-header')).toEqual([
      'H1:Dashboard Vergunningen',
      'H2:Overzicht',
      'H3:Aanvragen per uur',
    ])
  })

  it('runs h1 → h2 → h3 below 768 px', async () => {
    const page = await mountPage()
    expect(outline(page, '.lintje-top-bar')).toEqual([
      'H1:Dashboard Vergunningen',
      'H2:Overzicht',
      'H3:Aanvragen per uur',
    ])
  })
})

describe('lintje-page-header', () => {
  it('renders the page title as an h2 and no h1', async () => {
    const page = await mountPage()
    const header = page.querySelector('lintje-page-header')!.shadowRoot!
    expect(header.querySelector('.lintje-page-header__title')!.tagName).toBe('H2')
    expect(header.querySelector('h1')).toBeNull()
  })
})

describe('lintje-page-header without a shell', () => {
  async function mountAlone(markup = ''): Promise<LintjePageHeader> {
    const header = document.createElement('lintje-page-header') as LintjePageHeader
    header.innerHTML = markup
    header.data = { title: 'Meldingen', description: '32 meldingen' }
    document.body.append(header)
    mounted.push(header)
    await header.updateComplete
    return header
  }

  it('draws the title and description without a kicker', async () => {
    const root = (await mountAlone()).shadowRoot!
    expect(root.querySelector('h2')!.textContent).toBe('Meldingen')
    expect(root.querySelector('.lintje-page-header__description')!.textContent).toBe('32 meldingen')
    expect(root.querySelector('.lintje-page-header__kicker')).toBeNull()
  })

  it('puts breadcrumbs above the title and actions on its right, through named slots', async () => {
    const header = await mountAlone(
      '<nav slot="breadcrumbs">Beheer</nav><button slot="actions">Exporteren</button>',
    )
    const root = header.shadowRoot!
    const crumbs = root.querySelector<HTMLSlotElement>('slot[name="breadcrumbs"]')!
    const actions = root.querySelector<HTMLSlotElement>('slot[name="actions"]')!
    expect(crumbs.assignedElements()[0]!.textContent).toBe('Beheer')
    expect(actions.assignedElements()[0]!.textContent).toBe('Exporteren')
    // The trail comes before the title, the actions after it.
    const title = root.querySelector('h2')!
    expect(crumbs.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(actions.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    actions.dispatchEvent(new Event('slotchange'))
    await header.updateComplete
    expect(actions.classList.contains('is-empty')).toBe(false)
  })

  it('leaves an empty actions slot out of the layout', async () => {
    const root = (await mountAlone()).shadowRoot!
    expect(root.querySelector('slot[name="actions"]')!.classList.contains('is-empty')).toBe(true)
  })
})

/** How many title observers `mount` creates, with a counting stand-in for the observer. */
async function countObservers(
  mount: () => Promise<LintjePageHeader>,
): Promise<{ created: number; header: LintjePageHeader }> {
  const original = globalThis.IntersectionObserver
  let created = 0
  globalThis.IntersectionObserver = class {
    constructor() {
      created++
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof IntersectionObserver
  try {
    const header = await mount()
    return { created, header }
  } finally {
    globalThis.IntersectionObserver = original
  }
}

describe('lintje-page-header in the shell', () => {
  async function mountInShell(slot = 'header'): Promise<LintjePageHeader> {
    const shell = document.createElement('lintje-shell') as LintjeShell
    shell.data = { name: 'Beheer', navigation: [] }
    const header = document.createElement('lintje-page-header') as LintjePageHeader
    header.slot = slot
    header.data = { title: 'Meldingen', description: '32 meldingen' }
    shell.append(header)
    document.body.append(shell)
    mounted.push(shell)
    await Promise.all([shell.updateComplete, header.updateComplete])
    return header
  }

  it('stands flush as the title row, with its description', async () => {
    const root = (await mountInShell()).shadowRoot!
    expect(root.querySelector('.lintje-page-header')!.classList).toContain(
      'lintje-page-header--shell',
    )
    expect(root.querySelector('.lintje-page-header__description')).not.toBeNull()
  })

  it("stands as a band, not flush, outside the shell's header slot", async () => {
    const root = (await mountInShell('')).shadowRoot!
    expect(root.querySelector('.lintje-page-header')!.classList).not.toContain(
      'lintje-page-header--shell',
    )
  })

  it('watches no title for a top bar and tells the store nothing', async () => {
    const counted = await countObservers(() => mountInShell())
    expect(counted.created).toBe(0)
    counted.header.remove()
    expect(getFrameState().titleHidden).toBe(false)
  })

  it('does watch its title outside the shell, so the count above is a real one', async () => {
    const counted = await countObservers(async () => {
      const header = document.createElement('lintje-page-header') as LintjePageHeader
      header.data = { title: 'Overzicht' }
      document.body.append(header)
      mounted.push(header)
      await header.updateComplete
      return header
    })
    expect(counted.created).toBeGreaterThan(0)
  })
})

describe('lintje-page-header editable', () => {
  it('puts a pencil beside the title that asks to rename, only when editable', async () => {
    const header = document.createElement('lintje-page-header') as LintjePageHeader
    header.data = { title: 'Teamoverleg 2 oktober' }
    document.body.append(header)
    mounted.push(header)
    await header.updateComplete
    expect(header.shadowRoot!.querySelector('.lintje-page-header__edit')).toBeNull()
    header.editable = true
    await header.updateComplete
    const pencil = header.shadowRoot!.querySelector<HTMLElement>('.lintje-page-header__edit')!
    expect(pencil.getAttribute('label')).toBe('Naam wijzigen')
    let asked = 0
    header.addEventListener('lintje-title-edit', () => (asked += 1))
    pencil.click()
    expect(asked).toBe(1)
  })
})
