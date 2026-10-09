/** The video player in a browser: scrubbing with the pointer and the keys, full screen with captions. */
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { ARROW_STEP, PAGE_STEP } from '../audio-player/playback'
import './video-player'
import type { LintjeVideoPlayer } from './video-player'

const SECONDS = 60

/** A silent 8-bit mono WAV: real media that loads, seeks and reports a duration. */
function silence(seconds = SECONDS): string {
  const rate = 8000
  const samples = rate * seconds
  const view = new DataView(new ArrayBuffer(44 + samples))
  const text = (at: number, value: string): void =>
    [...value].forEach((char, index) => view.setUint8(at + index, char.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples, true)
  text(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  text(36, 'data')
  view.setUint32(40, samples, true)
  new Uint8Array(view.buffer, 44).fill(128)
  return URL.createObjectURL(new Blob([view.buffer], { type: 'audio/wav' }))
}

const SEGMENTS = [
  { start: 0, text: 'Goedemorgen allemaal.' },
  { start: 15, text: 'De ochtenddienst begint maandag een half uur eerder.' },
]

async function mount(): Promise<LintjeVideoPlayer> {
  const element = Object.assign(document.createElement('lintje-video-player'), {
    name: 'Hoorzitting',
    segments: SEGMENTS,
    captions: true,
  })
  element.style.width = '640px'
  element.src = silence()
  document.body.append(element)
  await expect.poll(() => media(element).duration, { timeout: 5000 }).toBe(SECONDS)
  await expect.poll(() => bar(element).getAttribute('aria-disabled')).toBe(null)
  return element
}

const root = (element: LintjeVideoPlayer): ShadowRoot & { fullscreenElement?: Element | null } =>
  element.shadowRoot!
const media = (element: LintjeVideoPlayer): HTMLVideoElement =>
  root(element).querySelector('video')!
const bar = (element: LintjeVideoPlayer): HTMLElement =>
  root(element).querySelector<HTMLElement>('.lintje-player__bar')!
const frame = (element: LintjeVideoPlayer): HTMLElement =>
  root(element).querySelector<HTMLElement>('.lintje-video-player')!
const caption = (element: LintjeVideoPlayer): HTMLElement | null =>
  root(element).querySelector<HTMLElement>('.lintje-video-player__caption-text')
const button = (element: LintjeVideoPlayer, label: string): HTMLButtonElement | null =>
  root(element).querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)

afterEach(async () => {
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined)
  document.body.replaceChildren()
})

describe('lintje-video-player scrubs', () => {
  it('moves to where the pointer presses the bar', async () => {
    const element = await mount()
    const heard: number[] = []
    element.addEventListener('lintje-seek', (event) => heard.push((event as CustomEvent).detail))
    await element.updateComplete
    const box = bar(element).getBoundingClientRect()
    await userEvent.click(bar(element), { position: { x: (box.width * 3) / 4, y: box.height / 2 } })
    // A pixel is a tenth of a second here and the press lands within a few: a second's room.
    const off = (time: number | undefined): number => Math.abs((time ?? 0) - (SECONDS * 3) / 4)
    await expect.poll(() => off(element.currentTime)).toBeLessThan(1.5)
    expect(off(heard.at(-1))).toBeLessThan(1.5)
    await expect.poll(() => off(media(element).currentTime)).toBeLessThan(1.5)
  })

  it('moves with the keys on the bar, and the caption follows', async () => {
    const element = await mount()
    bar(element).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(element.currentTime).toBe(ARROW_STEP)
    await userEvent.keyboard('{PageUp}')
    expect(element.currentTime).toBe(ARROW_STEP + PAGE_STEP)
    await expect.poll(() => caption(element)?.textContent).toBe(SEGMENTS[1]!.text)
    await userEvent.keyboard('{Home}')
    expect(element.currentTime).toBe(0)
    await expect.poll(() => media(element).currentTime).toBe(0)
  })
})

describe('lintje-video-player in full screen', () => {
  it('takes the frame with its caption and controls full screen, and leaves it again', async () => {
    const element = await mount()
    element.currentTime = 20
    await expect.poll(() => caption(element)?.textContent).toBe(SEGMENTS[1]!.text)
    await userEvent.click(button(element, 'Volledig scherm')!)
    await expect.poll(() => root(element).fullscreenElement).toBe(frame(element))
    expect(document.fullscreenElement).toBe(element)
    await expect.poll(() => button(element, 'Volledig scherm verlaten')).toBeTruthy()

    // The caption stands on the picture and the controls under it, all on the screen.
    const screen = frame(element).getBoundingClientRect()
    expect(screen.width).toBe(window.innerWidth)
    expect(screen.height).toBe(window.innerHeight)
    const stage = root(element).querySelector('.lintje-video-player__stage')!
    const text = caption(element)!.getBoundingClientRect()
    const controls = root(element)
      .querySelector('.lintje-video-player__controls')!
      .getBoundingClientRect()
    expect(stage.contains(caption(element))).toBe(true)
    expect(text.height).toBeGreaterThan(0)
    expect(text.bottom).toBeLessThanOrEqual(controls.top)
    expect(controls.bottom).toBeLessThanOrEqual(screen.bottom + 0.5)

    await userEvent.click(button(element, 'Volledig scherm verlaten')!)
    await expect.poll(() => document.fullscreenElement).toBe(null)
    await expect.poll(() => button(element, 'Volledig scherm')).toBeTruthy()
  })
})
