/**
 * The icons a chart draws itself (zoom controls, the pin in "Zet als bereik"), through
 * `renderIcon`. An icon-only control shows text when its file is missing (`+`, `−`), keeping
 * its size; what a control does is its `action`, never its icon's name.
 */
import { nothing, type TemplateResult } from 'lit'
import { renderIcon } from '../../../../icons/render'

/** One icon, or the text that stands in for it while no file has that name. */
export function chartIcon(name: string, text: string, size = 16): TemplateResult | string {
  const glyph = renderIcon(name, { size })
  return glyph === nothing ? text : glyph
}

/** The map's zoom controls, in the order the map and its skeleton draw them. */
export const ZOOM_CONTROLS = [
  { action: 'in', name: 'functioneel-plus', text: '+', label: 'Inzoomen' },
  { action: 'out', name: 'functioneel-minus', text: '−', label: 'Uitzoomen' },
  { action: 'home', name: 'functioneel-home', text: 'Terug', label: 'Terug naar het hele gebied' },
] as const
