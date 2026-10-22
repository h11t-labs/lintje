/**
 * The one set of tones, and the one set of work states, every element translates its own words
 * into. A tone is a colour with its glyph; a state is what a task is doing. A host never maps:
 * an element that speaks its own vocabulary (the table's delivery status, a message's kind)
 * translates it here.
 */

/** A status colour with its glyph. `subtle` and `live` are the quiet and the recording form. */
export type Tone =
  | 'neutral'
  | 'subtle'
  | 'busy'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'attention'
  | 'live'

/** The glyph that says what the tone means; the colour is never the only carrier (rule 13). */
export const TONE_ICON: Partial<Record<Tone, string>> = {
  success: 'functioneel-cirkel-vinkje',
  warning: 'functioneel-waarschuwing',
  attention: 'functioneel-waarschuwing',
  error: 'functioneel-foutmelding',
  info: 'functioneel-info',
}

/**
 * The same glyphs in the house style's coloured form, for a status block (a message, a toast, the
 * summary of a form): the shape in the status colour with the glyph white.
 */
export const TONE_ICON_COLOURED: Partial<Record<Tone, string>> = {
  success: 'functioneel-cirkel-vinkje-gekleurd',
  warning: 'functioneel-waarschuwing-gekleurd',
  attention: 'functioneel-waarschuwing-gekleurd',
  error: 'functioneel-foutmelding-gekleurd',
  info: 'functioneel-info-gekleurd',
}

/** The word a tone stands for when an element has nothing more specific to say. */
export const TONE_WORD: Record<Tone, string> = {
  neutral: 'onbekend',
  subtle: 'onbekend',
  busy: 'bezig',
  success: 'in orde',
  warning: 'let op',
  error: 'storing',
  info: 'informatie',
  attention: 'aandacht',
  live: 'live',
}

/** What a task is doing: the queue, a progress bar and a status word share it. */
export type WorkState = 'queued' | 'busy' | 'paused' | 'done' | 'error' | 'cancelled'

export const WORK_STATE_TONE: Record<WorkState, Tone> = {
  queued: 'neutral',
  busy: 'busy',
  paused: 'warning',
  done: 'success',
  error: 'error',
  cancelled: 'subtle',
}

export const WORK_STATE_LABEL: Record<WorkState, string> = {
  queued: 'Wachtrij',
  busy: 'Bezig',
  paused: 'Onderbroken',
  done: 'Klaar',
  error: 'Mislukt',
  cancelled: 'Geannuleerd',
}

/** How content stands: drawn, still coming, nothing to draw, or failed. */
export type ContentStateKind = 'ready' | 'loading' | 'empty' | 'error'
