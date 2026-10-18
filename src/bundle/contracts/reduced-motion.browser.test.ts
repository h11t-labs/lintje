/**
 * Reduced motion (every browser test runs with it): only opacity moves, in 80 ms. The focus ring
 * and a colour change, also one a child inherits, stand at once; a box that opens lets its content
 * out as soon as its height stands, and waits only while a transition of that height really runs.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { TAB } from '../../core/test-keys'
import '../../components/actions/button/button'
import type { LintjeButton } from '../../components/actions/button/button'
import '../../components/filters/filter-zone/filter-zone'
import '../../components/layout/expander/expander'
import '../../components/graph/graph/graph'
import '../../components/tables/sortable-list/sortable-list'
import type { LintjeSortableList } from '../../components/tables/sortable-list/sortable-list'
import type { LintjeElement } from '../../core/element'
import type { GraphData } from '../../types'
import { heightSettleMs } from '../../components/shared/transition'

afterEach(() => {
  document.body.replaceChildren()
})

it('transitions only opacity on a focused button and the label in it', async () => {
  const element = document.createElement('lintje-button') as LintjeButton
  element.textContent = 'Opslaan'
  document.body.append(element)
  await element.updateComplete
  // WebKit sends the key only to a document that holds the focus.
  const start = Object.assign(document.createElement('input'), { ariaLabel: 'Zoeken' })
  element.before(start)
  start.focus()
  await userEvent.keyboard(TAB)

  const button = element.shadowRoot!.querySelector<HTMLElement>('button')!
  expect(button.matches(':focus-visible')).toBe(true)
  const label = button.querySelector<HTMLElement>('.lintje-button__label')!
  for (const box of [button, label]) {
    const style = getComputedStyle(box)
    expect(style.transitionProperty).toBe('opacity')
    expect(style.transitionDuration).toBe('0.08s')
  }
})

/** Until no update is left: settling in `updated()` asks for one more. */
async function updated(element: LintjeElement): Promise<void> {
  while (!(await element.updateComplete));
}

// Holds the height still in the element itself, whatever `tokens/base.css` lets move.
const STILL =
  '.lintje-disclosure__body, .lintje-filter-bar__body { transition-property: opacity !important; }'

/** Mounts closed, opens, and gives the box and what it showed right after the update. */
async function open(
  tag: string,
  box: string,
  inner: string,
  still: boolean,
  prepare: (element: LintjeElement & { open: boolean }) => void,
): Promise<{ wait: number; settled: boolean; overflow: string; root: HTMLElement }> {
  const element = document.createElement(tag) as LintjeElement & { open: boolean }
  prepare(element)
  document.body.append(element)
  await updated(element)
  if (still) {
    element.shadowRoot!.append(
      Object.assign(document.createElement('style'), { textContent: STILL }),
    )
  }
  const body = element.shadowRoot!.querySelector<HTMLElement>(box)!
  const wait = heightSettleMs(body)
  element.open = true
  await updated(element)
  const root = body.closest<HTMLElement>('.lintje-disclosure, .lintje-filter-bar')!
  return {
    wait,
    settled: root.classList.contains('is-settled'),
    overflow: getComputedStyle(element.shadowRoot!.querySelector(inner)!).overflow,
    root,
  }
}

const expander = (still: boolean) =>
  open(
    'lintje-expander',
    '.lintje-disclosure__body',
    '.lintje-disclosure__body-inner',
    still,
    (element) => {
      element.setAttribute('heading', 'Toelichting')
      element.textContent = 'Inhoud'
    },
  )

const zone = (still: boolean) =>
  open(
    'lintje-filter-zone',
    '.lintje-filter-bar__body',
    '.lintje-filter-bar__body-inner',
    still,
    (element) => {
      Object.assign(element, { total: 1, sentence: [{ text: 'Je ziet: alles', emphasis: false }] })
      element.innerHTML = '<input aria-label="Periode" />'
      element.addEventListener('lintje-zone-open-change', (event) => {
        element.open = (event as CustomEvent<boolean>).detail
      })
    },
  )

describe.each([
  ['lintje-expander', expander],
  ['lintje-filter-zone', zone],
])('%s that opens', (_, mount) => {
  it('lets its content out at once when its height stands', async () => {
    await page.viewport(1280, 800)
    const { wait, settled, overflow } = await mount(true)
    expect(wait).toBe(0)
    expect(settled).toBe(true)
    expect(overflow).toBe('visible')
  })

  // With the rules of `tokens/base.css` alone: settled at once exactly when the height stands.
  it('waits only as long as its height moves', async () => {
    await page.viewport(1280, 800)
    const { wait, settled, root } = await mount(false)
    expect(settled).toBe(wait === 0)
    await expect.poll(() => root.classList.contains('is-settled')).toBe(true)
  })
})

it('stands a graph’s nodes in their new place at once', async () => {
  const data: GraphData = {
    description: 'Een ministerie met twee diensten.',
    types: [{ key: 'org', label: 'Organisatie', icon: 'gebouwen-basis-kantoorgebouw' }],
    layout: 'layered-down',
    nodes: [
      { id: 'min', label: 'Ministerie van Wonen', type: 'org' },
      { id: 'a', label: 'Dienst Subsidies', type: 'org' },
      { id: 'b', label: 'Rijksdienst Gegevens', type: 'org' },
    ],
    edges: [
      { from: 'min', to: 'a' },
      { from: 'min', to: 'b' },
    ],
  }
  const element = document.createElement('lintje-graph') as LintjeElement & { data: GraphData }
  element.data = data
  document.body.append(element)
  const place = () =>
    element.shadowRoot!.querySelector<HTMLElement>('[data-node="a"]')?.style.transform
  // The drawing fits itself once its box is measured, a frame or two after it is drawn.
  let before = place()
  for (let still = 0; still < 3;) {
    await new Promise(requestAnimationFrame)
    still = place() === before ? still + 1 : 0
    before = place()
  }
  element.data = { ...data, layout: 'layered-right' }
  await element.updateComplete
  const after = place()
  expect(after).not.toBe(before)
  await new Promise(requestAnimationFrame)
  await new Promise(requestAnimationFrame)
  expect(place()).toBe(after)
})

it('stands a sortable row in its new place at once, moved by a key or put down by a tap', async () => {
  const element = Object.assign(document.createElement('lintje-sortable-list'), {
    items: [
      { id: 'naam', label: 'Naam' },
      { id: 'datum', label: 'Datum' },
      { id: 'status', label: 'Status' },
    ],
  }) as LintjeSortableList
  document.body.append(element)
  await element.updateComplete
  const root = element.shadowRoot!
  const rows = () => [...root.querySelectorAll<HTMLElement>('.lintje-sortable-list__row')]
  const grip = (id: string) =>
    root.querySelector<HTMLElement>(`.lintje-sortable-list__grip[data-id="${id}"]`)!
  const moving = () =>
    rows().filter((row) => row.getAnimations().length || getComputedStyle(row).translate !== 'none')

  grip('naam').focus()
  await userEvent.keyboard(' ')
  await userEvent.keyboard('{ArrowDown}')
  await element.updateComplete
  expect(rows().map((row) => row.dataset.id)).toEqual(['datum', 'naam', 'status'])
  expect(moving()).toEqual([])

  await userEvent.click(grip('status'))
  await element.updateComplete
  expect(rows().map((row) => row.dataset.id)).toEqual(['datum', 'status', 'naam'])
  expect(moving()).toEqual([])
})
