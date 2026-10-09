/** The job list: a work-list row per state, the right action and event, and the change read out once. */
import { describe, expect, it } from 'vitest'
import './job-list'
import { spokenState, type Job, type LintjeJobList } from './job-list'
import type { LintjeList } from '../../tables/list/list'

const JOBS: Job[] = [
  {
    id: 'q',
    name: 'Overdracht nachtdienst.m4a',
    state: 'queued',
    detail: 'Plaats 2 in de wachtrij',
  },
  { id: 'b', name: 'Briefing ochtenddienst.m4a', state: 'busy', progress: 62 },
  { id: 'p', name: 'Hoorzitting zaal 4.wav', state: 'paused', progress: 40 },
  { id: 'd', name: 'Teamoverleg 2 oktober.m4a', state: 'done', href: '/opnames/d' },
  { id: 'e', name: 'Interview 3.wav', state: 'error', detail: 'Het bestand is beschadigd' },
  { id: 'c', name: 'Proefopname.mp3', state: 'cancelled' },
]

async function mount(jobs: Job[] = JOBS): Promise<LintjeJobList> {
  const element = Object.assign(document.createElement('lintje-job-list'), { jobs })
  document.body.append(element)
  await element.updateComplete
  await list(element)?.updateComplete
  return element
}

// The rows are the work list's, one shadow root further in.
const list = (element: LintjeJobList): LintjeList | null =>
  element.shadowRoot!.querySelector('lintje-list')
const rows = (element: LintjeJobList): HTMLElement[] => [
  ...(list(element)?.shadowRoot!.querySelectorAll<HTMLElement>('.lintje-list__row') ?? []),
]

describe('lintje-job-list', () => {
  it('draws one list item per job with its badge', async () => {
    const element = await mount()
    expect(list(element)!.shadowRoot!.querySelector('ul')).not.toBeNull()
    const badges = rows(element).map((row) => {
      const badge = row.querySelector('lintje-badge')!
      return `${badge.getAttribute('tone')}:${badge.textContent}`
    })
    expect(badges).toEqual([
      'neutral:Wachtrij',
      'busy:Bezig',
      'warning:Onderbroken',
      'success:Klaar',
      'error:Mislukt',
      'subtle:Geannuleerd',
    ])
  })

  it('draws a bar only where a percentage exists, muted where it broke off', async () => {
    const element = await mount()
    const bars = rows(element).map((row) => row.querySelector('lintje-progress-bar'))
    expect(bars.map((bar) => bar !== null)).toEqual([false, true, true, false, false, false])
    expect(bars[1]!.value).toBe(62)
    expect(bars[1]!.hideLabel).toBe(true)
    expect(bars[2]!.tone).toBe('paused')
  })

  it('opens running work that has somewhere to go, and keeps its action in sight', async () => {
    const element = document.createElement('lintje-job-list')
    element.jobs = [{ id: 'l', name: 'Weekendbezetting', state: 'busy', href: '/opnames/l' }]
    document.body.append(element)
    await element.updateComplete
    const row = rows(element)[0]!
    expect([...row.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual([
      '/opnames/l',
    ])
    expect(row.textContent).toContain('Annuleren')
  })

  it('links a done job by its name alone, with "Verwijderen" behind its menu', async () => {
    const element = await mount()
    const done = rows(element)[3]!
    const links = [...done.querySelectorAll('a')]
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/opnames/d'])
    expect(done.querySelector('lintje-button')).toBeNull()
    expect(done.querySelector('lintje-menu-button')!.items).toEqual([
      { value: 'lintje-job-remove', label: 'Verwijderen' },
    ])
  })

  it('opens a done job from anywhere on its row, as lintje-navigate', async () => {
    const element = await mount()
    const heard: unknown[] = []
    element.addEventListener('lintje-navigate', (event) => {
      event.preventDefault()
      heard.push((event as CustomEvent).detail)
    })
    let rowClicks = 0
    element.addEventListener('lintje-row-click', () => (rowClicks += 1))
    rows(element)[3]!.click()
    rows(element)[0]!.click()
    expect(heard).toEqual([{ href: '/opnames/d' }])
    expect(rowClicks).toBe(0)
  })

  it('sends the id with the action of each state', async () => {
    const element = await mount()
    const heard: string[] = []
    for (const name of [
      'lintje-job-cancel',
      'lintje-job-resume',
      'lintje-job-retry',
      'lintje-job-remove',
    ]) {
      element.addEventListener(name, (event) =>
        heard.push(`${name}:${(event as CustomEvent).detail}`),
      )
    }
    for (const row of rows(element)) row.querySelector<HTMLElement>('lintje-button')?.click()
    expect(heard).toEqual([
      'lintje-job-cancel:q',
      'lintje-job-cancel:b',
      'lintje-job-resume:p',
      'lintje-job-retry:e',
      'lintje-job-remove:c',
    ])
  })

  it('names the job in each action for a screen reader', async () => {
    const element = await mount()
    const action = rows(element)[0]!.querySelector('lintje-button')!
    expect(action.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      'Annuleren Overdracht nachtdienst.m4a',
    )
  })

  it('reads a job that changed state once, and not a moving percentage', async () => {
    const element = await mount()
    const status = (): string => element.shadowRoot!.querySelector('[role="status"]')!.textContent!
    expect(status()).toBe('')

    element.jobs = JOBS.map((job) => (job.id === 'b' ? { ...job, progress: 70 } : job))
    await element.updateComplete
    expect(status()).toBe('')

    element.jobs = JOBS.map((job) => (job.id === 'b' ? { ...job, state: 'done' } : job))
    await element.updateComplete
    expect(status()).toBe('Briefing ochtenddienst.m4a is klaar.')

    element.jobs = JOBS.map((job) =>
      job.id === 'q' ? { ...job, state: 'error', detail: 'Het bestand is beschadigd' } : job,
    )
    await element.updateComplete
    expect(status()).toBe(
      'Overdracht nachtdienst.m4a is mislukt. Het bestand is beschadigd. Briefing ochtenddienst.m4a wordt verwerkt.',
    )
  })

  it('says every state as a whole sentence, a failure with its reason', () => {
    const said = (state: Job['state'], detail?: string): string =>
      spokenState({ id: 'x', name: 'Rapport.docx', state, detail })
    expect(said('queued')).toBe('Rapport.docx staat in de wachtrij.')
    expect(said('busy', 'Stap 2 van 3')).toBe('Rapport.docx wordt verwerkt.')
    expect(said('paused')).toBe('Rapport.docx is onderbroken.')
    expect(said('done')).toBe('Rapport.docx is klaar.')
    expect(said('cancelled')).toBe('Rapport.docx is geannuleerd.')
    expect(said('error')).toBe('Rapport.docx is mislukt.')
    expect(said('error', 'Het bestand is te groot.')).toBe(
      'Rapport.docx is mislukt. Het bestand is te groot.',
    )
  })

  it('passes its heading level to the list', async () => {
    const element = await mount(JOBS.map((job) => ({ ...job, group: 'Vandaag' })))
    element.headingLevel = 4
    await element.updateComplete
    await list(element)!.updateComplete
    const heading = list(element)!.shadowRoot!.querySelector('[role="heading"]')!
    expect(heading.getAttribute('aria-level')).toBe('4')
  })

  it('gives a done job without a result neither a link nor an action in sight', async () => {
    const element = await mount([{ id: 'd', name: 'Klaar.m4a', state: 'done' }])
    const row = rows(element)[0]!
    expect(row.querySelector('a, lintje-button')).toBeNull()
    expect(row.classList.contains('is-static')).toBe(true)
  })

  it('draws nothing but its status region for an empty queue', async () => {
    const element = await mount([])
    expect(list(element)).toBeNull()
    expect(element.shadowRoot!.querySelector('[role="status"]')).not.toBeNull()
  })

  it('leaves "Klaar" out where every job is done', async () => {
    const element = await mount([
      { id: 'd1', name: 'Eerste.m4a', state: 'done', href: '/opnames/d1' },
      { id: 'd2', name: 'Tweede.m4a', state: 'done', href: '/opnames/d2' },
    ])
    expect(rows(element).map((row) => row.querySelector('lintje-badge'))).toEqual([null, null])
  })
})
