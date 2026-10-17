/** The card: what it draws, when it is a link, what its actions send and how it lies across. */
import { afterEach, describe, expect, it } from 'vitest'
import { render } from 'lit'
import { renderIcon } from '../../../icons/render'
import './card'
import type { CardData, LintjeCard } from './card'
import type { LintjePerson } from '../person/person'
import type { LintjePersonGroup } from '../person-group/person-group'

const PRODUCT: CardData = {
  id: 'vertalen',
  title: 'Vertalen',
  href: '/producten/vertalen',
  meta: ['AI-dienst', 'Team AI-diensten', ''],
  description: 'Vertaalt teksten en documenten.',
  status: { label: 'Je hebt toegang', tone: 'success' },
}

async function mount(data: CardData, attributes: Record<string, string> = {}): Promise<LintjeCard> {
  const element = document.createElement('lintje-card')
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
  element.data = data
  document.body.append(element)
  await element.updateComplete
  return element
}

afterEach(() => document.body.replaceChildren())

const nextFrame = (): Promise<unknown> => new Promise((resolve) => requestAnimationFrame(resolve))

describe('lintje-card', () => {
  it('draws the shared warning glyph', async () => {
    const root = (await mount({ ...PRODUCT, status: { tone: 'warning', label: 'Let op' } }))
      .shadowRoot!
    const expected = document.createElement('div')
    render(renderIcon('functioneel-waarschuwing'), expected)
    const glyph = root.querySelector('.lintje-card__status--warning svg')
    expect(glyph).not.toBeNull()
    expect(glyph!.innerHTML).toBe(expected.querySelector('svg')!.innerHTML)
  })

  it('draws the muted line, the title as a heading link, the text and the status', async () => {
    const root = (await mount(PRODUCT)).shadowRoot!
    // An empty part is left out, so no dot dangles.
    expect(root.querySelector('.lintje-card__meta')!.textContent).toBe(
      'AI-dienst · Team AI-diensten',
    )
    const link = root.querySelector<HTMLAnchorElement>('h3 a')!
    expect(link.textContent!.trim()).toBe('Vertalen')
    expect(link.getAttribute('href')).toBe('/producten/vertalen')
    expect(root.querySelector('.lintje-card__description')!.textContent).toBe(
      'Vertaalt teksten en documenten.',
    )
    const status = root.querySelector('.lintje-card__status--success')!
    expect(status.textContent!.trim()).toBe('Je hebt toegang')
    expect(status.querySelector('svg')).not.toBeNull()
  })

  it('draws optional facts as a small table, a missing value as a dash and never as 0', async () => {
    const root = (
      await mount({
        ...PRODUCT,
        facts: [
          { label: 'Verversing', value: 'Dagelijks' },
          { label: 'Rijen', value: null },
        ],
      })
    ).shadowRoot!
    expect([...root.querySelectorAll('dt')].map((node) => node.textContent)).toEqual([
      'Verversing',
      'Rijen',
    ])
    const missing = root.querySelectorAll('dd')[1]!
    expect(missing.querySelector('.lintje-card__missing')).not.toBeNull()
    expect(missing.textContent).not.toContain('0')

    const compact = (
      await mount({ ...PRODUCT, facts: [{ label: 'Rijen', value: '12' }] }, { compact: '' })
    ).shadowRoot!
    expect(compact.querySelector('dl')).toBeNull()
  })

  it('takes the heading level it is given', async () => {
    const root = (await mount(PRODUCT, { 'heading-level': '2' })).shadowRoot!
    expect(root.querySelector('h2.lintje-card__title')).not.toBeNull()
    expect(root.querySelector('h3')).toBeNull()
  })

  it('without actions the whole card follows its link, as lintje-navigate', async () => {
    const element = await mount(PRODUCT)
    const card = element.shadowRoot!.querySelector<HTMLElement>('.lintje-card')!
    expect(card.classList.contains('is-link')).toBe(true)
    expect(card.querySelector('.lintje-card__chevron')).not.toBeNull()
    const heard: string[] = []
    element.addEventListener('lintje-navigate', (event) => {
      heard.push((event as CustomEvent<{ href: string }>).detail.href)
      event.preventDefault()
    })
    element.shadowRoot!.querySelector<HTMLElement>('.lintje-card__description')!.click()
    expect(heard).toEqual(['/producten/vertalen'])
  })

  it('with actions it is not a link, and an action without href sends lintje-card-action', async () => {
    const element = await mount({
      ...PRODUCT,
      actions: [
        { label: 'Openen', href: 'https://vertalen.example', variant: 'primary', external: true },
        { label: 'Volgen', value: 'follow' },
        { label: 'Derde', value: 'third' },
      ],
    })
    const root = element.shadowRoot!
    expect(root.querySelector('.lintje-card.is-link')).toBeNull()
    expect(root.querySelector('.lintje-card__chevron')).toBeNull()
    const buttons = root.querySelectorAll('lintje-button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]!.getAttribute('href')).toBe('https://vertalen.example')
    expect(buttons[0]!.getAttribute('target')).toBe('_blank')
    expect(buttons[0]!.textContent).toContain('opent in een nieuw tabblad')

    const heard: unknown[] = []
    element.addEventListener('lintje-card-action', (event) =>
      heard.push((event as CustomEvent).detail),
    )
    ;(buttons[1] as HTMLElement).click()
    expect(heard).toEqual([{ id: 'vertalen', value: 'follow' }])

    const navigated: string[] = []
    element.addEventListener('lintje-navigate', () => navigated.push('card'))
    root.querySelector<HTMLElement>('.lintje-card__description')!.click()
    expect(navigated).toEqual([])
  })

  it('a click on the title sends one lintje-navigate, link card or not', async () => {
    for (const actions of [undefined, [{ label: 'Volgen', value: 'follow' }]]) {
      const element = await mount({ ...PRODUCT, actions })
      const heard: string[] = []
      element.addEventListener('lintje-navigate', (event) => {
        heard.push((event as CustomEvent<{ href: string }>).detail.href)
        event.preventDefault()
      })
      element.shadowRoot!.querySelector<HTMLAnchorElement>('.lintje-card__link')!.click()
      expect(heard).toEqual(['/producten/vertalen'])
      element.remove()
    }
  })

  it('an action with an href in this tab sends lintje-navigate, never lintje-card-action', async () => {
    const element = await mount({
      ...PRODUCT,
      actions: [
        { label: 'Openen', href: 'https://vertalen.example', external: true },
        { label: 'Details', href: '/producten/vertalen/details', variant: 'link' },
      ],
    })
    const navigated: string[] = []
    const acted: unknown[] = []
    element.addEventListener('lintje-navigate', (event) => {
      navigated.push((event as CustomEvent<{ href: string }>).detail.href)
      event.preventDefault()
    })
    element.addEventListener('lintje-card-action', (event) =>
      acted.push((event as CustomEvent).detail),
    )
    const [external, details] = element.shadowRoot!.querySelectorAll<HTMLElement>('lintje-button')
    expect(details!.classList.contains('lintje-card__action--link')).toBe(true)
    // An external link opens a tab of its own: the host has nothing to route.
    external!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }),
    )
    details!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }),
    )
    expect(navigated).toEqual(['/producten/vertalen/details'])
    expect(acted).toEqual([])
  })

  it('draws icon actions beside the title, a switch with its pressed glyph', async () => {
    expect((await mount(PRODUCT)).shadowRoot!.querySelector('.lintje-card__icon-action')).toBeNull()

    const heart = {
      value: 'favoriet',
      label: 'Favoriet',
      icon: 'functioneel-favoriet-outline',
      iconPressed: 'functioneel-favoriet',
    }
    const share = { value: 'delen', label: 'Delen', icon: 'functioneel-delen' }
    const extra = { value: 'derde', label: 'Derde', icon: 'functioneel-meer' }
    const element = await mount({
      ...PRODUCT,
      iconActions: [{ ...heart, pressed: true }, share, extra],
    })
    const buttons = element.shadowRoot!.querySelectorAll<HTMLElement & { pressed?: boolean }>(
      '.lintje-card__icon-action',
    )
    expect(buttons).toHaveLength(2)
    const [toggle, plain] = buttons
    expect(toggle!.getAttribute('icon')).toBe('functioneel-favoriet')
    expect(toggle!.getAttribute('label')).toBe('Favoriet: Vertalen')
    expect(toggle!.pressed).toBe(true)
    expect(plain!.pressed).toBeUndefined()

    const asked: unknown[] = []
    const navigated: string[] = []
    element.addEventListener('lintje-card-action', (event) =>
      asked.push((event as CustomEvent).detail),
    )
    element.addEventListener('lintje-navigate', () => navigated.push('card'))
    toggle!.click()
    plain!.click()
    // A link card does not follow its link from an icon action; the card keeps nothing.
    expect(asked).toEqual([
      { id: 'vertalen', value: 'favoriet', pressed: false },
      { id: 'vertalen', value: 'delen' },
    ])
    expect(navigated).toEqual([])
    await element.updateComplete
    expect(toggle!.getAttribute('icon')).toBe('functioneel-favoriet')

    element.data = { ...PRODUCT, iconActions: [{ ...heart, pressed: false }] }
    await element.updateComplete
    expect(toggle!.getAttribute('icon')).toBe('functioneel-favoriet-outline')
    expect(toggle!.pressed).toBe(false)
  })

  it('upright: a screenshot above the card, a logo beside the title', async () => {
    const image = (await mount({ ...PRODUCT, media: { src: 'shot.png', alt: 'Het scherm' } }))
      .shadowRoot!
    expect(
      image.querySelector<HTMLImageElement>('.lintje-card__media .lintje-card__image')!.alt,
    ).toBe('Het scherm')

    const logo = (await mount({ ...PRODUCT, media: { src: 'logo.svg', alt: '', kind: 'logo' } }))
      .shadowRoot!
    expect(logo.querySelector('.lintje-card__head .lintje-card__logo')).not.toBeNull()
    expect(logo.querySelector('.lintje-card__media')).toBeNull()
  })

  it('across: every picture takes the column on the left', async () => {
    const root = (
      await mount(
        { ...PRODUCT, media: { src: 'logo.svg', alt: '', kind: 'logo' } },
        { layout: 'horizontal' },
      )
    ).shadowRoot!
    expect(root.querySelector('.lintje-card.is-horizontal')).not.toBeNull()
    expect(root.querySelector('.lintje-card__media .lintje-card__logo')).not.toBeNull()
    expect(root.querySelector('.lintje-card__head .lintje-card__logo')).toBeNull()
  })

  it('compact keeps the muted line, title, status and the first action only', async () => {
    const root = (
      await mount(
        {
          ...PRODUCT,
          media: { src: 'shot.png', alt: '' },
          actions: [{ label: 'Openen', href: '#' }, { label: 'Volgen' }],
        },
        { compact: '' },
      )
    ).shadowRoot!
    expect(root.querySelector('.lintje-card__meta')).not.toBeNull()
    expect(root.querySelector('.lintje-card__description')).toBeNull()
    expect(root.querySelector('.lintje-card__image')).toBeNull()
    expect(root.querySelector('.lintje-card__status')).not.toBeNull()
    expect(root.querySelectorAll('lintje-button')).toHaveLength(1)
  })

  it('while loading holds the shape in skeletons', async () => {
    const root = (await mount(PRODUCT, { loading: '' })).shadowRoot!
    expect(root.querySelector('.lintje-card.is-loading')).not.toBeNull()
    expect(root.querySelectorAll('lintje-skeleton').length).toBeGreaterThan(1)
    expect(root.querySelector('h3')).toBeNull()
  })

  it('says it loads from a region that stays, and then that it has loaded', async () => {
    const element = await mount(PRODUCT, { loading: '' })
    const region = element.shadowRoot!.querySelector('[role="status"]')!
    // Drawn empty, filled a frame later, so a screen reader hears the change.
    expect(region.textContent).toBe('')
    await nextFrame()
    await element.updateComplete
    expect(region.textContent).toBe('Gegevens laden…')
    element.loading = false
    await element.updateComplete
    await nextFrame()
    await element.updateComplete
    expect(element.shadowRoot!.querySelector('[role="status"]')).toBe(region)
    expect(region.textContent).toBe('Gegevens geladen.')
    expect(element.shadowRoot!.querySelector('h3')).not.toBeNull()
  })

  it('has no status region when it never loaded', async () => {
    const root = (await mount(PRODUCT)).shadowRoot!
    expect(root.querySelector('[role="status"]')).toBeNull()
  })
})

describe('people on a card', () => {
  const JV = { name: 'J. de Vries', initials: 'JV', href: '/mensen/jv' }
  const READERS = [
    { name: 'A. Bakker', initials: 'AB', href: '/mensen/ab' },
    { name: 'S. Yılmaz', initials: 'SY' },
    { name: 'M. Jansen', initials: 'MJ' },
  ]
  const WITH_PEOPLE: CardData = {
    ...PRODUCT,
    facts: [
      { label: 'Behandelaar', person: JV },
      { label: 'Meelezers', people: READERS },
      { label: 'Bron', value: 'Register' },
    ],
  }

  const fact = (element: LintjeCard, index: number): HTMLElement =>
    element.shadowRoot!.querySelectorAll<HTMLElement>('.lintje-card__fact')[index]!

  it('draws a person or a row of people on the right, named by the term, without a value', async () => {
    const element = await mount({ ...WITH_PEOPLE, href: undefined })
    const handler = fact(element, 0)
    expect(handler.querySelector('dt')!.textContent).toBe('Behandelaar')
    const person = handler.querySelector<LintjePerson>('dd lintje-person')!
    expect(person.getAttribute('size')).toBe('small')
    // On a card that is no link, a person with `href` is a link.
    expect(person.person?.href).toBe('/mensen/jv')
    const group = fact(element, 1).querySelector<LintjePersonGroup>('dd lintje-person-group')!
    expect(group.getAttribute('label')).toBe('Meelezers')
    expect(group.getAttribute('size')).toBe('small')
    expect(group.people).toHaveLength(3)
    expect(fact(element, 1).querySelector('.lintje-card__missing')).toBeNull()
    expect(fact(element, 2).querySelector('dd')!.textContent!.trim()).toBe('Register')
  })

  it('takes `person` before `people` before `value`, and null as nobody', async () => {
    const element = await mount({
      ...PRODUCT,
      facts: [
        { label: 'Eigenaar', person: null, people: READERS, value: 'x' },
        { label: 'Lezers', people: READERS, value: 'x' },
      ],
    })
    const nobody = fact(element, 0).querySelector('lintje-person')!
    expect(nobody.person).toBeNull()
    expect(fact(element, 0).querySelector('lintje-person-group')).toBeNull()
    expect(fact(element, 1).querySelector('lintje-person-group')).not.toBeNull()
    expect(fact(element, 1).querySelector('dd')!.textContent).not.toContain('x')
  })

  it('on a card that is a link: no person link, and the row and its list open no card', async () => {
    const element = await mount(WITH_PEOPLE)
    expect(element.shadowRoot!.querySelector('.lintje-card.is-link')).not.toBeNull()
    const person = fact(element, 0).querySelector('lintje-person')!
    expect(person.person?.href).toBeUndefined()
    const group = fact(element, 1).querySelector('lintje-person-group')!
    expect(group.people.every((reader) => reader.href === undefined)).toBe(true)
    const navigated: string[] = []
    element.addEventListener('lintje-navigate', (event) => {
      navigated.push((event as CustomEvent<{ href: string }>).detail.href)
      event.preventDefault()
    })
    await group.updateComplete
    const button = group.shadowRoot!.querySelector<HTMLButtonElement>('button')!
    button.click()
    await group.updateComplete
    expect(group.open).toBe(true)
    group.shadowRoot!.querySelector<HTMLElement>('.lintje-person-group__heading')!.click()
    expect(navigated).toEqual([])
    // Elsewhere on the card it still opens.
    element.shadowRoot!.querySelector<HTMLElement>('.lintje-card__description')!.click()
    expect(navigated).toEqual(['/producten/vertalen'])
  })

  it('leaves the facts out on a compact card, these too', async () => {
    const element = await mount(WITH_PEOPLE, { compact: '' })
    expect(element.shadowRoot!.querySelector('lintje-person, lintje-person-group')).toBeNull()
  })
})
