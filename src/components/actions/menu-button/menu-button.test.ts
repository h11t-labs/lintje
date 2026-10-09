/**
 * The menu button: the trigger's ARIA, the rows the arrows reach, and what choosing a row sends.
 * happy-dom has no layout, so the popover's place is not checked here (`popover.test.ts` is).
 */
import { describe, expect, it } from 'vitest'
import './menu-button'
import {
  nextRow,
  rowByLetter,
  type LintjeMenuButton,
  type MenuEntry,
  type MenuItem,
} from './menu-button'

const ITEMS: MenuEntry[] = [
  { value: 'dupliceren', label: 'Dupliceren', icon: 'functioneel-kopieren' },
  { value: 'exporteren', label: 'Exporteren', href: '/export?formaat=csv', hint: 'CSV' },
  { value: 'overdragen', label: 'Overdragen', disabled: true, reason: 'Alleen de eigenaar' },
  'separator',
  { value: 'verwijderen', label: 'Verwijderen', danger: true },
]

async function mount(props: Partial<LintjeMenuButton> = {}): Promise<LintjeMenuButton> {
  const element = Object.assign(document.createElement('lintje-menu-button'), {
    label: 'Acties',
    items: ITEMS,
    ...props,
  })
  document.body.append(element)
  await element.updateComplete
  return element
}

const trigger = (element: LintjeMenuButton): HTMLButtonElement =>
  element.shadowRoot!.querySelector('.lintje-menu-button__trigger')!
const rows = (element: LintjeMenuButton): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>('[role="menuitem"]'),
]

describe('lintje-menu-button', () => {
  it('names its menu on the trigger and opens it on a click', async () => {
    const element = await mount()
    const button = trigger(element)
    expect(button.getAttribute('aria-haspopup')).toBe('menu')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    const popover = element.shadowRoot!.querySelector('lintje-popover')!
    expect(button.getAttribute('aria-controls')).toBe(popover.id)

    button.click()
    await element.updateComplete
    expect(element.open).toBe(true)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(popover.getAttribute('panel-role')).toBe('menu')
  })

  it('draws rows, a link row, a disabled row and the separator', async () => {
    const element = await mount({ open: true })
    const all = rows(element)
    expect(all.map((row) => row.querySelector('.lintje-menu__label')!.textContent)).toEqual([
      'Dupliceren',
      'Exporteren',
      'Overdragen',
      'Verwijderen',
    ])
    expect(all[1]!.querySelector('.lintje-menu__hint')!.textContent).toBe('CSV')
    expect(all[1]!.tagName).toBe('A')
    expect(all[1]!.getAttribute('href')).toBe('/export?formaat=csv')
    expect(all[2]!.getAttribute('aria-disabled')).toBe('true')
    expect(all[3]!.classList.contains('is-danger')).toBe(true)
    expect(element.shadowRoot!.querySelectorAll('[role="separator"]')).toHaveLength(1)
  })

  it('sends the value and closes when a row is chosen', async () => {
    const element = await mount({ open: true })
    const actions: string[] = []
    element.addEventListener('lintje-action', (event) =>
      actions.push((event as CustomEvent<string>).detail),
    )
    rows(element)[0]!.click()
    await element.updateComplete
    expect(actions).toEqual(['dupliceren'])
    expect(element.open).toBe(false)
  })

  it('sends lintje-navigate for a plain click on a link row, nothing for a disabled row', async () => {
    const element = await mount({ open: true })
    const heard: string[] = []
    element.addEventListener('lintje-navigate', (event) =>
      heard.push((event as CustomEvent<{ href: string }>).detail.href),
    )
    element.addEventListener('lintje-action', (event) =>
      heard.push((event as CustomEvent<string>).detail),
    )
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    rows(element)[1]!.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(false)
    expect(heard).toEqual(['exporteren', '/export?formaat=csv'])

    element.open = true
    await element.updateComplete
    heard.length = 0
    rows(element)[2]!.click()
    expect(heard).toEqual([])
  })

  it('closes on the popover’s Escape and keeps that event inside', async () => {
    const element = await mount({ open: true })
    let escaped = 0
    document.addEventListener('lintje-close', () => escaped++, { once: true })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await element.updateComplete
    expect(element.open).toBe(false)
    expect(escaped).toBe(0)
  })

  it('keeps a disabled trigger in the tab order and refuses to open', async () => {
    const element = await mount({ disabled: true })
    const button = trigger(element)
    expect(button.disabled).toBe(false)
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.classList.contains('is-disabled')).toBe(true)
    button.click()
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await element.updateComplete
    expect(element.open).toBe(false)
  })

  it('puts the disabled row with its reason in a tooltip the arrows reach', async () => {
    const element = await mount({ open: true })
    const disabled = rows(element)[2]!
    expect(disabled.closest('lintje-tooltip')?.getAttribute('text')).toBe('Alleen de eigenaar')
    rows(element)[1]!.focus()
    const menu = element.shadowRoot!.querySelector('.lintje-menu')!
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(element.shadowRoot!.activeElement).toBe(disabled)
  })

  it('draws the icon-button form with its label as the name', async () => {
    const element = await mount({ icon: true, label: 'Meer acties' })
    expect(trigger(element).getAttribute('aria-label')).toBe('Meer acties')
    expect(trigger(element).classList.contains('lintje-icon-button--outlined')).toBe(true)
    expect(trigger(element).classList.contains('lintje-menu-button__trigger--icon')).toBe(true)
  })

  it('places the menu by the trigger, not by the busy sentence beside it', async () => {
    const element = await mount()
    const popover = element.shadowRoot!.querySelector('lintje-popover')!
    expect(popover.previousElementSibling).toBe(trigger(element))
  })

  it('draws the icon-button form flat with variant tertiary', async () => {
    const element = await mount({ icon: true, label: 'Meer acties', variant: 'tertiary' })
    expect(trigger(element).classList.contains('lintje-icon-button--flat')).toBe(true)
    expect(trigger(element).classList.contains('lintje-icon-button--outlined')).toBe(false)
  })

  it('draws switches and a choice under a heading as a named group', async () => {
    const element = await mount({
      open: true,
      items: [
        { value: 'ondertiteling', label: 'Ondertiteling', checked: false, hint: 'C' },
        'separator',
        { heading: 'Afspeelsnelheid' },
        { value: '1', label: '1×', checked: true, radio: true },
        { value: '2', label: '2×', checked: false, radio: true },
      ],
    })
    const root = element.shadowRoot!
    const box = root.querySelector('[role="menuitemcheckbox"]')!
    expect(box.getAttribute('aria-checked')).toBe('false')
    // Unchecked keeps the slot, so the labels stay in line.
    expect(box.querySelector('.lintje-menu__slot')).not.toBeNull()
    const group = root.querySelector('[role="group"]')!
    const heading = root.getElementById(group.getAttribute('aria-labelledby')!)!
    expect(heading.textContent!.trim()).toBe('Afspeelsnelheid')
    const radios = [...group.querySelectorAll('[role="menuitemradio"]')]
    expect(radios.map((row) => row.getAttribute('aria-checked'))).toEqual(['true', 'false'])
    // One of a choice is a radio's circle, filled when chosen; a switch is a check.
    expect(
      radios.map((row) =>
        row.querySelector('.lintje-menu__radio')!.classList.contains('is-checked'),
      ),
    ).toEqual([true, false])

    const sent: string[] = []
    element.addEventListener('lintje-action', (event) =>
      sent.push((event as CustomEvent<string>).detail),
    )
    ;(radios[1] as HTMLElement).click()
    expect(sent).toEqual(['2'])
  })

  it("sends its action from a split button's own half, and only turns its icon while busy", async () => {
    const element = await mount({
      split: true,
      label: 'Downloaden',
      action: 'docx',
      leadingIcon: 'functioneel-downloaden',
    })
    const sent: string[] = []
    element.addEventListener('lintje-action', (event) =>
      sent.push((event as CustomEvent<string>).detail),
    )
    const main = element.shadowRoot!.querySelector<HTMLButtonElement>('.lintje-menu-button__main')!
    main.click()
    expect(sent).toEqual(['docx'])
    element.busyLabel = 'Het Word-document wordt gemaakt'
    await element.updateComplete
    expect(main.querySelector('.lintje-menu-button__busy')).not.toBeNull()
    expect(main.getAttribute('aria-busy')).toBe('true')
    // The sentence is for the screen reader; the button keeps its colours and nothing moves.
    expect(
      element.shadowRoot!.querySelector('[role="status"]')!.classList.contains('visually-hidden'),
    ).toBe(true)
    expect(main.hasAttribute('aria-disabled')).toBe(false)
    main.click()
    expect(sent).toEqual(['docx'])
  })

  it('shows the spinner and the sentence in a status beside a disabled trigger while busy', async () => {
    const element = await mount({ open: true })
    const status = element.shadowRoot!.querySelector('[role="status"]')!
    expect(status.textContent!.trim()).toBe('')
    element.busyLabel = 'Het Word-document wordt gemaakt'
    await element.updateComplete
    expect(status.querySelector('lintje-spinner')).not.toBeNull()
    expect(status.textContent!.trim()).toBe('Het Word-document wordt gemaakt')
    expect(trigger(element).getAttribute('aria-disabled')).toBe('true')
    expect(element.open).toBe(false)
    trigger(element).click()
    await element.updateComplete
    expect(element.open).toBe(false)
  })
})

describe('row arithmetic', () => {
  const list = ITEMS.filter((entry): entry is MenuItem => entry !== 'separator')

  it('reaches a disabled row, so its reason can be read, and wraps round', () => {
    expect(nextRow(list, 1, 1)).toBe(2)
    expect(nextRow(list, 3, 1)).toBe(0)
    expect(nextRow(list, 0, -1)).toBe(3)
    expect(nextRow(list, -1, 1)).toBe(0)
    expect(nextRow(list, list.length, -1)).toBe(3)
    expect(nextRow([], -1, 1)).toBe(-1)
  })

  it('jumps to the next row that starts with a letter', () => {
    expect(rowByLetter(list, 0, 'v')).toBe(3)
    expect(rowByLetter(list, 0, 'o')).toBe(2)
    expect(rowByLetter(list, 0, 'q')).toBe(-1)
    expect(rowByLetter(list, 3, 'D')).toBe(0)
  })
})
