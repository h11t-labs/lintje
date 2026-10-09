/**
 * `<lintje-filter-bar>` — the host's declared filters in the filter zone and, below 768 px,
 * the sheet. Values cross as the canonical strings the host writes to the URL. A change in the
 * bar commits at once; the sheet commits on "Toepassen". The host confirms with the next
 * `data`. Put one filter bar on a page: two would both write the count and own the sheet.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type TemplateResult,
  type PropertyValues,
} from 'lit'
import { LintjeElement, define, type FrameSettings } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import '../../inputs/field/field'
import '../../inputs/segmented/segmented'
import '../../inputs/select/select'
import '../../inputs/multiselect/multiselect'
import '../../inputs/range/range'
import '../../inputs/date-range/date-range'
import '../../inputs/toggle/toggle'
import '../../inputs/text-input/text-input'
import '../../inputs/number-input/number-input'
import '../filter-zone/filter-zone'
import '../filter-sheet/filter-sheet'
import { MOBILE, MediaController } from '../../../core/media'
import {
  clearFilterZone,
  FrameStateController,
  setFrameState,
  setScrolled,
} from '../../../core/frame-state'
import { sentenceText, type SentencePart } from '../shared/sentence'
import type { DateRange } from '../../inputs/date-range/date-range'
import type { FilterBarData, FilterDefinition, FilterValue } from '../../../types'
import layoutCss from '../shared/filter-layout.css?inline'

type Values = Record<string, FilterValue>

const same = (a: FilterValue | undefined, b: FilterValue | undefined): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

// Dates: the picker writes dd-mm-yyyy, the host and the URL ISO.
const isoToPicker = (iso: string | null): string | null =>
  iso ? iso.split('-').reverse().join('-') : null
const pickerToIso = (date: string | null): string | null =>
  date ? date.split('-').reverse().join('-') : null
const isoToDate = (iso: string): Date => {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function optionLabel(filter: FilterDefinition, value: string): string {
  return filter.options?.find((option) => option.value === value)?.label ?? value
}

function valueText(filter: FilterDefinition, value: FilterValue | undefined): string {
  switch (filter.kind) {
    case 'select':
    case 'segmented':
      return typeof value === 'string' && value !== '' ? optionLabel(filter, value) : 'alle'
    case 'multiselect': {
      const list = Array.isArray(value) ? (value as string[]) : []
      return list.length === 0 || list.length === filter.options?.length
        ? 'alle'
        : list.map((item) => optionLabel(filter, item)).join(', ')
    }
    case 'date-range': {
      const range = value as { from: string | null; to: string | null } | null
      return range?.from && range.to
        ? `${isoToPicker(range.from)} t/m ${isoToPicker(range.to)}`
        : 'alle datums'
    }
    case 'range': {
      const [from, to] = (value as [number, number] | null) ?? [0, (filter.steps?.length ?? 1) - 1]
      return `${filter.steps?.[from]} – ${filter.steps?.[to]}`
    }
    case 'slider':
      return typeof value === 'number' ? `${value}${filter.unit ? ` ${filter.unit}` : ''}` : 'alle'
    case 'toggle':
      return value === true ? 'aan' : 'uit'
    case 'text':
      return typeof value === 'string' && value !== '' ? value : 'alle'
    case 'number':
      return typeof value === 'number' ? `${value}${filter.unit ? ` ${filter.unit}` : ''}` : 'alle'
  }
}

function sentence(filters: FilterDefinition[], values: Values): SentencePart[] {
  const parts: SentencePart[] = [{ text: 'Je ziet: ', emphasis: false }]
  filters.forEach((filter, index) => {
    if (index > 0) parts.push({ text: ' · ', emphasis: false })
    parts.push({ text: `${filter.label} `, emphasis: false })
    parts.push({ text: valueText(filter, values[filter.key]), emphasis: true })
  })
  parts.push({ text: '.', emphasis: false })
  return parts
}

export class LintjeFilterBar extends LintjeElement {
  static override styles = shadowCss(layoutCss)

  static override properties: PropertyDeclarations = {
    data: { attribute: false },
    values: { state: true },
    draft: { state: true },
    open: { state: true },
  }

  declare data?: FilterBarData | null

  protected override get dataSettings(): FrameSettings | undefined {
    return this.data ?? undefined
  }

  values: Values = {}
  /** The sheet's draft: nothing applies before "Toepassen". */
  draft: Values = {}
  open: boolean = false

  private readonly mobile = new MediaController(this, MOBILE)
  private readonly frame = new FrameStateController(this)
  private sheetWasOpen = false
  private committed = ''
  private declaredOpen: boolean | undefined = undefined

  private get filters(): FilterDefinition[] {
    return this.data?.filters ?? []
  }

  /**
   * A `hidden` filter has its control in a tile, which writes the same URL key: the bar does
   * not draw it, count it in "n van m afwijkend" or reset it with "Herstel standaard".
   */
  private get visible(): FilterDefinition[] {
    return this.filters.filter((filter) => !filter.hidden)
  }

  private get defaults(): Values {
    return Object.fromEntries(this.visible.map((filter) => [filter.key, filter.default]))
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('data') && this.data) {
      const committed: Values = Object.fromEntries(
        this.visible.map((filter) => [filter.key, filter.value]),
      )
      // Compared by value, so a rerun with the same filters does not undo a change the bar has
      // just made and is still waiting to hear back about.
      const signature = JSON.stringify(committed)
      if (signature !== this.committed) {
        this.committed = signature
        this.values = committed
      }
      // Watched on the value, so a rerun that repeats it does not re-expand a collapsed bar.
      const declaredOpen = this.data.open ?? false
      if (declaredOpen !== this.declaredOpen) {
        this.declaredOpen = declaredOpen
        this.open = declaredOpen
      }
    }
    // A standalone bar keeps its hands off the shell: two bars writing one store would
    // re-render each other without end.
    if (this.data?.standalone) return
    const sheetOpen = this.frame.state.sheetOpen
    if (sheetOpen && !this.sheetWasOpen) this.draft = { ...this.values }
    this.sheetWasOpen = sheetOpen
    // Written while updating, not after: the store tells this element too, and a later write
    // would schedule a second update (lit.dev/msg/change-in-update).
    const parts = sentence(this.visible, this.values)
    setFrameState({
      hasFilters: true,
      modifiedCount: this.modifiedCount,
      summary: sentenceText(parts),
    })
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    if (!this.data?.standalone) clearFilterZone()
  }

  private isModified(source: Values, filter: FilterDefinition): boolean {
    return !same(source[filter.key], filter.default)
  }

  private get modifiedCount(): number {
    return this.visible.filter((filter) => this.isModified(this.values, filter)).length
  }

  private commit(next: Values): void {
    this.values = next
    this.emit('lintje-values-change', next)
  }

  private control(
    filter: FilterDefinition,
    value: FilterValue | undefined,
    modified: boolean,
    stacked: boolean,
    onChange: (value: FilterValue) => void,
  ): TemplateResult {
    const options = filter.options ?? []
    switch (filter.kind) {
      // Every control is `hide-label`: the `lintje-field` around it draws the label.
      case 'segmented':
        return html`<lintje-segmented
          ?stacked=${stacked}
          hide-label
          label=${filter.label}
          value=${(value as string) ?? ''}
          .options=${options}
          @lintje-change=${(event: CustomEvent<string>) => onChange(event.detail)}
        ></lintje-segmented>`
      case 'select':
        return html`<lintje-select
          ?stacked=${stacked}
          hide-label
          label=${filter.label}
          value=${(value as string) ?? ''}
          .options=${options}
          ?bold=${modified}
          @lintje-change=${(event: CustomEvent<string>) => onChange(event.detail)}
        ></lintje-select>`
      case 'multiselect':
        return html`<lintje-multiselect
          ?stacked=${stacked}
          hide-label
          label=${filter.label}
          .options=${options}
          .selected=${Array.isArray(value) ? (value as string[]) : []}
          @lintje-change=${(event: CustomEvent<string[]>) => onChange(event.detail)}
        ></lintje-multiselect>`
      case 'date-range': {
        const range = value as { from: string | null; to: string | null } | null
        return html`<lintje-date-range
          ?stacked=${stacked}
          hide-label
          accessible-name=${filter.label}
          .range=${{ from: isoToPicker(range?.from ?? null), to: isoToPicker(range?.to ?? null) }}
          .maxDate=${typeof filter.max === 'string' ? isoToDate(filter.max) : undefined}
          @lintje-change=${(event: CustomEvent<DateRange>) =>
            onChange({ from: pickerToIso(event.detail.from), to: pickerToIso(event.detail.to) })}
        ></lintje-date-range>`
      }
      case 'range': {
        const steps = filter.steps ?? []
        const [from, to] = (value as [number, number] | null) ?? [0, steps.length - 1]
        return html`<lintje-range
          ?stacked=${stacked}
          hide-label
          label=${filter.label}
          .steps=${steps}
          .from=${from}
          .to=${to}
          @lintje-change=${(event: CustomEvent<[number, number]>) => onChange(event.detail)}
        ></lintje-range>`
      }
      case 'slider': {
        const steps = filter.steps ?? []
        return html`<lintje-range
          single
          ?stacked=${stacked}
          hide-label
          label=${filter.label}
          unit=${filter.unit ?? nothing}
          .steps=${steps}
          .value=${typeof value === 'number' ? value : (steps[0] ?? null)}
          @lintje-change=${(event: CustomEvent<number>) => onChange(event.detail)}
        ></lintje-range>`
      }
      case 'toggle':
        return html`<lintje-toggle
          hide-label
          label=${filter.label}
          ?checked=${value === true}
          @lintje-change=${(event: CustomEvent<boolean>) => onChange(event.detail)}
        ></lintje-toggle>`
      case 'text':
        return html`<lintje-text-input
          ?stacked=${stacked}
          hide-label
          clearable
          label=${filter.label}
          .value=${typeof value === 'string' ? value : ''}
          placeholder=${filter.placeholder ?? nothing}
          @lintje-change=${(event: CustomEvent<string>) => onChange(event.detail)}
        ></lintje-text-input>`
      case 'number':
        return html`<lintje-number-input
          ?stacked=${stacked}
          hide-label
          label=${filter.label}
          .value=${typeof value === 'number' ? value : null}
          .min=${filter.min}
          .max=${typeof filter.max === 'number' ? filter.max : undefined}
          .step=${filter.step ?? 1}
          unit=${filter.unit ?? nothing}
          .stepper=${filter.unit === undefined}
          @lintje-change=${(event: CustomEvent<number | null>) => onChange(event.detail)}
        ></lintje-number-input>`
    }
  }

  private fields(
    source: Values,
    stacked: boolean,
    onChange: (next: Values) => void,
  ): TemplateResult {
    return html`${this.visible.map((filter) => {
      const modified = this.isModified(source, filter)
      return html`<lintje-field label=${filter.label} ?modified=${modified} ?stacked=${stacked}>
        ${this.control(filter, source[filter.key], modified, stacked, (value) =>
          onChange({ ...source, [filter.key]: value }),
        )}
      </lintje-field>`
    })}`
  }

  protected override render(): TemplateResult {
    const parts = sentence(this.visible, this.values)
    const sheetOpen = this.frame.state.sheetOpen && this.mobile.matches && !this.data?.standalone

    // `.open` is a property: `?open` would only add the attribute, never clear the zone's default.
    return html`
      <lintje-filter-zone
        stick="fixed"
        .total=${this.visible.length}
        .modified=${this.modifiedCount}
        .open=${this.open}
        ?scrolled=${this.frame.state.scrolled}
        .sentence=${parts}
        @lintje-filters-reset=${() => this.commit(this.defaults)}
        @lintje-zone-open-change=${(event: CustomEvent<boolean>) => {
          this.open = event.detail
          this.emit('lintje-filters-open-change', event.detail)
        }}
        @lintje-zone-scrolled-change=${(event: CustomEvent<boolean>) => setScrolled(event.detail)}
      >
        ${this.fields(this.values, false, (next) => this.commit(next))}
      </lintje-filter-zone>

      <lintje-filter-sheet
        ?open=${sheetOpen}
        .sentence=${sentence(this.visible, this.draft)}
        ?reset-disabled=${this.visible.every((filter) => !this.isModified(this.draft, filter))}
        @lintje-sheet-close=${() => setFrameState({ sheetOpen: false })}
        @lintje-filters-reset=${() => {
          this.draft = this.defaults
        }}
        @lintje-filters-apply=${() => {
          this.commit(this.draft)
          setFrameState({ sheetOpen: false })
        }}
      >
        ${this.fields(this.draft, true, (next) => {
          this.draft = next
        })}
      </lintje-filter-sheet>
    `
  }
}

define('lintje-filter-bar', LintjeFilterBar)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-filter-bar': LintjeFilterBar
  }
}
