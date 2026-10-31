/**
 * `<lintje-timeline>` — moments along a rail: how something went over time, or who did what.
 *
 * The host gives the moments in the order they stand and writes every date in Dutch; the element
 * never reads the clock. Where now is follows from the data: planned moments sit at the end still
 * to come; without them the first and last `at` decide; without those, the oldest comes first.
 * From there come the accent on the last moment that happened, the stroke of `today`, and which
 * moments `limit` keeps back behind "Toon eerdere". A moment has three lines: the date and a label
 * above, the title, and under it a sentence, a link and its own slot. Lying, every moment stands
 * at its place in time; a row that does not fit stands up. Below 768 px every moment stands on one
 * side.
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
import { styleProps } from '../../../core/style-props'
import { renderHeading, type HeadingLevel } from '../../shared/heading'
import { FrameResizeObserver } from '../../shared/frame-resize-observer'
import { avatarStyles, renderAvatar } from '../../shared/avatar'
import { iconStyles } from '../../../icons/render'
import '../../actions/button/button'
import '../person/person'
import type { Person } from '../../../types'
import timelineCss from './timeline.css?inline'

export type TimelineSide = 'start' | 'end'
export type TimelinePlacement = 'start' | 'alternate' | 'sides'
export type TimelineOrientation = 'vertical' | 'horizontal'

/** Who did something when that is no person: a name and the icon in its circle. */
export interface TimelineActor {
  name: string
  /** The icon's file name; the cogs (`gereedschap-tandwielen`) without it. */
  icon?: string
}

export interface TimelineLink {
  label: string
  href: string
}

export interface TimelineMoment {
  /** The moment as the host wrote it, in Dutch: "3 augustus 2026", "08:12", "Nog niet bekend". */
  when: string
  /**
   * The same moment as ISO 8601, for `<time datetime>` and for its place on a lying rail. A moment
   * without it stands apart after the end of that rail.
   */
  at?: string
  /** A word or two after the date, above the title: whose step or what kind ("Uw actie"). */
  label?: string
  /** What happened. After `who` it is the rest of the sentence: "wijzigde de omschrijving". */
  title: string
  /**
   * Who did it: someone, with the circle before the name and a link with `href`; or what is no
   * person ("Systeem"), a name with an icon in the circle: the cogs, or the one `icon` names.
   */
  who?: string | Person | TimelineActor
  /** A sentence or two under the title. */
  text?: string
  link?: TimelineLink
  /**
   * The name of the moment's slot: a child of `<lintje-timeline>` with `slot="<value>"` stands
   * under the sentence and the link, a badge or an attachment, any Lintje element or plain HTML.
   */
  value?: string
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
  | { kind: 'group'; label: string; future: boolean }
  | { kind: 'today'; label: string }

/** The space between two moments, `--space-8`; a moment on the other side starts twice that lower. */
const GAP = 32
const STEP = 2 * GAP

const time = (at: string | undefined): number | undefined => {
  const value = at ? Date.parse(at) : NaN
  return Number.isFinite(value) ? value : undefined
}

/**
 * Whether the newest moment comes first. Planned moments sit at the end still to come; without
 * them the first and last moment with a time decide; without those, the oldest comes first.
 */
export function newestFirst(moments: TimelineMoment[]): boolean {
  const first = !!moments[0]?.planned
  const last = !!moments.at(-1)?.planned
  if (first !== last) return first
  const times = moments.map((moment) => time(moment.at)).filter((value) => value !== undefined)
  return times.length > 1 && times[0]! > times.at(-1)!
}

/** Where the stroke of today stands: between what happened and what is planned. */
export function todayIndex(moments: TimelineMoment[], newest: boolean): number {
  if (newest) {
    for (let index = moments.length - 1; index >= 0; index--) {
      if (moments[index]!.planned) return index + 1
    }
    return 0
  }
  const planned = moments.findIndex((moment) => moment.planned)
  return planned < 0 ? moments.length : planned
}

/** The last moment that happened: the one drawn in the accent. */
export function latestIndex(moments: TimelineMoment[], newest: boolean): number {
  if (newest) return moments.findIndex((moment) => !moment.planned)
  for (let index = moments.length - 1; index >= 0; index--) {
    if (!moments[index]!.planned) return index
  }
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

/**
 * The moments that show, `from` up to `to`: all of them, or the `limit` nearest now and as many
 * more as the reader asked for. The ones kept back are the oldest, at whichever end they are.
 */
export function shownMoments(
  moments: TimelineMoment[],
  limit: number | undefined,
  more: number,
  newest: boolean,
): { from: number; to: number; hidden: number } {
  const count = limit ? Math.min(moments.length, Math.max(1, limit) + more) : moments.length
  const hidden = moments.length - count
  return newest ? { from: 0, to: count, hidden } : { from: hidden, to: moments.length, hidden }
}

/**
 * The rows in reading order. A group heading comes before the first moment of its group, today
 * between what happened and what is planned; with groups off, only the moments and today.
 */
export function timelineRows(
  moments: TimelineMoment[],
  from: number,
  to: number,
  today: string | undefined,
  groups: boolean,
  newest: boolean,
): TimelineRow[] {
  const rows: TimelineRow[] = []
  const at = todayIndex(moments, newest)
  let group: string | undefined
  for (let index = from; index < to; index++) {
    const moment = moments[index]!
    if (today && index === at) rows.push({ kind: 'today', label: today })
    if (groups && moment.group && moment.group !== group) {
      rows.push({ kind: 'group', label: moment.group, future: !!moment.planned })
    }
    group = moment.group
    rows.push({ kind: 'moment', moment, index })
  }
  if (today && at === to && to === moments.length) rows.push({ kind: 'today', label: today })
  return rows
}

/** Still to come: a planned moment, or the heading of a group that starts with one. */
function future(row: TimelineRow | undefined): boolean {
  if (!row || row.kind === 'today') return false
  return row.kind === 'group' ? row.future : !!row.moment.planned
}

/** The stretch of rail between two rows is dashed when either of them is still to come. */
export function dashedBetween(rows: TimelineRow[], at: number): boolean {
  return future(rows[at]) || future(rows[at + 1])
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

/** The side of a mark, as `--lintje-timeline-mark`. */
const MARK = 10
/** The narrowest and widest a label is on a lying rail; any narrower and the row stands up. */
const LABEL_MIN = 160
const LABEL_MAX = 300
/** The space between two labels on one side, `--space-4`. */
const LABEL_GAP = 16
/** The room today's label takes above a lying rail, centred on its stroke. */
const TODAY_ROOM = 80
/** The names of the sides before a lying rail: their 4rem column and the `--space-4` after it. */
const NAMES = 80

export interface RowPlace {
  x: number
  up: boolean
  width: number
  /** Without `at`: after the end of the rail. */
  apart: boolean
}

export interface RowLayout {
  places: RowPlace[]
  /** Where the rail starts: half a mark in, so the first mark stays inside the element. */
  begin: number
  /** The rail is drawn through to here, dashed after it. */
  boundary: number
  end: number
  today?: number
  /** A year at the start of each year, under a rail with every moment above it. */
  years: { x: number; label: string }[]
  fits: boolean
}

/**
 * Where each moment stands on a lying rail `width` wide: in proportion to its time, the oldest
 * left whatever the order, with room after the last for its label and for every moment without
 * a time. It fits when each label has `LABEL_MIN` before the next one on its side.
 */
export function rowLayout(
  moments: TimelineMoment[],
  placement: TimelinePlacement,
  width: number,
  todayAt?: string,
): RowLayout {
  const times = moments.map((moment) => time(moment.at))
  const known = times.filter((value): value is number => value !== undefined)
  const now = time(todayAt)
  const apart = times.flatMap((value, index) => (value === undefined ? [index] : []))
  const begin = MARK / 2
  const length = width - begin - LABEL_MIN - apart.length * (LABEL_MIN + LABEL_GAP)
  if (!known.length || length < 0) {
    return { places: [], begin, boundary: begin, end: begin, years: [], fits: false }
  }
  const start = Math.min(...known)
  const stop = Math.max(...known, ...(now === undefined ? [] : [now]))
  const scale = (value: number): number =>
    begin + (stop > start ? ((value - start) / (stop - start)) * length : 0)
  const xs = times.map((value, index) =>
    value === undefined
      ? begin + length + (apart.indexOf(index) + 1) * (LABEL_MIN + LABEL_GAP)
      : scale(value),
  )
  const up = moments.map((moment, index) =>
    placement === 'sides'
      ? moment.side !== 'end'
      : placement === 'alternate'
        ? index % 2 === 0
        : true,
  )
  const today = now !== undefined && now >= start ? scale(now) : undefined
  // With labels on both sides today's label stands above the rail, so a label there ends before it.
  const block = today !== undefined && placement !== 'start' ? today - TODAY_ROOM / 2 : undefined
  const places = moments.map((_, index) => {
    const x = xs[index]!
    const after = xs.filter((other, at) => up[at] === up[index] && other > x)
    let end = after.length ? Math.min(...after) - LABEL_GAP : width
    if (up[index] && block !== undefined && block > x) end = Math.min(end, block)
    return {
      x,
      up: up[index]!,
      width: Math.min(LABEL_MAX, end - x),
      apart: times[index] === undefined,
    }
  })
  const last = Math.max(begin, ...places.filter((place) => !place.apart).map((place) => place.x))
  const latest = latestIndex(moments, newestFirst(moments))
  const planned = moments.some((moment, index) => moment.planned && times[index] !== undefined)
  const boundary =
    today ?? (planned && latest >= 0 && times[latest] !== undefined ? xs[latest]! : last)
  const years: RowLayout['years'] = []
  const year = (value: number): number => new Date(value).getUTCFullYear()
  if (placement === 'start' && year(stop) - year(start) >= 2) {
    for (let label = year(start) + 1; label <= year(stop); label++) {
      const x = scale(Date.UTC(label, 0, 1))
      if (today === undefined || Math.abs(x - today) > LABEL_GAP * 3) {
        years.push({ x, label: String(label) })
      }
    }
  }
  return {
    places,
    begin,
    boundary,
    end: Math.max(last, today ?? 0),
    today,
    years,
    fits: places.every((place) => place.width >= LABEL_MIN),
  }
}

export class LintjeTimeline extends LintjeElement {
  static override styles = [iconStyles, avatarStyles, shadowCss(timelineCss)]

  static override properties: PropertyDeclarations = {
    moments: { attribute: false },
    heading: { type: String },
    level: { type: Number },
    placement: { type: String, reflect: true },
    orientation: { type: String, reflect: true },
    sides: { attribute: false },
    today: { type: String },
    todayAt: { type: String, attribute: 'today-at' },
    limit: { type: Number },
    step: { type: Number },
    empty: { type: String },
    more: { state: true },
    width: { state: true },
  }

  /** The moments, in the order they stand: the oldest first, or the newest. */
  moments: TimelineMoment[] = []
  declare heading?: string
  /** The heading's level on the page. */
  level: HeadingLevel = 3
  /** `start`: on one side, the date before the rail. `alternate`: in turn. `sides`: by `side`. */
  placement: TimelinePlacement = 'start'
  /**
   * `horizontal` lays the moments along a rail at their place in time; when their labels do not
   * fit, and on a phone, the timeline stands.
   */
  orientation: TimelineOrientation = 'vertical'
  /** The names over the two sides with `placement="sides"`: `['U', 'Wij']`. */
  declare sides?: [string, string]
  /** The label of today on the rail: "Vandaag, 21 oktober". */
  declare today?: string
  /** Today as ISO 8601: where its stroke stands on a lying rail. Without it a lying rail has none. */
  declare todayAt?: string
  /** How many moments nearest now show before "Toon eerdere"; all of them without it. */
  declare limit?: number
  /** How many more each "Toon eerdere" shows; all the rest without it. */
  declare step?: number
  /** The sentence that stands without moments. */
  empty: string = 'Er is nog niets gebeurd.'
  /** How many moments the reader asked to see beyond `limit`. */
  protected more = 0
  /** The element's width, measured: what a lying rail is laid out against. */
  protected width = 0

  #mobile = new MediaController(this, MOBILE)
  #resize = new FrameResizeObserver(() => {
    if (this.clientWidth !== this.width) this.width = this.clientWidth
    this.fit()
  })

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

  private fit(): void {
    this.fitRow()
    this.fitSides()
  }

  /**
   * A lying rail stands under the tallest label above it; the labels below, the years and the
   * names of the sides take their place from it.
   */
  private fitRow(): void {
    const axis = this.renderRoot.querySelector<HTMLElement>('.lintje-timeline__axis')
    if (!axis) return
    const tallest = (selector: string): number =>
      Math.max(
        0,
        ...[...axis.querySelectorAll(selector)].map((item) => item.getBoundingClientRect().height),
      )
    const today = axis.querySelector<HTMLElement>('.lintje-timeline__row--today:not(.is-below)')
    const above = Math.max(
      tallest('.lintje-timeline__row--up'),
      today ? tallest('.lintje-timeline__row--today .lintje-timeline__today') + LABEL_GAP : 0,
    )
    const under = axis.querySelector(
      '.lintje-timeline__year, .lintje-timeline__row--today.is-below',
    )
    const below = Math.max(tallest('.lintje-timeline__row--down'), under ? 2 * LABEL_GAP : 0)
    const rail = above + MARK / 2
    axis.style.setProperty('--lintje-timeline-rail-y', `${rail}px`)
    axis.style.setProperty('height', `${rail + MARK / 2 + below}px`)
    const names = this.renderRoot.querySelectorAll<HTMLElement>('.lintje-timeline__name')
    names[0]?.style.setProperty('top', `${(rail - names[0].offsetHeight) / 2}px`)
    names[1]?.style.setProperty('top', `${rail + (below - names[1].offsetHeight) / 2}px`)
  }

  /**
   * On two sides the items stand where `stagger` puts them. The spine runs between the marks,
   * dashed over the stretch that is still to come: at the top or at the bottom.
   */
  private fitSides(): void {
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
    const dashed = items.slice(0, -1).map((item) => item.dataset.dashed === 'true')
    const firstY = centres[0] ?? 0
    const lastY = centres.at(-1) ?? 0
    const top = dashed[0] === true
    const split = dashed.findIndex((value) => value !== top)
    const splitY = split < 0 ? lastY : centres[split]!
    const [upper, lower] = top ? ['planned', 'done'] : ['done', 'planned']
    const spine = (kind: string): HTMLElement | null =>
      this.renderRoot.querySelector(`.lintje-timeline__spine--${kind}`)
    spine(upper)?.style.setProperty('top', `${firstY}px`)
    spine(upper)?.style.setProperty('height', `${Math.max(0, splitY - firstY)}px`)
    spine(lower)?.style.setProperty('top', `${splitY}px`)
    spine(lower)?.style.setProperty('height', `${Math.max(0, lastY - splitY)}px`)
  }

  /**
   * Shows `step` more, or the rest. A button that stays keeps the focus; one that goes hands it
   * to the first moment that came in.
   */
  private async showEarlier(shown: { from: number; to: number; hidden: number }): Promise<void> {
    const newest = newestFirst(this.moments)
    const extra = this.step ? Math.min(this.step, shown.hidden) : shown.hidden
    this.more += extra
    await this.updateComplete
    if (this.renderRoot.querySelector('.lintje-timeline__more')) return
    const first = newest ? shown.to : shown.from - extra
    const row = this.renderRoot.querySelector<HTMLElement>(`[data-index="${first}"]`)
    if (!row) return
    row.tabIndex = -1
    row.focus()
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

  /** A person's circle before the name; what is no person has an icon in its circle. */
  private renderWho(who: string | Person | TimelineActor): TemplateResult {
    if (typeof who !== 'string' && !('icon' in who)) {
      return html`<strong class="lintje-timeline__who"
        ><lintje-person class="lintje-timeline__person" size="small" .person=${who}></lintje-person
      ></strong>`
    }
    const actor = typeof who === 'string' ? { name: who } : who
    return html`${renderAvatar(
      { name: actor.name },
      {
        size: 'small',
        icon: actor.icon ?? 'gereedschap-tandwielen',
        className: 'lintje-timeline__actor',
      },
    )}<strong class="lintje-timeline__who">${actor.name}</strong>`
  }

  /**
   * A moment's three lines: above the title its date and label, or only the label when the date
   * stands in a column; the title; under it the sentence, the link and the moment's slot.
   */
  private renderBody(moment: TimelineMoment, column: boolean, prefix?: string): TemplateResult {
    const date = this.renderDate(moment, prefix)
    const label = moment.label
    const over = column
      ? label
        ? html`<span class="lintje-timeline__over"
              ><span class="lintje-timeline__label">${label}</span></span
            >`
        : nothing
      : html`<span class="lintje-timeline__over"
            >${date}${label ? html`<span class="lintje-timeline__label"> · ${label}</span>` : nothing}</span
          >`
    const title =
      moment.who === undefined
        ? html`<p class="lintje-timeline__title">${moment.title}</p>`
        : html`<p class="lintje-timeline__title lintje-timeline__title--said">
            ${this.renderWho(moment.who)} ${moment.title}
          </p>`
    const link = moment.link
    return html`${over}${title}
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
      }
      ${
        moment.value
          ? html`<div class="lintje-timeline__content"><slot name=${moment.value}></slot></div>`
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

  /**
   * The rail of one row on one side: a stub up to the mark, the mark, and the line down. Past the
   * first or last row it runs on only where moments are kept back.
   */
  private renderRail(
    rows: TimelineRow[],
    at: number,
    shown: { from: number; to: number },
  ): TemplateResult {
    const row = rows[at]!
    const up = at > 0 && dashedBetween(rows, at - 1) ? 'is-dashed' : ''
    const down = at < rows.length - 1 && dashedBetween(rows, at) ? 'is-dashed' : ''
    const top = at === 0 && shown.from === 0 ? 'is-hidden' : ''
    const bottom = at === rows.length - 1 && shown.to === this.moments.length ? 'is-hidden' : ''
    // A group's tick and today's stroke cross the rail where a moment has its mark.
    const mark =
      row.kind === 'moment'
        ? html`<span class="lintje-timeline__mark"></span>`
        : html`<span class="lintje-timeline__tick"></span>`
    return html`<span class="lintje-timeline__rail" aria-hidden="true"
      ><span class="lintje-timeline__stub ${up} ${top}"></span
      >${mark}<span class="lintje-timeline__line ${down} ${bottom}"></span
    ></span>`
  }

  /** One side: a date column before the rail, or on a phone the date above the title. */
  private renderOneSide(
    rows: TimelineRow[],
    latest: number,
    shown: { from: number; to: number },
    people: boolean,
  ): TemplateResult {
    const stack = this.#mobile.matches
    return html`<ol
      class=${classMap({
        'lintje-timeline__list': true,
        'lintje-timeline__list--start': !stack,
        'lintje-timeline__list--stack': stack,
        'has-people': people,
      })}
      aria-labelledby=${this.heading ? 'lintje-timeline-heading' : nothing}
    >
      ${rows.map((row, at) => {
        const rail = this.renderRail(rows, at, shown)
        if (row.kind === 'moment') {
          const name = this.sideName(row.moment)
          return html`<li class=${classMap(this.rowClasses(row, latest))} data-index=${row.index}>
            ${stack ? nothing : html`<span class="lintje-timeline__when">${this.renderDate(row.moment)}</span>`}
            ${rail}
            <div class="lintje-timeline__body">
              ${this.renderBody(row.moment, !stack, stack ? name : undefined)}
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
  private renderTwoSides(rows: TimelineRow[], latest: number, people: boolean): TemplateResult {
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
          class=${classMap({
            'lintje-timeline__list': true,
            'lintje-timeline__list--sides': true,
            'has-people': people,
          })}
          aria-labelledby=${this.heading ? 'lintje-timeline-heading' : nothing}
        >
          ${rows.map((row, at) => {
            const dashed = String(dashedBetween(rows, at))
            if (row.kind === 'today') {
              return html`<li
                class="lintje-timeline__row lintje-timeline__row--today lintje-timeline__row--end"
                data-dashed=${dashed}
              >
                <span class="lintje-timeline__tick" aria-hidden="true"></span>
                <span class="lintje-timeline__today">${row.label}</span>
              </li>`
            }
            if (row.kind !== 'moment') return nothing
            const side = sideOf(row.moment, row.index, this.placement)
            const name = this.sideName(row.moment)
            return html`<li
              class=${classMap({ ...this.rowClasses(row, latest), [`lintje-timeline__row--${side}`]: true })}
              data-index=${row.index}
              data-dashed=${dashed}
            >
              <div class="lintje-timeline__body">
                ${name ? html`<span class="visually-hidden">${name}: </span>` : nothing}
                ${this.renderBody(row.moment, false)}
              </div>
              <span class="lintje-timeline__mark" aria-hidden="true"></span>
            </li>`
          })}
        </ol>
      </div>`
  }

  /** Lying: each moment at its place in time, its label above or under the rail. */
  private renderRow(
    rows: TimelineRow[],
    layout: RowLayout,
    from: number,
    latest: number,
    people: boolean,
  ): TemplateResult {
    const names = this.placement === 'sides' ? this.sides : undefined
    const px = (value: number): string => `${Math.round(value)}px`
    return html`<div class="lintje-timeline__lying">
      ${
        names
          ? html`<div class="lintje-timeline__names" aria-hidden="true">
              <span class="lintje-timeline__name">${names[0]}</span>
              <span class="lintje-timeline__name">${names[1]}</span>
            </div>`
          : nothing
      }
      <div class="lintje-timeline__axis">
        <span
          class="lintje-timeline__axis-rail"
          aria-hidden="true"
          ${styleProps({ left: px(layout.begin), width: px(layout.boundary - layout.begin) })}
        ></span>
        <span
          class="lintje-timeline__axis-rail lintje-timeline__axis-rail--planned"
          aria-hidden="true"
          ${styleProps({ left: px(layout.boundary), width: px(layout.end - layout.boundary) })}
        ></span>
        <ol
          class=${classMap({
            'lintje-timeline__list': true,
            'lintje-timeline__list--row': true,
            'has-people': people,
          })}
          aria-labelledby=${this.heading ? 'lintje-timeline-heading' : nothing}
        >
          ${rows.map((row) => {
            if (row.kind === 'today') {
              if (layout.today === undefined) return nothing
              return html`<li
                class=${classMap({
                  'lintje-timeline__row': true,
                  'lintje-timeline__row--today': true,
                  'is-below': this.placement === 'start',
                })}
                ${styleProps({ left: px(layout.today) })}
              >
                <span class="lintje-timeline__tick" aria-hidden="true"></span>
                <span class="lintje-timeline__today">${row.label}</span>
              </li>`
            }
            if (row.kind !== 'moment') return nothing
            const place = layout.places[row.index - from]!
            const name = this.sideName(row.moment)
            return html`<li
              class=${classMap({
                ...this.rowClasses(row, latest),
                'lintje-timeline__row--up': place.up,
                'lintje-timeline__row--down': !place.up,
              })}
              data-index=${row.index}
              ${styleProps({ left: px(place.x), width: px(place.width) })}
            >
              <div class="lintje-timeline__body">
                ${name ? html`<span class="visually-hidden">${name}: </span>` : nothing}
                ${this.renderBody(row.moment, false)}
              </div>
              <span class="lintje-timeline__mark" aria-hidden="true"></span>
            </li>`
          })}
        </ol>
        ${layout.years.map(
          (year) =>
            html`<span class="lintje-timeline__year" aria-hidden="true" ${styleProps({ left: px(year.x) })}
              >${year.label}</span
            >`,
        )}
      </div>
    </div>`
  }

  /** The layout of a lying rail, or none when the timeline stands. */
  private lying(from: number, to: number): RowLayout | undefined {
    if (this.orientation !== 'horizontal' || this.#mobile.matches || !this.width) return undefined
    const width = this.width - (this.placement === 'sides' && this.sides ? NAMES : 0)
    const layout = rowLayout(this.moments.slice(from, to), this.placement, width, this.todayAt)
    return layout.fits ? layout : undefined
  }

  private renderMore(
    shown: { from: number; to: number; hidden: number },
    after: boolean,
  ): TemplateResult {
    const count = this.step ? Math.min(this.step, shown.hidden) : shown.hidden
    return html`<lintje-button
      class="lintje-timeline__more ${after ? 'lintje-timeline__more--after' : ''}"
      variant="link"
      @click=${() => void this.showEarlier(shown)}
      >${count === 1 ? 'Toon 1 eerder moment' : `Toon ${count} eerdere momenten`}</lintje-button
    >`
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
    const newest = newestFirst(this.moments)
    const shown = shownMoments(this.moments, this.limit, this.more, newest)
    const layout = this.lying(shown.from, shown.to)
    const twoSided = this.twoSided
    const rows = timelineRows(
      this.moments,
      shown.from,
      shown.to,
      this.today,
      !twoSided && !layout,
      newest,
    )
    const latest = latestIndex(this.moments, newest)
    const people = this.moments.some((moment) => moment.who !== undefined)
    const more = shown.hidden > 0 ? this.renderMore(shown, newest) : nothing
    return html`<section class="lintje-timeline">
      ${heading} ${newest ? nothing : more}
      ${
        layout
          ? this.renderRow(rows, layout, shown.from, latest, people)
          : twoSided
            ? this.renderTwoSides(rows, latest, people)
            : this.renderOneSide(rows, latest, shown, people)
      }
      ${newest ? more : nothing}
    </section>`
  }
}

define('lintje-timeline', LintjeTimeline)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-timeline': LintjeTimeline
  }
}
