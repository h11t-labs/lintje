/** The tabs: the ARIA pattern, the panel that shows, the keyboard and the events. */
import { describe, expect, it } from 'vitest'
import './tabs'
import { scrollEdges, scrollToShow, type LintjeTabs, type TabItem } from './tabs'

const TABS: TabItem[] = [
  { value: 'transcript', label: 'Transcript', href: '?' },
  { value: 'samenvatting', label: 'Samenvatting', href: '?tab=samenvatting' },
  { value: 'opmerkingen', label: 'Opmerkingen', count: 2 },
  { value: 'geschiedenis', label: 'Geschiedenis', disabled: true },
]

async function mount(value?: string): Promise<LintjeTabs> {
  const element = Object.assign(document.createElement('lintje-tabs'), {
    tabs: TABS,
    label: 'Weergave van de opname',
    value,
  })
  element.innerHTML = TABS.map((tab) => `<p slot="${tab.value}">${tab.label}</p>`).join('')
  document.body.append(element)
  await element.updateComplete
  return element
}

const tabs = (element: LintjeTabs): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>('[role="tab"]'),
]
const panels = (element: LintjeTabs): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>('[role="tabpanel"]'),
]

function listen(element: LintjeTabs): string[] {
  const heard: string[] = []
  element.addEventListener('lintje-tab-change', (event) =>
    heard.push(`tab:${(event as CustomEvent<string>).detail}`),
  )
  element.addEventListener('lintje-navigate', (event) =>
    heard.push(`href:${(event as CustomEvent<{ href: string }>).detail.href}`),
  )
  return heard
}

describe('lintje-tabs', () => {
  it('wires the tablist, the tabs and the panels', async () => {
    const element = await mount('samenvatting')
    const list = element.shadowRoot!.querySelector('[role="tablist"]')!
    expect(list.getAttribute('aria-label')).toBe('Weergave van de opname')
    const all = tabs(element)
    expect(all.map((tab) => tab.getAttribute('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ])
    expect(all.map((tab) => tab.getAttribute('tabindex'))).toEqual(['-1', '0', '-1', '-1'])
    expect(all[0]!.tagName).toBe('A')
    expect(all[2]!.tagName).toBe('BUTTON')
    expect(all[3]!.getAttribute('aria-disabled')).toBe('true')
    expect(all[2]!.querySelector('lintje-badge')!.textContent).toBe('2')

    const shown = panels(element).filter((panel) => !panel.hidden)
    expect(shown).toHaveLength(1)
    expect(shown[0]!.getAttribute('aria-labelledby')).toBe(all[1]!.id)
    expect(all[1]!.getAttribute('aria-controls')).toBe(shown[0]!.id)
    expect(shown[0]!.getAttribute('tabindex')).toBe('0')
    expect(shown[0]!.querySelector('slot')!.name).toBe('samenvatting')
  })

  it('marks a panel focused by a press, so only keyboard focus draws its ring', async () => {
    const panel = panels(await mount())[0]!
    panel.dispatchEvent(new Event('pointerdown'))
    panel.dispatchEvent(new FocusEvent('focus'))
    expect(panel.classList.contains('is-pressed')).toBe(true)
    panel.dispatchEvent(new FocusEvent('blur'))
    panel.dispatchEvent(new FocusEvent('focus'))
    expect(panel.classList.contains('is-pressed')).toBe(false)
  })

  it('chooses the first tab without a value and never sets value itself', async () => {
    const element = await mount()
    expect(element.selectedIndex).toBe(0)
    tabs(element)[2]!.click()
    await element.updateComplete
    expect(element.value).toBeUndefined()
  })

  it('sends the value, and the href for a link tab on a plain click', async () => {
    const element = await mount()
    const heard = listen(element)
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    tabs(element)[1]!.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(false)
    tabs(element)[2]!.click()
    tabs(element)[3]!.click()
    expect(heard).toEqual(['tab:samenvatting', 'href:?tab=samenvatting', 'tab:opmerkingen'])
  })

  it('moves with the arrows and chooses a tab, but not a disabled one or a link', async () => {
    const element = await mount('samenvatting')
    const heard = listen(element)
    const list = element.shadowRoot!.querySelector('[role="tablist"]')!
    tabs(element)[1]!.focus()
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(element.shadowRoot!.activeElement).toBe(tabs(element)[2])
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(element.shadowRoot!.activeElement).toBe(tabs(element)[3])
    // A link tab is a page: the arrow lands on it and goes nowhere.
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    expect(element.shadowRoot!.activeElement).toBe(tabs(element)[0])
    expect(heard).toEqual(['tab:opmerkingen'])
  })
})

describe('lintje-tabs of links only', () => {
  const PAGES: TabItem[] = [
    { value: 'transcript', label: 'Transcript', href: '?tab=transcript' },
    { value: 'samenvatting', label: 'Samenvatting', href: '?tab=samenvatting' },
    { value: 'geschiedenis', label: 'Geschiedenis', href: '?tab=geschiedenis', disabled: true },
  ]

  it('is a nav of links with the current page marked, and no tabs or tabpanels', async () => {
    const element = Object.assign(document.createElement('lintje-tabs'), {
      tabs: PAGES,
      label: 'Weergave van de opname',
      value: 'samenvatting',
    })
    document.body.append(element)
    await element.updateComplete
    const root = element.shadowRoot!
    expect(root.querySelector('[role="tablist"], [role="tab"], [role="tabpanel"]')).toBeNull()
    const nav = root.querySelector('nav')!
    expect(nav.getAttribute('aria-label')).toBe('Weergave van de opname')
    const links = [...nav.querySelectorAll('a')]
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([null, 'page', null])
    expect(links.every((link) => !link.hasAttribute('tabindex'))).toBe(true)
    expect(links[1]!.classList.contains('is-active')).toBe(true)
    expect(links[2]!.hasAttribute('href')).toBe(false)
    expect(links[2]!.getAttribute('aria-disabled')).toBe('true')
    expect(root.querySelector('.lintje-tabs__panel slot')!.getAttribute('name')).toBe(
      'samenvatting',
    )
    const heard = listen(element)
    links[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
    expect(heard).toEqual(['tab:transcript', 'href:?tab=transcript'])
    element.remove()
  })
})

describe('lintje-tabs variant="panel"', () => {
  const LARGE: TabItem[] = [
    {
      value: 'tekst',
      label: 'Tekst',
      icon: 'functioneel-kopieren',
      hint: 'Typ, plak of spreek in',
    },
    {
      value: 'live',
      label: 'Live gesprek',
      icon: 'functioneel-bel',
      hint: 'Praat met elkaar',
      badge: 'Nieuw',
    },
  ]

  async function mountLarge(variant: 'line' | 'panel'): Promise<LintjeTabs> {
    const element = Object.assign(document.createElement('lintje-tabs'), {
      tabs: LARGE,
      label: 'Wat wil je vertalen?',
      variant,
    })
    document.body.append(element)
    await element.updateComplete
    return element
  }

  it('draws each tab with its icon, its hint and its badge', async () => {
    const element = await mountLarge('panel')
    expect(element.getAttribute('variant')).toBe('panel')
    expect(element.shadowRoot!.querySelector('.lintje-tabs--panel')).not.toBeNull()
    const [first, second] = tabs(element)
    expect(first!.querySelector('.lintje-tabs__icon')).not.toBeNull()
    expect(first!.querySelector('.lintje-tabs__hint')!.textContent).toBe('Typ, plak of spreek in')
    expect(first!.querySelector('lintje-badge')).toBeNull()
    expect(second!.querySelector('lintje-badge')!.textContent).toBe('Nieuw')
    expect(second!.getAttribute('aria-selected')).toBe('false')
  })

  it('keeps the line variant as it was: a badge, but no icon and no hint', async () => {
    const element = await mountLarge('line')
    expect(element.shadowRoot!.querySelector('.lintje-tabs--panel')).toBeNull()
    expect(element.shadowRoot!.querySelector('.lintje-tabs__icon')).toBeNull()
    expect(element.shadowRoot!.querySelector('.lintje-tabs__hint')).toBeNull()
    expect(tabs(element)[1]!.querySelector('lintje-badge')!.textContent).toBe('Nieuw')
  })
})

describe('scroll arithmetic', () => {
  it('says which side still has tabs out of sight', () => {
    expect(scrollEdges(0, 300, 600)).toEqual({ start: false, end: true })
    expect(scrollEdges(150, 300, 600)).toEqual({ start: true, end: true })
    expect(scrollEdges(300, 300, 600)).toEqual({ start: true, end: false })
    expect(scrollEdges(0, 300, 300)).toEqual({ start: false, end: false })
  })

  it('scrolls just far enough to show the chosen tab', () => {
    expect(scrollToShow(400, 120, 0, 300)).toBe(220)
    expect(scrollToShow(40, 120, 100, 300)).toBe(40)
    expect(scrollToShow(120, 100, 0, 300)).toBe(0)
  })
})
