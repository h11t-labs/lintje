/**
 * `<lintje-timeline>` — moments along a rail, the oldest first: how something went over time.
 *
 * The host writes every date in Dutch and marks what is still to come; the element never reads
 * the clock. `today` is a stroke on the rail between the last moment that happened and the first
 * planned one. With `limit` the latest moments show first and a button above them shows the rest.
 * Below 768 px every moment stands on one side, its date above its title.
 *
 * Events: `lintje-navigate` `{ href }` for a plain click on a moment's link.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { isPlainClick } from '../../../core/links'
import { MediaController, MOBILE } from '../../../core/media'
import { shadowCss } from '../../../core/styles'
import { renderHeading, type HeadingLevel } from '../../shared/heading'
import { FrameResizeObserver } from '../../shared/frame-resize-observer'
import '../../actions/button/button'
import timelineCss from './timeline.css?inline'

export type TimelineSide = 'start' | 'end'
export type TimelinePlacement = 'start' | 'alternate' | 'sides'

export interface TimelineLink {
  label: string
  href: string
}

export interface TimelineMoment {
  /** The moment as the host wrote it, in Dutch: "3 augustus 2026", "08:12", "Nog niet bekend". */
  when: string
  /** The same moment as ISO 8601, for `<time datetime>`. */
  at?: string
  title: string
  /** A sentence or two under the title. */
  text?: string
  link?: TimelineLink
  /**
   * Still to come: a hollow mark on a dashed rail. Say it in `when` too ("Verwacht vóór 1
   * december 2026"), so it never rests on the drawing alone.
   */
  planned?: boolean
  /** With `placement="sides"`: under the first or the second name of `sides`. */
  side?: TimelineSide
  /**
   * A heading on the rail where it changes from the moment before, such as a year; `when` can
   * then leave it out. Drawn where the moments stand on one side.
   */
  group?: string
}

/** A moment, the group heading before it, or the stroke of today: one item of the list. */
export type TimelineRow =
  | { kind: 'moment'; moment: TimelineMoment; index: number }
  | { kind: 'group'; label: string }
  | { kind: 'today'; label: string }

/** The space between two moments, `--space-8`; a moment on the other side starts twice that lower. */
const GAP = 32
const STEP = 2 * GAP

/** Where the stroke of today stands: before the first planned moment, or after the last. */
export function todayIndex(moments: TimelineMoment[]): number {
  const planned = moments.findIndex((moment) => moment.planned)
  return planned < 0 ? moments.length : planned
}

/** The last moment that happened: the one drawn in the accent. */
export function latestIndex(moments: TimelineMoment[]): number {
  for (let index = moments.length - 1; index >= 0; index--)
    if (!moments[index]!.planned) return index
  return -1
}

export function sideOf(
  moment: TimelineMoment,
  index: number,
  placement: TimelinePlacement,
): TimelineSide {
  if (placement === 'sides') return moment.side ?? 'start'
  if (placement === 'alternate') return index % 2 ? 'start' : 'end'
  return 'end'
}

/** The moments that show: all of them, or the latest `limit`. */
export function shownMoments(
  moments: TimelineMoment[],
  limit: number | undefined,
  expanded: boolean,
): { first: number; hidden: number } {
  if (expanded || !limit || limit >= moments.length) return { first: 0, hidden: 0 }
  const first = moments.length - Math.max(1, limit)
  return { first, hidden: first }
}

/**
 * The rows in reading order. A group heading comes before the first moment of its group, today
 * before the first planned moment; with groups off, only the moments and today.
 */
export function timelineRows(
  moments: TimelineMoment[],
  first: number,
  today: string | undefined,
  groups: boolean,
): TimelineRow[] {
  const rows: TimelineRow[] = []
  const at = todayIndex(moments)
  let group: string | undefined
  moments.forEach((moment, index) => {
    if (index < first) return
    if (today && index === at) rows.push({ kind: 'today', label: today })
    if (groups && moment.group && moment.group !== group) {
      rows.push({ kind: 'group', label: moment.group })
    }
    group = moment.group
    rows.push({ kind: 'moment', moment, index })
  })
  if (today && at === moments.length) rows.push({ kind: 'today', label: today })
  return rows
}

/**
 * The top of each item when the moments stand on two sides: never above the one before it, at
 * least `STEP` below it, and `GAP` below the last one on its own side.
 */
export function stagger(items: { side: TimelineSide; height: number }[]): number[] {
  const bottom: Record<TimelineSide, number> = { start: -GAP, end: -GAP }
  let previous = -STEP
  return items.map(({ side, height }) => {
    const top = Math.max(previous + STEP, bottom[side] + GAP)
    previous = top
    bottom[side] = top + height
    return top
  })
}

/** The row from which the rail is dashed: today, else the last moment that happened. */
function boundary(rows: TimelineRow[], moments: TimelineMoment[]): number {
  const today = rows.findIndex((row) => row.kind === 'today')
  if (today >= 0) return today
  if (!moments.some((moment) => moment.planned)) return Infinity
  const latest = latestIndex(moments)
  return rows.findIndex((row) => row.kind === 'moment' && row.index === latest)
}

export class LintjeTimeline extends LintjeElement {
  static override styles = shadowCss(timelineCss)

  static override properties: PropertyDeclarations = {
    moments: { attribute: false },
    heading: { type: String },
    level: { type: Number },
    placement: { type: String, reflect: true },
    sides: { attribute: false },
    today: { type: String },
    limit: { type: Number },
    empty: { type: String },
    expanded: { state: true },
  }

  /** The moments, the oldest first. */
  moments: TimelineMoment[] = []
  declare heading?: string
  /** The heading's level on the page. */
  level: HeadingLevel = 3
  /** `start`: on one side, the date before the rail. `alternate`: in turn. `sides`: by `side`. */
  placement: TimelinePlacement = 'start'
  /** The names over the two sides with `placement="sides"`: `['U', 'Wij']`. */
  declare sides?: [string, string]
  /** The label of today on the rail: "Vandaag, 21 oktober". */
  declare today?: string
  /** How many of the latest moments show before "Toon eerdere"; all of them without it. */
  declare limit?: number
  /** The sentence that stands without moments. */
  empty: string = 'Er is nog niets gebeurd.'
  protected expanded = false

  #mobile = new MediaController(this, MOBILE)
  #resize = new FrameResizeObserver(() => this.fit())

  override connectedCallback(): void {
    super.connectedCallback()
    this.#resize.observe(this)
  }

  override disconnectedCallback(): void {
    this.#resize.disconnect()
    super.disconnectedCallback()
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.fit()
  }

  private get twoSided(): boolean {
    return this.placement !== 'start' && !this.#mobile.matches
  }

  /** On two sides the items stand where `stagger` puts them; the spine runs between the marks. */
  private fit(): void {
    const list = this.renderRoot.querySelector<HTMLElement>('.lintje-timeline__list--sides')
    if (!list) return
    const items = [...list.children] as HTMLElement[]
    const tops = stagger(
      items.map((item) => ({
        side: item.classList.contains('lintje-timeline__row--start') ? 'start' : 'end',
        height: item.getBoundingClientRect().height,
      })),
    )
    let height = 0
    const centres: number[] = []
    items.forEach((item, index) => {
      const top = tops[index]!
      item.style.setProperty('top', `${top}px`)
      height = Math.max(height, top + item.getBoundingClientRect().height)
      const mark = item.querySelector<HTMLElement>('.lintje-timeline__mark, .lintje-timeline__tick')
      centres.push(top + (mark ? mark.offsetTop + mark.offsetHeight / 2 : 0))
    })
    list.style.setProperty('height', `${height}px`)
    const dashed = this.renderRoot.querySelector<HTMLElement>('.lintje-timeline__spine--planned')
    const solid = this.renderRoot.querySelector<HTMLElement>('.lintje-timeline__spine--done')
    const firstY = centres[0] ?? 0
    const lastY = centres.at(-1) ?? 0
    const split = Number(list.dataset.boundary)
    const splitY =
      Number.isFinite(split) && split >= 0 ? centres[split]! : split < 0 ? firstY : lastY
    solid?.style.setProperty('top', `${firstY}px`)
    solid?.style.setProperty('height', `${Math.max(0, splitY - firstY)}px`)
    dashed?.style.setProperty('top', `${splitY}px`)
    dashed?.style.setProperty('height', `${Math.max(0, lastY - splitY)}px`)
  }

  private async showEarlier(): Promise<void> {
    this.expanded = true
    await this.updateComplete
    const first = this.renderRoot.querySelector<HTMLElement>('.lintje-timeline__row--moment')
    if (!first) return
    first.tabIndex = -1
    first.focus()
  }

  private onLink(event: MouseEvent, href: string): void {
    if (isPlainClick(event)) this.followLink(href, event)
  }

  private renderDate(moment: TimelineMoment, prefix?: string): TemplateResult {
    const when = prefix ? `${prefix} · ${moment.when}` : moment.when
    return moment.at
      ? html`<time class="lintje-timeline__date" datetime=${moment.at}>${when}</time>`
      : html`<span class="lintje-timeline__date">${when}</span>`
  }

  private renderContent(moment: TimelineMoment): TemplateResult {
    const link = moment.link
    return html`<p class="lintje-timeline__title">${moment.title}</p>
      ${moment.text ? html`<p class="lintje-timeline__text">${moment.text}</p>` : nothing}
      ${
        link
          ? html`<a
              class="lintje-timeline__link"
              href=${link.href}
              @click=${(event: MouseEvent) => this.onLink(event, link.href)}
              >${link.label}</a
            >`
          : nothing
      }`
  }

  /** The name of a moment's side, in front of its date where the sides are not drawn. */
  private sideName(moment: TimelineMoment): string | undefined {
    if (this.placement !== 'sides' || !this.sides) return undefined
    return this.sides[moment.side === 'end' ? 1 : 0]
  }

  private rowClasses(row: TimelineRow, latest: number): Record<string, boolean> {
    return {
      'lintje-timeline__row': true,
      [`lintje-timeline__row--${row.kind}`]: true,
      'is-planned': row.kind === 'moment' && !!row.moment.planned,
      'is-latest': row.kind === 'moment' && row.index === latest,
    }
  }

  /** The rail of one row on one side: a stub up to the mark, the mark, and the line down. */
  private renderRail(row: TimelineRow, at: number, count: number, split: number): TemplateResult {
    const up = at > split ? 'is-dashed' : ''
    const down = at >= split ? 'is-dashed' : ''
    const firstHidden = at === 0 && !this.hiddenBefore
    const last = at === count - 1
    // A group's tick and today's stroke cross the rail where a moment has its mark.
    const mark =
      row.kind === 'moment'
        ? html`<span class="lintje-timeline__mark"></span>`
        : html`<span class="lintje-timeline__tick"></span>`
    return html`<span class="lintje-timeline__rail" aria-hidden="true"
      ><span class="lintje-timeline__stub ${up} ${firstHidden ? 'is-hidden' : ''}"></span
      >${mark}<span class="lintje-timeline__line ${down} ${last ? 'is-hidden' : ''}"></span
    ></span>`
  }

  private hiddenBefore = 0

  /** One side: a date column before the rail, or on a phone the date above the title. */
  private renderOneSide(rows: TimelineRow[], latest: number, split: number): TemplateResult {
    const stack = this.#mobile.matches
    return html`<ol
      class=${classMap({
        'lintje-timeline__list': true,
        'lintje-timeline__list--start': !stack,
        'lintje-timeline__list--stack': stack,
      })}
      aria-labelledby=${this.heading ? 'lintje-timeline-heading' : nothing}
    >
      ${rows.map((row, at) => {
        const rail = this.renderRail(row, at, rows.length, split)
        if (row.kind === 'moment') {
          const name = this.sideName(row.moment)
          return html`<li class=${classMap(this.rowClasses(row, latest))}>
            ${stack ? nothing : html`<span class="lintje-timeline__when">${this.renderDate(row.moment)}</span>`}
            ${rail}
            <div class="lintje-timeline__body">
              ${stack ? this.renderDate(row.moment, name) : nothing}${this.renderContent(row.moment)}
            </div>
          </li>`
        }
        if (row.kind === 'group') {
          return html`<li class=${classMap(this.rowClasses(row, latest))}>
            ${stack ? nothing : html`<span class="lintje-timeline__group">${row.label}</span>`}
            ${rail}
            ${stack ? html`<span class="lintje-timeline__group">${row.label}</span>` : html`<span></span>`}
          </li>`
        }
        return html`<li class=${classMap(this.rowClasses(row, latest))}>
          ${stack ? nothing : html`<span></span>`} ${rail}
          <span class="lintje-timeline__today">${row.label}</span>
        </li>`
      })}
    </ol>`
  }

  /** Two sides: the spine in the middle, each moment beside it; `fit` places them. */
  private renderTwoSides(rows: TimelineRow[], latest: number, split: number): TemplateResult {
    const names = this.placement === 'sides' ? this.sides : undefined
    return html`${
      names
        ? html`<div class="lintje-timeline__heads" aria-hidden="true">
            <span class="lintje-timeline__head lintje-timeline__head--start">${names[0]}</span>
            <span class="lintje-timeline__head lintje-timeline__head--end">${names[1]}</span>
          </div>`
        : nothing
    }
      <div class="lintje-timeline__track">
        <span class="lintje-timeline__spine lintje-timeline__spine--done" aria-hidden="true"></span>
        <span class="lintje-timeline__spine lintje-timeline__spine--planned" aria-hidden="true"></span>
        <ol
          class="lintje-timeline__list lintje-timeline__list--sides"
          data-boundary=${String(split)}
          aria-labelledby=${this.heading ? 'lintje-timeline-heading' : nothing}
        >
          ${rows.map((row) => {
            if (row.kind === 'today') {
              return html`<li class="lintje-timeline__row lintje-timeline__row--today lintje-timeline__row--end">
                <span class="lintje-timeline__tick" aria-hidden="true"></span>
                <span class="lintje-timeline__today">${row.label}</span>
              </li>`
            }
            if (row.kind !== 'moment') return nothing
            const side = sideOf(row.moment, row.index, this.placement)
            const name = this.sideName(row.moment)
            return html`<li
              class=${classMap({ ...this.rowClasses(row, latest), [`lintje-timeline__row--${side}`]: true })}
            >
              <div class="lintje-timeline__body">
                ${name ? html`<span class="visually-hidden">${name}: </span>` : nothing}
                ${this.renderDate(row.moment)}${this.renderContent(row.moment)}
              </div>
              <span class="lintje-timeline__mark" aria-hidden="true"></span>
            </li>`
          })}
        </ol>
      </div>`
  }

  protected override render(): TemplateResult {
    const heading = this.heading
      ? renderHeading(
          this.level,
          'lintje-timeline__heading',
          this.heading,
          'lintje-timeline-heading',
        )
      : nothing
    if (!this.moments.length) {
      return html`<section class="lintje-timeline">
        ${heading}
        <p class="lintje-timeline__empty">${this.empty}</p>
      </section>`
    }
    const { first, hidden } = shownMoments(this.moments, this.limit, this.expanded)
    this.hiddenBefore = hidden
    const twoSided = this.twoSided
    const rows = timelineRows(this.moments, first, this.today, !twoSided)
    const latest = latestIndex(this.moments)
    const split = boundary(rows, this.moments)
    return html`<section class="lintje-timeline">
      ${heading}
      ${
        hidden > 0
          ? html`<lintje-button
              class="lintje-timeline__more"
              variant="link"
              @click=${() => void this.showEarlier()}
              >${hidden === 1 ? 'Toon 1 eerder moment' : `Toon ${hidden} eerdere momenten`}</lintje-button
            >`
          : nothing
      }
      ${twoSided ? this.renderTwoSides(rows, latest, split) : this.renderOneSide(rows, latest, split)}
    </section>`
  }
}

define('lintje-timeline', LintjeTimeline)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-timeline': LintjeTimeline
  }
}
