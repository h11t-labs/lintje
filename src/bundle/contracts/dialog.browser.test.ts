/** The contract of every modal dialog on the `FocusTrap`: focus in, Tab stays in, the page holds still, it closes, focus back, its name resolves. */
import { afterEach, describe, expect, it } from 'vitest'
import { cdp, page, server, userEvent } from 'vitest/browser'
import type { LintjeShell } from '../../components/frame/shell/shell'
import { deepActiveElement, holdsFocus } from '../../core/focus'
import { scrollRoot } from '../../core/host-config'
import { focusTarget, tabbables } from '../../components/shared/focus-trap'
import '../../components/frame/app-search/app-search'
import '../../components/overlays/dialog/dialog'
import '../../components/overlays/drawer/drawer'
import '../../components/filters/filter-sheet/filter-sheet'
import '../../components/filters/filter-bar/filter-bar'
import '../../components/inputs/text-input/text-input'
import '../../components/overlays/modal/modal'
import '../../components/frame/notifications/notifications'
import '../../components/actions/button/button'
import '../../components/frame/shell/shell'
import type { FilterBarData, ShellData } from '../../types'
import { SHIFT_TAB, TAB } from '../../core/test-keys'

type Find = (element: HTMLElement) => HTMLElement | null | undefined

interface Row {
  name: string
  /** Opened at 390 px: the element is a modal sheet only on a phone. */
  phone?: boolean
  /** Puts the element on the page with what opens it; a host's listeners do the closing. */
  mount(): { element: HTMLElement; trigger: Find }
  /** Where the focus lands on opening. */
  first: Find
  /** Escape answers nothing, by design: the session runs out either way. */
  escapeIgnored?: boolean
  /** The other ways out, each a control to click. */
  closers: [string, Find][]
  /** The texts `aria-labelledby` and `aria-describedby` point at. */
  label?: string
  description?: string
  /** Chromium's accessibility tree: the role and description the dialog gets there. */
  tree?: { role: string; description: string }
}

/**
 * What fails today: each entry has its GitHub issue above it and matches a check's
 * `<row> :: <check>`. A failing check that matches none fails; an entry whose check passes, or
 * that matches no check at all, fails too, so the fix takes its entry out.
 */
const KNOWN: RegExp[] = []
const seen = new Set<RegExp>()
const ran: string[] = []

const shadow = (element: HTMLElement, selector: string): HTMLElement | null =>
  element.shadowRoot!.querySelector<HTMLElement>(selector)

const ZAAKNUMMER = {
  key: 'zaak',
  label: 'Zaaknummer',
  kind: 'text',
  value: '',
  default: '',
} as const
const filterSheet = (bar: HTMLElement): HTMLElement | null =>
  bar.shadowRoot!.querySelector<HTMLElement>('lintje-filter-sheet')
const filterSentence = (bar: HTMLElement): HTMLElement | null | undefined =>
  bar
    .shadowRoot!.querySelector('lintje-filter-zone')
    ?.shadowRoot?.querySelector<HTMLElement>('.lintje-filter-bar__mobile-summary')

/** A host as a page has it: its button sets `open`, every request to close clears it. */
function hosted(
  element: HTMLElement & { open: boolean },
  close = 'lintje-close',
): { element: HTMLElement; trigger: Find } {
  const trigger = Object.assign(document.createElement('button'), {
    type: 'button',
    textContent: 'Openen',
  })
  trigger.addEventListener('click', () => (element.open = true))
  element.addEventListener(close, () => (element.open = false))
  document.body.append(trigger, element)
  return { element, trigger: () => trigger }
}

const SHELL: ShellData = {
  name: 'Aanvragen',
  navigation: [
    { label: 'Overzicht', href: '/overzicht', active: true },
    { label: 'Archief', href: '/archief' },
  ],
  share: true,
}

function shell(): { element: HTMLElement; trigger: Find } {
  const element = Object.assign(document.createElement('lintje-shell'), { data: SHELL })
  element.innerHTML = '<p>Inhoud</p>'
  document.body.append(element)
  return { element, trigger: () => null }
}

const ROWS: Row[] = [
  {
    name: 'lintje-modal',
    mount: () =>
      hosted(
        Object.assign(document.createElement('lintje-modal'), { heading: 'Aanvragen per week' }),
      ),
    first: (element) => shadow(element, '.lintje-modal'),
    closers: [['de sluitknop', (element) => shadow(element, '.lintje-modal__close')]],
  },
  {
    name: 'lintje-drawer',
    mount: () => {
      const drawer = Object.assign(document.createElement('lintje-drawer'), { heading: 'Aanvraag' })
      drawer.innerHTML =
        '<p>Ingediend op 3 maart.</p><lintje-text-input label="Opmerking"></lintje-text-input>'
      return hosted(drawer)
    },
    // The first field, through its shadow root.
    first: (element) =>
      element.querySelector('lintje-text-input')?.shadowRoot?.querySelector<HTMLElement>('input'),
    closers: [['de sluitknop', (element) => shadow(element, '.lintje-drawer__close')]],
    label: 'Aanvraag',
  },
  {
    name: 'lintje-drawer zonder veld',
    mount: () => {
      const drawer = Object.assign(document.createElement('lintje-drawer'), { heading: 'Aanvraag' })
      drawer.innerHTML = '<p>Ingediend op 3 maart.</p>'
      return hosted(drawer)
    },
    first: (element) => shadow(element, '.lintje-drawer__close'),
    closers: [['de sluitknop', (element) => shadow(element, '.lintje-drawer__close')]],
    label: 'Aanvraag',
  },
  {
    name: 'lintje-dialog',
    mount: () => {
      const dialog = Object.assign(document.createElement('lintje-dialog'), {
        heading: 'Naam wijzigen',
        wide: true,
      })
      dialog.innerHTML = `<lintje-text-input label="Naam"></lintje-text-input>
        <lintje-button slot="actions" variant="secondary">Annuleren</lintje-button>
        <lintje-button slot="actions" variant="primary">Opslaan</lintje-button>`
      return hosted(dialog)
    },
    first: (element) =>
      element.querySelector('lintje-text-input')?.shadowRoot?.querySelector<HTMLElement>('input'),
    closers: [['de sluitknop', (element) => shadow(element, '.lintje-dialog__close')]],
    label: 'Naam wijzigen',
  },
  {
    name: 'lintje-dialog zonder veld',
    mount: () => {
      const dialog = Object.assign(document.createElement('lintje-dialog'), {
        heading: 'Sneltoetsen',
      })
      dialog.innerHTML = '<p>Zoeken: /</p>'
      return hosted(dialog)
    },
    first: (element) => shadow(element, '.lintje-dialog__close'),
    closers: [['de sluitknop', (element) => shadow(element, '.lintje-dialog__close')]],
    label: 'Sneltoetsen',
  },
  {
    name: 'lintje-dialog alert',
    mount: () => {
      const dialog = Object.assign(document.createElement('lintje-dialog'), {
        alert: true,
        heading: 'Aanvraag verwijderen?',
      })
      dialog.innerHTML = `De aanvraag en de 2 bijlagen worden verwijderd.
        <lintje-button slot="actions" variant="secondary" autofocus>Annuleren</lintje-button>
        <lintje-button slot="actions" variant="danger">Verwijderen</lintje-button>`
      dialog.querySelector('[autofocus]')!.addEventListener('click', () => (dialog.open = false))
      return hosted(dialog)
    },
    // The safe answer, so Enter never confirms by itself.
    first: (element) => focusTarget(element.querySelector<HTMLElement>('[autofocus]')!),
    closers: [['annuleren', (element) => element.querySelector<HTMLElement>('[autofocus]')]],
    label: 'Aanvraag verwijderen?',
    description: 'De aanvraag en de 2 bijlagen worden verwijderd.',
    tree: { role: 'alertdialog', description: 'De aanvraag en de 2 bijlagen worden verwijderd.' },
  },
  {
    name: 'lintje-filter-sheet',
    phone: true,
    mount: () => {
      const sheet = document.createElement('lintje-filter-sheet')
      sheet.innerHTML = '<lintje-text-input label="Zaaknummer"></lintje-text-input>'
      return hosted(sheet, 'lintje-sheet-close')
    },
    first: (element) => shadow(element, '.lintje-filter-sheet'),
    closers: [['de sluitknop', (element) => shadow(element, '.lintje-filter-sheet__close')]],
  },
  ...[false, true].map((standalone): Row => ({
    name: `lintje-filter-bar${standalone ? ' standalone' : ''} op 390 px`,
    phone: true,
    mount: () => {
      const element = Object.assign(document.createElement('lintje-filter-bar'), {
        data: { standalone, filters: [ZAAKNUMMER] } satisfies FilterBarData,
      })
      document.body.append(element)
      // The sentence under the header opens the sheet.
      return { element, trigger: (bar) => filterSentence(bar) }
    },
    first: (bar) => filterSheet(bar)?.shadowRoot?.querySelector('.lintje-filter-sheet'),
    closers: [
      [
        'de sluitknop',
        (bar) => filterSheet(bar)?.shadowRoot?.querySelector('.lintje-filter-sheet__close'),
      ],
    ],
  })),
  {
    name: 'lintje-app-search',
    mount: () => hosted(document.createElement('lintje-app-search')),
    first: (element) => shadow(element, '.lintje-app-search__input'),
    closers: [['de achtergrond', (element) => shadow(element, '.lintje-app-search__scrim')]],
  },
  {
    name: 'lintje-app-search op 390 px',
    phone: true,
    mount: () => hosted(document.createElement('lintje-app-search')),
    first: (element) => shadow(element, '.lintje-app-search__input'),
    closers: [['de sluitknop', (element) => shadow(element, '.lintje-app-search__close')]],
  },
  {
    name: 'lintje-dialog alert persistent',
    mount: () => {
      const dialog = Object.assign(document.createElement('lintje-dialog'), {
        alert: true,
        persistent: true,
        heading: 'Je sessie verloopt over 1 minuut',
      })
      dialog.innerHTML = `Je invoer wordt bewaard in deze browser. Blijf aangemeld om door te werken.
        <lintje-button slot="actions" variant="tertiary">Afmelden</lintje-button>
        <lintje-button slot="actions" variant="primary" autofocus>Aangemeld blijven</lintje-button>`
      dialog.querySelector('[autofocus]')!.addEventListener('click', () => (dialog.open = false))
      return hosted(dialog)
    },
    first: (element) => focusTarget(element.querySelector<HTMLElement>('[autofocus]')!),
    escapeIgnored: true,
    closers: [
      ['aangemeld blijven', (element) => element.querySelector<HTMLElement>('[autofocus]')],
    ],
    label: 'Je sessie verloopt over 1 minuut',
    description: 'Je invoer wordt bewaard in deze browser. Blijf aangemeld om door te werken.',
  },
  {
    name: 'lintje-notifications op 390 px',
    phone: true,
    mount: () => {
      const element = Object.assign(document.createElement('lintje-notifications'), {
        items: [
          { id: 'm1', title: 'Export klaar', when: 'zojuist', unread: true },
          { id: 'm2', title: 'Rapport gedeeld', when: 'gisteren' },
        ],
      })
      document.body.append(element)
      return { element, trigger: () => shadow(element, '.lintje-notifications__bell') }
    },
    first: (element) => shadow(element, '.lintje-notifications__close'),
    closers: [['de sluitknop', (element) => shadow(element, '.lintje-notifications__close')]],
  },
  {
    name: 'lintje-shell menu op 390 px',
    phone: true,
    mount: () => {
      const { element } = shell()
      return {
        element,
        trigger: () => shadow(element, '.lintje-mobile-header__button--menu'),
      }
    },
    // Opening leaves the focus on the button, which then reads "Sluiten".
    first: (element) => shadow(element, '.lintje-mobile-header__button--menu'),
    closers: [['sluiten', (element) => shadow(element, '.lintje-mobile-header__button--menu')]],
  },
  {
    name: 'lintje-shell Delen op 390 px',
    phone: true,
    mount: () => {
      const { element } = shell()
      return {
        element,
        // "Delen" is a row at the top of the menu's panel: the menu opens first.
        trigger: () => {
          if (!(element as LintjeShell).menuOpen) (element as LintjeShell).menuOpen = true
          return shadow(element, '.lintje-mobile-menu__tools .lintje-share__button')
        },
      }
    },
    first: (element) => shadow(element, '.lintje-share__close'),
    closers: [['de sluitknop', (element) => shadow(element, '.lintje-share__close')]],
  },
]

const labelsOf = (row: Row): string[] => [
  'de focus gaat erin',
  'Tab blijft erin',
  'Shift+Tab blijft erin',
  row.escapeIgnored ? 'Escape laat hem open' : 'Escape sluit',
  ...(row.escapeIgnored ? [] : ['de focus keert terug na Escape']),
  ...row.closers.flatMap(([name]) => [`${name} sluit`, `de focus keert terug na ${name}`]),
  'de pagina scrolt niet',
  'de naam en beschrijving vinden hun doel',
  ...(row.tree ? ['de toegankelijkheidsboom'] : []),
]
const LABELS = ROWS.flatMap((row) => labelsOf(row).map((name) => `${row.name} :: ${name}`))

/** Runs one check; a failure that `KNOWN` holds passes, and says so by returning false. */
async function check(row: Row, name: string, body: () => Promise<void>): Promise<boolean> {
  const label = `${row.name} :: ${name}`
  ran.push(label)
  const entry = KNOWN.find((known) => known.test(label))
  try {
    await body()
  } catch (error) {
    if (!entry) throw error
    seen.add(entry)
    return false
  }
  return true
}

/** Every element under a node, through every shadow root. */
function deep(root: ParentNode, found: Element[] = []): Element[] {
  for (const element of root.querySelectorAll('*')) {
    found.push(element)
    if (element.shadowRoot) deep(element.shadowRoot, found)
  }
  return found
}

/** The modal dialogs a reader meets now. */
const dialogs = (): HTMLElement[] =>
  deep(document.body).filter(
    (element): element is HTMLElement =>
      element instanceof HTMLElement &&
      element.getAttribute('aria-modal') === 'true' &&
      element.checkVisibility(),
  )

/** The text a node shows, slotted content and a slot's fallback included. */
function textOf(node: Node): string {
  if (node instanceof HTMLSlotElement)
    return node.assignedNodes({ flatten: true }).map(textOf).join('')
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  return Array.from(node.childNodes, textOf).join('')
}
const words = (text: string): string => text.replace(/\s+/g, ' ').trim()

/** What scrolls the page, as `lockScroll()` picks it. */
function pageScroller(): HTMLElement {
  const root = scrollRoot()
  return !root || root === document.scrollingElement ? document.body : root
}
const locked = (): boolean => getComputedStyle(pageScroller()).overflow === 'hidden'

const tab = (): Promise<void> => userEvent.keyboard(TAB)
const shiftTab = (): Promise<void> => userEvent.keyboard(SHIFT_TAB)

interface Opened {
  element: HTMLElement
  trigger: HTMLElement
  dialog: HTMLElement
  /** The dialogs already open under it, which stay: the shell's menu under "Delen". */
  under: number
}

/** Mounts the row, opens it from its focused trigger and waits for the first focus. */
async function open(row: Row): Promise<Opened> {
  // A sentinel the pointer can reach: it gives the test's frame the keyboard in WebKit.
  const sentinel = Object.assign(document.createElement('button'), {
    type: 'button',
    textContent: 'Begin',
  })
  document.body.append(sentinel)
  await userEvent.click(sentinel)
  sentinel.remove()
  const { element, trigger: find } = row.mount()
  if (row.phone) {
    await page.viewport(390, 844)
    // WebKit resizes the frame after `viewport()` resolves; a media query's `change` comes a frame later.
    await expect.poll(() => window.innerWidth).toBe(390)
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)
  }
  await expect.poll(() => find(element)?.checkVisibility() ?? false).toBe(true)
  const trigger = find(element)!
  trigger.focus()
  expect(deepActiveElement()).toBe(trigger)
  const under = dialogs().length
  trigger.click()
  await expect.poll(() => dialogs().length).toBe(under + 1)
  return { element, trigger, dialog: dialogs()[under]!, under }
}

/** After a close: no dialog left, the focus on the trigger. */
async function closes(
  row: Row,
  path: string,
  view: Opened,
  act: () => Promise<void>,
): Promise<void> {
  await act()
  const closed = await check(row, `${path} sluit`, async () => {
    await expect.poll(() => dialogs().length).toBe(view.under)
  })
  if (!closed) return
  await check(row, `de focus keert terug na ${path}`, async () => {
    await expect.poll(() => deepActiveElement()).toBe(view.trigger)
  })
}

interface AXNode {
  role?: { value?: string }
  name?: { value?: string }
  description?: { value?: string }
}

/** Chromium's own accessibility tree of every frame: the test runs in an iframe. */
async function axNodes(): Promise<AXNode[]> {
  const session = cdp()
  await session.send('Accessibility.enable')
  const { frameTree } = (await session.send('Page.getFrameTree')) as {
    frameTree: { frame: { id: string }; childFrames?: unknown[] }
  }
  const ids: string[] = []
  const walk = (tree: { frame: { id: string }; childFrames?: unknown[] }): void => {
    ids.push(tree.frame.id)
    for (const child of tree.childFrames ?? []) walk(child as typeof tree)
  }
  walk(frameTree)
  const trees = await Promise.all(
    ids.map((frameId) => session.send('Accessibility.getFullAXTree', { frameId })),
  )
  return trees.flatMap((tree) => (tree as { nodes: AXNode[] }).nodes)
}

afterEach(async () => {
  // The viewport goes back while the element is still on the page.
  await page.viewport(1440, 900)
  await expect.poll(() => window.innerWidth).toBe(1440)
  document.body.replaceChildren()
})

describe.each(ROWS)('$name', (row) => {
  it('takes the focus in from its trigger', async () => {
    await check(row, 'de focus gaat erin', async () => {
      const view = await open(row)
      // A field may draw after the dialog opens: look it up on every poll.
      await expect
        .poll(() => {
          const first = row.first(view.element)
          return first != null && deepActiveElement() === first
        })
        .toBe(true)
      expect(holdsFocus(view.dialog)).toBe(true)
    })
  })

  it('keeps Tab and Shift+Tab inside', async () => {
    const view = await open(row)
    await expect.poll(() => holdsFocus(view.dialog)).toBe(true)
    const stops = tabbables(view.dialog)
    await check(row, 'Tab blijft erin', async () => {
      stops.at(-1)!.focus()
      await tab()
      expect(holdsFocus(view.dialog)).toBe(true)
      expect(deepActiveElement()).toBe(stops[0])
    })
    await check(row, 'Shift+Tab blijft erin', async () => {
      stops[0]!.focus()
      await shiftTab()
      expect(holdsFocus(view.dialog)).toBe(true)
      expect(deepActiveElement()).toBe(stops.at(-1))
    })
  })

  if (row.escapeIgnored) {
    it('stays open on Escape', async () => {
      const view = await open(row)
      await expect.poll(() => holdsFocus(view.dialog)).toBe(true)
      await check(row, 'Escape laat hem open', async () => {
        await userEvent.keyboard('{Escape}')
        expect(dialogs().slice(view.under)).toEqual([view.dialog])
        expect(holdsFocus(view.dialog)).toBe(true)
      })
    })
  } else {
    it('closes on Escape and gives the focus back', async () => {
      const view = await open(row)
      await expect.poll(() => holdsFocus(view.dialog)).toBe(true)
      await closes(row, 'Escape', view, () => userEvent.keyboard('{Escape}'))
    })
  }

  it.each(row.closers)('closes by %s and gives the focus back', async (path, control) => {
    const view = await open(row)
    await expect.poll(() => holdsFocus(view.dialog)).toBe(true)
    // The scrim is under the panel: its corner is what a pointer reaches.
    const position = path === 'de achtergrond' ? { position: { x: 4, y: 4 } } : {}
    // A phone-only control comes a frame after the width: `matchMedia` reports its change late.
    await expect.poll(() => control(view.element)).toBeTruthy()
    await closes(row, path, view, () => userEvent.click(control(view.element)!, position))
  })

  it('holds the page still while open', async () => {
    expect(locked()).toBe(false)
    const view = await open(row)
    await expect.poll(() => holdsFocus(view.dialog)).toBe(true)
    await check(row, 'de pagina scrolt niet', async () => {
      expect(locked()).toBe(true)
      const [path, control] = row.closers[0]!
      const position = path === 'de achtergrond' ? { position: { x: 4, y: 4 } } : {}
      await expect.poll(() => control(view.element)).toBeTruthy()
      await userEvent.click(control(view.element)!, position)
      await expect.poll(() => dialogs().length).toBe(view.under)
      // A dialog under it keeps the page still.
      expect(locked()).toBe(view.under > 0)
    })
  })

  it('names itself in its own root', async () => {
    const view = await open(row)
    await check(row, 'de naam en beschrijving vinden hun doel', async () => {
      const { dialog } = view
      const root = dialog.getRootNode() as Document | ShadowRoot
      const targets = (attribute: string): HTMLElement[] =>
        (dialog.getAttribute(attribute) ?? '')
          .split(/\s+/)
          .filter(Boolean)
          .map((id) => root.getElementById(id) as HTMLElement)
      const labelledBy = targets('aria-labelledby')
      const describedBy = targets('aria-describedby')
      for (const target of [...labelledBy, ...describedBy]) {
        expect(target, 'an id that is not in the dialog’s root').not.toBeNull()
        expect(words(textOf(target))).not.toBe('')
      }
      if (!labelledBy.length) expect(dialog.getAttribute('aria-label')?.trim()).toBeTruthy()
      if (row.label) expect(words(labelledBy.map(textOf).join(' '))).toBe(row.label)
      if (row.description) expect(words(describedBy.map(textOf).join(' '))).toBe(row.description)
      // Element reflection reads the same elements.
      const reflected = dialog as HTMLElement & {
        ariaLabelledByElements?: Element[] | null
        ariaDescribedByElements?: Element[] | null
      }
      if (labelledBy.length && 'ariaLabelledByElements' in reflected) {
        expect(reflected.ariaLabelledByElements).toEqual(labelledBy)
      }
      if (describedBy.length && 'ariaDescribedByElements' in reflected) {
        expect(reflected.ariaDescribedByElements).toEqual(describedBy)
      }
    })
  })

  if (row.tree) {
    const { role, description } = row.tree
    it.runIf(server.browser === 'chromium')('is named and described in the tree', async () => {
      await open(row)
      await check(row, 'de toegankelijkheidsboom', async () => {
        const node = (await axNodes()).find((item) => item.role?.value === role)
        expect(node?.name?.value).toBe(row.label)
        expect(node?.description?.value).toBe(description)
      })
    })
  }
})

describe('the known failures', () => {
  it('are all still failing', () => {
    const stale = KNOWN.filter(
      (entry) =>
        !seen.has(entry) &&
        (ran.some((label) => entry.test(label)) || !LABELS.some((label) => entry.test(label))),
    ).map(String)
    expect(stale, `fixed, so take out of KNOWN:\n${stale.join('\n')}`).toHaveLength(0)
  })
})
