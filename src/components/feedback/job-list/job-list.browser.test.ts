/** The job list in a browser: the focus stays in the list when a job's control changes or goes. */
import { afterEach, describe, expect, it } from 'vitest'
import { deepActiveElement } from '../../../core/focus'
import './job-list'
import type { Job, LintjeJobList } from './job-list'
import type { LintjeList } from '../../tables/list/list'

const BUSY: Job = { id: 'b', name: 'Rapport.docx', state: 'busy', progress: 40 }

async function settle(element: LintjeJobList): Promise<void> {
  await element.updateComplete
  for (let round = 0; round < 3; round += 1) await new Promise((done) => setTimeout(done))
}

async function mount(jobs: Job[]): Promise<LintjeJobList> {
  const element = Object.assign(document.createElement('lintje-job-list'), { jobs })
  document.body.append(element)
  await settle(element)
  return element
}

const row = (element: LintjeJobList): HTMLElement =>
  element
    .shadowRoot!.querySelector<LintjeList>('lintje-list')!
    .shadowRoot!.querySelector<HTMLElement>('.lintje-list__row')!

afterEach(() => {
  document.body.replaceChildren()
})

describe('lintje-job-list keeps the focus', () => {
  it('on the ⋮ of a job that is done while its "Annuleren" had the focus', async () => {
    const element = await mount([BUSY])
    row(element).querySelector('lintje-button')!.focus()
    element.jobs = [{ ...BUSY, state: 'done', href: '/rapport' }]
    await settle(element)
    const trigger = row(element)
      .querySelector('lintje-menu-button')!
      .shadowRoot!.querySelector('button')
    expect(deepActiveElement()).toBe(trigger)
  })

  it('on its status region, which says so, when the last job goes with the focus', async () => {
    const element = await mount([{ ...BUSY, state: 'cancelled' }])
    row(element).querySelector('lintje-button')!.focus()
    element.jobs = []
    await settle(element)
    const region = element.shadowRoot!.querySelector('[role="status"]')!
    expect(deepActiveElement()).toBe(region)
    expect(region.textContent).toBe('Er staan geen taken meer in de lijst.')
  })
})
