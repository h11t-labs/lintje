/**
 * `<lintje-audio-player>` — plays a recording: play between two 15-second skips, the position
 * as a slider, the time, the volume and the speed.
 *
 * With `.peaks` (0–1) the slider is the waveform, without them a bar. With `.segments` — the
 * transcript's `{ start, speaker }[]` — every speaker takes a colour, named in a legend above
 * (`no-legend` leaves it to the transcript, which names the same colours).
 * `compact` puts everything on one line; a phone has no room for it and keeps the column.
 * `flush` drops its own frame, for a bar the page draws around it. Never autoplays.
 * `.currentTime` seeks.
 *
 * Events: `lintje-time-change` (seconds, at most four times a second), `lintje-seek` (seconds:
 * the reader moved the position), `lintje-play`, `lintje-pause`.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { define } from '../../../core/element'
import { MediaController, MOBILE } from '../../../core/media'
import { styleProps } from '../../../core/style-props'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import buttonCss from '../../../primitives/button/button.css?inline'
import iconButtonCss from '../../../primitives/icon-button/icon-button.css?inline'
import '../../../primitives/button/button'
import '../../../primitives/skeleton/skeleton'
import '../../feedback/announcement/announcement'
import '../../actions/menu-button/menu-button'
import type { MenuEntry } from '../../actions/menu-button/menu-button'
import type { AnnouncementViewData } from '../../../types'
import {
  SKIP_STEP,
  SPEEDS,
  barCount,
  formatTime,
  playedFraction,
  resamplePeaks,
  speakerAt,
  speakerColours,
  speakerStretches,
  speedLabel,
  timeAtPointer,
  valueText,
  volumeForKey,
  type SpeakerColour,
  type SpeakerTurn,
} from './playback'
import { LintjePlayerElement } from './player'
import playerCss from './player.css?inline'
import audioPlayerCss from './audio-player.css?inline'

export type { SpeakerTurn } from './playback'

const FAILED: AnnouncementViewData = {
  kind: 'outage',
  text: 'De opname kan niet worden geladen.',
  // A failed load is spoken.
  live: true,
}

/** A speaker's colour, for `--lintje-speaker`; `null` where nobody speaks yet. */
const speakerFill = (colour: SpeakerColour | undefined): string | null =>
  colour ? `var(--color-chart-${colour})` : null

/** Where unmuting a slider pulled down to nothing starts again. */
const UNMUTE_VOLUME = 0.5

export class LintjeAudioPlayer extends LintjePlayerElement {
  static override styles = [
    iconStyles,
    shadowCss(buttonCss),
    shadowCss(iconButtonCss),
    shadowCss(playerCss),
    shadowCss(audioPlayerCss),
  ]

  static override properties: PropertyDeclarations = {
    peaks: { attribute: false },
    segments: { attribute: false },
    noLegend: { type: Boolean, attribute: 'no-legend' },
    compact: { type: Boolean, reflect: true },
    flush: { type: Boolean, reflect: true },
    hoverTime: { state: true },
    waveWidth: { state: true },
    volume: { state: true },
    muted: { state: true },
  }

  /** The waveform's peaks, 0–1. Without them the position is a bar. */
  declare peaks?: number[] | null
  /** Who speaks when: the transcript's segments, or any `{ start, speaker }[]` in time order. */
  segments: SpeakerTurn[] = []
  /** Leaves the legend out where the transcript beside it names every colour. */
  noLegend: boolean = false
  /** Everything on one line, for a row or a tile. */
  compact: boolean = false
  /** No frame of its own: the page's bar around it is the frame. */
  flush: boolean = false

  protected hoverTime: number | null = null
  protected waveWidth: number = 0
  protected volume: number = 1
  protected muted: boolean = false

  protected readonly mediaSelector = 'audio'
  private readonly mobile = new MediaController(this, MOBILE)
  private observer: ResizeObserver | null = null
  private observed: Element | null = null

  private get hasPeaks(): boolean {
    return Boolean(this.peaks && this.peaks.length > 0)
  }

  private get colours(): Map<string, SpeakerColour> {
    return speakerColours(this.segments ?? [])
  }

  override disconnectedCallback(): void {
    this.observer?.disconnect()
    this.observer = null
    this.observed = null
    super.disconnectedCallback()
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    const wave = this.renderRoot.querySelector('.lintje-audio-player__wave')
    if (wave === this.observed) return
    this.observer?.disconnect()
    this.observed = wave
    if (!wave || typeof ResizeObserver === 'undefined') return
    this.observer = new ResizeObserver((entries) => {
      const width = Math.round(entries[0]?.contentRect.width ?? 0)
      if (width !== this.waveWidth) this.waveWidth = width
    })
    this.observer.observe(wave)
  }

  /** The slider also says who speaks, so the colours are never the only way to know. */
  protected override sliderLabel(): string {
    const speaker = speakerAt(this.segments ?? [], this.heard)
    const time = valueText(this.heard, this.length)
    return speaker ? `${time}, ${speaker}` : time
  }

  private setVolume(volume: number): void {
    this.volume = volume
    this.muted = volume === 0
    this.applyVolume()
  }

  private toggleMute(): void {
    if (this.muted && this.volume === 0) this.volume = UNMUTE_VOLUME
    this.muted = !this.muted
    this.applyVolume()
  }

  private applyVolume(): void {
    const media = this.media
    if (!media) return
    media.volume = this.volume
    media.muted = this.muted
  }

  private onWaveMove(event: PointerEvent): void {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
    this.hoverTime = this.ready
      ? timeAtPointer(event.clientX, box.left, box.width, this.length)
      : null
    this.onSliderPointerMove(event)
  }

  /** "Opnieuw proberen" goes away with the failure: the focus moves to the play button. */
  private readonly onRetry = (): void => {
    this.retry()
    void this.updateComplete.then(() =>
      this.renderRoot.querySelector<HTMLElement>('.lintje-player__play')?.focus(),
    )
  }

  private volumeFromPointer(event: PointerEvent): void {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
    this.setVolume(Math.round(timeAtPointer(event.clientX, box.left, box.width, 1) * 100) / 100)
  }

  private onVolumePointerDown(event: PointerEvent): void {
    if (event.button !== 0) return
    const track = event.currentTarget as HTMLElement
    track.setPointerCapture?.(event.pointerId)
    track.focus()
    this.volumeFromPointer(event)
  }

  private onVolumePointerMove(event: PointerEvent): void {
    const track = event.currentTarget as HTMLElement
    if (track.hasPointerCapture?.(event.pointerId)) this.volumeFromPointer(event)
  }

  private onVolumeKeydown(event: KeyboardEvent): void {
    const next = volumeForKey(event.key, this.muted ? 0 : this.volume)
    if (next === null) return
    event.preventDefault()
    this.setVolume(next)
  }

  private onSpeedMenu(event: CustomEvent<string>): void {
    // The menu belongs to this player; its action is not the host's.
    event.stopPropagation()
    this.setSpeed(Number(event.detail))
  }

  private renderCursor(): TemplateResult | typeof nothing {
    const hover = this.hoverTime
    if (hover === null) return nothing
    const speaker = speakerAt(this.segments ?? [], hover)
    return html`<span
      class="lintje-audio-player__cursor"
      aria-hidden="true"
      ${styleProps({ left: `${playedFraction(hover, this.length) * 100}%` })}
      ><span class="lintje-audio-player__cursor-time"
        >${formatTime(hover)}${speaker ? ` · ${speaker}` : ''}</span
      ></span
    >`
  }

  private renderWave(): TemplateResult {
    const peaks = this.peaks ?? []
    // No bars until measured: the full set would overflow for a frame.
    const measuring = typeof ResizeObserver !== 'undefined' && this.waveWidth === 0
    const count = this.waveWidth > 0 ? barCount(this.waveWidth) : measuring ? 0 : peaks.length
    const bars = resamplePeaks(peaks, count)
    const played = Math.round(playedFraction(this.position, this.length) * bars.length)
    const turns = this.segments ?? []
    const colours = this.colours
    const length = this.length
    return html`<div
      class="lintje-audio-player__wave"
      role="slider"
      tabindex="0"
      aria-label="Positie"
      aria-valuemin="0"
      aria-valuemax=${Math.round(this.length)}
      aria-valuenow=${Math.round(this.heard)}
      aria-valuetext=${this.sliderLabel()}
      @keydown=${this.onSliderKeydown}
      @pointerdown=${this.onSliderPointerDown}
      @pointermove=${this.onWaveMove}
      @pointerleave=${() => (this.hoverTime = null)}
    >
      ${bars.map((peak, index) => {
        const speaker = speakerAt(turns, ((index + 0.5) / bars.length) * length)
        const colour = speaker ? colours.get(speaker) : undefined
        return html`<span
          class=${classMap({
            'lintje-audio-player__peak': true,
            'is-played': index < played,
            'has-speaker': Boolean(colour),
          })}
          ${styleProps({
            height: `${Math.max(peak, 0.08) * 100}%`,
            '--lintje-speaker': speakerFill(colour),
          })}
        ></span>`
      })}
      <span
        class="lintje-audio-player__head"
        aria-hidden="true"
        ${styleProps({ left: `${playedFraction(this.position, length) * 100}%` })}
      ></span>
      ${this.renderCursor()}
    </div>`
  }

  /** The bar without peaks; with speakers its stretches take their colours. */
  private renderTrack(): TemplateResult {
    const length = this.length
    const played = playedFraction(this.position, length)
    const colours = this.colours
    const pieces = speakerStretches(this.segments ?? [], length).flatMap((stretch) => {
      const colour = colours.get(stretch.speaker)
      const cut = Math.min(Math.max(played, stretch.from), stretch.to)
      return [
        { from: stretch.from, to: cut, colour, played: true },
        { from: cut, to: stretch.to, colour, played: false },
      ].filter((piece) => piece.to > piece.from)
    })
    return html`<div
      class="lintje-player__bar lintje-audio-player__bar"
      role="slider"
      tabindex="0"
      aria-label="Positie"
      aria-valuemin="0"
      aria-valuemax=${Math.round(this.length)}
      aria-valuenow=${Math.round(this.heard)}
      aria-valuetext=${this.sliderLabel()}
      @keydown=${this.onSliderKeydown}
      @pointerdown=${this.onSliderPointerDown}
      @pointermove=${this.onWaveMove}
      @pointerleave=${() => (this.hoverTime = null)}
    >
      ${
        pieces.length === 0
          ? html`<div
              class="lintje-player__bar-fill"
              ${styleProps({ width: `${played * 100}%` })}
            ></div>`
          : pieces.map(
              (piece) =>
                html`<span
                  class=${classMap({
                    'lintje-audio-player__stretch': true,
                    'is-played': piece.played,
                  })}
                  ${styleProps({
                    left: `${piece.from * 100}%`,
                    width: `${(piece.to - piece.from) * 100}%`,
                    '--lintje-speaker': speakerFill(piece.colour),
                  })}
                ></span>`,
            )
      }
      <span
        class="lintje-audio-player__head"
        aria-hidden="true"
        ${styleProps({ left: `${played * 100}%` })}
      ></span>
      ${this.renderCursor()}
    </div>`
  }

  private renderSlider(): TemplateResult {
    if (this.failed) {
      return html`<lintje-announcement compact class="lintje-audio-player__alert" .data=${FAILED}>
        <lintje-button slot="action" variant="link" @click=${this.onRetry}
          >Opnieuw proberen</lintje-button
        >
      </lintje-announcement>`
    }
    if (!this.ready) {
      return html`<lintje-skeleton
        class="lintje-audio-player__skeleton"
        height=${this.hasPeaks ? '48' : '6'}
      ></lintje-skeleton>`
    }
    return this.hasPeaks ? this.renderWave() : this.renderTrack()
  }

  private renderLegend(): TemplateResult | typeof nothing {
    const colours = this.colours
    if (colours.size === 0 || this.noLegend) return nothing
    const current = speakerAt(this.segments ?? [], this.position)
    return html`<ul class="lintje-audio-player__legend" aria-label="Sprekers">
      ${[...colours].map(
        ([speaker, colour]) =>
          html`<li
            class=${classMap({
              'lintje-audio-player__speaker': true,
              'is-current': speaker === current,
            })}
          >
            <span
              class="lintje-audio-player__swatch"
              aria-hidden="true"
              ${styleProps({ '--lintje-speaker': speakerFill(colour) })}
            ></span>
            <span>${speaker}</span>
            ${
              speaker === current
                ? html`<span class="lintje-audio-player__now">spreekt nu</span>`
                : nothing
            }
          </li>`,
      )}
    </ul>`
  }

  private renderSkip(direction: -1 | 1): TemplateResult {
    const label = `${SKIP_STEP} seconden ${direction < 0 ? 'terug' : 'vooruit'}`
    const disabled = !this.ready
    return html`<button
      type="button"
      class=${classMap({
        'lintje-icon-button': true,
        'lintje-icon-button--flat': true,
        'lintje-player__icon-button': true,
        'lintje-audio-player__skip': true,
        'is-disabled': disabled,
      })}
      aria-label=${label}
      title=${label}
      aria-disabled=${disabled ? 'true' : nothing}
      @click=${() => {
        if (!disabled) this.skip(direction * SKIP_STEP)
      }}
    >
      ${renderIcon('functioneel-dubbel-delta-rechts', {
        size: 20,
        flip: direction < 0 ? 'horizontal' : undefined,
      })}
      <span class="lintje-audio-player__step" aria-hidden="true">${SKIP_STEP}</span>
    </button>`
  }

  private renderTransport(): TemplateResult {
    return html`<div class="lintje-audio-player__transport">
      ${this.renderSkip(-1)} ${this.renderPlay()} ${this.renderSkip(1)}
    </div>`
  }

  private renderMute(): TemplateResult {
    return this.renderIconButton(
      this.muted ? 'functioneel-geluid-uit' : 'functioneel-geluid-aan',
      'Geluid dempen',
      () => this.toggleMute(),
      { disabled: false, pressed: this.muted },
    )
  }

  private renderVolume(): TemplateResult {
    const level = this.muted ? 0 : this.volume
    const percent = Math.round(level * 100)
    return html`<div class="lintje-audio-player__volume">
      ${this.renderMute()}
      <div
        class="lintje-audio-player__level"
        role="slider"
        tabindex="0"
        aria-label="Volume"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow=${percent}
        aria-valuetext=${this.muted ? 'Gedempt' : `${percent} procent`}
        @keydown=${this.onVolumeKeydown}
        @pointerdown=${this.onVolumePointerDown}
        @pointermove=${this.onVolumePointerMove}
      >
        <div class="lintje-audio-player__level-fill" ${styleProps({ width: `${percent}%` })}></div>
      </div>
    </div>`
  }

  /** Beside the volume bar an icon says the label is the speed; alone, on a phone, it needs none. */
  private renderSpeed(mobile = false): TemplateResult {
    const items: MenuEntry[] = SPEEDS.map((speed) => ({
      value: String(speed.value),
      label: speed.label,
      checked: speed.value === this.speed,
      radio: true,
    }))
    const label = speedLabel(this.speed)
    return html`<lintje-menu-button
      class="lintje-audio-player__speed"
      variant="flat"
      placement="bottom-end"
      leading-icon=${mobile ? '' : 'multimedia-player-vooruitspoelen'}
      label=${label}
      accessible-label=${`Afspeelsnelheid ${label}`}
      ?disabled=${!this.ready}
      .items=${items}
      @lintje-action=${this.onSpeedMenu}
    ></lintje-menu-button>`
  }

  /** On a phone the times stand under the slider: the row has room for the buttons only. */
  private renderTimes(): TemplateResult {
    return html`<div class="lintje-audio-player__times">
      <strong class="lintje-player__position">${formatTime(this.position)}</strong>
      <span class="lintje-player__duration">${formatTime(this.length)}</span>
    </div>`
  }

  /** A phone has its own volume buttons: there the player only mutes. */
  private renderFull(mobile: boolean): TemplateResult {
    return html`${this.renderLegend()} ${this.renderSlider()}
      ${mobile && !this.failed ? this.renderTimes() : nothing}
      <div class="lintje-audio-player__controls">
        <div class="lintje-audio-player__start">
          ${mobile ? this.renderMute() : this.renderTime(true)}
        </div>
        ${this.renderTransport()}
        <div class="lintje-audio-player__end">
          ${mobile ? nothing : this.renderVolume()} ${this.renderSpeed(mobile)}
        </div>
      </div>`
  }

  private renderCompact(): TemplateResult {
    return html`${this.renderLegend()} ${this.renderTransport()} ${this.renderSlider()}
    ${this.renderTime(true)} ${this.renderVolume()} ${this.renderSpeed()}`
  }

  protected override render(): TemplateResult {
    const mobile = this.mobile.matches
    const compact = this.compact && !mobile
    return html`<div
      class=${classMap({
        'lintje-audio-player': true,
        'lintje-audio-player--compact': compact,
        'lintje-audio-player--flush': this.flush,
      })}
      role="group"
      aria-label=${this.name || 'Opname'}
      @keydown=${this.onGroupKeydown}
    >
      <audio class="lintje-player__media" preload="metadata" src=${this.src || nothing}></audio>
      ${compact ? this.renderCompact() : this.renderFull(mobile)}
    </div>`
  }
}

define('lintje-audio-player', LintjeAudioPlayer)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-audio-player': LintjeAudioPlayer
  }
}
