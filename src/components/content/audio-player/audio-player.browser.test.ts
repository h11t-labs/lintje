/** The audio player in a browser: scrubbing with the pointer and the keys, and its number of bars. */
import { afterEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import './audio-player'
import type { LintjeAudioPlayer } from './audio-player'
import { ARROW_STEP, PAGE_STEP, barCount } from './playback'

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

// More peaks than bars, so the count comes from the width and not from the data.
const PEAKS = Array.from({ length: 240 }, (_, index) => 0.2 + Math.abs(Math.sin(index / 5)) * 0.7)

const SEGMENTS = [
  { start: 0, speaker: 'Spreker 1' },
  { start: 30, speaker: 'Spreker 2' },
]

async function mount(peaks: number[] | null, width = '800px'): Promise<LintjeAudioPlayer> {
  const element = Object.assign(document.createElement('lintje-audio-player'), {
    name: 'Teamoverleg',
    peaks,
    segments: SEGMENTS,
  })
  element.style.width = width
  element.src = silence()
  document.body.append(element)
  await expect.poll(() => slider(element), { timeout: 5000 }).toBeTruthy()
  await expect.poll(() => element.shadowRoot!.querySelector('audio')!.duration).toBe(SECONDS)
  return element
}

const slider = (element: LintjeAudioPlayer): HTMLElement | null =>
  element.shadowRoot!.querySelector<HTMLElement>('[role="slider"][aria-label="Positie"]')
const bars = (element: LintjeAudioPlayer): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>('.lintje-audio-player__peak'),
]
const media = (element: LintjeAudioPlayer): HTMLAudioElement =>
  element.shadowRoot!.querySelector('audio')!

function seeks(element: LintjeAudioPlayer): number[] {
  const heard: number[] = []
  element.addEventListener('lintje-seek', (event) => heard.push((event as CustomEvent).detail))
  return heard
}

afterEach(async () => {
  document.body.replaceChildren()
  await page.viewport(1440, 900)
})

describe('lintje-audio-player scrubs', () => {
  for (const [kind, peaks] of [
    ['waveform', PEAKS],
    ['bar', null],
  ] as const) {
    it(`moves to where the pointer presses the ${kind}`, async () => {
      const element = await mount(peaks)
      const heard = seeks(element)
      const track = slider(element)!
      const box = track.getBoundingClientRect()
      await userEvent.click(track, { position: { x: box.width / 4, y: box.height / 2 } })
      // A pixel either way is a fraction of a second on a 60-second recording.
      expect(element.currentTime).toBeCloseTo(SECONDS / 4, 0)
      expect(heard.at(-1)).toBeCloseTo(SECONDS / 4, 0)
      await expect.poll(() => media(element).currentTime).toBeCloseTo(SECONDS / 4, 0)
      expect(element.shadowRoot!.activeElement).toBe(track)
    })

    it(`moves with the keys on the ${kind}`, async () => {
      const element = await mount(peaks)
      const track = slider(element)!
      track.focus()
      await userEvent.keyboard('{ArrowRight}')
      expect(element.currentTime).toBe(ARROW_STEP)
      await userEvent.keyboard('{PageUp}')
      expect(element.currentTime).toBe(ARROW_STEP + PAGE_STEP)
      await expect
        .poll(() => track.getAttribute('aria-valuenow'))
        .toBe(String(ARROW_STEP + PAGE_STEP))
      expect(track.getAttribute('aria-valuetext')).toContain('Spreker 2')
      await userEvent.keyboard('{Home}')
      expect(element.currentTime).toBe(0)
      await expect.poll(() => media(element).currentTime).toBe(0)
      // End last: on CI's Linux WebKit a Home after End left the media at the end.
      await userEvent.keyboard('{End}')
      expect(element.currentTime).toBe(SECONDS)
      await expect.poll(() => media(element).currentTime).toBe(SECONDS)
    })
  }
})

describe('lintje-audio-player draws as many bars as its width holds', () => {
  const wave = (element: LintjeAudioPlayer): HTMLElement =>
    element.shadowRoot!.querySelector<HTMLElement>('.lintje-audio-player__wave')!
  const intended = (element: LintjeAudioPlayer): number =>
    barCount(Math.round(wave(element).getBoundingClientRect().width))

  async function expectFit(element: LintjeAudioPlayer): Promise<void> {
    await expect.poll(() => bars(element).length).toBe(intended(element))
    const box = wave(element).getBoundingClientRect()
    const drawn = bars(element)
    expect(drawn.length).toBeGreaterThan(0)
    // Every bar keeps its 4 px and the last one ends inside the waveform.
    expect(drawn.every((bar) => Math.round(bar.getBoundingClientRect().width) === 4)).toBe(true)
    expect(drawn.at(-1)!.getBoundingClientRect().right).toBeLessThanOrEqual(box.right + 0.5)
  }

  it('fills a wide player and follows a change of width', async () => {
    const element = await mount(PEAKS)
    await expectFit(element)
    const wide = bars(element).length
    element.style.width = '400px'
    await expectFit(element)
    expect(bars(element).length).toBeLessThan(wide)
  })

  it('fits a phone', async () => {
    await page.viewport(390, 844)
    await expect.poll(() => window.innerWidth).toBe(390)
    const element = await mount(PEAKS, '100%')
    await expectFit(element)
  })
})
