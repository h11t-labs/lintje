/**
 * The sketches the overview draws for each element, and the chooser for each chart kind: the
 * element's shape in greys, on a page or a tile in outline, never the element itself. Calm,
 * the same for every element, and in the page's mode.
 *
 * A recipe is a frame and rows of parts, the rows split by ` / ` and the parts by spaces. A part
 * is a name with an optional width in percent: `l60` is a line of 60 %. `over` lays a layer
 * over the page, with rows of its own. The parts:
 *
 *   l  line          t  title line      T  big title      s  small line    u  link line
 *   b  button        bo outlined button bt text button    i  icon          io icon button
 *   in field         inic field with an icon in it        se select          ta text area
 *   cb / cbx  box    ra / rax  radio
 *   tg toggle        seg segments       tab tabs          chip  chip       dot  dot
 *   bar bar          prog progress      bx box            bxa marked box   img  picture
 *   menu menu        kpi figure         av avatar         qr code          emb emblem
 *   wave sound       play play          video picture     doc page         spin ring
 *   meter levels     slider slider      step steps        grip handle      ind indent
 *   chev / chevl / chevd chevron right, left, down  rule rule          sp space    bubble question
 *   dash suggestion
 *   tbl table        map map            log timeline      split two panes  card small card
 *   cell filled box  tags field with chips                mark marked term
 *   c<kind> a chart: cline carea cdual cbars chbars cgroup cstack cpie chist cheat cscatter ctarget
 *
 * A row may be marked in front: `[…]` stands in a frame, `|` has a stripe on its left, `#` is
 * filled, as a chosen row is.
 */

/* Frames: `page`, `tile`, `note` (a stripe on the left), `band` (filled), `code`, `drop`
   (dashed), or none. `nav` puts a menu beside the page, `foot` a band under it; `center` sets a
   small element in the middle of its box. */
export const SKETCHES = {
  // Page
  shell: { frame: 'page', nav: true, rows: 'l90 / l70 / l50 / l60' },
  'page-header': { rows: 'T50 / l90 / l70 / s40 u20' },
  breadcrumbs: { center: true, rows: 'u20 chev u20 chev l20' },
  'sub-nav': { rows: 's30 / t25 / s35 / u35 / u30 / u35' },
  hero: { frame: 'band', rows: 'T70 / l90 / l70 / u35 chev' },
  footer: { frame: 'band', rows: 't70 / s25 / l30 / l25 / l30' },
  'user-menu': { frame: 'band', center: true, rows: 'av chevd' },
  'app-search': { frame: 'page', rows: 'l90 / l70 / l50', over: 'search', layer: 'in / l70 / l50 / l60' },
  notifications: { frame: 'band', center: true, rows: 'i dot' },
  // Layout
  grid: { rows: 'bx60 bx30 / cell cell' },
  'grid-item': { rows: 'cell cell cell' },
  tile: { frame: 'tile', rows: 't40 / s30 / img / s40' },
  tabs: { rows: 'tab / l90 / l70 / l50' },
  expander: { rows: '[t50 sp chevd]' },
  'split-pane': { rows: 'split' },
  // Overlays
  modal: { frame: 'page', rows: 'l90 / l70 / l50 / l60', over: 'modal', layer: 't50 / l80 / l60 / sp bo25 b30' },
  dialog: { frame: 'page', rows: 'l90 / l70 / l50 / l60', over: 'dialog', layer: 't60 / l80 / sp bo35 b40' },
  drawer: { frame: 'page', rows: 'l90 / l70 / l50 / l60', over: 'drawer', layer: 't60 / l80 / l60 / in' },
  popover: { frame: 'page', rows: 'l90 / l70 / l50 / l60', over: 'popover', layer: 't60 / l80 / l60' },
  tooltip: { frame: 'page', rows: 'l90 / l70 / l50 / l60', over: 'tooltip', layer: 'l' },
  toggletip: { rows: 'l40 io', over: 'popover', layer: 't60 / l80' },
  // Actions
  button: { center: true, rows: 'b28 bo28 bt14' },
  'icon-button': { center: true, rows: 'io' },
  'menu-button': { rows: 'se35 / menu' },
  'copy-button': { center: true, rows: 'bo35' },
  'qr-code': { center: true, rows: 'qr / bo35' },
  icon: { center: true, rows: 'i i i i i' },
  icons: { rows: 'i l20 i l20 i l20 / i l20 i l20 i l20 / i l20 i l20 i l20' },
  logo: { center: true, rows: 'emb emb' },
  // Text and media
  prose: { rows: 'T50 / l90 / l80 / l85 / l40' },
  code: { frame: 'code', rows: 'l30 / l60 / l50 / l70 / l20' },
  highlight: { rows: 'l25 mark35 / l70' },
  'token-value': { rows: 'l30 cbx l20 / l30 cbx l20 / l30 l35' },
  translator: { frame: 'tile', rows: 'se io se / split' },
  'audio-player': { frame: 'tile', rows: 'wave / s10 sp play sp i' },
  'video-player': { rows: 'video' },
  transcript: { rows: '| s15 s5 / | l80 / | s15 s5 / | l70 / | s15 s5 / | l75' },
  'document-viewer': { frame: 'tile', rows: 't30 sp chevl s15 chev / i i s10 sp i / doc' },
  gallery: { rows: 'img / cell cell cell' },
  // Messages and status
  announcement: { frame: 'band', rows: 'i t60 / l60' },
  toast: { frame: 'page', rows: 'l90 / l70 / l50 / l60', over: 'toast', layer: 't70 / l60' },
  'conflict-alert': { frame: 'note', rows: 't50 / l80 / bo bt' },
  'empty-state': { center: true, rows: 'i / t40 / l60 / b35' },
  'error-page': { rows: 's20 / T50 / l70 / in60 / u30 / u30' },
  badge: { center: true, rows: 'chip chip chip' },
  'status-dot': { center: true, rows: 'dot l15 dot l15 dot l15' },
  spinner: { center: true, rows: 'spin spin spin' },
  skeleton: { rows: 'cell40' },
  'progress-bar': { rows: 't30 sp s30 / prog' },
  'job-list': { rows: 't50 sp u15 / s40 / chip / rule / t45 sp u15 / prog70' },
  'streaming-text': { rows: '[spin l40]' },
  'ai-label': { rows: 'chip l50' },
  'level-meter': { center: true, rows: 'meter t20' },
  'recording-status': { rows: 'kpi kpi' },
  // Fields
  field: { rows: 's20 / se50' },
  'text-input': { rows: 's20 / in / s20' },
  find: { rows: 'inic / l50 mark15 l25 / l30 mark15' },
  textarea: { rows: 's30 / ta / sp s20' },
  'number-input': { rows: 's20 / io in io / s40' },
  select: { rows: 's20 / se50' },
  combobox: { rows: 's30 / se / menu' },
  multiselect: { rows: 's30 / tags60 / s40' },
  'tag-input': { rows: 's30 / tags / s50' },
  checkbox: { center: true, rows: 'cbx l40' },
  'checkbox-group': { rows: 't40 / cb l40 / cbx l30 / s30 / cb l40' },
  'radio-group': { rows: 't30 / rax l25 / ra l30 / ra l30' },
  toggle: { center: true, rows: 'tg l40' },
  segmented: { rows: 's30 / seg' },
  range: { rows: 's30 s20 / slider / s10 sp s10 sp s10' },
  'date-input': { rows: 's20 / inic60 / s20' },
  'time-input': { rows: 's20 / inic30 / s15' },
  'date-range': { rows: 's20 / inic' },
  'slot-picker': { rows: 's30 / s15 s15 s15 / bx bx bx / bx bx bx / bx bx bx' },
  'file-upload': { frame: 'drop', center: true, rows: 'bo35 l30 / s45' },
  'text-editor': { rows: 's20 / [s5 s5 s5 s15 s10] / ta' },
  // Forms
  form: { rows: 's20 / in / s25 / in / s25 sp bo20 b20' },
  'form-section': { frame: 'tile', rows: 'T40 / s20 / in in40' },
  stepper: { rows: 'io u30 s15 / io t30 / io l40' },
  repeater: { rows: 's25 / in in io / bo40 s20' },
  'repeater-row': { rows: 'in in io' },
  'error-summary': { frame: 'tile', rows: 'i t50 / dot u60 / dot u40' },
  'form-actions': { rows: 'rule / s25 sp bo20 b20' },
  // Filters
  'filter-bar': { rows: 'se se se sp bo / l60' },
  'filter-zone': { frame: 'tile', rows: 'se se / se se' },
  'filter-sheet': { frame: 'page', rows: 'l90 / l70 / l50 / l60', over: 'drawer', layer: 't60 / se / se / sp b' },
  // Figures and charts
  'kpi-row': { rows: 'kpi kpi kpi kpi' },
  kpi: { rows: 'kpi' },
  chart: { frame: 'tile', rows: 't40 sp seg20 / s20 s20 / cline' },
  note: { frame: 'tile', rows: 't40 sp s20 / l90 / l90 / l70 / s25' },
  explainer: { frame: 'tile', rows: 't50 sp chevd / t15 l60 / t15 l50' },
  // Map
  map: { frame: 'tile', rows: 't40 / map' },
  // Tables and lists
  'data-table': { frame: 'tile', rows: 't40 / s30 / rule / t30 sp t15 t15 / l40 sp l15 chip / l35 sp l15 chip / l30 sp l15 chip' },
  pagination: { center: true, rows: 'chevl s12 play s3 s3 u15 chev' },
  list: { rows: '| t40 / | s30 / | t35 / | s30 / | t35 / | s30' },
  card: { frame: 'tile', rows: 'img / s20 / t50 / l70 / bo' },
  'card-list': { rows: 'card card card' },
  'description-list': { rows: 's20 / l40 / s20 / l50 / s20 / l35 sp u15' },
  'tree-view': { rows: 'chevd l30 / ind chevd l35 / ind ind ind l30 / # ind ind ind t30 / ind ind ind l30 / ind chev l25' },
  'sortable-list': { rows: '[grip l30] / [grip l40] / [grip l25] / [grip l30]' },
  'activity-log': { rows: 't30 / log' },
  // Chat
  chat: { frame: 'page', rows: 'sp s10 i bubble50 / l60 / tbl' },
  'chat-message': { rows: 'sp s10 i bubble60' },
  'chat-answer': { rows: 't90 / l50 / kpi kpi kpi' },
  'chat-composer': { frame: 'tile', rows: 'l80 / s5 / se35 sp b30' },
  'chat-strip': { rows: 's15 s15 s15 / l25 u15 u15 / s20 / u25' },
  'chat-suggestions': { rows: 's40 / dash60 / dash45 dash45' },
}

/** Each chart kind as the chooser draws it. */
export const KIND_SKETCHES = {
  line: 'cline',
  'stacked-area': 'carea',
  'dual-axis': 'cdual',
  bar: 'cbars',
  'horizontal-bar': 'chbars',
  'grouped-bar': 'cgroup',
  'stacked-bar': 'cstack',
  pie: 'cpie',
  histogram: 'chist',
  heatmap: 'cheat',
  scatter: 'cscatter',
  radar: 'cradar',
  'target-progress': 'ctarget',
}

// The charts in a 100 × 50 box: `i` is the ink, `w` the weaker second series.
const CHARTS = {
  cline:
    '<polyline class="i" fill="none" points="0,38 16,32 33,35 50,20 66,24 83,10 100,14"/><polyline class="w" fill="none" stroke-dasharray="4 3" points="0,42 16,40 33,38 50,34 66,36 83,28 100,30"/>',
  carea:
    '<polygon class="w" points="0,50 0,24 25,20 50,14 75,16 100,8 100,50"/><polygon class="i" points="0,50 0,36 25,34 50,28 75,30 100,24 100,50"/>',
  cdual:
    '<g class="w"><rect x="4" y="26" width="10" height="24"/><rect x="20" y="18" width="10" height="32"/><rect x="36" y="30" width="10" height="20"/><rect x="52" y="14" width="10" height="36"/><rect x="68" y="22" width="10" height="28"/><rect x="84" y="10" width="10" height="40"/></g><polyline class="i" fill="none" points="9,16 25,20 41,8 57,12 73,4 89,6"/>',
  cbars:
    '<g class="i"><rect x="4" y="22" width="11" height="28"/><rect x="20" y="12" width="11" height="38"/><rect x="36" y="28" width="11" height="22"/><rect x="52" y="18" width="11" height="32"/><rect x="68" y="30" width="11" height="20"/><rect x="84" y="8" width="11" height="42"/></g>',
  chbars:
    '<g class="i"><rect x="0" y="2" width="84" height="8"/><rect x="0" y="15" width="66" height="8"/><rect x="0" y="28" width="50" height="8"/><rect x="0" y="41" width="28" height="8"/></g><line class="w" x1="60" y1="0" x2="60" y2="50" stroke-dasharray="3 3"/>',
  cgroup:
    '<g class="i"><rect x="6" y="18" width="9" height="32"/><rect x="40" y="10" width="9" height="40"/><rect x="74" y="24" width="9" height="26"/></g><g class="w"><rect x="17" y="28" width="9" height="22"/><rect x="51" y="20" width="9" height="30"/><rect x="85" y="14" width="9" height="36"/></g>',
  cstack:
    '<g class="i"><rect x="8" y="26" width="16" height="24"/><rect x="32" y="20" width="16" height="30"/><rect x="56" y="30" width="16" height="20"/><rect x="80" y="22" width="16" height="28"/></g><g class="w"><rect x="8" y="10" width="16" height="16"/><rect x="32" y="6" width="16" height="14"/><rect x="56" y="14" width="16" height="16"/><rect x="80" y="4" width="16" height="18"/></g>',
  cpie:
    '<circle class="w" cx="50" cy="25" r="23"/><path class="i" d="M50 25 L50 2 A23 23 0 0 1 71 34 Z"/>',
  chist:
    '<g class="i"><rect x="0" y="36" width="16" height="14"/><rect x="17" y="20" width="16" height="30"/><rect x="34" y="6" width="16" height="44"/><rect x="51" y="16" width="16" height="34"/><rect x="68" y="30" width="16" height="20"/><rect x="85" y="42" width="15" height="8"/></g>',
  cheat:
    '<g class="w"><rect x="0" y="0" width="24" height="12"/><rect x="50" y="0" width="24" height="12"/><rect x="26" y="13" width="24" height="12"/><rect x="76" y="13" width="24" height="12"/><rect x="0" y="26" width="24" height="12"/><rect x="50" y="38" width="24" height="12"/></g><g class="i"><rect x="26" y="0" width="24" height="12"/><rect x="76" y="0" width="24" height="12"/><rect x="0" y="13" width="24" height="12"/><rect x="50" y="13" width="24" height="12"/><rect x="26" y="26" width="24" height="12"/><rect x="76" y="26" width="24" height="12"/><rect x="0" y="38" width="24" height="12"/><rect x="26" y="38" width="24" height="12"/><rect x="76" y="38" width="24" height="12"/><rect x="50" y="26" width="24" height="12"/></g>',
  cscatter:
    '<g class="i"><circle cx="8" cy="42" r="3"/><circle cx="22" cy="36" r="3"/><circle cx="34" cy="38" r="3"/><circle cx="48" cy="26" r="3"/><circle cx="60" cy="30" r="3"/><circle cx="74" cy="18" r="3"/><circle cx="88" cy="12" r="3"/></g><line class="w" x1="0" y1="22" x2="100" y2="22" stroke-dasharray="3 3"/>',
  cradar:
    '<polygon class="w" fill="none" points="50,2 72,13.5 72,36.5 50,48 28,36.5 28,13.5"/><polygon class="i" points="50,8 66,16.5 62,32 50,44 34,34 30,14"/>',
  ctarget:
    '<g class="w"><rect x="0" y="4" width="100" height="9"/><rect x="0" y="20" width="100" height="9"/><rect x="0" y="36" width="100" height="9"/></g><g class="i"><rect x="0" y="4" width="80" height="9"/><rect x="0" y="20" width="56" height="9"/><rect x="0" y="36" width="34" height="9"/></g><line class="i" x1="74" y1="0" x2="74" y2="50"/>',
  map: '<path class="w" d="M38 2 L62 4 L72 14 L66 24 L74 34 L62 48 L44 46 L34 36 L24 32 L30 18 Z"/><g class="i"><circle cx="46" cy="22" r="3"/><circle cx="58" cy="30" r="4"/><circle cx="40" cy="36" r="2.5"/></g>',
}

function part(token) {
  const [, name, width] = token.match(/^([a-zA-Z]+?)(\d*)$/)
  const node = document.createElement('span')
  node.className = `guide__sk guide__sk--${name}`
  if (width) node.style.setProperty('--sk-w', `${width}%`)
  const svg = CHARTS[name]
  if (svg) {
    node.className = 'guide__sk guide__sk--chart'
    // A drawing with circles keeps its proportions; bars and lines may stretch to the row.
    const round = /circle/.test(svg) ? 'xMidYMid meet' : 'none'
    node.innerHTML = `<svg viewBox="0 0 100 50" preserveAspectRatio="${round}">${svg}</svg>`
  }
  // A few parts are drawn of smaller parts.
  const inner = { menu: 3, tab: 4, seg: 3, tbl: 4, kpi: 3, doc: 4, meter: 6, step: 5, wave: 18, qr: 9, grip: 6, log: 4, split: 2, card: 3, tags: 2 }[name]
  for (let i = 0; i < (inner ?? 0); i++) node.append(document.createElement('i'))
  return node
}

// A row's mark in front of it: `[…]` stands in a frame, `|` has a stripe on its left, `#` is filled.
const ROW_MARKS = [
  [/^\[(.*)\]$/, 'box'],
  [/^\|\s*(.*)$/, 'stripe'],
  [/^#\s*(.*)$/, 'fill'],
]

function rows(text, className) {
  const column = document.createElement('div')
  column.className = className
  for (const row of text.split(' / ')) {
    const line = document.createElement('div')
    line.className = 'guide__sk-row'
    let tokens = row.trim()
    for (const [mark, kind] of ROW_MARKS) {
      const match = tokens.match(mark)
      if (!match) continue
      line.classList.add(`guide__sk-row--${kind}`)
      tokens = match[1].trim()
    }
    for (const token of tokens.split(/\s+/)) line.append(part(token))
    column.append(line)
  }
  return column
}

/** The sketch of a recipe, or of a chart kind; `null` when there is none. */
export function sketchOf(recipe) {
  if (!recipe) return null
  const { frame, nav, foot, center, rows: text, over, layer } =
    typeof recipe === 'string' ? { rows: recipe } : recipe
  const box = document.createElement('div')
  box.className = `guide__sketch${over ? ` guide__sketch--${over}` : ''}`
  box.setAttribute('aria-hidden', 'true')
  const body = rows(text, `guide__sk-frame guide__sk-frame--${frame ?? 'none'}`)
  if (nav) body.classList.add('guide__sk-frame--nav')
  if (foot) body.classList.add('guide__sk-frame--foot')
  if (center) body.classList.add('guide__sk-frame--center')
  box.append(body)
  if (over) {
    if (['modal', 'dialog', 'drawer', 'search'].includes(over)) {
      const veil = document.createElement('div')
      veil.className = 'guide__sk-veil'
      box.append(veil)
    }
    box.append(rows(layer ?? 't60 / l80', 'guide__sk-layer'))
  }
  return box
}
