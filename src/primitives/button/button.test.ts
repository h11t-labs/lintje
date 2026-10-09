/**
 * A disabled or busy button — and a disabled icon button — stays in the tab order and refuses its activation.
 *
 * `disabled` and `busy` render `aria-disabled="true"` rather than the native
 * attribute, so the inner `<button>` stays focusable. The browser turns Enter and
 * Space on a focused button into a `click` on that same `<button>`, so the click
 * on the inner button stands for the pointer and the keyboard alike: none of them
 * may reach a listener a host put on the element.
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import './button'
import '../icon-button/icon-button'

// Read from disk, not imported: vitest does not run the CSS pipeline, so an
// `?inline` import comes back empty.
const read = (path: string) => readFileSync(resolvePath(`src/primitives/${path}`), 'utf8')
const buttonCss = read('button/button.css')
const iconButtonCss = read('icon-button/icon-button.css')

type Pressable = HTMLElement & {
  disabled: boolean
  busy?: boolean
  label?: string
  reason?: string
  updateComplete: Promise<unknown>
}

async function make(tag: string, props: Partial<Pressable>): Promise<Pressable> {
  const element = document.createElement(tag) as Pressable
  Object.assign(element, props)
  document.body.append(element)
  await element.updateComplete
  return element
}

const inner = (element: Pressable): HTMLButtonElement =>
  element.shadowRoot!.querySelector('button') as HTMLButtonElement

/**
 * Clicks the inner button the way a pointer, Enter or Space does and counts what
 * the host hears; `prevented` says whether the default (a submit) was cancelled.
 */
function clicksHeard(element: Pressable): { heard: number; prevented: boolean } {
  let heard = 0
  element.addEventListener('click', () => heard++)
  element.addEventListener('click', () => heard++, { capture: true })
  inner(element).click()
  const event = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true })
  inner(element).dispatchEvent(event)
  return { heard, prevented: event.defaultPrevented }
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('lintje-button', () => {
  for (const state of [{ disabled: true }, { busy: true }] as const) {
    const name = Object.keys(state)[0]

    it(`is focusable and aria-disabled while ${name}`, async () => {
      const element = await make('lintje-button', { label: 'Opslaan', ...state })
      const button = inner(element)
      expect(button.hasAttribute('disabled')).toBe(false)
      expect(button.getAttribute('aria-disabled')).toBe('true')
      button.focus()
      expect(element.shadowRoot!.activeElement).toBe(button)
    })

    it(`lets no click through to the host while ${name}`, async () => {
      const element = await make('lintje-button', { label: 'Opslaan', ...state })
      expect(clicksHeard(element)).toEqual({ heard: 0, prevented: true })
    })
  }

  it('keeps aria-busy on a busy button and the gray only on a disabled one', async () => {
    const busy = await make('lintje-button', { label: 'Opslaan', busy: true })
    expect(inner(busy).getAttribute('aria-busy')).toBe('true')
    expect(inner(busy).classList.contains('is-disabled')).toBe(false)
    const disabled = await make('lintje-button', { label: 'Opslaan', disabled: true })
    expect(inner(disabled).classList.contains('is-disabled')).toBe(true)
  })

  it('reads why it is disabled with the button, and only while disabled', async () => {
    const element = await make('lintje-button', {
      label: 'Opname starten',
      disabled: true,
      reason: 'Starten kan zodra Transcriptie je microfoon mag gebruiken.',
    })
    const why = element.shadowRoot!.getElementById(inner(element).getAttribute('aria-describedby')!)
    expect(why?.textContent).toBe('Starten kan zodra Transcriptie je microfoon mag gebruiken.')
    element.disabled = false
    await element.updateComplete
    expect(inner(element).hasAttribute('aria-describedby')).toBe(false)
  })

  it('passes the click on once it is available again', async () => {
    const element = await make('lintje-button', { label: 'Opslaan', disabled: true })
    element.disabled = false
    await element.updateComplete
    expect(inner(element).hasAttribute('aria-disabled')).toBe(false)
    // Two clicks, each heard by the capture and the bubble listener.
    expect(clicksHeard(element)).toEqual({ heard: 4, prevented: false })
  })
})

describe('lintje-button with an href', () => {
  type Link = Pressable & {
    href?: string
    target?: string
    rel?: string
    variant?: string
    type?: string
  }
  const anchor = (element: Pressable): HTMLAnchorElement =>
    element.shadowRoot!.querySelector('a') as HTMLAnchorElement

  it('renders a real link with the classes of the button', async () => {
    const link = (await make('lintje-button', {
      label: 'Bekijk alle aanvragen',
      href: '#table',
      type: 'submit',
    } as Partial<Link>)) as Link
    const button = await make('lintje-button', { label: 'Bekijk alle aanvragen' })
    const a = anchor(link)
    expect(link.shadowRoot!.querySelector('button')).toBeNull()
    expect(a.getAttribute('href')).toBe('#table')
    expect(a.hasAttribute('type')).toBe(false)
    expect(a.hasAttribute('role')).toBe(false)
    expect(a.className).toBe(inner(button).className)
  })

  it('keeps the link variant a link', async () => {
    const link = await make('lintje-button', {
      label: 'Meer',
      href: '/meer',
      variant: 'link',
    } as Partial<Link>)
    expect(anchor(link).classList.contains('lintje-button--link')).toBe(true)
  })

  it('opens a new tab without handing it the page', async () => {
    const blank = await make('lintje-button', {
      label: 'Bron',
      href: 'https://example.org',
      target: '_blank',
    } as Partial<Link>)
    expect(anchor(blank).getAttribute('target')).toBe('_blank')
    expect(anchor(blank).getAttribute('rel')).toBe('noopener noreferrer')
    const own = await make('lintje-button', {
      label: 'Bron',
      href: 'https://example.org',
      target: '_blank',
      rel: 'external',
    } as Partial<Link>)
    expect(anchor(own).getAttribute('rel')).toBe('external')
  })

  for (const state of [{ disabled: true }, { busy: true }] as const) {
    const name = Object.keys(state)[0]
    it(`goes nowhere and lets no click through while ${name}`, async () => {
      const element = await make('lintje-button', {
        label: 'Bekijk alle aanvragen',
        href: '#table',
        ...state,
      } as Partial<Link>)
      const a = anchor(element)
      expect(a.hasAttribute('href')).toBe(false)
      expect(a.getAttribute('aria-disabled')).toBe('true')
      expect(a.getAttribute('role')).toBe('link')
      a.focus()
      expect(element.shadowRoot!.activeElement).toBe(a)
      let heard = 0
      element.addEventListener('click', () => heard++)
      const event = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true })
      a.dispatchEvent(event)
      expect(heard).toBe(0)
      expect(event.defaultPrevented).toBe(true)
    })
  }
})

describe('lintje-icon-button', () => {
  it('ignores a size attribute from older markup', async () => {
    const element = document.createElement('lintje-icon-button') as Pressable
    element.setAttribute('size', 'compact')
    element.label = 'Sluiten'
    document.body.append(element)
    await element.updateComplete
    expect(inner(element).style.width).toBe('')
    expect(inner(element).className).not.toMatch(/compact/)
  })

  it('is focusable and aria-disabled while disabled, and lets no click through', async () => {
    const element = await make('lintje-icon-button', { label: 'Sluiten', disabled: true })
    const button = inner(element)
    expect(button.hasAttribute('disabled')).toBe(false)
    expect(button.getAttribute('aria-disabled')).toBe('true')
    button.focus()
    expect(element.shadowRoot!.activeElement).toBe(button)
    expect(clicksHeard(element)).toEqual({ heard: 0, prevented: true })
  })

  it('passes the click on when it is enabled', async () => {
    const element = await make('lintje-icon-button', { label: 'Sluiten' })
    expect(clicksHeard(element)).toEqual({ heard: 4, prevented: false })
  })

  it('draws moving bars beside the icon while live, and none at rest', async () => {
    const element = (await make('lintje-icon-button', {
      label: 'Stoppen met inspreken',
    })) as Pressable & { icon?: string; live?: boolean }
    element.icon = 'functioneel-kruis'
    await element.updateComplete
    expect(inner(element).querySelector('.lintje-icon-button__waves')).toBeNull()
    element.live = true
    await element.updateComplete
    expect(inner(element).classList.contains('is-live')).toBe(true)
    const waves = inner(element).querySelector('.lintje-icon-button__waves')!
    expect(waves.getAttribute('aria-hidden')).toBe('true')
    expect(waves.querySelectorAll('.lintje-icon-button__wave')).toHaveLength(4)
  })
})

/**
 * The pointer target: a box smaller than `--h-target` reaches it through a
 * transparent `::after` with a negative inset, never through a bigger drawing.
 * The test environment does not lay out, so the rules themselves are checked.
 */
const HIT_INSET = 'min(0px, calc((100% - var(--h-target)) / 2))'

/** The declarations of the rule whose selector list is exactly `selector`. */
function rule(css: string, selector: string): string {
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const start = flat.indexOf(`${selector} {`)
  if (start < 0) return ''
  return flat.slice(start, flat.indexOf('}', start))
}

describe('pointer targets', () => {
  it('gives the compact and chrome button a hit area above and below', () => {
    const hit = rule(buttonCss, '.lintje-button--compact::after,\n.lintje-button--chrome::after')
    expect(hit).toContain("content: ''")
    expect(hit).toContain('position: absolute')
    expect(hit).toContain(`inset: ${HIT_INSET} 0`)
  })

  it('gives the link button a hit area up to the 24 px text target', () => {
    const hit = rule(buttonCss, '.lintje-button--link::after')
    expect(hit).toContain('position: absolute')
    expect(hit).toContain('inset: min(0px, calc((100% - var(--h-target-text)) / 2)) 0')
  })

  it('draws the tile action in a colour of at least 3:1, never faded', () => {
    const tile = rule(iconButtonCss, '.lintje-icon-button--tile')
    expect(tile).toContain('color: var(--color-text-muted)')
    expect(tile).not.toContain('opacity')
  })

  it('gives the plain button no hit area: it is the 48 px target itself', () => {
    expect(buttonCss).not.toMatch(/\.lintje-button::after/)
    expect(buttonCss).toMatch(/height: var\(--h-button\);/)
  })

  it('draws the icon button as one box and reaches the target on every side', () => {
    expect(rule(iconButtonCss, '.lintje-icon-button')).toContain('width: var(--h-icon-button)')
    expect(rule(iconButtonCss, '.lintje-icon-button')).toContain('height: var(--h-icon-button)')
    expect(rule(iconButtonCss, '.lintje-icon-button::after')).toContain(`inset: ${HIT_INSET}`)
  })

  it('sets no size of its own on the icon button: the token is the size', async () => {
    const element = await make('lintje-icon-button', { label: 'Sluiten' })
    expect(inner(element).style.width).toBe('')
    expect(inner(element).style.height).toBe('')
  })
})

/**
 * A submit or reset button acts on the host's form: its inner `<button>` stands in
 * a shadow root and has no form owner, so the element calls `requestSubmit()` or
 * `reset()` itself, a task after the click — once every host listener had it.
 */
describe('lintje-button in a host form', () => {
  const task = (): Promise<void> => new Promise((resolve) => setTimeout(resolve))

  async function inForm(
    props: Partial<Pressable> & { type?: string; href?: string },
  ): Promise<{ form: HTMLFormElement; element: Pressable; submits: () => number }> {
    const form = document.createElement('form')
    let submits = 0
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      submits++
    })
    const element = document.createElement('lintje-button') as Pressable
    Object.assign(element, { label: 'Versturen', ...props })
    form.append(element)
    document.body.append(form)
    await element.updateComplete
    return { form, element, submits: () => submits }
  }

  it('submits the form for type="submit"', async () => {
    const { element, submits } = await inForm({ type: 'submit' })
    inner(element).click()
    await task()
    expect(submits()).toBe(1)
  })

  it('resets the form for type="reset"', async () => {
    const { form, element } = await inForm({ type: 'reset' })
    const field = document.createElement('input')
    field.defaultValue = 'Utrecht'
    form.prepend(field)
    field.value = 'Zwolle'
    inner(element).click()
    await task()
    expect(field.value).toBe('Utrecht')
  })

  it('does nothing for a plain button, a prevented click, a disabled or busy one, or a link', async () => {
    const plain = await inForm({})
    inner(plain.element).click()
    const prevented = await inForm({ type: 'submit' })
    prevented.element.addEventListener('click', (event) => event.preventDefault())
    inner(prevented.element).click()
    const disabled = await inForm({ type: 'submit', disabled: true })
    inner(disabled.element).click()
    const busy = await inForm({ type: 'submit', busy: true })
    inner(busy.element).click()
    const link = await inForm({ type: 'submit', href: '#verder' })
    link.element.shadowRoot!.querySelector('a')!.click()
    await task()
    for (const each of [plain, prevented, disabled, busy, link]) expect(each.submits()).toBe(0)
  })

  it('hears a host listener that prevents the click after it was added', async () => {
    const { element, submits } = await inForm({ type: 'submit' })
    document.body.addEventListener('click', (event) => event.preventDefault(), { once: true })
    inner(element).click()
    await task()
    expect(submits()).toBe(0)
  })

  it('says whether the region it opens is open, only when the host sets it', async () => {
    const element = document.createElement('lintje-button')
    element.textContent = 'Aanpassen'
    document.body.append(element)
    await element.updateComplete
    const native = element.shadowRoot!.querySelector('button')!
    expect(native.hasAttribute('aria-expanded')).toBe(false)
    element.expanded = true
    await element.updateComplete
    expect(native.getAttribute('aria-expanded')).toBe('true')
  })
})

describe('lintje-button ARIA', () => {
  afterEach(() => document.body.replaceChildren())

  it('puts the state a host gives on the inner button, never on the host', async () => {
    const element = (await make('lintje-button', {})) as Pressable & Record<string, unknown>
    Object.assign(element, {
      expanded: false,
      pressed: true,
      haspopup: 'dialog',
      keyshortcuts: '/',
      accessibleName: 'Bestanden kiezen, Bijlagen',
      description: 'Maximaal 10 MB',
      invalid: true,
    })
    await element.updateComplete
    const button = inner(element)
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.getAttribute('aria-haspopup')).toBe('dialog')
    expect(button.getAttribute('aria-keyshortcuts')).toBe('/')
    expect(button.getAttribute('aria-label')).toBe('Bestanden kiezen, Bijlagen')
    expect(button.getAttribute('aria-description')).toBe('Maximaal 10 MB')
    expect(button.getAttribute('aria-invalid')).toBe('true')
  })

  it('renders no aria-expanded until a host sets it', async () => {
    const element = await make('lintje-button', {})
    expect(inner(element).hasAttribute('aria-expanded')).toBe(false)
  })

  it('keeps the busy label in the accessibility tree: transparent, not visibility: hidden', () => {
    expect(buttonCss).toMatch(/\.is-busy \.lintje-button__label \{ opacity: 0; \}/)
    expect(buttonCss).not.toMatch(/\.is-busy \.lintje-button__label,/)
  })
})
