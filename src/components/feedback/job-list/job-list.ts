/**
 * `<lintje-job-list>` — the queue of long tasks: what runs, what is done and what went wrong. Its
 * rows are the work list's rows (`lintje-list`): the state as a word, the progress as a bar, one
 * action in plain sight per state, and a row with an `href` opening it: a done job's result, or
 * what runs where it can be followed (a live recording). "Verwijderen" is behind a done job's ⋮. Where every job is done, "Klaar" is left out: in a list of finished work alone
 * the state is noise.
 *
 * A job that changes state is read out once, as a sentence ("Rapport.docx is mislukt. Het
 * bestand is beschadigd."), from a status region of its own; the list itself is not live, so a
 * moving percentage does not chatter. It never fetches: the host sets `jobs` again when a job
 * moves. When the last job goes with the focus on it, the focus goes to that region.
 *
 * Events: `lintje-job-cancel`, `lintje-job-retry`, `lintje-job-resume`, `lintje-job-remove`
 * (detail: the job's id), `lintje-navigate` `{ href }` (a row with an `href`; cancel it to route).
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { holdsFocus } from '../../../core/focus'
import { shadowCss } from '../../../core/styles'
import '../../tables/list/list'
import type { ListItem } from '../../tables/list/list'
import type { BadgeTone } from '../../../primitives/badge/badge'
import jobListCss from './job-list.css?inline'

export type JobState = 'queued' | 'busy' | 'paused' | 'done' | 'error' | 'cancelled'

export interface Job {
  id: string
  name: string
  state: JobState
  /** One line under the name: the step and time left, the queue place, or the error reason. */
  detail?: string
  /** 0–100, for a busy job or where a paused one broke off. */
  progress?: number | null
  /** Where it opens: a done job's result, or work that can be followed while it runs. */
  href?: string
  /** The kind of work, as an icon file name. */
  icon?: string
  /** The moment, on the right: "vandaag 10:12". */
  meta?: string
  /** The heading consecutive jobs stand under ("Vandaag"). */
  group?: string
}

type JobEvent = 'lintje-job-cancel' | 'lintje-job-retry' | 'lintje-job-resume' | 'lintje-job-remove'

const STATE: Record<JobState, { label: string; tone: BadgeTone }> = {
  queued: { label: 'Wachtrij', tone: 'neutral' },
  busy: { label: 'Bezig', tone: 'busy' },
  paused: { label: 'Onderbroken', tone: 'warning' },
  done: { label: 'Klaar', tone: 'success' },
  error: { label: 'Mislukt', tone: 'error' },
  cancelled: { label: 'Geannuleerd', tone: 'subtle' },
}

/** What a job that moved to a state is read out as. */
const SPOKEN: Record<JobState, (name: string) => string> = {
  queued: (name) => `${name} staat in de wachtrij.`,
  busy: (name) => `${name} wordt verwerkt.`,
  paused: (name) => `${name} is onderbroken.`,
  done: (name) => `${name} is klaar.`,
  error: (name) => `${name} is mislukt.`,
  cancelled: (name) => `${name} is geannuleerd.`,
}

/** The sentence for a job's new state; a failure says why, when the job says it. */
export function spokenState(job: Job): string {
  const sentence = SPOKEN[job.state](job.name)
  const why = job.state === 'error' ? job.detail?.trim() : ''
  if (!why) return sentence
  return `${sentence} ${why}${/[.!?]$/.test(why) ? '' : '.'}`
}

const ACTION: Partial<Record<JobState, { label: string; event: JobEvent }>> = {
  queued: { label: 'Annuleren', event: 'lintje-job-cancel' },
  busy: { label: 'Annuleren', event: 'lintje-job-cancel' },
  paused: { label: 'Hervatten', event: 'lintje-job-resume' },
  error: { label: 'Opnieuw', event: 'lintje-job-retry' },
  cancelled: { label: 'Verwijderen', event: 'lintje-job-remove' },
}

/** A job as a work-list row: its state, its bar while it runs, and its one action. */
export function jobRow(job: Job, quiet = false): ListItem {
  const measured = typeof job.progress === 'number' && !Number.isNaN(job.progress)
  const action = ACTION[job.state]
  const done = job.state === 'done'
  return {
    id: job.id,
    title: job.name,
    // A row opens where the host gave it somewhere to go; its action stays in plain sight.
    clickable: Boolean(job.href),
    href: job.href,
    sub: job.detail,
    meta: job.meta,
    icon: job.icon,
    group: job.group,
    status: quiet && done ? undefined : STATE[job.state],
    progress:
      measured && (job.state === 'busy' || job.state === 'paused') ? job.progress : undefined,
    action: action ? { label: action.label, value: action.event } : undefined,
    actions: done ? [{ value: 'lintje-job-remove', label: 'Verwijderen' }] : undefined,
  }
}

export class LintjeJobList extends LintjeElement {
  static override styles = shadowCss(jobListCss)

  static override properties: PropertyDeclarations = {
    jobs: { attribute: false },
    headingLevel: { type: Number, attribute: 'heading-level' },
    spoken: { state: true },
  }

  jobs: Job[] = []
  /** The level of a group's heading ("Vandaag"), as on `lintje-list`. */
  headingLevel: 2 | 3 | 4 | 5 | 6 = 3
  spoken: string = ''

  private known = new Map<string, JobState>()
  private emptiedWithFocus = false

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (!changed.has('jobs')) return
    const list = this.renderRoot.querySelector('lintje-list')
    this.emptiedWithFocus = !this.jobs?.length && Boolean(list && holdsFocus(list))
    const first = this.known.size === 0
    const moved: string[] = []
    const next = new Map<string, JobState>()
    for (const job of this.jobs ?? []) {
      next.set(job.id, job.state)
      const before = this.known.get(job.id)
      if (!first && before !== job.state) moved.push(spokenState(job))
    }
    this.known = next
    if (moved.length) this.spoken = moved.join(' ')
    else if (this.emptiedWithFocus) this.spoken = 'Er staan geen taken meer in de lijst.'
  }

  // With the list gone there is no row left to go to: the region says the list is empty.
  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (!this.emptiedWithFocus) return
    this.emptiedWithFocus = false
    const region = this.renderRoot.querySelector<HTMLElement>('[role="status"]')
    if (!region) return
    region.tabIndex = -1
    region.focus()
  }

  // A row's action becomes the job's event.
  private onAction(event: CustomEvent<{ id: string; value: string }>): void {
    event.stopPropagation()
    const { id, value } = event.detail
    if (value.startsWith('lintje-job-')) this.emit(value as JobEvent, id)
  }

  // A done job's row opens its result, on its name or beside it: the list's click is taken over.
  private onRowClick(event: CustomEvent<{ id: string; href?: string }>): void {
    event.stopPropagation()
    event.preventDefault()
    if (event.detail.href) this.followLink(event.detail.href)
  }

  protected override render(): TemplateResult {
    // An empty queue draws nothing: the host decides what an empty page says.
    const jobs = this.jobs ?? []
    return html`${
      jobs.length
        ? html`<lintje-list
            class="lintje-job-list"
            heading-level=${this.headingLevel}
            .items=${jobs.map((job) =>
              jobRow(
                job,
                jobs.every((other) => other.state === 'done'),
              ),
            )}
            @lintje-row-action=${this.onAction}
            @lintje-row-click=${this.onRowClick}
          ></lintje-list>`
        : nothing
    }
      <p class="visually-hidden" role="status">${this.spoken}</p>`
  }
}

define('lintje-job-list', LintjeJobList)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-job-list': LintjeJobList
  }
}
