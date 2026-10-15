/**
 * `<lintje-log-viewer>` — log lines in a tile, oldest first, that follow the newest while live.
 *
 * The host holds the filter (level, search term, "alleen treffers") and the chosen line, keeps
 * them in the URL and sends only the lines that match; the view, the following and the cleared
 * view are the element's own. It finds the hits of the term itself and steps through them. It
 * never guesses: a line without a level has no badge. Lines without time, level or source are
 * drawn as plain output. A danger action is the host's to confirm.
 *
 * Events: `lintje-log-filter-change` `{ level, search, onlyHits }`, `lintje-log-select`
 * `string | null` (the chosen line), `lintje-log-action` `string` (one of `actions`),
 * `lintje-log-retry`.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { repeat } from 'lit/directives/repeat.js'
import { define, type FrameSettings } from '../../../core/element'
import { formatNumber } from '../../../core/format'
import { lengthPx } from '../../../core/length'
import { MediaController } from '../../../core/media'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { badgeStyles, renderBadge, type BadgeTone } from '../../feedback/badge/badge'
import { spanStyles } from '../../shared/grid-item-element'
import '../../actions/button/button'
import '../../actions/icon-button/icon-button'
import '../../feedback/skeleton/skeleton'
import '../../layout/tile/tile'
import '../../actions/menu-button/menu-button'
import type { MenuEntry } from '../../actions/menu-button/menu-button'
import '../../feedback/announcement/announcement'
import '../../inputs/find/find'
import '../../inputs/segmented/segmented'
import '../../inputs/select/select'
import '../code/code'
import '../highlight/highlight'
import { LintjeContentTileElement } from '../../shared/content-tile'
import { COPIED_FOR } from '../../shared/copied'
import { atEndAfterScroll } from '../../shared/follow'
import { downloadCsv, downloadText } from '../../shared/download'
import type { LogEntry, LogFilter, LogLevel, LogViewerData } from '../../../types'
import {
  LEVEL_WORD,
  asJson,
  asText,
  countHits,
  csvRows,
  fold,
  isRaw,
  lineText,
  plain,
  since,
  splitHits,
} from './lines'
import logViewerCss from './log-viewer.css?inline'

type TimeShown = 'clock' | 'since'

/** How the filter row fits its own width: all on one line, the level folded to a select, or stacked. */
type Fit = 'wide' | 'compact' | 'narrow'

interface View {
  wrap: boolean
  fold: boolean
  time: TimeShown
  columns: { time: boolean; level: boolean; source: boolean }
}

const LEVELS: (LogLevel | 'all')[] = ['all', 'error', 'warning', 'info', 'debug']
const LEVEL_LABEL: Record<LogLevel | 'all', string> = {
  all: 'Alles',
  error: 'Fouten',
  warning: 'Let op',
  info: 'Info',
  debug: 'Debug',
}
const LEVEL_TONE: Record<LogLevel, { tone: BadgeTone; icon?: string }> = {
  error: { tone: 'error', icon: 'functioneel-foutmelding' },
  warning: { tone: 'warning', icon: 'functioneel-waarschuwing' },
  // Quiet on purpose: nearly every line is info, and a column of fills would drown the errors.
  info: { tone: 'neutral', icon: 'functioneel-info' },
  debug: { tone: 'subtle' },
}

/** New lines are read out at most this often. */
const SPEAK_EVERY = 5000

export class LintjeLogViewer extends LintjeContentTileElement {
  static override styles = [spanStyles, iconStyles, badgeStyles, shadowCss(logViewerCss)]

  static override properties: PropertyDeclarations = {
    data: { attribute: false },
    view: { state: true },
    hit: { state: true },
    following: { state: true },
    unreadFrom: { state: true },
    clearedAfter: { state: true },
    unfolded: { state: true },
    opened: { state: true },
    activeId: { state: true },
    copied: { state: true },
    message: { state: true },
    fit: { state: true },
  }

  declare data?: LogViewerData
  protected view: View = {
    wrap: true,
    fold: true,
    time: 'clock',
    columns: { time: true, level: true, source: true },
  }
  /** The current hit, from 1. */
  protected hit: number = 1
  /** The reader stands at the newest line, so new lines keep them there. */
  protected following: boolean = true
  /** The first line that came in while the reader looked elsewhere. */
  protected unreadFrom: string | null = null
  /** The last line hidden by "Venster leegmaken". */
  protected clearedAfter: string | null = null
  protected unfolded: ReadonlySet<string> = new Set()
  protected opened: ReadonlySet<string> = new Set()
  /** The line the arrow keys stand on. */
  protected activeId: string | null = null
  protected copied: 'menu' | 'line' | 'link' | null = null
  protected message: string = ''
  protected fit: Fit = 'wide'

  readonly #mobile = new MediaController(this)
  #lastTop = 0
  #lastId: string | null = null
  #lastTerm = ''
  /** A step was taken: the current hit is brought into view once drawn. */
  #jump = false
  /** A filter went to the host: its answer's line count is read out. */
  #asked = false
  #pending = { lines: 0, errors: 0 }
  #speakTimer: ReturnType<typeof setTimeout> | null = null
  #copiedTimer: ReturnType<typeof setTimeout> | null = null
  #sayFrame = 0
  #fitObserver: ResizeObserver | null = null
  #observed: Element | null = null
  #growth: ResizeObserver | null = null
  #grown: Element | null = null
  /** The segments' width on one line, once measured. */
  #levelsWidth = 0
  #drawnFit: Fit = 'wide'

  protected override get dataSettings(): FrameSettings | undefined {
    return this.data ?? undefined
  }

  override disconnectedCallback(): void {
    if (this.#speakTimer) clearTimeout(this.#speakTimer)
    if (this.#copiedTimer) clearTimeout(this.#copiedTimer)
    cancelAnimationFrame(this.#sayFrame)
    this.#fitObserver?.disconnect()
    this.#fitObserver = null
    this.#observed = null
    this.#growth?.disconnect()
    this.#growth = null
    this.#grown = null
    super.disconnectedCallback()
  }

  /* What is shown ------------------------------------------------------------ */

  private get entries(): LogEntry[] {
    return this.data?.entries ?? []
  }

  /** The lines after the cleared ones; all of them when the cleared line is no longer sent. */
  private get shown(): LogEntry[] {
    const entries = this.entries
    if (!this.clearedAfter) return entries
    const at = entries.findIndex((entry) => entry.id === this.clearedAfter)
    return at === -1 ? entries : entries.slice(at + 1)
  }

  private get filter(): Required<LogFilter> {
    const filter = this.data?.filter ?? {}
    return {
      level: filter.level ?? 'all',
      search: filter.search ?? '',
      onlyHits: Boolean(filter.onlyHits),
    }
  }

  /** A filter the host answered: an empty answer is "nothing for this filter", not an empty log. */
  private get filtered(): boolean {
    const { level, onlyHits } = this.filter
    return level !== 'all' || (onlyHits && Boolean(this.term))
  }

  private get term(): string {
    return this.filter.search.trim().toLowerCase()
  }

  /* Updates ------------------------------------------------------------------ */

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (!changed.has('data')) return
    // A new term goes to its first hit, also the one a page opens with.
    if (this.term !== this.#lastTerm) {
      this.#lastTerm = this.term
      this.hit = 1
      if (this.term) {
        this.following = false
        this.#jump = true
      }
    }
    const entries = this.entries
    const last = entries.at(-1)?.id ?? null
    if (this.#lastId !== null && last !== this.#lastId) {
      const before = entries.findIndex((entry) => entry.id === this.#lastId)
      const arrived = before === -1 ? [] : entries.slice(before + 1)
      if (arrived.length) this.arrive(arrived)
    }
    this.#lastId = last
  }

  private arrive(lines: LogEntry[]): void {
    if (!this.following && !this.unreadFrom) this.unreadFrom = lines[0]!.id
    if (!this.data?.live) return
    this.#pending.lines += lines.length
    this.#pending.errors += lines.filter((line) => line.level === 'error').length
    this.#speakTimer ??= setTimeout(() => {
      this.#speakTimer = null
      const { lines: count, errors } = this.#pending
      this.#pending = { lines: 0, errors: 0 }
      if (!count) return
      const what = count === 1 ? '1 nieuwe regel' : `${formatNumber(count)} nieuwe regels`
      const bad =
        errors === 0 ? '' : errors === 1 ? ', waarvan 1 fout' : `, waarvan ${errors} fouten`
      this.say(`${what}${bad}`)
    }, SPEAK_EVERY)
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.watchFit()
    this.watchGrowth()
    // A new layout keeps the row's width, so its observer stays silent: measure it again.
    if (this.fit !== this.#drawnFit) {
      this.#drawnFit = this.fit
      requestAnimationFrame(() => this.refit())
    }
    const log = this.log
    if (!log) return
    if (this.#jump) {
      this.#jump = false
      this.reveal(log.querySelector<HTMLElement>('lintje-highlight[current]'), log)
    } else if (this.following) {
      log.scrollTop = log.scrollHeight
    }
    if (changed.has('data') && this.#asked) {
      this.#asked = false
      const count = this.shown.length
      this.say(count === 1 ? '1 regel' : `${formatNumber(count)} regels`)
    }
  }

  // The row reads its own width, not the screen's: a tile beside another is narrow on a wide screen.
  private watchFit(): void {
    const row = this.renderRoot.querySelector('.lintje-log-viewer__filters')
    if (!row || row === this.#observed || typeof ResizeObserver === 'undefined') return
    this.#fitObserver?.disconnect()
    this.#fitObserver = new ResizeObserver(() => this.refit())
    this.#fitObserver.observe(row)
    this.#observed = row
  }

  // The rows lay out only once the tile draws its slot, and grow as a line opens: whoever
  // follows stays at the newest line, also when the log first appears.
  private watchGrowth(): void {
    const rows = this.log?.querySelector('.lintje-log-viewer__rows')
    if (!rows || rows === this.#grown || typeof ResizeObserver === 'undefined') return
    this.#growth?.disconnect()
    this.#growth = new ResizeObserver(() => {
      const log = this.log
      if (this.following && log) log.scrollTop = log.scrollHeight
    })
    this.#growth.observe(rows)
    this.#grown = rows
  }

  private refit(): void {
    const row = this.renderRoot.querySelector<HTMLElement>('.lintje-log-viewer__filters')
    if (!row) return
    // The search and the tools have their sizes in tokens; the segments are measured on one line.
    const space = lengthPx(row, '--space-2', 8)
    const find = 10 * lengthPx(row, '--space-10', 40)
    const tools = 3 * lengthPx(row, '--h-button', 48) + 2 * space
    const select = 12 * lengthPx(row, '--space-4', 16)
    const segments = row.querySelector('lintje-segmented')
    if (segments)
      this.#levelsWidth = Math.max(this.#levelsWidth, segments.getBoundingClientRect().width)
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0
    const tail = find + gap + tools
    const room = row.clientWidth
    let next: Fit
    if (row.classList.contains('is-raw')) next = room >= tail ? 'wide' : 'narrow'
    else if (room < select + gap + tail) next = 'narrow'
    // Not yet measured: try them on one line, and measure there.
    else next = !this.#levelsWidth || room >= this.#levelsWidth + gap + tail ? 'wide' : 'compact'
    if (next !== this.fit) this.fit = next
  }

  private get log(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.lintje-log-viewer__log')
  }

  /** Scrolls the log, never the page: moving the page moves the controls from under the pointer. */
  private reveal(target: Element | null, log: HTMLElement): void {
    if (!target) return
    const box = log.getBoundingClientRect()
    const at = target.getBoundingClientRect()
    if (at.top < box.top || at.bottom > box.bottom) {
      log.scrollTop += at.top - box.top - box.height / 3
    }
  }

  private readonly onScroll = (): void => {
    const log = this.log
    if (!log) return
    const beyond = log.scrollHeight - log.scrollTop - log.clientHeight
    const atEnd = atEndAfterScroll(this.following, log.scrollTop, this.#lastTop, beyond)
    if (atEnd && !this.following) this.toLatest(false)
    else if (!atEnd) this.following = false
    this.#lastTop = log.scrollTop
  }

  private toLatest(scroll = true): void {
    this.following = true
    this.unreadFrom = null
    const log = this.log
    if (scroll && log) log.scrollTop = log.scrollHeight
  }

  // Emptied first: the same words again are no change to a live region.
  private say(text: string): void {
    cancelAnimationFrame(this.#sayFrame)
    this.message = ''
    this.#sayFrame = requestAnimationFrame(() => (this.message = text))
  }

  /* Host requests ----------------------------------------------------------- */

  private askFilter(change: Partial<LogFilter>): void {
    const next = { ...this.filter, ...change }
    this.#asked = change.level !== undefined || change.onlyHits !== undefined
    this.emit('lintje-log-filter-change', next)
  }

  private select(id: string | null): void {
    this.emit('lintje-log-select', id)
  }

  /* Finding ----------------------------------------------------------------- */

  private get hitCounts(): number[] {
    const term = this.term
    return this.shown.map((entry) => countHits(plain(entry.message), term))
  }

  private onStep(event: CustomEvent<1 | -1>): void {
    event.stopPropagation()
    const total = this.hitCounts.reduce((sum, count) => sum + count, 0)
    if (!total) return
    const from = Math.min(this.hit, total)
    this.hit = ((from - 1 + event.detail + total) % total) + 1
    this.following = false
    this.#jump = true
  }

  /* Copying ----------------------------------------------------------------- */

  private async copy(text: string, which: 'menu' | 'line' | 'link'): Promise<void> {
    try {
      await navigator.clipboard?.writeText(text)
    } catch {
      return
    }
    this.copied = which
    if (this.#copiedTimer) clearTimeout(this.#copiedTimer)
    this.#copiedTimer = setTimeout(() => (this.copied = null), COPIED_FOR)
    this.say('Gekopieerd')
  }

  private get fileName(): string {
    const name = (this.data?.title ?? 'log')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    return name || 'log'
  }

  /* Menus ------------------------------------------------------------------- */

  private onViewAction(event: CustomEvent<string>): void {
    event.stopPropagation()
    const [, key] = event.detail.split(':')
    const view = this.view
    if (key === 'wrap') this.view = { ...view, wrap: !view.wrap }
    else if (key === 'fold') this.view = { ...view, fold: !view.fold }
    else if (key === 'clock' || key === 'since') this.view = { ...view, time: key }
    else if (key === 'time' || key === 'level' || key === 'source') {
      this.view = { ...view, columns: { ...view.columns, [key]: !view.columns[key] } }
    } else if (key === 'only-hits') this.askFilter({ onlyHits: !this.filter.onlyHits })
  }

  private onCopyAction(event: CustomEvent<string>): void {
    event.stopPropagation()
    const lines = this.shown
    const name = this.fileName
    switch (event.detail) {
      case 'copy:text':
        void this.copy(asText(lines), 'menu')
        break
      case 'copy:json':
        void this.copy(asJson(lines), 'menu')
        break
      case 'save:log':
        downloadText(`${name}.log`, asText(lines), 'text/plain')
        break
      case 'save:csv':
        downloadCsv(name, csvRows(lines))
        break
      case 'save:json':
        downloadText(`${name}.json`, asJson(lines), 'application/json')
        break
    }
  }

  private onMoreAction(event: CustomEvent<string>): void {
    event.stopPropagation()
    if (event.detail === 'log:clear') {
      this.clearedAfter = this.entries.at(-1)?.id ?? null
      this.toLatest()
      return
    }
    this.emit('lintje-log-action', event.detail)
  }

  /** In a narrow row the three menus are one: what does not fit beside the level folds into "Meer". */
  private readonly onAnyAction = (event: CustomEvent<string>): void => {
    const [kind] = event.detail.split(':')
    if (kind === 'view') this.onViewAction(event)
    else if (kind === 'copy' || kind === 'save') this.onCopyAction(event)
    else this.onMoreAction(event)
  }

  private viewItems(raw: boolean): MenuEntry[] {
    const { wrap, fold: folded, time, columns } = this.view
    const first = this.entries.find((entry) => entry.at)
    const sample = this.entries.find((entry) => entry.time)
    return [
      { heading: 'Regels' },
      { value: 'view:wrap', label: 'Lange regels afbreken', checked: wrap },
      { value: 'view:fold', label: 'Lange berichten inklappen', checked: folded },
      ...(raw
        ? []
        : ([
            'separator',
            { heading: 'Tijd' },
            {
              value: 'view:clock',
              label: 'Kloktijd',
              checked: time === 'clock',
              radio: true,
              hint: sample?.time,
            },
            {
              value: 'view:since',
              label: 'Sinds de eerste regel',
              checked: time === 'since',
              radio: true,
              hint: since(sample?.at, first?.at) ?? undefined,
            },
            'separator',
            { heading: 'Kolommen' },
            { value: 'view:time', label: 'Tijd', checked: columns.time },
            { value: 'view:level', label: 'Niveau', checked: columns.level },
            { value: 'view:source', label: 'Bron', checked: columns.source },
          ] satisfies MenuEntry[])),
      'separator',
      { heading: 'Zoeken' },
      {
        value: 'view:only-hits',
        label: 'Alleen regels met een treffer',
        checked: this.filter.onlyHits,
        disabled: !this.term && !this.filter.onlyHits,
        reason: 'Zoek eerst een woord',
      },
    ]
  }

  private copyItems(): MenuEntry[] {
    return [
      { heading: 'Kopiëren' },
      {
        value: 'copy:text',
        label: 'Getoonde regels als tekst',
        hint: formatNumber(this.shown.length),
      },
      { value: 'copy:json', label: 'Getoonde regels als JSON' },
      'separator',
      { heading: 'Downloaden' },
      { value: 'save:log', label: 'Tekstbestand', hint: '.log' },
      { value: 'save:csv', label: 'Voor een spreadsheet', hint: '.csv' },
      { value: 'save:json', label: 'JSON', hint: '.json' },
    ]
  }

  private moreItems(): MenuEntry[] {
    const actions = this.data?.actions ?? []
    return [
      { heading: 'Dit venster' },
      { value: 'log:clear', label: 'Venster leegmaken', disabled: this.shown.length === 0 },
      ...(actions.length ? (['separator', ...actions] satisfies MenuEntry[]) : []),
    ]
  }

  /* Keys -------------------------------------------------------------------- */

  private readonly onRowsKeydown = (event: KeyboardEvent): void => {
    const rows = [...this.renderRoot.querySelectorAll<HTMLElement>('.lintje-log-viewer__row')]
    if (!rows.length) return
    // Without a line of its own the keys start at the newest, the one with the tab stop.
    const found = rows.findIndex((row) => row.dataset.id === this.activeId)
    const index = found === -1 ? rows.length - 1 : found
    let next = index
    switch (event.key) {
      case 'ArrowDown':
        next = Math.min(rows.length - 1, index + 1)
        break
      case 'ArrowUp':
        next = Math.max(0, index - 1)
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = rows.length - 1
        break
      case 'Enter':
        if (event.target !== rows[index]) return
        event.preventDefault()
        this.select(this.data?.selected === this.activeId ? null : this.activeId)
        return
      default:
        return
    }
    event.preventDefault()
    const row = rows[next]!
    this.activeId = row.dataset.id ?? null
    row.focus({ preventScroll: true })
    if (event.key === 'End') this.toLatest()
    else {
      this.following = false
      const log = this.log
      if (log) this.reveal(row, log)
    }
  }

  /* Rendering --------------------------------------------------------------- */

  protected override render(): TemplateResult | typeof nothing {
    const data = this.data
    if (!data) return nothing
    const entries = this.entries
    const state = data.state ?? 'ready'
    const tileState =
      state === 'loading'
        ? 'loading'
        : state === 'empty' ||
            (!entries.length && !data.live && !this.filtered && state !== 'error')
          ? 'empty'
          : 'ready'
    const raw = isRaw(entries)
    const mobile = this.#mobile.matches

    return html`<lintje-tile
        class="lintje-log-viewer__tile"
        span=${data.span ?? nothing}
        heading=${data.title ?? nothing}
        icon=${data.icon ?? nothing}
        subtitle=${data.subtitle ?? nothing}
        intro=${data.intro ?? nothing}
        footnote=${data.footnote ?? nothing}
        ?expandable=${Boolean(data.expandable) && tileState === 'ready'}
        state=${tileState}
        message=${data.message ?? (tileState === 'empty' ? 'Er zijn geen logregels.' : nothing)}
        @lintje-tile-expand=${(event: Event) => {
          event.stopPropagation()
          this.expand(true)
        }}
      >
        ${this.renderNotice(data, state)}
        <div slot="loading" class="lintje-log-viewer__skeleton" aria-hidden="true">
          ${[72, 48, 85, 60, 38, 77, 54, 66].map(
            (width) => html`<span class="lintje-log-viewer__skeleton-row">
              <lintje-skeleton width="12ch" height="1rem"></lintje-skeleton>
              <lintje-skeleton width="4rem" height="1rem"></lintje-skeleton>
              <lintje-skeleton width="${width}%" height="1rem"></lintje-skeleton>
            </span>`,
          )}
        </div>
        <div class="lintje-log-viewer">
          ${this.renderFilters(raw)} ${this.renderFrame(raw, mobile)}
        </div>
      </lintje-tile>
      ${this.renderExpandModal(this.expanded ? this.renderLines(raw, mobile, 'modal') : nothing, {
        heading: data.title,
        subtitle: data.subtitle,
      })}`
  }

  /** Three squares at the height of the fields beside them, so the row has one height. */
  private renderTools(raw: boolean): TemplateResult {
    if (this.fit === 'narrow') {
      return html`<span class="lintje-log-viewer__tools">
        <lintje-menu-button
          accessible-label="Weergave, kopiëren en meer"
          leading-icon="functioneel-meer"
          variant="tertiary"
          placement="bottom-end"
          .items=${
            [
              ...this.viewItems(raw),
              'separator',
              ...this.copyItems(),
              'separator',
              ...this.moreItems(),
            ] satisfies MenuEntry[]
          }
          @lintje-action=${this.onAnyAction}
        ></lintje-menu-button>
      </span>`
    }
    return html`<span class="lintje-log-viewer__tools">
      <lintje-menu-button
        accessible-label="Weergave"
        leading-icon="functioneel-filters"
        variant="tertiary"
        placement="bottom-end"
        .items=${this.viewItems(raw)}
        @lintje-action=${this.onViewAction}
      ></lintje-menu-button>
      <lintje-menu-button
        accessible-label=${this.copied === 'menu' ? 'Gekopieerd' : 'Kopiëren of downloaden'}
        leading-icon=${this.copied === 'menu' ? 'functioneel-vinkje' : 'functioneel-kopieren'}
        variant="tertiary"
        placement="bottom-end"
        .items=${this.copyItems()}
        @lintje-action=${this.onCopyAction}
      ></lintje-menu-button>
      <lintje-menu-button
        accessible-label="Meer acties"
        leading-icon="functioneel-meer"
        variant="tertiary"
        placement="bottom-end"
        .items=${this.moreItems()}
        @lintje-action=${this.onMoreAction}
      ></lintje-menu-button>
    </span>`
  }

  private renderNotice(data: LogViewerData, state: string): TemplateResult | typeof nothing {
    if (state === 'error') {
      return html`<lintje-announcement
        slot="notice"
        .data=${{
          kind: 'error',
          text: data.message ?? 'De logregels komen niet binnen.',
          live: true,
        }}
      >
        <lintje-button
          slot="action"
          variant="tertiary"
          size="compact"
          @click=${() => this.emit('lintje-log-retry')}
          >Opnieuw proberen</lintje-button
        >
      </lintje-announcement>`
    }
    return data.notice
      ? html`<lintje-announcement slot="notice" .data=${data.notice}></lintje-announcement>`
      : nothing
  }

  private renderFilters(raw: boolean): TemplateResult {
    const folded = this.fit !== 'wide'
    const { level, search } = this.filter
    const counts = this.data?.counts
    const options = LEVELS.map((value) => {
      const count = counts?.[value]
      const label = LEVEL_LABEL[value]
      return folded
        ? { value, label: count === undefined ? label : `${label} (${formatNumber(count)})` }
        : { value, label, count }
    })
    const total = this.hitCounts.reduce((sum, count) => sum + count, 0)
    const levels = raw
      ? nothing
      : folded
        ? html`<lintje-select
            class="lintje-log-viewer__level"
            label="Niveau"
            hide-label
            stacked
            .value=${level}
            .options=${options}
            @lintje-change=${(event: CustomEvent<string>) => {
              event.stopPropagation()
              this.askFilter({ level: event.detail as LogLevel | 'all' })
            }}
          ></lintje-select>`
        : html`<lintje-segmented
            class="lintje-log-viewer__level"
            label="Niveau"
            hide-label
            .value=${level}
            .options=${options}
            @lintje-change=${(event: CustomEvent<string>) => {
              event.stopPropagation()
              this.askFilter({ level: event.detail as LogLevel | 'all' })
            }}
          ></lintje-segmented>`
    return html`<div
      class=${classMap({
        'lintje-log-viewer__filters': true,
        [`is-${this.fit}`]: true,
        'is-raw': raw,
      })}
    >
      ${levels}
      <lintje-find
        class="lintje-log-viewer__find"
        label="Zoeken in log"
        .value=${search}
        .total=${this.term ? total : null}
        .current=${total ? Math.min(this.hit, total) : 0}
        @lintje-change=${(event: CustomEvent<string>) => {
          event.stopPropagation()
          this.askFilter({ search: event.detail })
        }}
        @lintje-find-step=${this.onStep}
      ></lintje-find>
      ${this.renderTools(raw)}
    </div>`
  }

  private renderFrame(raw: boolean, mobile: boolean): TemplateResult {
    return html`<div class="lintje-log-viewer__frame">
        ${this.renderLines(raw, mobile, 'tile')} ${this.renderFoot()}
      </div>
      <p class="visually-hidden" role="status" aria-atomic="false">${this.message}</p>`
  }

  private renderLines(raw: boolean, mobile: boolean, place: 'tile' | 'modal'): TemplateResult {
    const data = this.data
    const shown = this.shown
    const counts = this.hitCounts
    const firsts: number[] = []
    counts.reduce((next, count, index) => {
      firsts[index] = next
      return next + count
    }, 1)
    const total = counts.reduce((sum, count) => sum + count, 0)
    const hit = total ? Math.min(this.hit, total) : 0
    const inTile = place === 'tile'
    const activeId =
      inTile && shown.some((entry) => entry.id === this.activeId)
        ? this.activeId
        : (shown.at(-1)?.id ?? null)
    const hidden = this.clearedAfter ? this.entries.length - shown.length : 0
    const unread = !this.following && this.unreadFrom
    const newCount = unread ? shown.length - shown.findIndex((e) => e.id === this.unreadFrom) : 0

    return html`<div
      class=${classMap({
        'lintje-log-viewer__log': true,
        'lintje-log-viewer__log--expanded': !inTile,
        'is-nowrap': !this.view.wrap && !mobile,
        'is-mobile': mobile,
      })}
      role="log"
      aria-live="off"
      aria-label=${data?.title ?? 'Log'}
      tabindex=${inTile ? nothing : '0'}
      @scroll=${inTile ? this.onScroll : nothing}
      @keydown=${inTile ? this.onRowsKeydown : nothing}
    >
      <div class="lintje-log-viewer__rows">
        ${
          data?.truncated
            ? html`<p class="lintje-log-viewer__note">
              ${formatNumber(data.truncated)} oudere regels niet getoond
            </p>`
            : nothing
        }
        ${
          hidden
            ? html`<p class="lintje-log-viewer__note">
              Venster leeggemaakt${
                this.clearedTime ? ` om ${this.clearedTime}` : ''
              }. ${formatNumber(hidden)} regels verborgen.
              <lintje-button
                variant="link"
                size="compact"
                @click=${() => (this.clearedAfter = null)}
                >Weer tonen</lintje-button
              >
            </p>`
            : nothing
        }
        ${repeat(
          shown,
          (entry) => entry.id,
          (entry, index) =>
            this.renderRow(entry, {
              raw,
              first: firsts[index]!,
              hits: counts[index]!,
              hit,
              active: inTile && entry.id === activeId,
              place,
              divider: unread && entry.id === this.unreadFrom ? newCount : 0,
            }),
        )}
        ${shown.length ? nothing : this.renderEmpty()}
      </div>
    </div>`
  }

  private get clearedTime(): string | undefined {
    return this.entries.find((entry) => entry.id === this.clearedAfter)?.time
  }

  private renderEmpty(): TemplateResult {
    if (this.filtered && !this.entries.length) {
      return html`<div class="lintje-log-viewer__empty">
        <p class="lintje-log-viewer__empty-title">Geen regels voor dit filter</p>
        <p>Kies een ander niveau of pas de zoektekst aan.</p>
        <lintje-button
          variant="secondary"
          size="compact"
          @click=${() => {
            this.#asked = true
            this.emit('lintje-log-filter-change', { level: 'all', search: '', onlyHits: false })
          }}
          >Filter wissen</lintje-button
        >
      </div>`
    }
    return html`<div class="lintje-log-viewer__empty">
      <p>${this.clearedAfter ? 'Wachten op nieuwe regels…' : 'Wachten op de eerste regel…'}</p>
    </div>`
  }

  private renderRow(
    entry: LogEntry,
    o: {
      raw: boolean
      first: number
      hits: number
      hit: number
      active: boolean
      place: 'tile' | 'modal'
      divider: number
    },
  ): TemplateResult {
    const text = plain(entry.message)
    const folded = fold(text)
    const shownHits = folded.hidden ? countHits(folded.shown, this.term) : o.hits
    // A current hit in the folded part opens it.
    const hitHidden = o.hit >= o.first + shownHits && o.hit < o.first + o.hits
    const open = !this.view.fold || !folded.hidden || this.unfolded.has(entry.id) || hitHidden
    const body = open ? text : folded.shown
    const tab = o.active ? '0' : '-1'
    const selected = this.data?.selected === entry.id
    const message = html`<span class="lintje-log-viewer__body"
        >${splitHits(body, this.term, o.first).map((part) =>
          part.hit === undefined
            ? part.text
            : html`<lintje-highlight kind="match" ?current=${part.hit === o.hit}
                >${part.text}</lintje-highlight
              >`,
        )}</span
      >${
        folded.hidden && this.view.fold && !hitHidden
          ? html`<button
              type="button"
              class="lintje-log-viewer__more"
              tabindex=${tab}
              aria-expanded=${String(open)}
              @click=${() => this.toggle('unfolded', entry.id)}
            >
              ${open ? 'Minder tonen' : `${folded.hidden} regels meer`}
            </button>`
          : nothing
      }`
    const details = this.opened.has(entry.id)
    return html`${
      o.divider
        ? html`<div class="lintje-log-viewer__divider">${formatNumber(o.divider)} nieuw</div>`
        : nothing
    }<div
      class=${classMap({
        'lintje-log-viewer__row': true,
        'lintje-log-viewer__row--error': entry.level === 'error',
        'lintje-log-viewer__row--raw': o.raw,
        'is-selected': selected,
      })}
      data-id=${entry.id}
      tabindex=${o.place === 'tile' ? tab : nothing}
      aria-current=${selected ? 'true' : nothing}
      @focus=${o.place === 'tile' ? () => (this.activeId = entry.id) : nothing}
    >
      ${
        o.raw
          ? html`<span class="lintje-log-viewer__number">${entry.line ?? ''}</span
              ><span class="lintje-log-viewer__message">${message}</span>`
          : this.renderCells(entry, message, tab, details)
      }
      ${
        details && entry.details
          ? html`<lintje-code
              class="lintje-log-viewer__details"
              .text=${entry.details}
              label="Details van de regel"
            ></lintje-code>`
          : nothing
      }
    </div>`
  }

  private renderCells(
    entry: LogEntry,
    message: TemplateResult,
    tab: string,
    details: boolean,
  ): TemplateResult {
    const { columns, time } = this.view
    const first = this.entries.find((line) => line.at)
    const moment = time === 'since' ? (since(entry.at, first?.at) ?? entry.time) : entry.time
    const level = entry.level ? LEVEL_TONE[entry.level] : null
    return html`<span class="lintje-log-viewer__toggle">
        ${
          entry.details
            ? html`<button
                type="button"
                class=${classMap({ 'lintje-log-viewer__open': true, 'is-open': details })}
                tabindex=${tab}
                aria-expanded=${String(details)}
                aria-label="Details"
                @click=${() => this.toggle('opened', entry.id)}
              >
                ${renderIcon('functioneel-delta-omlaag', { size: 16, rotate: details ? undefined : 270 })}
              </button>`
            : nothing
        }
      </span>
      ${
        columns.time
          ? html`<span class="lintje-log-viewer__time"
              >${
                moment
                  ? html`<button
                      type="button"
                      class="lintje-log-viewer__pick"
                      tabindex="-1"
                      title="Deze regel kiezen"
                      @click=${() =>
                        this.select(this.data?.selected === entry.id ? null : entry.id)}
                    >
                      <time datetime=${entry.at ?? nothing}>${moment}</time>
                    </button>`
                  : nothing
              }</span
            >`
          : nothing
      }
      ${
        columns.level
          ? html`<span class="lintje-log-viewer__level-cell"
              >${
                level && entry.level
                  ? renderBadge({
                      value: LEVEL_WORD[entry.level],
                      tone: level.tone,
                      icon: level.icon,
                    })
                  : nothing
              }</span
            >`
          : nothing
      }
      ${
        columns.source
          ? html`<span class="lintje-log-viewer__source">${entry.source ?? ''}</span>`
          : nothing
      }
      <span class="lintje-log-viewer__message">${message}</span>`
  }

  private toggle(set: 'unfolded' | 'opened', id: string): void {
    const next = new Set(this[set])
    if (!next.delete(id)) next.add(id)
    this[set] = next
  }

  private renderFoot(): TemplateResult {
    const data = this.data
    const shown = this.shown
    const chosen = data?.selected ? this.entries.find((e) => e.id === data.selected) : undefined
    const unreadAt = this.unreadFrom ? shown.findIndex((e) => e.id === this.unreadFrom) : -1
    const unread = !this.following && unreadAt !== -1 ? shown.length - unreadAt : 0
    const filtered = this.filtered
    const all = data?.counts?.all
    const count =
      filtered && all !== undefined
        ? `${formatNumber(shown.length)} van ${formatNumber(all)} regels`
        : `${formatNumber(all ?? shown.length)} regels`

    if (chosen) {
      return html`<div class="lintje-log-viewer__foot is-chosen">
        <span class="lintje-log-viewer__state">Regel van ${chosen.time ?? chosen.line ?? ''} gekozen</span>
        <span class="lintje-log-viewer__foot-actions">
          <lintje-button
            variant="tertiary"
            size="compact"
            @click=${() => void this.copy(lineText(chosen), 'line')}
            >${this.copied === 'line' ? 'Gekopieerd' : 'Regel kopiëren'}</lintje-button
          >
          <lintje-button
            variant="tertiary"
            size="compact"
            @click=${() => void this.copy(window.location.href, 'link')}
            >${this.copied === 'link' ? 'Gekopieerd' : 'Link naar regel'}</lintje-button
          >
          <lintje-icon-button
            icon="functioneel-kruis"
            label="Keuze opheffen"
            variant="flat"
            @click=${() => this.select(null)}
          ></lintje-icon-button>
        </span>
      </div>`
    }
    const live = Boolean(data?.live)
    // The word carries it; the dot only repeats it in the colour of a recording.
    const liveMark = live
      ? html`<span class="lintje-log-viewer__live"
          ><span class="lintje-log-viewer__dot" aria-hidden="true"></span>Live</span
        ><span class="lintje-log-viewer__sep" aria-hidden="true">·</span>`
      : nothing
    if (unread) {
      return html`<div class="lintje-log-viewer__foot is-away">
        <span class="lintje-log-viewer__state"
          >${liveMark}${renderBadge({ value: formatNumber(unread), variant: 'count' })}
          ${unread === 1 ? 'nieuwe regel onder' : 'nieuwe regels onder'}</span
        >
        <span class="lintje-log-viewer__count">${count}</span>
        <div class="lintje-log-viewer__latest">
          <span class="lintje-log-viewer__latest-button">
            <lintje-button
              variant="tertiary"
              size="chrome"
              icon="functioneel-pijl-omlaag"
              @click=${() => this.toLatest()}
              >Naar nieuwste</lintje-button
            >
          </span>
        </div>
      </div>`
    }
    return html`<div class="lintje-log-viewer__foot">
      <span class="lintje-log-viewer__state">
        ${liveMark}${
          !live
            ? 'Er komen geen regels meer bij.'
            : this.following
              ? 'Volgt de nieuwste regel. Scrol omhoog om stil te staan.'
              : 'Staat stil. Scrol helemaal naar onder om weer te volgen.'
        }
      </span>
      <span class="lintje-log-viewer__count">${count}</span>
    </div>`
  }
}

define('lintje-log-viewer', LintjeLogViewer)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-log-viewer': LintjeLogViewer
  }
}
