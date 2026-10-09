/**
 * The side layout's top bar: the name, the tools, "Zoeken", "Weergave" and "Delen". Render
 * functions of `<lintje-shell>`, drawn in its shadow root. The top layout has no top bar;
 * `renderBarTools` puts "Weergave" and "Delen" in its navigation bar, as bare icons — and in the
 * top bar too when the labelled buttons do not fit (`toolsCompact`).
 */
import { html, nothing, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { renderIcon } from '../../../icons/render'
import '../../inputs/radio-group/radio-group'
import type { ModeSetting, ShellData, ShellView } from '../../../types'
import type { LintjeShell } from './shell'

/** The three light/dark settings in display order, each shown as its word. */
const MODE_SETTINGS: readonly { value: ModeSetting; text: string; label: string }[] = [
  { value: 'system', text: 'Systeem', label: 'Systeemweergave' },
  { value: 'light', text: 'Licht', label: 'Lichte modus' },
  { value: 'dark', text: 'Donker', label: 'Donkere modus' },
]

/**
 * Below 768 px a panel opens from below as a sheet, with the filter sheet's head: its name and a
 * close button. Above it the panel hangs from its tool and needs neither.
 */
function sheetHead(
  shell: LintjeShell,
  title: string,
  close: () => void,
): TemplateResult | typeof nothing {
  if (!shell.mobile.matches) return nothing
  return html`<div class="lintje-share__header">
    <h2 class="lintje-share__title" id="lintje-sheet-title">${title}</h2>
    <button
      type="button"
      class="lintje-dialog-close lintje-share__close"
      aria-label="${title} sluiten"
      @click=${close}
    >
      ${renderIcon('functioneel-kruis', { size: 16 })}
    </button>
  </div>`
}

/** The e-mail's subject: the page and the application, as the top bar names them. */
export function mailSubject(data: ShellData | null | undefined): string {
  return [data?.pageName, data?.name].filter(Boolean).join(' – ')
}

/** One icon in the share menu, or the empty box that keeps the label aligned. */
export function shareGlyph(name: string): TemplateResult {
  const glyph = renderIcon(name, { size: 16 })
  return glyph === nothing
    ? html`<span class="lintje-share__gap" aria-hidden="true"></span>`
    : glyph
}

/** The top bar: matters of the whole page only, never filters. */
export function renderTopBar(shell: LintjeShell): TemplateResult {
  const data = shell.data
  const titleHidden = shell.store.state.titleHidden

  return html`<header class="lintje-top-bar">
    <div class="lintje-top-bar__name">
      <div class="lintje-top-bar__words">
        <!-- The page's one h1. Below 768 px this bar is display: none and the mobile header
             carries it instead. -->
        ${data?.name ? html`<h1 class="lintje-top-bar__dashboard">${data.name}</h1>` : nothing}
        ${
          data?.pageName
            ? html`<span
              class=${classMap({ 'lintje-top-bar__page': true, 'is-visible': titleHidden })}
              aria-hidden=${!titleHidden}
              >› ${data.pageName}</span
            >`
            : nothing
        }
      </div>
    </div>

    <div class="lintje-top-bar__actions">
      ${
        shell.toolsCompact
          ? html`${shell.renderSearch()}${shell.renderNotifications()}${renderBarTools(shell)}`
          : renderLabelledTools(shell)
      }
    </div>
  </header>`
}

/** "Zoeken", "Weergave" and "Delen" as buttons with their word; search shows its key. */
function renderLabelledTools(shell: LintjeShell): TemplateResult {
  const data = shell.data
  return html`${
    data?.search
      ? html`<lintje-button
          variant="tertiary"
          size="chrome"
          icon="functioneel-zoek"
          keyshortcuts="/"
          @click=${() => shell.askSearch()}
          >Zoeken <kbd class="lintje-key lintje-top-bar__key" aria-hidden="true">/</kbd></lintje-button
        >`
      : nothing
  }${shell.renderNotifications()}
      ${
        data?.view
          ? html`<div class="lintje-view" @focusout=${(event: FocusEvent) => leavePanel(shell, event)}>
            <lintje-button
              class="lintje-view__button"
              variant="tertiary"
              size="chrome"
              icon="functioneel-darkmode"
              icon-right="functioneel-delta-omlaag"
              .expanded=${shell.viewOpen}
              @click=${() => toggleView(shell)}
              >Weergave</lintje-button
            >
            ${shell.viewOpen ? renderView(shell, data.view) : nothing}
          </div>`
          : nothing
      }
      ${
        data?.share
          ? html`<div class="lintje-share" @focusout=${(event: FocusEvent) => leavePanel(shell, event)}>
            <lintje-button
              class="lintje-share__button"
              variant="tertiary"
              size="chrome"
              icon="functioneel-delen"
              icon-right="functioneel-delta-omlaag"
              .expanded=${shell.shareOpen}
              @click=${() => toggleShare(shell)}
              >Delen</lintje-button
            >
            ${shell.shareOpen ? renderShare(shell) : nothing}
          </div>`
          : nothing
      }`
}

/** "Weergave" and "Delen" each open their own panel and close the other. */
function toggleView(shell: LintjeShell): void {
  shell.viewOpen = !shell.viewOpen
  shell.shareOpen = false
  shell.openGroup = null
}

function toggleShare(shell: LintjeShell): void {
  shell.shareOpen = !shell.shareOpen
  shell.viewOpen = false
  shell.openGroup = null
}

/**
 * A panel closes once the focus leaves it and its tool, so it never covers what Tab reaches next.
 * Focus to nowhere (a click beside it) is the scrim's; a sheet below 768 px holds the focus itself.
 */
function leavePanel(shell: LintjeShell, event: FocusEvent): void {
  const next = event.relatedTarget as Node | null
  const tool = event.currentTarget as HTMLElement
  if (!next || shell.mobile.matches || tool.contains(next)) return
  if (tool.classList.contains('lintje-view')) shell.viewOpen = false
  else shell.shareOpen = false
}

/**
 * One bare tool on the navigation bar: the glyph, or its Dutch word without an icon file. Both
 * panels are disclosures, not menus: `aria-expanded` without `aria-haspopup`.
 */
function barTool(
  label: string,
  icon: string,
  className: string,
  open: boolean,
  onClick: () => void,
): TemplateResult {
  const glyph = renderIcon(icon, { size: 20 })
  return html`<button
    type="button"
    class=${classMap({
      'lintje-shell__tool': true,
      'lintje-shell__tool--text': glyph === nothing,
      [className]: true,
    })}
    aria-label=${label}
    title=${label}
    aria-expanded=${open}
    @click=${onClick}
  >
    ${glyph === nothing ? label : glyph}
  </button>`
}

/** "Weergave" and "Delen" as bare tools at the end of the navigation bar. */
export function renderBarTools(shell: LintjeShell): TemplateResult {
  const data = shell.data
  return html`${
    data?.view
      ? html`<div class="lintje-view" @focusout=${(event: FocusEvent) => leavePanel(shell, event)}>
          ${barTool('Weergave', 'functioneel-darkmode', 'lintje-view__button', shell.viewOpen, () =>
            toggleView(shell),
          )}
          ${shell.viewOpen ? renderView(shell, data.view) : nothing}
        </div>`
      : nothing
  }${
    data?.share
      ? html`<div class="lintje-share" @focusout=${(event: FocusEvent) => leavePanel(shell, event)}>
          ${barTool('Delen', 'functioneel-delen', 'lintje-share__button', shell.shareOpen, () =>
            toggleShare(shell),
          )}
          ${shell.shareOpen ? renderShare(shell) : nothing}
        </div>`
      : nothing
  }`
}

/** The panel of "Weergave": a choice applies at once and the panel stays; a press beside closes. */
export function renderView(shell: LintjeShell, view: ShellView): TemplateResult {
  const close = (): void => {
    shell.viewOpen = false
  }
  const sheet = shell.mobile.matches
  return html`
    <div class="lintje-share__scrim" @click=${close}></div>
    <div
      class="lintje-view__popover"
      role=${sheet ? 'dialog' : 'group'}
      aria-modal=${sheet ? 'true' : nothing}
      aria-label="Weergave"
      tabindex="-1"
    >
      ${sheetHead(shell, 'Weergave', close)}
      <p class="lintje-share__heading">Licht of donker</p>
      <div class="lintje-view__row">
        <div class="lintje-toggle-group" role="group" aria-label="Systeem, licht of donker">
          ${MODE_SETTINGS.map((option) =>
            toggle(
              option.label,
              '',
              option.text,
              option.value === view.mode,
              () => shell.changeView({ mode: option.value }),
              true,
            ),
          )}
        </div>
      </div>
      ${
        view.layoutChoice
          ? html`<p class="lintje-share__heading">Menu</p>
              <div class="lintje-view__row">
                <div class="lintje-toggle-group" role="group" aria-label="Plaats van het menu">
                  ${toggle(
                    'Menu als zijbalk',
                    '',
                    'Zijbalk',
                    shell.layout === 'side',
                    () => shell.changeView({ layout: 'side' }),
                    true,
                  )}
                  ${toggle(
                    'Menu boven',
                    '',
                    'Boven',
                    shell.layout === 'top',
                    () => shell.changeView({ layout: 'top' }),
                    true,
                  )}
                </div>
              </div>`
          : nothing
      }
      ${renderThemes(shell, view)}
    </div>
  `
}

/** One choice of six long names: a radio group, under the panel's own heading as its name. */
function renderThemes(shell: LintjeShell, view: ShellView): TemplateResult | typeof nothing {
  const themes = view.themes
  if (!themes?.length) return nothing
  return html`<p class="lintje-share__heading" aria-hidden="true">Thema</p>
    <div class="lintje-view__row">
      <lintje-radio-group
        class="lintje-view__themes"
        label="Thema"
        hide-label
        .options=${themes}
        .value=${view.theme ?? themes[0].value}
        @lintje-change=${(event: CustomEvent<string>) => shell.changeView({ theme: event.detail })}
      ></lintje-radio-group>
    </div>`
}

/** One option in a toggle group; `text` shows while the icon has no file, or where `words` is set. */
export function toggle(
  label: string,
  icon: string,
  text: string,
  active: boolean,
  onClick: () => void,
  words: boolean = false,
): TemplateResult {
  // The accessible name is the full word, even where the face is an abbreviation or a drawing.
  const glyph = words ? nothing : renderIcon(icon, { size: 16 })
  return html`<button
    type="button"
    class=${classMap({
      'lintje-toggle-group__option': true,
      'lintje-toggle-group__option--text': glyph === nothing,
      'is-active': active,
    })}
    aria-pressed=${active}
    aria-label=${label}
    title=${label}
    @click=${onClick}
  >
    ${glyph === nothing ? text : glyph}
  </button>`
}

/** Swaps the share menu and its QR code, with the focus on what took the place of the press. */
function showPhone(shell: LintjeShell, phone: boolean): void {
  shell.sharePhone = phone
  void shell.updateComplete.then(() =>
    shell.renderRoot
      .querySelector<HTMLElement>(phone ? '.lintje-share__back' : '.lintje-share__phone')
      ?.focus(),
  )
}

/** This view's link for a phone, under the host's scheme so an app opens it (`mibrowsers`). */
export function phoneLink(href: string, scheme = ''): string {
  const name = scheme.replace(/:(\/\/)?$/, '')
  return name ? name + href.slice(href.indexOf(':')) : href
}

/** The share menu's second face: this view's link as a code a phone camera reads. */
function renderSharePhone(shell: LintjeShell, close: () => void): TemplateResult {
  return html`
    <div class="lintje-share__scrim" @click=${close}></div>
    <div class="lintje-share__popover" role="dialog" aria-labelledby="lintje-share-phone">
      <button type="button" class="lintje-share__item lintje-share__back" @click=${() => showPhone(shell, false)}>
        ${shareGlyph('functioneel-terug')}Terug
      </button>
      <p class="lintje-share__heading" id="lintje-share-phone">Open op mijn telefoon</p>
      <div class="lintje-share__qr">
        <p class="lintje-share__hint">Scan de code met de camera van je telefoon.</p>
        <lintje-qr-code
          class="lintje-share__code"
          label="QR-code naar deze weergave"
          src=${shell.data?.qrCode ?? ''}
          value=${phoneLink(window.location.href, shell.data?.qrScheme)}
        ></lintje-qr-code>
      </div>
    </div>
  `
}

/**
 * The panel of "Delen": a disclosure of plain buttons, not a menu, so Tab walks it. An item that
 * is done closes it and gives the focus back to "Delen"; so does Escape (`<lintje-shell>`).
 */
export function renderShare(shell: LintjeShell): TemplateResult {
  const close = () => {
    shell.shareOpen = false
  }
  const done = (): void => shell.closePanel('.lintje-share__button')
  if (shell.sharePhone) return renderSharePhone(shell, close)
  // As a sheet the panel is a dialog: its head names it, so the heading "Delen" goes.
  const sheet = shell.mobile.matches
  return html`
    <div class="lintje-share__scrim" @click=${close}></div>
    <div
      class="lintje-share__popover"
      role=${sheet ? 'dialog' : 'group'}
      aria-modal=${sheet ? 'true' : nothing}
      aria-label="Delen"
      tabindex="-1"
    >
      ${sheet ? sheetHead(shell, 'Delen', close) : html`<p class="lintje-share__heading">Delen</p>`}
      <button
        type="button"
        class="lintje-share__item"
        @click=${() => {
          void navigator.clipboard?.writeText(window.location.href)
          shell.showToast('Link naar deze weergave gekopieerd')
          done()
        }}
      >
        ${shareGlyph('functioneel-externe-link')}Link naar deze weergave
      </button>
      <button
        type="button"
        class="lintje-share__item"
        @click=${() => {
          const subject = encodeURIComponent(mailSubject(shell.data) || document.title)
          const body = encodeURIComponent(window.location.href)
          window.location.href = `mailto:?subject=${subject}&body=${body}`
          done()
        }}
      >
        ${shareGlyph('functioneel-mail')}Verstuur als e-mail
      </button>
      <p class="lintje-share__heading">Exporteren</p>
      <button
        type="button"
        class="lintje-share__item"
        @click=${() => {
          done()
          // After the menu has left the page, or it is on the print.
          requestAnimationFrame(() => window.print())
        }}
      >
        ${shareGlyph('functioneel-printer')}Afdrukken of opslaan als PDF
      </button>
      <button
        type="button"
        class="lintje-share__item lintje-share__phone"
        @click=${() => showPhone(shell, true)}
      >
        ${shareGlyph('functioneel-smartphone')}Open op mijn telefoon
      </button>
      <!-- Drawn in the design, not built, so not shown (owner, 18 Sep: no dead buttons):
           "Abonneer: dagelijks om 08:00" needs a mail service, "Alle data (CSV)" an export
           of every tile. Each returns here with its action. -->
      <!-- The footer is the filter bar's "Je ziet" sentence, through the store. -->
      ${
        shell.store.state.summary
          ? html`<p class="lintje-share__footer">${shell.store.state.summary}</p>`
          : nothing
      }
    </div>
  `
}

/* --- Toast ------------------------------------------------------------- */
