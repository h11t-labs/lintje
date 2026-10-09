/**
 * `LintjePlayerElement` — what the audio and video players share; registers no tag.
 *
 * Events: `lintje-time-change` (seconds; at most four a second while playing, at once after a
 * seek or pause), `lintje-seek` (seconds: the reader moved the position, with the bar, a key or a
 * skip), `lintje-play`, `lintje-pause`.
 *
 * Setting `currentTime` seeks without an event of its own, so a host that answers
 * `lintje-time-change` by setting it cannot loop. A seek before the duration is known is kept.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement } from '../../../core/element'
import { holdsFocus } from '../../../core/focus'
import { styleProps } from '../../../core/style-props'
import { renderIcon } from '../../../icons/render'
import {
  RateLimit,
  clampTime,
  formatTime,
  playedFraction,
  seekForKey,
  timeAtPointer,
  valueText,
} from './playback'

/** A keydown on these keeps its native meaning. */
const NATIVE_KEYS = new Set(['BUTTON', 'SELECT', 'INPUT', 'TEXTAREA', 'A'])

export abstract class LintjePlayerElement extends LintjeElement {
  static override properties: PropertyDeclarations = {
    src: { type: String },
    name: { type: String },
    duration: { type: Number },
    position: { state: true },
    heard: { state: true },
    playing: { state: true },
    ready: { state: true },
    failed: { state: true },
    mediaDuration: { state: true },
    speed: { state: true },
  }

  /** The recording's URL. Without it the controls are disabled. */
  src: string = ''
  /** The recording's name: the accessible name of the player's group. */
  name: string = ''
  /** The duration in seconds, shown before the media has loaded. */
  declare duration?: number

  protected position: number = 0
  /**
   * The position the slider states. It follows playback only while the slider has no focus: a
   * value that changes every second is read out every second.
   */
  protected heard: number = 0
  protected playing: boolean = false
  protected ready: boolean = false
  protected failed: boolean = false
  protected mediaDuration: number = Number.NaN
  protected speed: number = 1

  private pendingSeek: number | null = null
  private readonly limit = new RateLimit()
  private listening: HTMLMediaElement | null = null

  protected abstract readonly mediaSelector: string

  /** The position in seconds. Setting it seeks; it sends no event of its own. */
  get currentTime(): number {
    return this.position
  }

  set currentTime(seconds: number) {
    this.seek(Number(seconds))
  }

  protected get media(): HTMLMediaElement | null {
    return this.renderRoot?.querySelector<HTMLMediaElement>(this.mediaSelector) ?? null
  }

  protected get length(): number {
    if (Number.isFinite(this.mediaDuration) && this.mediaDuration > 0) return this.mediaDuration
    return this.duration && this.duration > 0 ? this.duration : 0
  }

  /** Moves the media to `seconds`; with `report` the host hears at once. */
  protected seek(seconds: number, report = false): void {
    const length = this.length
    const target = length > 0 ? clampTime(seconds, length) : Math.max(0, seconds || 0)
    this.position = target
    this.heard = target
    const media = this.media
    if (media && this.ready) {
      if (Math.abs(media.currentTime - target) > 0.01) media.currentTime = target
    } else {
      this.pendingSeek = target
    }
    if (report) {
      this.emit('lintje-seek', target)
      this.report(true)
    }
  }

  protected report(force: boolean): void {
    if (this.limit.allow(Date.now(), force)) this.emit('lintje-time-change', this.position)
  }

  protected toggle(): void {
    const media = this.media
    if (!media || !this.ready) return
    if (media.paused) {
      const started = media.play() as Promise<void> | undefined
      // A refusal (no user gesture, a broken file) rejects; the error event reports it.
      started?.catch?.(() => undefined)
    } else {
      media.pause()
    }
  }

  /** Plays from where it stands: what "Fragment afspelen" asks after a seek. */
  play(): void {
    if (this.media?.paused) this.toggle()
  }

  protected skip(seconds: number): void {
    this.seek(this.position + seconds, true)
  }

  protected setSpeed(speed: number): void {
    this.speed = speed
    const media = this.media
    if (media) media.playbackRate = speed
  }

  protected retry(): void {
    this.failed = false
    this.media?.load()
  }

  private readonly onMetadata = (): void => {
    const media = this.media
    if (!media) return
    this.mediaDuration = media.duration
    this.ready = true
    this.failed = false
    media.playbackRate = this.speed
    if (this.pendingSeek !== null) {
      const target = this.pendingSeek
      this.pendingSeek = null
      this.seek(target)
    }
  }

  private readonly onTimeUpdate = (): void => {
    const media = this.media
    if (!media) return
    this.position = media.currentTime
    const slider = this.renderRoot.querySelector('[role="slider"][aria-label="Positie"]')
    if (!slider || !holdsFocus(slider)) this.heard = this.position
    this.report(false)
  }

  private readonly onSeeked = (): void => {
    const media = this.media
    if (!media) return
    this.position = media.currentTime
    this.heard = this.position
    this.report(true)
  }

  private readonly onPlay = (): void => {
    this.playing = true
    this.emit('lintje-play')
  }

  private readonly onPause = (): void => {
    if (!this.playing) return
    this.playing = false
    const media = this.media
    if (media) this.position = media.currentTime
    this.heard = this.position
    this.emit('lintje-pause')
    this.report(true)
  }

  private readonly onError = (): void => {
    this.failed = true
    this.ready = false
    this.playing = false
  }

  private readonly mediaEvents: [string, () => void][] = [
    ['loadedmetadata', this.onMetadata],
    ['durationchange', this.onMetadata],
    ['timeupdate', this.onTimeUpdate],
    ['seeked', this.onSeeked],
    ['play', this.onPlay],
    ['pause', this.onPause],
    ['ended', this.onPause],
    ['error', this.onError],
  ]

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('src') && changed.get('src') !== undefined) {
      this.ready = false
      this.failed = false
      this.playing = false
      this.position = 0
      this.heard = 0
      this.mediaDuration = Number.NaN
      this.pendingSeek = null
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    const media = this.media
    if (media === this.listening) return
    for (const [name, handler] of this.mediaEvents) {
      this.listening?.removeEventListener(name, handler)
      media?.addEventListener(name, handler)
    }
    this.listening = media
  }

  /** Space plays or pauses wherever the focus is in the player, except on a native control. */
  protected onGroupKeydown(event: KeyboardEvent): void {
    if (event.key !== ' ' || event.ctrlKey || event.metaKey || event.altKey) return
    const target = event.composedPath()[0] as HTMLElement | undefined
    if (target && NATIVE_KEYS.has(target.tagName)) return
    if (target?.closest?.('lintje-select, lintje-menu-button')) return
    event.preventDefault()
    this.toggle()
  }

  protected onSliderKeydown(event: KeyboardEvent): void {
    if (!this.ready) return
    const next = seekForKey(event.key, this.position, this.length)
    if (next === null) return
    event.preventDefault()
    this.seek(next, true)
  }

  private seekFromPointer(event: PointerEvent): void {
    const track = event.currentTarget as HTMLElement
    const box = track.getBoundingClientRect()
    this.seek(timeAtPointer(event.clientX, box.left, box.width, this.length), true)
  }

  protected onSliderPointerDown(event: PointerEvent): void {
    if (!this.ready || event.button !== 0) return
    const track = event.currentTarget as HTMLElement
    track.setPointerCapture?.(event.pointerId)
    track.focus()
    this.seekFromPointer(event)
  }

  protected onSliderPointerMove(event: PointerEvent): void {
    const track = event.currentTarget as HTMLElement
    if (!this.ready || !track.hasPointerCapture?.(event.pointerId)) return
    this.seekFromPointer(event)
  }

  /** `aria-disabled` while not ready: it stays in the tab order, its press is swallowed. */
  protected renderPlay(): TemplateResult {
    const label = this.playing ? 'Pauzeren' : 'Afspelen'
    const disabled = !this.ready
    return html`<button
      type="button"
      class=${classMap({
        'lintje-button': true,
        'lintje-button--primary': true,
        'lintje-player__play': true,
        'is-disabled': disabled,
      })}
      aria-label=${label}
      title=${label}
      aria-disabled=${disabled ? 'true' : nothing}
      @click=${() => {
        if (!disabled) this.toggle()
      }}
    >
      ${renderIcon(this.playing ? 'multimedia-player-pauze' : 'multimedia-player-afspelen', { size: 20 })}
    </button>`
  }

  protected renderIconButton(
    icon: string,
    label: string,
    onClick: () => void,
    options: { flip?: boolean; disabled?: boolean; pressed?: boolean; className?: string } = {},
  ): TemplateResult {
    const disabled = options.disabled ?? !this.ready
    return html`<button
      type="button"
      class="lintje-icon-button lintje-icon-button--flat lintje-player__icon-button ${
        disabled ? 'is-disabled' : ''
      } ${options.className ?? ''}"
      aria-label=${label}
      title=${label}
      aria-pressed=${options.pressed === undefined ? nothing : String(options.pressed)}
      aria-disabled=${disabled ? 'true' : nothing}
      @click=${() => {
        if (!disabled) onClick()
      }}
    >
      ${renderIcon(icon, { size: 20, flip: options.flip ? 'horizontal' : undefined })}
    </button>`
  }

  protected sliderLabel(): string {
    return valueText(this.heard, this.length)
  }

  protected renderBar(): TemplateResult {
    const length = this.length
    const played = playedFraction(this.position, length) * 100
    return html`<div
      class=${classMap({ 'lintje-player__bar': true, 'is-disabled': !this.ready })}
      role="slider"
      tabindex=${this.ready ? '0' : '-1'}
      aria-label="Positie"
      aria-valuemin="0"
      aria-valuemax=${Math.round(length)}
      aria-valuenow=${Math.round(this.heard)}
      aria-valuetext=${this.sliderLabel()}
      aria-disabled=${this.ready ? nothing : 'true'}
      @keydown=${this.onSliderKeydown}
      @pointerdown=${this.onSliderPointerDown}
      @pointermove=${this.onSliderPointerMove}
    >
      <div class="lintje-player__bar-fill" ${styleProps({ width: `${played}%` })}></div>
      <div class="lintje-player__bar-handle" ${styleProps({ left: `${played}%` })}></div>
    </div>`
  }

  protected renderTime(full: boolean): TemplateResult {
    const length = formatTime(this.length)
    if (!full) return html`<span class="lintje-player__time is-muted">${length}</span>`
    return html`<span class="lintje-player__time"
      ><strong class="lintje-player__position">${formatTime(this.position)}</strong>
      <span class="lintje-player__duration">/ ${length}</span></span
    >`
  }
}
