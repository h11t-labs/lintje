/**
 * The audio player: its forms, the slider's ARIA, the keyboard and the events. happy-dom
 * cannot play media, so the `<audio>` is stubbed: its duration is defined and its events are
 * dispatched by hand, the way a browser would.
 */
import { describe, expect, it, vi } from 'vitest'
import './audio-player'
import type { LintjeAudioPlayer } from './audio-player'

async function mount(props: Partial<LintjeAudioPlayer> = {}): Promise<LintjeAudioPlayer> {
  const element = Object.assign(document.createElement('lintje-audio-player'), {
    name: 'Overleg 12 mei',
    src: '/opnames/overleg.mp3',
    ...props,
  })
  document.body.append(element)
  await element.updateComplete
  return element
}

/** The `<audio>` with a duration and play/pause that answer the way a browser does. */
function stubMedia(element: LintjeAudioPlayer, duration = 2832): HTMLAudioElement {
  const media = element.shadowRoot!.querySelector('audio')!
  let paused = true
  Object.defineProperty(media, 'duration', { configurable: true, get: () => duration })
  Object.defineProperty(media, 'paused', { configurable: true, get: () => paused })
  media.play = vi.fn(() => {
    paused = false
    media.dispatchEvent(new Event('play'))
    return Promise.resolve()
  })
  media.pause = vi.fn(() => {
    paused = true
    media.dispatchEvent(new Event('pause'))
  })
  return media
}

async function loaded(element: LintjeAudioPlayer, duration = 2832): Promise<HTMLAudioElement> {
  const media = stubMedia(element, duration)
  media.dispatchEvent(new Event('loadedmetadata'))
  await element.updateComplete
  return media
}

const root = (element: LintjeAudioPlayer): ShadowRoot => element.shadowRoot!
const slider = (element: LintjeAudioPlayer): HTMLElement =>
  root(element).querySelector('[role="slider"]')!
const play = (element: LintjeAudioPlayer): HTMLButtonElement =>
  root(element).querySelector('.lintje-player__play')!

function collect(element: LintjeAudioPlayer, name: string): unknown[] {
  const seen: unknown[] = []
  element.addEventListener(name, (event) => seen.push((event as CustomEvent).detail))
  return seen
}

describe('lintje-audio-player', () => {
  it('is a group named after the recording and holds an audio without autoplay', async () => {
    const element = await mount()
    const group = root(element).querySelector('[role="group"]')!
    expect(group.getAttribute('aria-label')).toBe('Overleg 12 mei')
    const audio = root(element).querySelector('audio')!
    expect(audio.getAttribute('src')).toBe('/opnames/overleg.mp3')
    expect(audio.hasAttribute('autoplay')).toBe(false)
    expect(audio.hasAttribute('controls')).toBe(false)
  })

  it('draws a bar without peaks, and puts everything on one line with `compact`', async () => {
    const element = await mount({ duration: 2832 })
    await loaded(element)
    expect(root(element).querySelector('.lintje-player__bar')).not.toBeNull()
    expect(root(element).querySelector('.lintje-audio-player__wave')).toBeNull()
    expect(root(element).querySelector('.lintje-audio-player__controls')).not.toBeNull()
    element.compact = true
    await element.updateComplete
    expect(root(element).querySelector('.lintje-audio-player--compact')).not.toBeNull()
    expect(root(element).querySelector('.lintje-audio-player__controls')).toBeNull()
    expect(root(element).querySelector('.lintje-player__time')!.textContent).toContain('47:12')
  })

  it('stands play between the two 15-second skips', async () => {
    const element = await mount({ peaks: [0.5] })
    await loaded(element)
    const transport = root(element).querySelector('.lintje-audio-player__transport')!
    const labels = [...transport.querySelectorAll('button')].map((button) =>
      button.getAttribute('aria-label'),
    )
    expect(labels).toEqual(['15 seconden terug', 'Afspelen', '15 seconden vooruit'])
    const forward = transport.querySelectorAll('button')[2]!
    forward.click()
    forward.click()
    expect(element.currentTime).toBe(30)
  })

  it('disables the controls and draws a skeleton until the recording has loaded', async () => {
    const element = await mount({ peaks: [0.2, 0.8, 0.5] })
    // `aria-disabled`, not the native attribute: the button stays in the tab order.
    expect(play(element).disabled).toBe(false)
    expect(play(element).getAttribute('aria-disabled')).toBe('true')
    expect(play(element).classList.contains('is-disabled')).toBe(true)
    // A press while it loads does nothing — a skip does not even queue a seek.
    const skip = root(element).querySelector<HTMLButtonElement>(
      '[aria-label="15 seconden vooruit"]',
    )!
    expect(skip.getAttribute('aria-disabled')).toBe('true')
    skip.click()
    expect(element.currentTime).toBe(0)
    expect(root(element).querySelector('lintje-skeleton')).not.toBeNull()
    expect(root(element).querySelector('.lintje-audio-player__wave')).toBeNull()
    await loaded(element)
    expect(play(element).hasAttribute('aria-disabled')).toBe(false)
    expect(play(element).classList.contains('is-disabled')).toBe(false)
    // Until the observer measured the waveform no bars are drawn; then as many as fit (24 px: 3).
    expect(root(element).querySelectorAll('.lintje-audio-player__peak')).toHaveLength(0)
    ;(element as unknown as { waveWidth: number }).waveWidth = 24
    await element.updateComplete
    expect(root(element).querySelectorAll('.lintje-audio-player__peak')).toHaveLength(3)
  })

  it('makes the waveform a slider in seconds', async () => {
    const element = await mount({ peaks: [0.2, 0.8, 0.5, 0.4] })
    await loaded(element)
    element.currentTime = 724
    await element.updateComplete
    const wave = slider(element)
    expect(wave.getAttribute('aria-valuemin')).toBe('0')
    expect(wave.getAttribute('aria-valuemax')).toBe('2832')
    expect(wave.getAttribute('aria-valuenow')).toBe('724')
    expect(wave.getAttribute('aria-valuetext')).toBe(
      '12 minuten 4 seconden van 47 minuten 12 seconden',
    )
    expect(wave.getAttribute('tabindex')).toBe('0')
  })

  it('marks the position on the waveform with the head, as on the bar', async () => {
    const element = await mount({ peaks: [0.2, 0.8, 0.5, 0.4] })
    await loaded(element, 100)
    element.currentTime = 25
    await element.updateComplete
    const head = slider(element).querySelector<HTMLElement>('.lintje-audio-player__head')
    expect(head?.getAttribute('aria-hidden')).toBe('true')
    expect(head?.style.left).toBe('25%')
  })

  it('holds the value the slider states while it has the focus and the recording plays', async () => {
    const element = await mount({ peaks: [0.5] })
    const media = await loaded(element, 100)
    const set = async (seconds: number): Promise<void> => {
      Object.defineProperty(media, 'currentTime', {
        configurable: true,
        writable: true,
        value: seconds,
      })
      media.dispatchEvent(new Event('timeupdate'))
      await element.updateComplete
    }
    await set(10)
    expect(slider(element).getAttribute('aria-valuenow')).toBe('10')
    slider(element).focus()
    await set(11)
    await set(12)
    expect(slider(element).getAttribute('aria-valuenow')).toBe('10')
    // The time beside it keeps running.
    expect(root(element).textContent).toContain('0:12')
    slider(element).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await element.updateComplete
    expect(slider(element).getAttribute('aria-valuenow')).toBe('17')
    slider(element).blur()
    await set(20)
    expect(slider(element).getAttribute('aria-valuenow')).toBe('20')
  })

  it('moves 5 s on the arrows and 30 s on PageUp, and reports the seek', async () => {
    const element = await mount({ peaks: [0.5] })
    const media = await loaded(element)
    const times = collect(element, 'lintje-time-change')
    slider(element).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    )
    expect(element.currentTime).toBe(5)
    expect(media.currentTime).toBe(5)
    slider(element).dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }))
    expect(element.currentTime).toBe(35)
    slider(element).dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(element.currentTime).toBe(2832)
    expect(times).toEqual([5, 35, 2832])
  })

  it('plays and pauses on the button and on Space, and says so', async () => {
    const element = await mount({ peaks: [0.5] })
    await loaded(element)
    expect(play(element).getAttribute('aria-label')).toBe('Afspelen')
    const events: string[] = []
    element.addEventListener('lintje-play', () => events.push('play'))
    element.addEventListener('lintje-pause', () => events.push('pause'))

    play(element).click()
    await element.updateComplete
    expect(events).toEqual(['play'])
    expect(play(element).getAttribute('aria-label')).toBe('Pauzeren')
    expect(play(element).querySelector('svg')).not.toBeNull()

    slider(element).dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true }),
    )
    await element.updateComplete
    expect(events).toEqual(['play', 'pause'])
  })

  it('reports the position at most four times a second while it plays', async () => {
    const element = await mount({ peaks: [0.5] })
    const media = await loaded(element)
    const times = collect(element, 'lintje-time-change')
    for (let step = 1; step <= 8; step++) {
      media.currentTime = step
      media.dispatchEvent(new Event('timeupdate'))
    }
    expect(times).toEqual([1])
    expect(element.currentTime).toBe(8)
  })

  it('keeps a seek made before the metadata and applies it once it is in', async () => {
    const element = await mount({ peaks: [0.5] })
    element.currentTime = 120
    const media = await loaded(element)
    expect(media.currentTime).toBe(120)
    expect(element.currentTime).toBe(120)
  })

  it('shows an error announcement with a retry when the recording cannot be loaded', async () => {
    const element = await mount({ peaks: [0.5] })
    const media = stubMedia(element)
    media.load = vi.fn()
    media.dispatchEvent(new Event('error'))
    await element.updateComplete
    const alert = root(element).querySelector('lintje-announcement')!
    expect(alert.data?.text).toBe('De opname kan niet worden geladen.')
    // The load failed just now: the announcement is a live region.
    expect(alert.data?.live).toBe(true)
    const retry = alert.querySelector('lintje-button')!
    expect(retry.textContent).toBe('Opnieuw proberen')
    retry.click()
    expect(media.load).toHaveBeenCalled()
  })

  it('offers the four speeds behind a button that shows the speed, and sets the rate', async () => {
    const element = await mount({ peaks: [0.5] })
    const media = await loaded(element)
    const menu = root(element).querySelector('lintje-menu-button')!
    expect(menu.label).toBe('1×')
    expect(menu.accessibleLabel).toBe('Afspeelsnelheid 1×')
    const items = menu.items as { label: string; checked?: boolean; radio?: boolean }[]
    expect(items.map((item) => item.label)).toEqual(['1×', '1,25×', '1,5×', '2×'])
    expect(items.map((item) => item.checked)).toEqual([true, false, false, false])
    expect(items[0]!.radio).toBe(true)
    const host = vi.fn()
    element.addEventListener('lintje-action', host)
    menu.dispatchEvent(
      new CustomEvent('lintje-action', { detail: '1.5', bubbles: true, composed: true }),
    )
    expect(media.playbackRate).toBe(1.5)
    expect(host).not.toHaveBeenCalled()
    await element.updateComplete
    expect(menu.label).toBe('1,5×')
  })

  it('mutes and sets the volume on its own slider', async () => {
    const element = await mount({ peaks: [0.5] })
    const media = await loaded(element)
    const mute = root(element).querySelector<HTMLButtonElement>('[aria-label="Geluid dempen"]')!
    const level = root(element).querySelector<HTMLElement>('.lintje-audio-player__level')!
    expect(mute.getAttribute('aria-pressed')).toBe('false')
    expect(level.getAttribute('aria-valuetext')).toBe('100 procent')

    level.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await element.updateComplete
    expect(media.volume).toBe(0.9)
    expect(level.getAttribute('aria-valuenow')).toBe('90')

    mute.click()
    await element.updateComplete
    expect(media.muted).toBe(true)
    expect(mute.getAttribute('aria-pressed')).toBe('true')
    expect(level.getAttribute('aria-valuetext')).toBe('Gedempt')
    mute.click()
    await element.updateComplete
    expect(media.muted).toBe(false)
    expect(media.volume).toBe(0.9)

    // Down to nothing is muted; unmuting from there starts at half.
    level.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    await element.updateComplete
    expect(mute.getAttribute('aria-pressed')).toBe('true')
    mute.click()
    expect(media.volume).toBe(0.5)
  })

  it('colours the speakers, names them above and in the slider', async () => {
    const element = await mount({
      peaks: [0.5, 0.5, 0.5, 0.5],
      segments: [
        { start: 0, speaker: 'Spreker 1' },
        { start: 30, speaker: 'Spreker 2' },
        { start: 60, speaker: 'Spreker 1' },
      ],
    })
    await loaded(element, 120)
    element.currentTime = 40
    await element.updateComplete
    const speakers = [...root(element).querySelectorAll('.lintje-audio-player__speaker')]
    expect(speakers.map((speaker) => speaker.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
      'Spreker 1',
      'Spreker 2 spreekt nu',
    ])
    expect(slider(element).getAttribute('aria-valuetext')).toBe(
      '40 seconden van 2 minuten, Spreker 2',
    )
    const swatch = root(element).querySelector<HTMLElement>('.lintje-audio-player__swatch')!
    expect(swatch.style.getPropertyValue('--lintje-speaker')).toBe('var(--color-chart-sky-blue)')
  })

  it('leaves the legend to the transcript with no-legend, and keeps the speaker in the slider', async () => {
    const element = await mount({
      peaks: [0.5, 0.5],
      noLegend: true,
      segments: [
        { start: 0, speaker: 'Spreker 1' },
        { start: 30, speaker: 'Spreker 2' },
      ],
    })
    await loaded(element, 60)
    element.currentTime = 40
    await element.updateComplete
    expect(root(element).querySelector('.lintje-audio-player__legend')).toBeNull()
    expect(slider(element).getAttribute('aria-valuetext')).toBe(
      '40 seconden van 1 minuut, Spreker 2',
    )
  })
})
