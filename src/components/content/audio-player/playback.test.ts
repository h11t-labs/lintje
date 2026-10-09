/** The players' shared arithmetic: time, scrub, keys, bars, speeds, speakers, volume and the report rate. */
import { describe, expect, it } from 'vitest'
import {
  RateLimit,
  barCount,
  clampTime,
  formatTime,
  indexAt,
  playedFraction,
  resamplePeaks,
  seekForKey,
  speakerAt,
  speakerColours,
  speakerStretches,
  speedLabel,
  timeAtPointer,
  spokenTime,
  valueText,
  volumeForKey,
} from './playback'

describe('formatTime', () => {
  it('writes m:ss with a padded second', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(5)).toBe('0:05')
    expect(formatTime(724)).toBe('12:04')
    expect(formatTime(2832)).toBe('47:12')
  })

  it('cuts off the fraction and lets minutes run past an hour', () => {
    expect(formatTime(59.99)).toBe('0:59')
    expect(formatTime(3725)).toBe('62:05')
  })

  it('shows nothing that is not a time as 0:00', () => {
    expect(formatTime(Number.NaN)).toBe('0:00')
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('0:00')
    expect(formatTime(-3)).toBe('0:00')
  })
})

describe('valueText', () => {
  it('says the position of the duration', () => {
    expect(valueText(724, 2832)).toBe('12 minuten 4 seconden van 47 minuten 12 seconden')
  })

  it('says the time in words, singular where it is one', () => {
    expect(spokenTime(0)).toBe('0 seconden')
    expect(spokenTime(1)).toBe('1 seconde')
    expect(spokenTime(60)).toBe('1 minuut')
    expect(spokenTime(61)).toBe('1 minuut 1 seconde')
    expect(spokenTime(3725)).toBe('1 uur 2 minuten 5 seconden')
    expect(spokenTime(Number.NaN)).toBe('0 seconden')
  })
})

describe('clampTime and playedFraction', () => {
  it('keeps a time inside the recording', () => {
    expect(clampTime(-4, 100)).toBe(0)
    expect(clampTime(140, 100)).toBe(100)
    expect(clampTime(40, 100)).toBe(40)
    expect(clampTime(40, Number.NaN)).toBe(0)
  })

  it('gives the played part as a fraction', () => {
    expect(playedFraction(25, 100)).toBe(0.25)
    expect(playedFraction(200, 100)).toBe(1)
    expect(playedFraction(10, 0)).toBe(0)
  })
})

describe('timeAtPointer', () => {
  it('maps the pointer on the track to a time', () => {
    expect(timeAtPointer(150, 100, 200, 400)).toBe(100)
    expect(timeAtPointer(300, 100, 200, 400)).toBe(400)
  })

  it('clamps a pointer outside the track', () => {
    expect(timeAtPointer(50, 100, 200, 400)).toBe(0)
    expect(timeAtPointer(900, 100, 200, 400)).toBe(400)
    expect(timeAtPointer(150, 100, 0, 400)).toBe(0)
  })
})

describe('seekForKey', () => {
  it('moves 5 s on the arrows and 30 s on PageUp and PageDown', () => {
    expect(seekForKey('ArrowRight', 60, 300)).toBe(65)
    expect(seekForKey('ArrowLeft', 60, 300)).toBe(55)
    expect(seekForKey('ArrowUp', 60, 300)).toBe(65)
    expect(seekForKey('ArrowDown', 60, 300)).toBe(55)
    expect(seekForKey('PageUp', 60, 300)).toBe(90)
    expect(seekForKey('PageDown', 60, 300)).toBe(30)
  })

  it('goes to the start and the end on Home and End', () => {
    expect(seekForKey('Home', 60, 300)).toBe(0)
    expect(seekForKey('End', 60, 300)).toBe(300)
  })

  it('stops at both ends', () => {
    expect(seekForKey('ArrowLeft', 2, 300)).toBe(0)
    expect(seekForKey('PageUp', 290, 300)).toBe(300)
  })

  it('leaves every other key alone', () => {
    expect(seekForKey(' ', 60, 300)).toBeNull()
    expect(seekForKey('Enter', 60, 300)).toBeNull()
  })
})

describe('the waveform bars', () => {
  it('fits a 4 px bar every 8 px', () => {
    expect(barCount(384)).toBe(48)
    expect(barCount(0)).toBe(0)
    expect(barCount(4)).toBe(1)
  })

  it('keeps the highest peak of each stretch', () => {
    expect(resamplePeaks([0.1, 0.9, 0.2, 0.3, 0.8, 0.1], 3)).toEqual([0.9, 0.3, 0.8])
  })

  it('stretches fewer peaks than bars and clamps them to 0–1', () => {
    expect(resamplePeaks([0.5, 2], 4)).toEqual([0.5, 0.5, 1, 1])
    expect(resamplePeaks([-1, Number.NaN], 2)).toEqual([0, 0])
    expect(resamplePeaks([], 4)).toEqual([])
  })
})

describe('indexAt', () => {
  const items = [{ start: 0 }, { start: 10 }, { start: 25 }]

  it('finds the last item that started', () => {
    expect(indexAt(items, 0)).toBe(0)
    expect(indexAt(items, 12)).toBe(1)
    expect(indexAt(items, 25)).toBe(2)
    expect(indexAt(items, 999)).toBe(2)
  })

  it('finds nothing before the first', () => {
    expect(indexAt([{ start: 5 }], 2)).toBe(-1)
    expect(indexAt([], 2)).toBe(-1)
  })
})

describe('speedLabel', () => {
  it('writes the speed with a decimal comma', () => {
    expect(speedLabel(1)).toBe('1×')
    expect(speedLabel(1.25)).toBe('1,25×')
    expect(speedLabel(0.75)).toBe('0,75×')
  })
})

describe('RateLimit', () => {
  it('lets at most four reports a second through', () => {
    const limit = new RateLimit()
    const passed = [0, 100, 200, 250, 300, 499, 500, 760].filter((now) => limit.allow(now))
    expect(passed).toEqual([0, 250, 500, 760])
  })

  it('lets a forced report through at once', () => {
    const limit = new RateLimit()
    expect(limit.allow(0)).toBe(true)
    expect(limit.allow(10)).toBe(false)
    expect(limit.allow(20, true)).toBe(true)
  })
})

describe('speakers', () => {
  const turns = [
    { start: 0, speaker: 'A' },
    { start: 10, speaker: 'A' },
    { start: 30, speaker: 'B' },
    { start: 60, speaker: 'A' },
  ]

  it('gives each speaker a colour in order of first appearance, past six the gray', () => {
    expect([...speakerColours(turns)]).toEqual([
      ['A', 'sky-blue'],
      ['B', 'dark-yellow'],
    ])
    const many = Array.from({ length: 8 }, (_, index) => ({ start: index, speaker: `S${index}` }))
    expect([...speakerColours(many).values()].slice(5)).toEqual(['green', 'other', 'other'])
  })

  it('says who speaks at a time, and nobody before the first turn', () => {
    expect(speakerAt(turns, 35)).toBe('B')
    expect(speakerAt([{ start: 5, speaker: 'A' }], 2)).toBeNull()
  })

  it("joins a speaker's turns into one stretch until the next speaker", () => {
    expect(speakerStretches(turns, 120)).toEqual([
      { speaker: 'A', from: 0, to: 0.25 },
      { speaker: 'B', from: 0.25, to: 0.5 },
      { speaker: 'A', from: 0.5, to: 1 },
    ])
    expect(speakerStretches(turns, 0)).toEqual([])
  })
})

describe('volumeForKey', () => {
  it('moves a tenth on the arrows, to the ends on Home and End, never past them', () => {
    expect(volumeForKey('ArrowUp', 0.5)).toBe(0.6)
    expect(volumeForKey('ArrowLeft', 0.05)).toBe(0)
    expect(volumeForKey('ArrowRight', 0.95)).toBe(1)
    expect(volumeForKey('End', 0.2)).toBe(1)
    expect(volumeForKey('Home', 0.2)).toBe(0)
    expect(volumeForKey('Enter', 0.2)).toBeNull()
  })
})
