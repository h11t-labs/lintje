/**
 * The form: it hears its fields by name (also through a section), keeps the draft, asks for one
 * submit, and puts the host's errors under their fields and in its summary.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import './form'
import '../form-section/form-section'
import '../../inputs/text-input/text-input'
import '../../inputs/textarea/textarea'
import '../../inputs/checkbox/checkbox'
import '../../inputs/toggle/toggle'
import '../../inputs/multiselect/multiselect'
import '../../inputs/date-range/date-range'
import '../../inputs/range/range'
import '../../inputs/file-upload/file-upload'
import { DRAFT_PREFIX, readDraft, type FormValues, type LintjeForm } from './form'
import type { LintjeErrorSummary } from '../error-summary/error-summary'
import type { LintjeFormActions } from '../form-actions/form-actions'
import type { LintjeTextInput } from '../../inputs/text-input/text-input'

/** What a field does when it commits: the non-composed `lintje-change` with its value. */
function announce(control: Element, value: unknown): void {
  control.dispatchEvent(new CustomEvent('lintje-change', { detail: value, bubbles: true }))
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve))

async function mount(attributes: Record<string, string> = {}): Promise<LintjeForm> {
  const form = document.createElement('lintje-form')
  for (const [name, value] of Object.entries(attributes)) form.setAttribute(name, value)
  form.innerHTML = `
    <lintje-form-section heading="Wat en waar">
      <lintje-text-input name="titel" label="Titel"></lintje-text-input>
      <lintje-text-input name="plaats" label="Plaats"></lintje-text-input>
    </lintje-form-section>
    <lintje-form-actions>
      <lintje-button variant="tertiary">Annuleren</lintje-button>
      <lintje-button variant="primary" type="submit">Opslaan</lintje-button>
    </lintje-form-actions>`
  form.values = { titel: 'Onbeheerde tas', plaats: 'Vergaderzaal 2' }
  document.body.append(form)
  await form.updateComplete
  return form
}

const field = (form: LintjeForm, name: string): LintjeTextInput =>
  form.querySelector<LintjeTextInput>(`[name="${name}"]`)!

const control = (input: LintjeTextInput): HTMLInputElement =>
  input.shadowRoot!.querySelector('input')!

/** What a reader does: type into the field and leave it. */
async function type(form: LintjeForm, name: string, value: string): Promise<void> {
  const input = control(field(form, name))
  input.value = value
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await form.updateComplete
}

function listen<T>(form: LintjeForm, name: string): T[] {
  const details: T[] = []
  form.addEventListener(name, (event) => details.push((event as CustomEvent<T>).detail))
  return details
}

describe('lintje-form', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => document.body.replaceChildren())

  it('writes the saved values into its fields', async () => {
    const form = await mount()
    expect(field(form, 'titel').value).toBe('Onbeheerde tas')
  })

  it('hears a field through a section, and keeps its filter event from the host', async () => {
    const form = await mount()
    let leaked = 0
    document.addEventListener('lintje-values-change', () => leaked++)
    await type(form, 'titel', 'Gevonden fiets')
    expect(form.collect()).toEqual({ titel: 'Gevonden fiets', plaats: 'Vergaderzaal 2' })
    expect(leaked).toBe(0)
  })

  it('is dirty while the draft differs, and says so once per change of mind', async () => {
    const form = await mount()
    const flips = listen<boolean>(form, 'lintje-dirty-change')
    await type(form, 'titel', 'Gevonden fiets')
    await type(form, 'titel', 'Gevonden fiets, rood')
    expect(form.dirty).toBe(true)
    expect(form.hasAttribute('dirty')).toBe(true)
    expect(form.querySelector<LintjeFormActions>('lintje-form-actions')!.state).toBe('dirty')
    await type(form, 'titel', 'Onbeheerde tas')
    expect(form.dirty).toBe(false)
    expect(flips).toEqual([true, false])
  })

  it('submits once, with the values, from the submit button and from Enter', async () => {
    const form = await mount()
    const submits = listen<{ values: FormValues }>(form, 'lintje-submit')
    form.querySelector<HTMLElement>('lintje-button[type="submit"]')!.click()
    expect(submits).toHaveLength(1)

    // Enter commits the field before the values are read.
    const input = control(field(form, 'plaats'))
    input.value = 'Ontvangsthal 1'
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
    )
    expect(submits).toHaveLength(2)
    expect(submits[1].values.plaats).toBe('Ontvangsthal 1')

    form.busy = true
    await form.updateComplete
    form.submit()
    expect(submits).toHaveLength(2)
  })

  it('is the one submit: the fields and the button reach no form of their own', async () => {
    const form = await mount()
    const submits = listen(form, 'lintje-submit')
    form.querySelector<HTMLElement>('lintje-button[type="submit"]')!.click()
    const input = control(field(form, 'plaats'))
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    )
    // The field's and the button's own paths wait a task: still one submit each.
    await tick()
    expect(submits).toHaveLength(2)
  })

  describe("inside a host's own <form>", () => {
    const prototype = HTMLElement.prototype as unknown as { attachInternals?: () => unknown }
    const original = prototype.attachInternals
    let host: HTMLFormElement
    let hostSubmits = 0

    beforeEach(() => {
      hostSubmits = 0
      host = document.createElement('form')
      host.requestSubmit = () => {
        hostSubmits++
      }
      // happy-dom has no `ElementInternals`: a stand-in whose form is the host's.
      prototype.attachInternals = () => ({
        form: host,
        setFormValue: () => {},
        setValidity: () => {},
      })
    })

    afterEach(() => {
      prototype.attachInternals = original
    })

    it('submits once on Enter and on the submit button, and leaves the host form alone', async () => {
      document.body.append(host)
      const form = document.createElement('lintje-form')
      form.innerHTML = `
        <lintje-text-input name="titel" label="Titel"></lintje-text-input>
        <lintje-form-actions>
          <lintje-button variant="primary" type="submit">Opslaan</lintje-button>
        </lintje-form-actions>`
      host.append(form)
      await form.updateComplete
      const submits = listen(form, 'lintje-submit')

      const input = control(field(form, 'titel'))
      input.value = 'Gevonden fiets'
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          composed: true,
          cancelable: true,
        }),
      )
      form.querySelector<HTMLElement>('lintje-button[type="submit"]')!.click()
      await tick()

      expect(submits).toHaveLength(2)
      expect(hostSubmits).toBe(0)
    })
  })

  it('while busy holds a read-only field disabled too, and hands back both', async () => {
    const form = await mount()
    const titel = field(form, 'titel')
    titel.readonly = true
    form.busy = true
    await form.updateComplete
    expect(titel.disabled).toBe(true)
    form.busy = false
    await form.updateComplete
    expect(titel.disabled).toBe(false)
    expect(titel.readonly).toBe(true)
  })

  it('while busy disables its fields and tells its action bar, and hands back after', async () => {
    const form = await mount()
    form.busy = true
    await form.updateComplete
    expect(form.shadowRoot!.querySelector('form')!.getAttribute('aria-busy')).toBe('true')
    expect(field(form, 'titel').disabled).toBe(true)
    expect(form.querySelector<LintjeFormActions>('lintje-form-actions')!.state).toBe('busy')
    form.busy = false
    await form.updateComplete
    expect(field(form, 'titel').disabled).toBe(false)
  })

  it('puts the errors on their fields and in the summary, which takes the focus', async () => {
    const form = await mount()
    const invalid = listen(form, 'lintje-invalid')
    form.submit()
    form.errors = {
      fields: { titel: 'Er is vandaag al een melding met deze titel' },
      form: 'De bijlage kon niet worden opgeslagen.',
    }
    await form.updateComplete
    const summary = form.shadowRoot!.querySelector<LintjeErrorSummary>('lintje-error-summary')!
    await summary.updateComplete
    await new Promise((resolve) => setTimeout(resolve))

    expect(field(form, 'titel').error).toBe('Er is vandaag al een melding met deze titel')
    expect(field(form, 'plaats').error).toBeUndefined()
    expect(summary.hidden).toBe(false)
    expect(summary.items).toEqual([
      { field: 'titel', label: 'Titel', message: 'Er is vandaag al een melding met deze titel' },
    ])
    expect(summary.message).toBe('De bijlage kon niet worden opgeslagen.')
    expect(invalid).toHaveLength(1)
    expect(summary.shadowRoot!.activeElement).toBe(
      summary.shadowRoot!.querySelector('.lintje-error-summary'),
    )

    // A field that changes loses its error, and no second alarm goes off.
    await type(form, 'titel', 'Gevonden fiets')
    expect(field(form, 'titel').error).toBeUndefined()
    expect(summary.items).toEqual([])
    expect(invalid).toHaveLength(1)
  })

  it('moves no focus for errors a page arrives with', async () => {
    const form = await mount()
    const invalid = listen(form, 'lintje-invalid')
    form.errors = { fields: { titel: 'Titel is verplicht' } }
    await form.updateComplete
    const summary = form.shadowRoot!.querySelector<LintjeErrorSummary>('lintje-error-summary')!
    await summary.updateComplete
    await new Promise((resolve) => setTimeout(resolve))
    expect(field(form, 'titel').error).toBe('Titel is verplicht')
    expect(summary.items).toHaveLength(1)
    expect(invalid).toHaveLength(1)
    expect(summary.shadowRoot!.activeElement).toBeNull()
  })

  it('leaves Enter to a field that used it', async () => {
    const form = await mount()
    const submits = listen(form, 'lintje-submit')
    const input = control(field(form, 'titel'))
    input.addEventListener('keydown', (event) => event.preventDefault())
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    )
    expect(submits).toHaveLength(0)
  })

  it('a save before the first render keeps the values it was given', async () => {
    const form = document.createElement('lintje-form')
    form.innerHTML = '<lintje-text-input name="titel" label="Titel"></lintje-text-input>'
    document.body.append(form)
    form.values = { titel: 'Onbeheerde tas, ontvangsthal' }
    form.saved(new Date(2026, 9, 4, 10, 42))
    await form.updateComplete
    expect(form.values.titel).toBe('Onbeheerde tas, ontvangsthal')
    expect(field(form, 'titel').value).toBe('Onbeheerde tas, ontvangsthal')
  })

  describe('every kind of field', () => {
    async function mountAll(attributes: Record<string, string> = {}): Promise<LintjeForm> {
      const form = document.createElement('lintje-form')
      for (const [name, value] of Object.entries(attributes)) form.setAttribute(name, value)
      form.innerHTML = `
        <lintje-text-input name="titel" label="Titel"></lintje-text-input>
        <lintje-checkbox name="akkoord" label="Akkoord"></lintje-checkbox>
        <lintje-toggle name="melden" label="Melden"></lintje-toggle>
        <lintje-multiselect name="loket" label="Loket"></lintje-multiselect>
        <lintje-date-range name="periode" label="Periode"></lintje-date-range>
        <lintje-range name="duur" label="Duur"></lintje-range>
        <lintje-file-upload name="bijlagen" label="Bijlagen"></lintje-file-upload>`
      form.querySelector<HTMLElement & { options: unknown }>('lintje-multiselect')!.options = [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
        { value: 'c', label: 'C' },
      ]
      form.querySelector<HTMLElement & { steps: unknown }>('lintje-range')!.steps = [1, 2, 3, 4, 5]
      form.querySelector<HTMLElement & { files: unknown }>('lintje-file-upload')!.files = [
        { id: 'f1', name: 'verklaring.pdf', size: 1000, state: 'done' },
        { id: 'f2', name: 'foto.jpg', size: 2000, state: 'busy', progress: 40 },
      ]
      document.body.append(form)
      await form.updateComplete
      return form
    }

    const at = <T>(form: LintjeForm, name: string): T =>
      form.querySelector(`[name="${name}"]`) as unknown as T

    it('writes each value where its tag holds it', async () => {
      const form = await mountAll()
      form.values = {
        titel: 'Gevonden fiets',
        akkoord: true,
        melden: true,
        loket: ['a', 'b'],
        periode: { from: '01-10-2026', to: '04-10-2026' },
        duur: [1, 3],
      }
      await form.updateComplete
      expect(at<{ value: string }>(form, 'titel').value).toBe('Gevonden fiets')
      expect(at<{ checked: boolean }>(form, 'akkoord').checked).toBe(true)
      expect(at<{ checked: boolean }>(form, 'melden').checked).toBe(true)
      expect(at<{ selected: string[] }>(form, 'loket').selected).toEqual(['a', 'b'])
      expect(at<{ range: unknown }>(form, 'periode').range).toEqual({
        from: '01-10-2026',
        to: '04-10-2026',
      })
      expect(at<{ from: number; to: number }>(form, 'duur')).toMatchObject({ from: 1, to: 3 })
    })

    it('collects what each field announced, and reads the ones that have not spoken', async () => {
      const form = await mountAll()
      expect(form.collect()).toEqual({
        titel: '',
        akkoord: false,
        melden: false,
        loket: [],
        periode: { from: null, to: null },
        duur: [0, 0],
        bijlagen: ['f1'],
      })

      announce(at(form, 'akkoord'), true)
      announce(at(form, 'loket'), ['c'])
      announce(at(form, 'periode'), { from: '02-10-2026', to: '03-10-2026' })
      announce(at(form, 'duur'), [2, 4])
      announce(at(form, 'bijlagen'), ['f1', 'f2'])
      const values = form.collect()
      expect(values).toMatchObject({
        akkoord: true,
        loket: ['c'],
        periode: { from: '02-10-2026', to: '03-10-2026' },
        duur: [2, 4],
        bijlagen: ['f1', 'f2'],
      })
      // In a form the form is the host: a field that waits for its value gets it back.
      expect(at<{ selected: string[] }>(form, 'loket').selected).toEqual(['c'])
      expect(at<{ from: number; to: number }>(form, 'duur')).toMatchObject({ from: 2, to: 4 })
    })

    it('puts a stored draft back into every field that can take it', async () => {
      localStorage.setItem(
        `${DRAFT_PREFIX}alles`,
        JSON.stringify({
          savedAt: Date.now(),
          values: { akkoord: true, loket: ['b'], duur: [0, 2], bijlagen: ['f9'] },
        }),
      )
      const form = await mountAll({ 'draft-key': 'alles' })
      expect(at<{ checked: boolean }>(form, 'akkoord').checked).toBe(true)
      expect(at<{ selected: string[] }>(form, 'loket').selected).toEqual(['b'])
      expect(at<{ from: number; to: number }>(form, 'duur')).toMatchObject({ from: 0, to: 2 })
      // A draft cannot put files back: the upload keeps the host's rows.
      expect(at<{ files: { id: string }[] }>(form, 'bijlagen').files.map((f) => f.id)).toEqual([
        'f1',
        'f2',
      ])
    })
  })

  it('says an error for a field that is not there, without a link', async () => {
    const form = await mount()
    form.errors = { fields: { titel: 'Titel is verplicht', bijlage: 'De bijlage is te groot' } }
    await form.updateComplete
    const summary = form.shadowRoot!.querySelector<LintjeErrorSummary>('lintje-error-summary')!
    await summary.updateComplete
    expect(summary.items).toEqual([
      { field: 'titel', label: 'Titel', message: 'Titel is verplicht' },
      { message: 'De bijlage is te groot' },
    ])
    const lines = summary.shadowRoot!.querySelectorAll('.lintje-error-summary__item')
    expect(lines).toHaveLength(2)
    expect(lines[1].querySelector('a')).toBeNull()
    expect(lines[1].textContent).toContain('De bijlage is te groot')
  })

  it('marks a native field invalid, since it draws no error of its own', async () => {
    const form = await mount()
    const native = document.createElement('input')
    native.name = 'kenmerk'
    form.append(native)
    await tick()
    form.errors = { fields: { kenmerk: 'Kenmerk is verplicht' } }
    await form.updateComplete
    expect(native.getAttribute('aria-invalid')).toBe('true')
    expect(field(form, 'titel').hasAttribute('aria-invalid')).toBe(false)
    form.errors = { fields: {} }
    await form.updateComplete
    expect(native.hasAttribute('aria-invalid')).toBe(false)
  })

  it('commits a textarea once on Ctrl+Enter, and submits once', async () => {
    const form = document.createElement('lintje-form')
    form.innerHTML = '<lintje-textarea name="omschrijving" label="Omschrijving"></lintje-textarea>'
    document.body.append(form)
    await form.updateComplete
    const textarea = form.querySelector('lintje-textarea')!
    await textarea.updateComplete
    const changes: unknown[] = []
    textarea.addEventListener('lintje-change', (event) =>
      changes.push((event as CustomEvent).detail),
    )
    const submits = listen<{ values: FormValues }>(form, 'lintje-submit')
    const area = textarea.shadowRoot!.querySelector('textarea')!
    area.value = 'Rode fiets bij de ingang'
    area.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    )
    expect(changes).toEqual(['Rode fiets bij de ingang'])
    expect(submits).toHaveLength(1)
    expect(submits[0].values.omschrijving).toBe('Rode fiets bij de ingang')
  })

  it('without a draft key, Ctrl+S claims no saved draft', async () => {
    const form = await mount()
    await type(form, 'titel', 'Gevonden fiets')
    const ctrlS = (): void => {
      control(field(form, 'titel')).dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 's',
          ctrlKey: true,
          bubbles: true,
          composed: true,
          cancelable: true,
        }),
      )
    }
    ctrlS()
    await form.updateComplete
    expect(form.querySelector<LintjeFormActions>('lintje-form-actions')!.state).toBe('dirty')

    form.setAttribute('draft-key', 'melding')
    await form.updateComplete
    ctrlS()
    await form.updateComplete
    expect(form.querySelector<LintjeFormActions>('lintje-form-actions')!.state).toBe('draft')
  })

  it('a field added while busy is disabled at once, and handed back after', async () => {
    const form = await mount()
    form.busy = true
    await form.updateComplete
    const late = document.createElement('lintje-text-input')
    late.setAttribute('name', 'kenteken')
    form.querySelector('lintje-form-section')!.append(late)
    await tick()
    expect(late.disabled).toBe(true)
    form.busy = false
    await form.updateComplete
    expect(late.disabled).toBe(false)
  })

  it('a field added later gets its value from the draft', async () => {
    localStorage.setItem(
      `${DRAFT_PREFIX}rijen`,
      JSON.stringify({ savedAt: Date.now(), values: { 'rij.2.naam': 'Jansen' } }),
    )
    const form = await mount({ 'draft-key': 'rijen' })
    const row = document.createElement('lintje-text-input')
    row.setAttribute('name', 'rij.2.naam')
    form.querySelector('lintje-form-section')!.append(row)
    await tick()
    expect(row.value).toBe('Jansen')
  })

  it('forgets a field that leaves the form, so it does not come back after a reload', async () => {
    const form = await mount({ 'draft-key': 'rijen' })
    const row = document.createElement('lintje-text-input')
    row.setAttribute('name', 'rij.2.naam')
    form.querySelector('lintje-form-section')!.append(row)
    await tick()
    announce(row, 'Jansen')
    await type(form, 'titel', 'Gevonden fiets')
    expect(JSON.parse(localStorage.getItem(`${DRAFT_PREFIX}rijen`)!).values).toHaveProperty(
      'rij.2.naam',
    )

    row.remove()
    await tick()
    expect(JSON.parse(localStorage.getItem(`${DRAFT_PREFIX}rijen`)!).values).toEqual({
      titel: 'Gevonden fiets',
    })
    expect(form.collect()).not.toHaveProperty('rij.2.naam')

    // A field moved inside the form stays.
    const plaats = field(form, 'plaats')
    form.append(plaats)
    await tick()
    expect(form.collect()).toHaveProperty('plaats', 'Vergaderzaal 2')

    // forget() drops a saved value as well.
    form.forget('plaats')
    expect(form.values).not.toHaveProperty('plaats')
  })

  it('shows the restored draft before any field exists', () => {
    const savedAt = Date.now() - 60_000
    localStorage.setItem(
      `${DRAFT_PREFIX}rijen`,
      JSON.stringify({ savedAt, values: { 'rij.0.naam': 'Jansen' } }),
    )
    const form = document.createElement('lintje-form')
    expect(form.restoredDraft).toBeNull()
    form.setAttribute('draft-key', 'rijen')
    expect(form.restoredDraft).toEqual({ 'rij.0.naam': 'Jansen' })
    expect(form.restoredAt?.getTime()).toBe(savedAt)
  })

  describe('the draft', () => {
    it('is kept under its key and put back into a new form', async () => {
      const form = await mount({ 'draft-key': 'melding' })
      await type(form, 'titel', 'Gevonden fiets')
      const stored = JSON.parse(localStorage.getItem(`${DRAFT_PREFIX}melding`)!)
      expect(stored.values).toEqual({ titel: 'Gevonden fiets' })
      expect(typeof stored.savedAt).toBe('number')
      form.remove()

      const again = await mount({ 'draft-key': 'melding' })
      expect(again.dirty).toBe(true)
      expect(field(again, 'titel').value).toBe('Gevonden fiets')
    })

    it('stays in memory without a key', async () => {
      const form = await mount()
      await type(form, 'titel', 'Gevonden fiets')
      expect(form.dirty).toBe(true)
      expect(localStorage.length).toBe(0)
    })

    it('is dropped when it is older than its lifetime', () => {
      const now = Date.UTC(2026, 9, 4, 12)
      const write = (hoursAgo: number): void =>
        localStorage.setItem(
          `${DRAFT_PREFIX}oud`,
          JSON.stringify({ savedAt: now - hoursAgo * 3_600_000, values: { titel: 'x' } }),
        )
      write(23)
      expect(readDraft('oud', 24, now)?.values).toEqual({ titel: 'x' })
      write(25)
      expect(readDraft('oud', 24, now)).toBeNull()
      expect(localStorage.getItem(`${DRAFT_PREFIX}oud`)).toBeNull()
      write(2)
      expect(readDraft('oud', 1, now)).toBeNull()
    })

    it('is dropped on a save, which the action bar reports', async () => {
      const form = await mount({ 'draft-key': 'melding' })
      await type(form, 'titel', 'Gevonden fiets')
      form.saved(new Date(2026, 9, 4, 10, 42))
      await form.updateComplete
      expect(localStorage.getItem(`${DRAFT_PREFIX}melding`)).toBeNull()
      expect(form.dirty).toBe(false)
      expect(form.values.titel).toBe('Gevonden fiets')
      const actions = form.querySelector<LintjeFormActions>('lintje-form-actions')!
      expect(actions.state).toBe('saved')
      await actions.updateComplete
      expect(actions.shadowRoot!.querySelector('[role="status"]')!.textContent).toContain(
        'Opgeslagen om 10:42',
      )
    })

    it('is thrown away by discardDraft(), and the saved values come back', async () => {
      const form = await mount({ 'draft-key': 'melding' })
      await type(form, 'titel', 'Gevonden fiets')
      form.discardDraft()
      await form.updateComplete
      expect(form.dirty).toBe(false)
      expect(field(form, 'titel').value).toBe('Onbeheerde tas')
      expect(localStorage.getItem(`${DRAFT_PREFIX}melding`)).toBeNull()
    })
  })
})
