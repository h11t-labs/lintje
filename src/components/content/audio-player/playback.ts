/**
 * The pure arithmetic `<lintje-audio-player>` and `<lintje-video-player>` share. No DOM.
 * `<lintje-transcript>` and the video player's caption use `indexAt()`.
 */

/** Seconds an arrow key moves; PageUp and PageDown move `PAGE_STEP`. */
export const ARROW_STEP = 5
export const PAGE_STEP = 30

/** Seconds the skip buttons move. */
export const SKIP_STEP = 15

/** The share of full volume an arrow key moves the volume slider. */
export const VOLUME_STEP = 0.1

export const REPORT_INTERVAL = 250

/** A waveform bar is 4 px wide with 4 px between two bars. */
export const BAR_PITCH = 8

export const SPEEDS: readonly { value: number; label: string }[] = [
  { value: 1, label: '1×' },
  { value: 1.25, label: '1,25×' },
  { value: 1.5, label: '1,5×' },
  { value: 2, label: '2×' },
]

export function speedLabel(speed: number): string {
  return (
    SPEEDS.find((entry) => entry.value === speed)?.label ?? `${String(speed).replace('.', ',')}×`
  )
}

/** A number of seconds as `m:ss`: `724` → "12:04". Minutes do not roll over into hours. */
export function formatTime(seconds: number): string {
  const whole = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
  const minutes = Math.floor(whole / 60)
  const rest = whole % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

/** A number of seconds in words: `724` → "12 minuten 4 seconden"; a screen reader misreads "12:04". */
export function spokenTime(seconds: number): string {
  const whole = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const rest = whole % 60
  const parts = [
    hours ? `${hours} uur` : '',
    minutes ? `${minutes} ${minutes === 1 ? 'minuut' : 'minuten'}` : '',
    rest || whole === 0 ? `${rest} ${rest === 1 ? 'seconde' : 'seconden'}` : '',
  ]
  return parts.filter(Boolean).join(' ')
}

/** What the slider says to a screen reader: "12 minuten 4 seconden van 47 minuten 12 seconden". */
export function valueText(position: number, duration: number): string {
  return `${spokenTime(position)} van ${spokenTime(duration)}`
}

/** A time inside the recording: `0` to `duration`, and `0` for anything that is not a number. */
export function clampTime(seconds: number, duration: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) return 0
  if (!Number.isFinite(duration) || duration <= 0) return 0
  return Math.min(seconds, duration)
}

export function playedFraction(position: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0
  return clampTime(position, duration) / duration
}

export function timeAtPointer(
  clientX: number,
  left: number,
  width: number,
  duration: number,
): number {
  if (width <= 0) return 0
  const fraction = Math.max(0, Math.min(1, (clientX - left) / width))
  return clampTime(fraction * duration, duration)
}

/** Where a slider key takes the position; `null` for a key the slider does not take. */
export function seekForKey(key: string, position: number, duration: number): number | null {
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      return clampTime(position - ARROW_STEP, duration)
    case 'ArrowRight':
    case 'ArrowUp':
      return clampTime(position + ARROW_STEP, duration)
    case 'PageDown':
      return clampTime(position - PAGE_STEP, duration)
    case 'PageUp':
      return clampTime(position + PAGE_STEP, duration)
    case 'Home':
      return 0
    case 'End':
      return clampTime(duration, duration)
    default:
      return null
  }
}

export function barCount(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 0
  return Math.floor((width + BAR_PITCH / 2) / BAR_PITCH)
}

/** Each bar is the highest peak of its stretch, so a short loud moment survives. */
export function resamplePeaks(peaks: readonly number[], count: number): number[] {
  const clean = peaks.map((peak) => (Number.isFinite(peak) ? Math.max(0, Math.min(1, peak)) : 0))
  if (count <= 0 || clean.length === 0) return []
  if (count >= clean.length) {
    return Array.from(
      { length: count },
      (_, bar) => clean[Math.floor((bar * clean.length) / count)]!,
    )
  }
  return Array.from({ length: count }, (_, bar) => {
    const from = Math.floor((bar * clean.length) / count)
    const to = Math.max(from + 1, Math.floor(((bar + 1) * clean.length) / count))
    return Math.max(...clean.slice(from, to))
  })
}

/** Where a volume key takes the volume (0–1); `null` for a key the slider does not take. */
export function volumeForKey(key: string, volume: number): number | null {
  let next: number
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      next = volume - VOLUME_STEP
      break
    case 'ArrowRight':
    case 'ArrowUp':
      next = volume + VOLUME_STEP
      break
    case 'Home':
      next = 0
      break
    case 'End':
      next = 1
      break
    default:
      return null
  }
  return Math.round(Math.max(0, Math.min(1, next)) * 100) / 100
}

/**
 * The categorical colours a recording's speakers take, in order of first appearance. Orange is
 * left out: it is the focus ring, and Defensie's primary.
 */
export const SPEAKER_COLOURS = [
  'sky-blue',
  'dark-yellow',
  'pink',
  'mint-green',
  'violet',
  'green',
] as const

/** A speaker past the six colours takes the gray of "other". */
export type SpeakerColour = (typeof SPEAKER_COLOURS)[number] | 'other'

export interface SpeakerTurn {
  start: number
  speaker: string
}

export function speakerColours(turns: readonly SpeakerTurn[]): Map<string, SpeakerColour> {
  const colours = new Map<string, SpeakerColour>()
  for (const { speaker } of turns) {
    if (!colours.has(speaker)) colours.set(speaker, SPEAKER_COLOURS[colours.size] ?? 'other')
  }
  return colours
}

/** Who speaks at `time`; `null` before the first turn. */
export function speakerAt(turns: readonly SpeakerTurn[], time: number): string | null {
  return turns[indexAt(turns, time)]?.speaker ?? null
}

/**
 * The recording as stretches of one speaker, as fractions of `duration`: a turn runs until the
 * next speaker starts, the last one until the end.
 */
export function speakerStretches(
  turns: readonly SpeakerTurn[],
  duration: number,
): { speaker: string; from: number; to: number }[] {
  if (!Number.isFinite(duration) || duration <= 0) return []
  const stretches: { speaker: string; from: number; to: number }[] = []
  for (const turn of turns) {
    const from = playedFraction(turn.start, duration)
    const last = stretches[stretches.length - 1]
    if (last?.speaker === turn.speaker) continue
    if (last) last.to = from
    stretches.push({ speaker: turn.speaker, from, to: 1 })
  }
  return stretches.filter((stretch) => stretch.to > stretch.from)
}

/** The index of the last item that started by `time`; `-1` before the first. */
export function indexAt(items: readonly { start: number }[], time: number): number {
  let found = -1
  for (let index = 0; index < items.length; index++) {
    if (items[index]!.start <= time) found = index
    else break
  }
  return found
}

/** Lets a report through at most once per `interval` ms; `force` passes the last of a run. */
export class RateLimit {
  private last = Number.NEGATIVE_INFINITY

  constructor(private readonly interval: number = REPORT_INTERVAL) {}

  allow(now: number, force = false): boolean {
    if (!force && now - this.last < this.interval) return false
    this.last = now
    return true
  }
}
