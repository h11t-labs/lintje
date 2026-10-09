/**
 * The error summary: it counts the fields, draws nothing when there is nothing wrong, and a link
 * puts the focus in the field it names.
 */
import { describe, expect, it } from 'vitest'
import './error-summary'
import '../../inputs/text-input/text-input'
import { findField, summaryHeading, type LintjeErrorSummary } from './error-summary'

async function mount(props: Partial<LintjeErrorSummary>): Promise<LintjeErrorSummary> {
  const element = Object.assign(document.createElement('lintje-error-summary'), props)
  document.body.append(element)
  await element.updateComplete
  return element
}

const box = (element: LintjeErrorSummary): HTMLElement | null =>
  element.shadowRoot!.querySelector('.lintje-error-summary')

describe('lintje-error-summary', () => {
  it('counts the fields in its heading, singular and plural', () => {
    expect(summaryHeading(1)).toBe('Controleer 1 veld')
    expect(summaryHeading(2)).toBe('Controleer 2 velden')
  })

  it('draws nothing without errors', async () => {
    const element = await mount({})
    expect(box(element)).toBeNull()
  })

  it('is an alert named by its heading, with one link per field', async () => {
    const element = await mount({
      items: [
        { field: 'titel', label: 'Titel', message: 'er is vandaag al een melding met deze titel' },
        { field: 'omschrijving', message: 'Omschrijving is verplicht' },
      ],
    })
    const frame = box(element)!
    expect(frame.getAttribute('role')).toBe('alert')
    expect(frame.getAttribute('tabindex')).toBe('-1')
    const heading = element.shadowRoot!.getElementById(frame.getAttribute('aria-labelledby')!)!
    expect(heading.textContent).toBe('Controleer 2 velden')
    const links = Array.from(frame.querySelectorAll('a'))
    expect(links.map((link) => link.textContent)).toEqual([
      'Titel: er is vandaag al een melding met deze titel',
      'Omschrijving is verplicht',
    ])
    expect(links[0].getAttribute('href')).toBe('#titel')
  })

  it('says an error without a field as a sentence, with a retry that asks', async () => {
    const element = await mount({
      message: 'De server gaf geen antwoord.',
      retry: 'Opnieuw proberen',
    })
    expect(element.shadowRoot!.querySelector('h3')!.textContent).toBe('Opslaan is niet gelukt')
    let retries = 0
    element.addEventListener('lintje-retry', () => retries++)
    element.shadowRoot!.querySelector<HTMLElement>('lintje-button')!.click()
    expect(retries).toBe(1)
  })

  it('finds the field by name in the document, and in the light DOM of a shadow host', async () => {
    const field = document.createElement('lintje-text-input')
    field.name = 'kenteken'
    document.body.append(field)
    const summary = await mount({})
    expect(findField(summary, 'kenteken')).toBe(field)

    const host = document.createElement('div')
    const root = host.attachShadow({ mode: 'open' })
    const inner = document.createElement('lintje-error-summary')
    root.append(inner)
    const light = document.createElement('input')
    light.name = 'plaats'
    host.append(light)
    document.body.append(host)
    expect(findField(inner, 'plaats')).toBe(light)
  })

  it('a link puts the focus in the field', async () => {
    const field = document.createElement('lintje-text-input')
    field.name = 'locatie'
    document.body.append(field)
    await field.updateComplete
    const element = await mount({ items: [{ field: 'locatie', message: 'Locatie is verplicht' }] })
    const scrolls: unknown[] = []
    field.scrollIntoView = (options?: boolean | ScrollIntoViewOptions) => scrolls.push(options)
    element.shadowRoot!.querySelector('a')!.click()
    expect(field.shadowRoot!.activeElement).toBe(field.shadowRoot!.querySelector('input'))
    // The middle of the view: a nested field has no scroll margin to clear the bars with.
    expect(scrolls).toEqual([{ block: 'center' }])
  })
})
