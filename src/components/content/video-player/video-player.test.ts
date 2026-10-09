/**
 * The video player: the picture's parts, the captions toggle, the keys and the events it shares
 * with the audio player. The `<video>` is stubbed: happy-dom cannot play media.
 */
import { describe, expect, it, vi } from 'vitest'
import './video-player'
import type { LintjeVideoPlayer } from './video-player'
import type { LintjeMenuButton } from '../../actions/menu-button/menu-button'

const SEGMENTS = [
  { start: 0, text: 'Goedemorgen allemaal.' },
  { start: 10, text: 'Is dat afgestemd met de roostermaker?' },
]

async function mount(props: Partial<LintjeVideoPlayer> = {}): Promise<LintjeVideoPlayer> {
  const element = Object.assign(document.createElement('lintje-video-player'), {
    name: 'Hoorzitting 3',
    src: '/opnames/hoorzitting.mp4',
    ...props,
  })
  document.body.append(element)
  await element.updateComplete
  return element
}

async function loaded(element: LintjeVideoPlayer, duration = 120): Promise<HTMLVideoElement> {
  const media = element.shadowRoot!.querySelector('video')!
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
  media.dispatchEvent(new Event('loadedmetadata'))
  await element.updateComplete
  return media
}

const root = (element: LintjeVideoPlayer): ShadowRoot => element.shadowRoot!
const menu = (element: LintjeVideoPlayer): LintjeMenuButton =>
  root(element).querySelector('lintje-menu-button')!

/** Chooses a row of the player's menu, as the menu button reports it. */
async function choose(element: LintjeVideoPlayer, value: string): Promise<void> {
  menu(element).dispatchEvent(
    new CustomEvent('lintje-action', { detail: value, bubbles: true, composed: true }),
  )
  await element.updateComplete
}

describe('lintje-video-player', () => {
  it('holds a video without controls or autoplay, in a named group', async () => {
    const element = await mount()
    const video = root(element).querySelector('video')!
    expect(video.hasAttribute('controls')).toBe(false)
    expect(video.hasAttribute('autoplay')).toBe(false)
    expect(video.getAttribute('src')).toBe('/opnames/hoorzitting.mp4')
    expect(root(element).querySelector('[role="group"]')!.getAttribute('aria-label')).toBe(
      'Hoorzitting 3',
    )
  })

  it('draws the controls under the picture: the bar, the time, play, mute, the menu, full screen', async () => {
    const element = await mount()
    await loaded(element)
    const controls = root(element).querySelector('.lintje-video-player__controls')!
    expect(controls.querySelector('.lintje-player__play')).not.toBeNull()
    const bar = controls.querySelector('[role="slider"]')!
    expect(bar.getAttribute('aria-valuemax')).toBe('120')
    expect(bar.getAttribute('aria-valuetext')).toBe('0 seconden van 2 minuten')
    expect(
      controls.querySelector('.lintje-player__time')!.textContent!.replace(/\s+/g, ' ').trim(),
    ).toBe('0:00 / 2:00')
    expect(controls.querySelector('[aria-label="Geluid dempen"]')).not.toBeNull()
    expect(menu(element).getAttribute('label')).toBe('Meer opties')
    expect(controls.querySelector('[aria-label="Volledig scherm"]')).not.toBeNull()
  })

  it('disables full screen while the video loads and when it cannot be loaded', async () => {
    const element = await mount()
    const fullscreen = (): HTMLButtonElement =>
      root(element).querySelector<HTMLButtonElement>('[aria-label="Volledig scherm"]')!
    const off = (): boolean => fullscreen().getAttribute('aria-disabled') === 'true'
    // `aria-disabled`, not the native attribute: the button stays in the tab order.
    expect(fullscreen().disabled).toBe(false)
    expect(off()).toBe(true)
    const media = await loaded(element)
    expect(off()).toBe(false)
    media.dispatchEvent(new Event('error'))
    await element.updateComplete
    expect(off()).toBe(true)
    expect(menu(element).disabled).toBe(true)
  })

  it('says a failed load on the picture, without the big play button, and loads again', async () => {
    const element = await mount()
    const media = await loaded(element)
    media.load = vi.fn()
    media.dispatchEvent(new Event('error'))
    await element.updateComplete
    // The failure appeared just now: it is an alert, spoken at once.
    const failed = root(element).querySelector('.lintje-video-player__stage [role="alert"]')!
    expect(failed.textContent).toContain('De video kan niet worden geladen.')
    expect(root(element).querySelector('.lintje-video-player__big-play')).toBeNull()
    failed.querySelector<HTMLButtonElement>('.lintje-video-player__retry')!.click()
    await element.updateComplete
    expect(media.load).toHaveBeenCalled()
    expect(root(element).querySelector('[role="alert"]')).toBeNull()
    expect(root(element).activeElement).toBe(
      root(element).querySelector('.lintje-video-player__big-play'),
    )
  })

  it('shows the big play button while it stands still and hides it while it plays', async () => {
    const element = await mount()
    await loaded(element)
    const big = root(element).querySelector<HTMLButtonElement>('.lintje-video-player__big-play')!
    expect(big.getAttribute('aria-label')).toBe('Afspelen')
    expect(big.querySelector('svg')).not.toBeNull()
    const played: string[] = []
    element.addEventListener('lintje-play', () => played.push('play'))
    big.click()
    await element.updateComplete
    expect(played).toEqual(['play'])
    expect(root(element).querySelector('.lintje-video-player__big-play')).toBeNull()
  })

  it('switches the captions in the menu and on C, and shows the segment that sounds', async () => {
    const element = await mount({ segments: SEGMENTS })
    await loaded(element)
    const row = (): unknown => menu(element).items[0]
    expect(row()).toMatchObject({ label: 'Ondertiteling', checked: false, hint: 'C' })
    expect(root(element).querySelector('.lintje-video-player__caption')).toBeNull()

    await choose(element, 'ondertiteling')
    element.currentTime = 12
    await element.updateComplete
    expect(element.captions).toBe(true)
    expect(row()).toMatchObject({ checked: true })
    expect(root(element).querySelector('.lintje-video-player__caption')!.textContent!.trim()).toBe(
      'Is dat afgestemd met de roostermaker?',
    )

    root(element)
      .querySelector('[role="slider"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true, composed: true }))
    await element.updateComplete
    expect(element.captions).toBe(false)
  })

  it('answers C and F also while the focus is on the menu button', async () => {
    const element = await mount()
    await loaded(element)
    const frame = root(element).querySelector<HTMLElement>('.lintje-video-player')!
    const request = vi.fn(() => Promise.resolve())
    frame.requestFullscreen = request
    const trigger = menu(element).shadowRoot!.querySelector('button')!
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true, composed: true }))
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true, composed: true }))
    await element.updateComplete
    expect(element.captions).toBe(true)
    expect(request).toHaveBeenCalled()
  })

  it('offers the audio description only when there is a described version', async () => {
    const plain = await mount()
    await loaded(plain)
    expect(
      menu(plain).items?.some(
        (item) => typeof item === 'object' && 'value' in item && item.value === 'audiodescriptie',
      ),
    ).toBe(false)
    plain.remove()

    const element = await mount({ describedSrc: '/opnames/hoorzitting-ad.mp4' })
    await loaded(element)
    const row = (): unknown =>
      menu(element).items?.find(
        (item) => typeof item === 'object' && 'value' in item && item.value === 'audiodescriptie',
      )
    expect(row()).toMatchObject({ label: 'Audiodescriptie', checked: false })
    const video = root(element).querySelector('video')!
    expect(video.getAttribute('src')).toBe('/opnames/hoorzitting.mp4')
  })

  it('switches to the described version at the same moment, and plays on', async () => {
    const element = await mount({ describedSrc: '/opnames/hoorzitting-ad.mp4' })
    const first = await loaded(element)
    element.currentTime = 42
    await element.updateComplete
    first.dispatchEvent(new Event('play'))
    await element.updateComplete
    await choose(element, 'audiodescriptie')
    await element.updateComplete
    const video = root(element).querySelector('video')!
    expect(video.getAttribute('src')).toBe('/opnames/hoorzitting-ad.mp4')
    expect(element.described).toBe(true)
    let at = 0
    Object.defineProperty(video, 'currentTime', {
      configurable: true,
      get: () => at,
      set: (value: number) => (at = value),
    })
    const media = await loaded(element)
    expect(at).toBe(42)
    expect(media.play).toHaveBeenCalled()
  })

  it('sets the speed from the menu and shows it beside the time', async () => {
    const element = await mount()
    const media = await loaded(element)
    expect(root(element).querySelector('.lintje-video-player__speed')).toBeNull()
    await choose(element, '1.5')
    expect(media.playbackRate).toBe(1.5)
    expect(root(element).querySelector('.lintje-video-player__speed')!.textContent).toBe('1,5×')
    const rows = menu(element).items.filter(
      (entry) => typeof entry !== 'string' && 'radio' in entry,
    )
    expect(rows.map((entry) => (entry as { checked: boolean }).checked)).toEqual([
      false,
      false,
      true,
      false,
    ])
  })

  it('mutes and sounds again with one pressed button', async () => {
    const element = await mount()
    const media = await loaded(element)
    const mute = root(element).querySelector<HTMLButtonElement>('[aria-label="Geluid dempen"]')!
    expect(mute.getAttribute('aria-pressed')).toBe('false')
    mute.click()
    await element.updateComplete
    expect(media.muted).toBe(true)
    expect(mute.getAttribute('aria-pressed')).toBe('true')
    mute.click()
    await element.updateComplete
    expect(media.muted).toBe(false)
  })

  it('keeps its menu actions from the host', async () => {
    const element = await mount()
    await loaded(element)
    const heard: string[] = []
    element.addEventListener('lintje-action', () => heard.push('action'))
    await choose(element, '2')
    expect(heard).toEqual([])
  })

  it('never shows the big play button and the caption together', async () => {
    const element = await mount({ segments: SEGMENTS, captions: true })
    await loaded(element)
    const big = (): Element | null => root(element).querySelector('.lintje-video-player__big-play')
    const caption = (): Element | null =>
      root(element).querySelector('.lintje-video-player__caption')
    expect(big()).not.toBeNull()
    expect(caption()).toBeNull()

    element.currentTime = 12
    await element.updateComplete
    expect(big()).toBeNull()
    expect(caption()).not.toBeNull()
  })

  it('asks for full screen for the whole player on F', async () => {
    const element = await mount()
    await loaded(element)
    const frame = root(element).querySelector<HTMLElement>('.lintje-video-player')!
    const request = vi.fn(() => Promise.resolve())
    frame.requestFullscreen = request
    root(element)
      .querySelector('[role="slider"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true, composed: true }))
    expect(request).toHaveBeenCalled()
  })

  it('offers to leave full screen while the player fills the screen', async () => {
    const element = await mount()
    await loaded(element)
    const frame = root(element).querySelector<HTMLElement>('.lintje-video-player')!
    Object.defineProperty(root(element), 'fullscreenElement', { configurable: true, value: frame })
    document.dispatchEvent(new Event('fullscreenchange'))
    await element.updateComplete
    const leave = (): HTMLButtonElement =>
      root(element).querySelector<HTMLButtonElement>('[aria-label="Volledig scherm verlaten"]')!
    expect(leave()).not.toBeNull()
    // A video that fails in full screen still lets the reader out.
    root(element).querySelector('video')!.dispatchEvent(new Event('error'))
    await element.updateComplete
    expect(leave().hasAttribute('aria-disabled')).toBe(false)
    Object.defineProperty(root(element), 'fullscreenElement', { configurable: true, value: null })
    document.dispatchEvent(new Event('fullscreenchange'))
    await element.updateComplete
    expect(root(element).querySelector('[aria-label="Volledig scherm"]')).not.toBeNull()
  })

  it('moves on the arrows like the audio player and reports it', async () => {
    const element = await mount()
    await loaded(element)
    const times: number[] = []
    element.addEventListener('lintje-time-change', (event) =>
      times.push((event as CustomEvent<number>).detail),
    )
    root(element)
      .querySelector('[role="slider"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(times).toEqual([5])
  })
})
