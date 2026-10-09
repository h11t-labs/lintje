/**
 * `<lintje-video-player>` — the picture of a recording, with the audio player's controls.
 *
 * The controls stand under the picture, never over it, also in full screen: the bar with the time
 * on one line; play, mute, "Meer opties" and full screen on the next, at any width. The menu holds
 * the captions (also on C), the audio description when `described-src` gives a version with one
 * (it switches at the same moment) and the speed; a speed other than 1× stands beside the time. The
 * controls are `aria-disabled` (in the tab order, the press swallowed) while the video loads or
 * cannot be loaded; a failed load says so on the picture, with "Opnieuw proberen". The `<video>`
 * has no controls of its own and never starts by itself. It does not fetch the captions. The big
 * play button stands on the picture only before the start, and the caption shows only without
 * it, so the two never cover each other.
 *
 * Events: `lintje-time-change` (seconds, at most four times a second), `lintje-play`,
 * `lintje-pause`.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import buttonCss from '../../../primitives/button/button.css?inline'
import iconButtonCss from '../../../primitives/icon-button/icon-button.css?inline'
import '../../actions/menu-button/menu-button'
import type { MenuEntry } from '../../actions/menu-button/menu-button'
import { SPEEDS, indexAt, speedLabel } from '../audio-player/playback'
import { LintjePlayerElement } from '../audio-player/player'
import playerCss from '../audio-player/player.css?inline'
import videoPlayerCss from './video-player.css?inline'

export interface TimedText {
  start: number
  text: string
}

const CAPTIONS = 'ondertiteling'
const DESCRIBED = 'audiodescriptie'

/** A key that the player answers, unless it is typed into a field. No menu row starts with it. */
function ownKey(event: KeyboardEvent, key: string): boolean {
  if (event.key.toLowerCase() !== key || event.ctrlKey || event.metaKey || event.altKey)
    return false
  return !event
    .composedPath()
    .some((node) => ['INPUT', 'TEXTAREA'].includes((node as Element).tagName ?? ''))
}

export class LintjeVideoPlayer extends LintjePlayerElement {
  static override styles = [
    iconStyles,
    shadowCss(buttonCss),
    shadowCss(iconButtonCss),
    shadowCss(playerCss),
    shadowCss(videoPlayerCss),
  ]

  static override properties: PropertyDeclarations = {
    segments: { attribute: false },
    captions: { type: Boolean, reflect: true },
    describedSrc: { type: String, attribute: 'described-src' },
    described: { type: Boolean, reflect: true },
    fullscreen: { state: true },
    muted: { state: true },
  }

  /** The captions: the transcript's segments, or any `{ start, text }[]`. */
  segments: TimedText[] = []
  /** Whether the captions show; the reader switches it. */
  captions: boolean = false
  /** The same video with an audio description: "Meer opties" offers it when given. */
  declare describedSrc?: string
  /** Whether the described version plays; the reader switches it. */
  described: boolean = false

  protected fullscreen: boolean = false
  protected muted: boolean = false

  protected readonly mediaSelector = 'video'

  private get frame(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.lintje-video-player')
  }

  private readonly onFullscreenChange = (): void => {
    const current = (this.shadowRoot as ShadowRoot & { fullscreenElement?: Element | null })
      ?.fullscreenElement
    this.fullscreen = current != null && current === this.frame
  }

  override connectedCallback(): void {
    super.connectedCallback()
    document.addEventListener('fullscreenchange', this.onFullscreenChange)
  }

  override disconnectedCallback(): void {
    document.removeEventListener('fullscreenchange', this.onFullscreenChange)
    super.disconnectedCallback()
  }

  /** What the `<video>` plays: the described version when the reader chose it. */
  private get source(): string {
    return this.described && this.describedSrc ? this.describedSrc : this.src
  }

  /** The other version goes on at the same moment, and plays on if this one played. */
  private async switchDescribed(): Promise<void> {
    const at = this.position
    const resume = this.playing
    this.described = !this.described
    this.ready = false
    this.playing = false
    this.seek(at)
    await this.updateComplete
    const media = this.media
    if (!resume || !media) return
    media.addEventListener(
      'loadedmetadata',
      () => void (media.play() as Promise<void> | undefined)?.catch?.(() => undefined),
      { once: true },
    )
  }

  private get caption(): string {
    const index = indexAt(this.segments, this.position)
    return index < 0 ? '' : (this.segments[index]?.text ?? '')
  }

  /** At the start, before anything sounds; the caption takes its place once the video moves. */
  private get waiting(): boolean {
    return !this.playing && this.position === 0
  }

  private get menuItems(): MenuEntry[] {
    return [
      { value: CAPTIONS, label: 'Ondertiteling', checked: this.captions, hint: 'C' },
      ...(this.describedSrc
        ? [{ value: DESCRIBED, label: 'Audiodescriptie', checked: this.described }]
        : []),
      'separator',
      { heading: 'Afspeelsnelheid' },
      ...SPEEDS.map((speed) => ({
        value: String(speed.value),
        label: speed.label,
        checked: speed.value === this.speed,
        radio: true,
      })),
    ]
  }

  /** Entering waits until the video has loaded; leaving always works. */
  private toggleFullscreen(): void {
    if (this.fullscreen) {
      if (typeof document.exitFullscreen === 'function') {
        void document.exitFullscreen().catch(() => undefined)
      }
      return
    }
    const frame = this.frame
    if (!frame || !this.ready) return
    void frame.requestFullscreen?.()?.catch?.(() => undefined)
  }

  /** The big button goes away once it plays: the focus moves to the play button below. */
  private readonly onBigPlay = (): void => {
    if (!this.ready) return
    this.toggle()
    void this.updateComplete.then(() =>
      this.renderRoot.querySelector<HTMLElement>('.lintje-player__play')?.focus(),
    )
  }

  /** The retry button goes away with the failure: the focus moves to the play button there. */
  private readonly onRetry = (): void => {
    this.retry()
    void this.updateComplete.then(() =>
      this.renderRoot
        .querySelector<HTMLElement>('.lintje-video-player__big-play, .lintje-player__play')
        ?.focus(),
    )
  }

  private onMenuAction(event: CustomEvent<string>): void {
    // The menu belongs to this player; its action is not the host's.
    event.stopPropagation()
    if (event.detail === CAPTIONS) this.captions = !this.captions
    else if (event.detail === DESCRIBED) void this.switchDescribed()
    else this.setSpeed(Number(event.detail))
  }

  private onKeydown(event: KeyboardEvent): void {
    if (ownKey(event, 'f')) {
      event.preventDefault()
      this.toggleFullscreen()
      return
    }
    if (ownKey(event, 'c')) {
      event.preventDefault()
      this.captions = !this.captions
      return
    }
    this.onGroupKeydown(event)
  }

  private renderFailed(): TemplateResult {
    // It answers a failed load, so it is spoken.
    return html`<div class="lintje-video-player__failed" role="alert">
      <span class="lintje-video-player__failed-mark"
        >${renderIcon('functioneel-waarschuwing', { size: 14 })}</span
      >
      <p class="lintje-video-player__failed-text">De video kan niet worden geladen.</p>
      <button
        type="button"
        class="lintje-button lintje-button--primary lintje-video-player__retry"
        @click=${this.onRetry}
      >
        ${renderIcon('functioneel-refresh', { size: 20 })}
        <span class="lintje-button__label">Opnieuw proberen</span>
      </button>
    </div>`
  }

  private renderOverlay(): TemplateResult | typeof nothing {
    if (this.failed) return this.renderFailed()
    if (this.waiting) {
      return html`<button
        type="button"
        class=${classMap({
          'lintje-button': true,
          'lintje-button--primary': true,
          'lintje-video-player__big-play': true,
          'is-disabled': !this.ready,
        })}
        aria-label="Afspelen"
        title="Afspelen"
        aria-disabled=${this.ready ? nothing : 'true'}
        @click=${this.onBigPlay}
      >
        ${renderIcon('multimedia-player-afspelen', { size: 28 })}
      </button>`
    }
    const caption = this.captions ? this.caption : ''
    return caption
      ? html`<div class="lintje-video-player__caption">
          <span class="lintje-video-player__caption-text">${caption}</span>
        </div>`
      : nothing
  }

  private renderStage(): TemplateResult {
    return html`<div class="lintje-video-player__stage">
      <video
        class="lintje-video-player__video"
        preload="metadata"
        playsinline
        .muted=${this.muted}
        src=${this.source || nothing}
        @click=${() => this.toggle()}
      ></video>
      ${this.renderOverlay()}
    </div>`
  }

  /** As the audio player's: one name, pressed while muted. */
  private renderMute(): TemplateResult {
    return this.renderIconButton(
      this.muted ? 'functioneel-geluid-uit' : 'functioneel-geluid-aan',
      'Geluid dempen',
      () => (this.muted = !this.muted),
      { disabled: false, pressed: this.muted },
    )
  }

  protected override render(): TemplateResult {
    return html`<div class="lintje-video-player" role="group" aria-label=${this.name || 'Video'} @keydown=${this.onKeydown}>
      ${this.renderStage()}
      <div class="lintje-video-player__controls">
        <div class="lintje-video-player__timeline">
          ${this.renderBar()} ${this.renderTime(true)}
          ${
            this.speed === 1
              ? nothing
              : html`<span class="lintje-video-player__speed">${speedLabel(this.speed)}</span>`
          }
        </div>
        <div class="lintje-video-player__buttons">
          ${this.renderPlay()} ${this.renderMute()}
          <lintje-menu-button
            class="lintje-video-player__more"
            icon
            variant="tertiary"
            label="Meer opties"
            placement="top-end"
            ?disabled=${!this.ready}
            .items=${this.menuItems}
            @lintje-action=${this.onMenuAction}
          ></lintje-menu-button>
          ${
            this.fullscreen
              ? this.renderIconButton(
                  'multimedia-player-full-screen-uitgaan',
                  'Volledig scherm verlaten',
                  () => this.toggleFullscreen(),
                  { disabled: false },
                )
              : this.renderIconButton('multimedia-player-full-screen', 'Volledig scherm', () =>
                  this.toggleFullscreen(),
                )
          }
        </div>
      </div>
    </div>`
  }
}

define('lintje-video-player', LintjeVideoPlayer)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-video-player': LintjeVideoPlayer
  }
}
