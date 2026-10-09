# Openstaande punten

Wat er nog openstaat in het design system: besluiten die niet genomen zijn, tokens en iconen die
ontbreken, afwijkingen van de ontwerpspecificaties die een lezer van
[`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) moet kennen, en de controles die geen test kan doen. Eén
regel per punt, met het bestand waar het over gaat. Sluit een regel in de wijziging die hem sluit.

## Iconen

- `src/components/content/video-player/video-player.ts`: de ondertitels zijn een rij van het menu "Meer opties"; met een ondertitelicoon (de set heeft er geen) zouden ze als knop in de rij kunnen staan.
- `src/components/content/audio-player/audio-player.ts`: de set heeft geen icoon voor 15 seconden overslaan; de overslaanknoppen dragen de pijlen met "15" eronder als tekst.
- `src/components/inputs/text-editor/text-editor.ts`: vet, cursief en kop zijn de letters "B", "I", "H"; lijst en link zijn de woorden "Opsomming" en "Link". De set heeft `symbolen-en-abstract-opsomming` en `functioneel-interne-link` (`functioneel-externe-link` betekent een externe link) — overleg met ontwerp voordat je ze gebruikt.
- `src/components/forms/stepper/stepper.ts`: de foutstap gebruikt `functioneel-waarschuwing`; de set heeft geen "uitroepteken".

## Tokens

- `src/components/content/audio-player/audio-player.css`: de kleur van een spreker die nog komt is die kleur op 40 % dekking, geen benoemde trede van een reeks. In licht blijven donkergeel, roze en mintgroen als vulling op wit onder 3:1.
- `src/components/content/video-player/video-player.css`: geen token voor een media-oppervlak; het podium, de video en het ondertitelvlak gebruiken `--color-text-on-light-fill`. Een `--color-media-bg` (inktzwart in beide modi) ontbreekt in `src/tokens/tokens.css`.
- `src/components/forms/form-actions/form-actions.ts`: een vastgezette actiebalk heeft geen schaduw — `--shadow-sticky` valt naar beneden; een opwaartse `--shadow-sticky-up` (en een `IntersectionObserver` voor `is-stuck`) ontbreekt.
- `src/tokens/tokens.css`: `--color-bg-subtle` en `--color-bg-selected` zijn dezelfde `--neutral-2`, dus een hover en een selectie verschillen alleen door de balk van 4 px (tabel, boomstructuur, lijst), een aangevinkte tabelrij ziet eruit als een rij onder de aanwijzer, en een hover van de een naar de ander verandert niets (`src/components/content/highlight/highlight.css`: de hover van de term).
- `src/components/tables/data-table/data-table.css`: een gefilterde kop krijgt `--color-bg-subtle`, tegen "een kop heeft geen vulling" in (`DESIGN_SYSTEM.md`, Tabellen); de hover van de sorteerknop is hetzelfde token.
- Ruimte buiten de 4 px-schaal (6 px, 10 px, 14 px, 2 px, 7 px, 13 px) in `tag-input.css`, `combobox.css`, `textarea.css`, `file-upload.css`, `notifications.css`; de rijen van 10 px in `list.css`, `description-list.css` en `announcement.css` zijn in elk geval onderling consistent.

## Primitives en gedeelde onderdelen

- `src/primitives/icon-button/icon-button.ts`: `size` (getypeerd `28 | 32 | 36 | 40 | 44`) wordt geaccepteerd en heeft geen effect — de box is altijd `--h-icon-button`. Het attribuut laten vallen is een brekende wijziging voor een host die het zet; besluit wanneer.
- `src/primitives/popover/popover.ts`: geen sheet-plaatsing op een telefoon; de combobox, de taginvoer, de datuminvoer en de menuknop houden een paneel onder het anker waar de specificaties een sheet onderaan tekenen.
- `src/components/inputs/shared/input.css`: de `:host(…)`-lijst noemt 7 van de 17 invoeren; de andere tien zetten elk hun eigen `:host`- en telefoonregel, en de telefoonregel voor het tekst- en getalveld staat in `radio-group.css`.
- `src/primitives/popover/popover.ts`: de popover vraagt alleen bij Escape en een klik buiten om te sluiten, niet wanneer de focus hem verlaat; een eigenaar zonder eigen `focusout` laat hem open na Tab voorbij zijn laatste stop of een focus elders (het popovercontract, `KNOWN`). Een `lintje-close` met een reden voor de focus zou dat voor elke eigenaar regelen.
- `src/components/inputs/date-range/date-range.ts`: het paneel staat `position: absolute` onder het veld, dus een scrollende voorouder (een tegel, een filterzone) snijdt het af; de multiselect zet het zijne `fixed` aan het veld (het popovercontract, `KNOWN`).
- `src/core/focus.ts` (`ownsEscape`: de popover, de multi-select, de datumreeks, de toggletip, de toast, het submenu van de bovenindeling, "Weergave" en "Delen"): of er een dialoog boven een open popup staat, wordt uit de focus gelezen — Escape blijft ongemoeid zolang de focus in een `aria-modal="true"` staat waar de popup niet in zit. Een dialoog die `aria-modal` niet zet, of die de focus niet genomen heeft, telt niet mee. Elke trap beantwoordt `isTopmost()` voor zichzelf (`src/components/shared/focus-trap.ts`), maar er is geen globale vraag naar de bovenste dialoog, dus een popup leest in plaats daarvan `aria-modal` uit de focus.
- `src/components/frame/shell/navigation.css`, `top-bar.css`, `mobile-header.css`, `src/components/frame/page-header/page-header.css`, `src/components/charts/kpi/kpi.css`, `src/primitives/tile/tile.css`: ruimte buiten de 4 px-schaal (22, 14, 10, 6, 18, 2 px) waar de railgeometrie van het menu of de gespecificeerde insprongen van de paginakop en de tegel die bepalen; gelaten zoals gespecificeerd.

## Dubbelingen

- `src/components/inputs/date-input/date-format.ts` en `date-input.ts` / `.css` herhalen het maandraster van `src/components/inputs/date-range/date-range.ts` / `.css` — weekdagen, `formatDate` (zelfde naam, andere invoer), `parseDate`, de markup en de CSS; het rekenen met dagen, de namen en de toetsen zijn gedeeld — met andere rijen (4–6 tegen 6), andere celafstanden en een andere vandaag-ring (`--color-accent-line` tegen `--color-info`); beide cellen zijn `--h-option`.
- `src/components/inputs/date-input/date-input.css`, `time-input.css`: de box van het bedieningselement herhaalt `text-input.css`.
- `src/components/inputs/multiselect/multiselect.ts`, `src/components/inputs/date-range/date-range.ts`, "Weergave" en "Delen" in `src/components/frame/shell/`: plaatsen hun paneel met eigen code in plaats van `primitives/shared/place.ts` (die van de multiselect is een kopie van `place()`).
- `src/components/frame/session-expiry/session-expiry.ts`: adopteert het stylesheet van de bevestigingsdialoog in plaats van `lintje-confirm-dialog` samen te stellen.
- `src/components/tables/activity-log/activity-log.ts`, `src/components/feedback/empty-state/empty-state.ts`: dezelfde schakeling voor het kopniveau.
- `src/components/frame/app-search/app-search.ts` en `src/components/inputs/combobox/combobox.ts`: dezelfde `splitMatch`.
- `src/components/inputs/combobox/combobox.ts` en `src/components/inputs/multiselect/multiselect.ts`: dezelfde `resultsText`.
- `src/primitives/popover/popover.ts` en `src/primitives/tooltip/tooltip.ts`: dezelfde `spotStyle`.
- `src/components/overlays/toggletip/toggletip.ts`, `src/components/shared/disclosure.ts`, `src/components/shared/charts/shared/controller.ts`: drie eigen tellers voor een uniek id.
- `src/components/charts/kpi/kpi.ts`, `src/components/inputs/textarea/textarea.ts`, `src/components/inputs/file-upload/file-upload.ts`: bouwen `formatNumber` van `src/core/format.ts` opnieuw.
- `src/primitives/tile/tile.css` en `src/components/shared/charts/shared/chart.css`: hetzelfde blok `.lintje-chart-state`.
- `src/components/frame/user-menu/user-menu.ts`: adopteert het stylesheet van de menuknop (`menu-button.css`) in plaats van `lintje-menu-button` samen te stellen.
- `src/components/map/map-tile/map-tile.ts`: adopteert `announcement.css` en `skeleton.css` in plaats van `lintje-announcement` en `lintje-skeleton` samen te stellen.
- `src/components/content/video-player/video-player.ts`: adopteert `button.css` en `icon-button.css` in plaats van `lintje-button` en `lintje-icon-button` samen te stellen.

## Contracten

- `src/components/tables/list/list.ts`: `RowClickDetail` dupliceert de vorm van de rijklik van de tabel.
- Eén actie, twee events: een linktab (`tabs.ts`: `lintje-tab-change` + `lintje-navigate`), een linkrij (`menu-button.ts`, `user-menu.ts`: `lintje-action` + `lintje-navigate`; `list.ts`: `lintje-row-action` naast de eigen `lintje-navigate` van het rijmenu).
- `src/components/forms/form-actions/form-actions.ts`: `state` heeft een vijfde waarde, `draft`, naast `saved | dirty | busy`; het zet `busy`, `disabled` en `block` op de knoppen in zijn slot, zodat de eigen waarde van een host bij het loslaten terugkomt.
- `src/components/content/audio-player/player.ts`: "Opnieuw proberen" laadt de media opnieuw en stuurt geen event.
- `src/components/tables/activity-log/activity-log.ts`: "Toon eerdere" toont alleen items die al gestuurd zijn; er is geen manier om de host om meer te vragen.
- `src/components/tables/data-table/filters.ts`: bereik- en periodefilters zijn niet gebouwd (`kind` is `options` | `text`); de kolomkiezer legt elke wijziging direct vast, zonder "Toepassen".

## Laden

- `vite.config.elements.ts`: een categorie is één bestand per tag boven op de gedeelde basis, dus `forms.js` is 32 requests en een pagina zo'n 45. Of de invoeren één bestand worden is niet besloten: minder requests, tegenover een pagina met drie invoeren die er zeventien laadt.
- `src/components/frame/shell/navigation.ts`: vanaf 768 px toont de voet van de zij-indeling de gebruiker en "Afmelden", niet de rijen van `userMenu`, die alleen de avatar van de bovenindeling en het telefoonmenu tekenen.
- `src/components/inputs/shared/input.ts`: in een native formulier melden alleen het tekstveld, het getalveld en de textarea hun geldigheid (`required`); de andere invoeren posten hun waarde en de `error` van een veld houdt een submit niet tegen. Een bestandsupload post de ids van de voltooide bestanden, niet de bestanden; de eigen `name` en `value` van de verzendknop worden niet gepost.
- `src/components/tables/data-table/data-table.ts`, `src/components/charts/chart-tile/chart-tile.ts`, `src/components/map/map-tile/map-tile.ts`: een klikbare rij of markering met een `href` is een event, geen link: zonder listener gaat hij nergens heen.

## Toegankelijkheid

- `src/components/inputs/date-input/date-input.ts`: de dagcellen zijn `<button role="gridcell">`.
- `src/components/frame/notifications/notifications.ts`: een open telefoonsheet blijft open over het breekpunt van 768 px heen en wordt de popover (de trap laat los, de focus keert terug naar de bel); het menu van `lintje-shell` sluit daar juist. Besluit welke van de twee klopt.
- `src/components/tables/data-table/data-table.ts`: geen `role="grid"`; een bewerkbare cel is een cel met `tabindex="0"` en een verborgen hint.
- `src/components/content/document-viewer/document-viewer.ts`: `role="toolbar"` zonder roving tabindex. "Passend" is `aria-pressed` maar tekent geen ingedrukte toestand; alleen het percentage ernaast verandert.
- `src/components/feedback/conflict-alert/conflict-alert.ts`: de melding neemt de focus terwijl zijn live-aankondiging spreekt; of een schermlezer de woorden dan twee keer zegt, is onbevestigd. "Verschillen bekijken" heeft `aria-expanded` maar geen `aria-controls`: de verschillen staan in een andere shadow root dan het binnenste bedieningselement van de knop.
- Doelen die alleen naar boven en beneden 48 px halen, omdat een raakvlak opzij een buur zou bedekken: de trechter van 32 px en het chipkruis van 28 px van de tabel (`data-table.css`), de greep van 28 px van de sorteerbare lijst, de links en "…" van de breadcrumbs, de naam van een voltooide stap in `stepper.css`. `src/components/layout/split-pane/split-pane.css`: de strook om de grootte te wijzigen is 9 px breed zonder raakvlak, omdat een bredere de scrollbalken van de panelen zou bedekken.
- `src/components/forms/stepper/stepper.ts`: op een telefoon heeft de horizontale stepper geen weg terug naar een voltooide stap.
- `src/tokens/themes.css`, thema `defensie`: alles wat in `--primary` tekent, staat als geaccepteerde tekortkoming in `DESIGN_SYSTEM.md` (Toegankelijkheid); `colour-scheme.test.ts` vraagt voor die vulling 3:1. In donker is een link op de waarschuwingstint (`#F17E22` op `#443322`) 4.44:1. Gevonden met axe over de styleguide in alle zes thema's; de andere vijf tonen niets wat `rijksoverheid` niet ook toont.
- `src/components/feedback/job-list/job-list.ts`, `src/components/feedback/streaming-text/streaming-text.ts`, `src/components/chat/chat-answer/chat-answer.ts`: de lijst is niet live; een aparte statusregio spreekt wijzigingen en hele zinnen uit (een bewuste afwijking van de specificaties).

Uit de WCAG-review van oktober 2026: wat nog openstaat in de elementen zelf. Wat het ontwerp zou veranderen, wacht op een besluit.

- Besluit — focusring: `--focus-orange` haalt 3.22:1 op wit, maar 2.55–2.95:1 op elke getinte lichte ondergrond: de filterband, `--color-bg-subtle`/`-inset`/`-selected`, de statustinten (toast, mededeling, conflictmelding, de status-cellen van `lintje-description-list`), `--color-choice-active-bg` en de waas van de hero voor elementen in een slot. Opties: een tweekleurige ring (oranje met een binnenlijn in inkt), een donkerder oranje, of een ring per ondergrond zoals `--color-hero-focus`.
- Besluit — `src/components/charts/kpi/kpi.ts`: gunstig of ongunstig is voor een ziende lezer alleen groen of rood (▲/▼ geeft de richting, niet het oordeel); het verborgen woord helpt alleen een schermlezer. Een zichtbaar woord of teken per toon.
- Besluit — grafieken: een lijn in mintgroen (1.80:1) of roze (2.17:1) op het lichte oppervlak, en punten in donkergeel, mintgroen en roze op het land van de kaart (1.6–2.0:1), halen geen 3:1. Een rand zoals donkergeel heeft (`components/shared/charts/shared/colors.ts`), of accepteren.
- Contrast in donker, elk een zichtbare wijziging: de stip van een gekozen radio (`--color-accent`, 1.3–2.4:1; `inputs/shared/input.css`, `menu-button.css`), de selectiebalk van een rij op `--color-bg-selected` (2.6:1; `list.css`, `data-table.css`), een link in een waarschuwingscel van `lintje-description-list` (4.1:1; `--color-link-on-status` is ervoor), de vulling van fout en klaar van `lintje-progress-bar` tegen het spoor (1.8–2.0:1), de foutmarkering van `lintje-stepper` (2.94:1), tijdcodes op een getinte fragment van `lintje-transcript` (4.4:1).
- Contrast in licht: dagen buiten de maand in `lintje-date-range` hebben de uitgeschakelde kleur (2.56:1) maar zijn kiesbaar; de vulling van de periode is 1.1:1; de stippellijn "lage zekerheid" van `lintje-highlight` is 2.7:1 (`--color-attention-line` haalt 3:1); stromen op de kaart staan op opacity .75 (2.1–2.8:1; `map-chart.css`, `leaflet.css`).
- Herschikken bij 400 % (1.4.10): het label van `lintje-button` loopt niet door (`nowrap` met beletselteken); een filterchip van de tabel loopt niet door en steekt bij 320 px uit; de actiebalk van `lintje-form-actions` plakt op een telefoon en neemt dan ongeveer 64 % van een viewport van 320×256; de beschrijving van `lintje-page-header` wordt onder 768 px niet getekend.
- Afgekapt met een beletselteken, zonder tooltip of doorloop: de h1 van de shell, de labels van het open zijmenu, de resultaten van `lintje-app-search`, de samenvatting van `lintje-stepper` op een telefoon, de rijen van `lintje-menu-button`, de labels van `lintje-sortable-list` (rijen van vaste hoogte) en `lintje-tree-view`, sprekernamen in `lintje-transcript`.
- Een live-regio die samen met haar tekst verschijnt (dus niet voorgelezen): het wachtvak van `lintje-streaming-text`, het skelet van een grafiek (`components/shared/charts/shared/chart-states.ts`), de status in de werkbalk van de tabel wanneer de filters gewist worden. Dezelfde tekst twee keer na elkaar wordt niet opnieuw voorgelezen in `lintje-tag-input`, `lintje-file-upload`, `lintje-repeater` en bij de grens van een verplaatsing in `lintje-sortable-list`.
- Te veel of dubbel voorgelezen: de foutsamenvatting is `role="alert"` en neemt ook de focus; het uitklapvenster van de tabel herhaalt het laatste bericht; de naam van een enkele `lintje-range` bevat zijn waarde (en `aria-valuenow` kan een tekst zijn); elke `lintje-card` in markup zegt "Gegevens geladen."; de knoppen "Menu"/"Sluiten" op een telefoon en de knop van `lintje-filter-zone` wisselen hun naam naast `aria-expanded`.
- Niet voorgelezen: het eerste werk in een lege `lintje-job-list`, het resultaat van Verlagen/Verhogen in `lintje-number-input`, een wijziging van de beschrijving in `lintje-segmented`, een verloren of zwakke verbinding in `lintje-recording-status`, de toon (waarschuwing, fout) van een cel van `lintje-description-list`.
- Focus: wanneer de laatste taak uit `lintje-job-list` gaat, landt de focus op de verborgen statusregel (geen zichtbaar doel zonder ontwerpwijziging); een sleep over de pagina haalt de gekozen knop van `lintje-file-upload` weg; in `lintje-transcript` verbergt een fragment dat dezelfde spreker krijgt als het vorige zijn knop met focus; de gekozen optie van `lintje-segmented` bedekt de focusring van haar buur; `lintje-tabs` wist `#pressed` niet bij `pointercancel`, dus de volgende focus met het toetsenbord tekent geen ring; met `columns` wijkt de DOM-volgorde van `lintje-expander` af van wat je ziet. Onder `prefers-reduced-motion: reduce` geeft `src/tokens/base.css` elk element `transition-duration: 80ms`, zodat ook de focusring (een outline of de lijn van een kaartteken) in 80 ms verschijnt, terwijl de focusring nooit geanimeerd is.
- Escape: `lintje-toast` sluit bij elke Escape op de pagina, ook een foutmelding of een toast met een actie; de Escape van `lintje-split-pane` sluit ook een modal eromheen, en `#placed` kan na een geannuleerde aanraking de volgende klik opslokken.
- Namen: de naam van de thuislink verbergt de zichtbare naam van de organisatie (2.5.3); de knoppen licht/donker beginnen niet met hun zichtbare woord; de terugzetknop van een veld zegt niet welk veld, en `reset-label` doet niets op `lintje-text-input` en `lintje-textarea`; `reason` op `lintje-button` dempt `description`; de telefoonknop "Filters" van de tabel mist `haspopup`/`expanded`; de gesplitste pijl van `lintje-menu-button` is niet `aria-disabled` terwijl hij bezig is; de grid van `lintje-date-range` mist `aria-multiselectable`; een natief veld in `lintje-form` krijgt `aria-invalid` maar geen melding; de ondertitel van `lintje-logo` komt niet bij een schermlezer; de container van de basiskaart heeft geen rol of naam.
- Iconen: `<lintje-icon label>` zonder bestand verliest zijn tekstalternatief; het icoon van de feedbacklink in de shell staat niet in het register, dus de link is leeg zolang het laadt.
- `src/components/feedback/level-meter/level-meter.ts`: de balken springen zolang er opgenomen wordt, zonder pauze, ook onder `prefers-reduced-motion` (alleen de overgang valt weg).
- `src/components/content/transcript/transcript.css`: het raakvlak van 48 px van de tijdcode schuift over de sprekerknop.
- Grafieken: een stroom op de svg-kaart is met focus maar 1 px; een gebied van de choropleet krijgt de omlijning van de browser in plaats van een lijn om zijn vorm; de choropleet en de vlakken op de basiskaart gebruiken nog `--color-map-border`; een punt met een reeks op de basiskaart (een marker, dus HTML) kleiner dan 24 px naast een ander teken haalt de doelgrootte van axe niet (2.5.8) — gezien met de cirkel en het vierkant van hemelblauw en donkergeel op de loketten van de voorbeelddata, waar vier bij elkaar staan; de punten op de svg-kaart zijn even klein, maar daar meet axe niet; op de basiskaart staat een punt met een reeks (een marker) boven elk pad en komt het toetsenbord er pas na alle paden langs, ook als zijn laag lager ligt; de focusring van een vlak staat achter zijn vorm en valt dus weg langs een rand die het deelt met een vlak dat later getekend is; labels op `other`/`remainder` in een gestapelde staaf halen in donker geen 4.5:1; de trendlijn van `lintje-bar-chart` overbrugt een `null`; de arcering ontbreekt op een basiskaart met alleen markers; reeksen zonder eigen kleur krijgen allemaal dezelfde; na een datawissel loopt de toetsenbordindex buiten bereik; een taartdiagram zonder legendatabel heeft geen toetsenbordpad en geen legenda.

## Afwijkingen van de specificaties

- `src/components/feedback/announcement/announcement.ts`: icoonbox 20 px (specificatie 24), de sluitknop een gewone knop in de box van `--h-icon-button` met een glyph van 16 px, "Mededeling sluiten", de link in de metaregel; "geen sluitknop bij een actie" is de `dismissible` van de host, niet afgedwongen. Er is geen vorm met alleen attributen.
- `src/components/feedback/ai-label/ai-label.ts`: het label als eerste regel van een export is aan de host.
- `src/components/forms/form/form.ts`: onderschept geen navigatie (de host roept de bevestigingsdialoog op bij `dirty`); `lintje-submitted` is de `saved()` van de host; `lintje-invalid` gaat af telkens als de host fouten zet.
- `src/components/forms/error-summary/error-summary.ts`: een vaste `<h3>`.
- `src/components/overlays/confirm-dialog/confirm-dialog.ts`: een eigen element, niet `lintje-modal`; het kader is `--color-border-strong`.
- `src/components/forms/form-section/form-section.ts`: `variant="tile"` tekent de tegelopmaak opnieuw; de kop is een vaste `<h3>`.
- `src/components/inputs/file-upload/file-upload.ts`: `lintje-upload-done` / `-error` zijn de `.files` van de host; een drop buiten de zone is aan de browser (die opent het bestand).
- `src/components/inputs/text-editor/text-editor.ts`: geen geneste of genummerde lijst, geen eigen ongedaan maken, geen placeholder, geen telling; het linkveld heeft geen knop Toevoegen.
- `src/components/tables/sortable-list/sortable-list.ts`: de andere rijen schuiven niet opzij; slepen scrolt niet automatisch.
- `src/components/feedback/streaming-text/streaming-text.ts`: `lintje-stop` / `lintje-retry` vervangen de stream-events van de specificatie.
- `src/components/content/document-viewer/document-viewer.ts`: geen PDF-rendering — de host rendert pagina's naar afbeeldingen, dus de tekst is niet selecteerbaar (`texts` geeft een schermlezer de tekst van elke pagina, verborgen); het passende percentage wordt alleen bij het laden gemeten.
- `src/components/layout/split-pane/split-pane.ts`: de greep is een focusbare `<div role="separator">`; een opgeslagen breedte wint van het attribuut `value`.
- `src/components/frame/app-search/app-search.ts`: registreert alleen `/` (geen Ctrl+K).
- `src/components/tables/data-table/editing.ts`: de datumeditor is een tekstveld, niet `lintje-date-input`; blur slaat op; op een telefoon is er geen bewerken en geen kiezer (de andere kolommen van een rij lees je in haar lijst).

## Gevonden bij het bouwen van de voorbeeldapplicaties

- `src/components/frame/page-header/page-header.ts`: in het slot `header` van de shell houdt de beschrijving het uiterlijk van het dashboard (1 rem, `--color-text-secondary`) waar de onderregels van de applicaties klein en gedempt waren. Besluit of de onderregel van een applicatie een beschrijving of een metaregel is.
- `src/components/frame/shell/header.ts`: de breedte van het lint gaat naar `lintje-logo` als getal in px (`RIBBON_WIDTH`) naast het token `--w-ribbon` in rem, dus de twee waarden staan op twee plekken en een grotere tekstgrootte van de lezer laat de logobalk (`--h-logobar`) groeien maar niet de tekening erin.
- `src/components/actions/logo/logo.ts`: met een eigen bestand van de host (`src`) wordt `full` genegeerd: de afbeelding wordt op de breedte van het lint getekend, dus een bestand met een heel logo belandt als miniatuur in de logobalk.
- `src/components/filters/filter-zone/filter-zone.css`, `src/components/frame/shell/shell.ts`: onder 768 px plakt de zin van de filterbalk niet — zijn `position: sticky` blijft binnen de host van de zone, die even hoog is als hijzelf — terwijl de shell er wel `scroll-padding-top` voor reserveert. Besluit of hij plakt; zo ja, dan onder de balk van de bovenindeling (56 px, `--h-topbar`), niet op de 72 px van de zij-indeling.
- `src/components/forms/form-actions/form-actions.ts`: WebKit scrolt bij focus de tekst van een tekstveld in beeld, niet zijn rand, dus de onderste pixels van een veld blijven onder de actiebalk; het veld is niet geheel bedekt (2.4.11 AA). De tabel lost hetzelfde op met een `focusin` die het veld van de balk vrij scrolt.
- `src/components/frame/shell/shell.ts`: de navigatiebalk van de bovenindeling is vastgezet aan de viewport; een host die een eigen container scrolt (`setHostConfig({ scrollRoot })`) krijgt de balk op de viewport, niet op die container.
- `src/components/frame/shell/header.ts`: een submenu gaat open zodra de aanwijzer op zijn item komt, zonder vertraging; op een touchscreen sluit een tweede tik op het item het niet (een tik erbuiten wel).
- `src/components/tables/data-table/data-table.ts`: `clickable` en `selectable` sluiten elkaar uit, dus een werkblad met een selectie opent een rij alleen via haar naam (`openable`), niet met een klik op de rij.
- `src/components/inputs/textarea/textarea.css`: de foutregel en de teller staan op twee regels; het ontwerp heeft ze op één.
- `src/components/inputs/file-upload/file-upload.ts`: geen `compact`-vorm (de dropzone van één regel uit het ontwerp).
- `src/components/feedback/streaming-text/streaming-text.ts`: het slot wordt pas geprojecteerd bij `done`, dus een term kan niet gemarkeerd worden terwijl de tekst streamt.
- `src/components/forms/repeater/repeater.ts`: tekent altijd zijn eigen legend, die de kop herhaalt van een `lintje-form-section` eromheen; op een telefoon staat de verwijderknop alleen naast het eerste veld.
- `src/components/forms/form/form.ts`: `beforeunload` vraagt het voor een herlaad die het concept toch zou herstellen; een bezig formulier bereikt de verwijderknoppen binnen `lintje-repeater-row` niet.
- `src/components/forms/form/form.ts` met `src/components/forms/error-summary/error-summary.ts`: de foutsamenvatting van het formulier drukt "label: melding" af met de eigen melding van het veld, dus een host moet meldingen voor beide plekken formuleren.
- `src/components/content/prose/prose.ts`: markup in het slot krijgt geen opmaak.
- `examples/meldingen/app.js` leest het concept zelf uit `localStorage` in plaats van `restoredDraft` en `restoredAt` van `lintje-form`. `examples/transcriptie/` en `examples/vertalen/` herladen de pagina om van modus te wisselen; `data-mode` tijdens het draaien wisselen werkt (gecontroleerd in Chromium op de transcriptiepagina: elk element volgt).

## Gevonden door de browsertests

`src/bundle/styleguide.browser.test.ts` tekent elk specimen van de styleguide in Chromium en WebKit, in de CI ook in Firefox, licht en donker, op 1440 en 390 px in het thema `rijksoverheid`, en draait er axe op. Wat axe vandaag vindt, staat in de `KNOWN`-lijst van dat bestand, met hier één regel per item; een fix haalt beide weg.

- `src/components/frame/shell/header.css`: het omgevingslabel is wit op het accent, 3.22:1 op de `#E17000` die vijf thema's delen (de `#007BC7` van `defensie` haalt 4.51:1); `mobile-header.css` en `navigation.css` tekenen hetzelfde label.
- `src/tokens/base.css`: onder `prefers-reduced-motion` geeft de regel op `*` elk element een transitie van 80 ms op elke property, ook de focusring, die nooit animeert (`transition-property` is `all` waar een blok er geen zet), terwijl het commentaar zegt dat alleen opacity 80 ms houdt; een kleur die een kind erft loopt dan één keer per niveau. Geen bevinding van axe: de test kwam het tegen als tekst die halverwege betrapt werd. Met de regel beperkt tot opacity melden `lintje-chat-answer` en `lintje-chart-tile` een ResizeObserver-lus in de styleguide, dus hun observers gaan eerst.

- `src/core/`: WebKit (Playwright 1.63) houdt de mediaqueries van een stylesheet die geen element gebruikt op het breekpunt van vóór een resize; Lit deelt één stylesheet per klasse, dus een eerste exemplaar dat pas na een draai of resize verschijnt, kan de verkeerde opmaak krijgen. In een echte Safari niet bevestigd; de browsertests wisselen de viewport daarom alleen met het element op de pagina.
- `src/components/forms/stepper/stepper.ts`: de wissel tussen rij en kolom geeft `ResizeObserver loop completed with undelivered notifications`, een `error`-event op `window`; `requestAnimationFrame` in de observer lost het op ten koste van één frame met een afgekapte rij.
- `vitest.config.ts`: WebKit op de Linux-runner van de CI mist nu en dan een poll van één seconde (de viewport die nog niet omgeslagen is in `breakpoint.browser.test.ts`, de sluitknop van `lintje-toast` die nog niet getekend is in `focus-handoff.browser.test.ts`); op macOS gebeurt dat niet. De WebKit-instantie krijgt daarom in elke run één herkansing; een test die twee keer faalt, faalt echt. Waarom die runner traag is, is niet uitgezocht.
- In de browserrun van de styleguide: Lit meldt een eigenschap die tijdens `update` verandert (change-in-update) voor `popover`, `shell`, `filter-zone`, `chat-composer`, `tabs`, `pagination`, `tooltip`, `toggletip`, `segmented` en `range`; `lintje-shortcuts` registreert `/` twee keer op de styleguidepagina; en ResizeObserver meldt drie onafgehandelde lusfouten, boven op die van de stepper hierboven.

## Nog te doen: browsercontroles

De browsertest van de styleguide tekent en audit; een `*.browser.test.ts` naast een component bedient het (focus, toetsen, aanwijzer) en meet wat het tekent, maar geen enkele luistert ernaar. Deze hebben nog een hand nodig, in Chromium, Firefox en Safari, licht en donker, op 1440 en 390 px — of zo'n test, die dan zijn regel weghaalt.

- `src/components/inputs/textarea/textarea.ts`: de `field-sizing`-fallback is alleen geforceerd getest (`textarea-fallback.browser.test.ts`): Chromium en WebKit kennen `field-sizing: content` allebei, dus in een engine zonder is hij nog niet gezien.
- `src/components/inputs/file-upload/file-upload.ts`: het sleepaantal is getest met een eigen `DataTransfer`; of Safari `dataTransfer.items` leesbaar houdt bij een echte sleep vanuit het systeem, is niet gezien.
- `src/components/tables/sortable-list/sortable-list.ts`: slepen met een vinger in Safari; Playwright stuurt geen touch naar WebKit, dus `sortable-list.browser.test.ts` sleept met touch alleen in Chromium.
- Geforceerde kleuren (Windows-hoog contrast): alleen in de emulatie van Chromium bekeken, in licht en donker, niet in Windows zelf.
- Er is geen test met een schermlezer gedaan op de live-regio's, de dialogen en de formulierfouten; wat ze zeggen is alleen tegen de DOM gecontroleerd.
- Firefox: de build van Playwright (1.63 met Firefox 155, en 1.64 met Firefox 157) start niet op macOS 27 ("Could not find profile folder"), dus `npm run test:browser:all` draait Chromium en WebKit; voeg `firefox` aan de lijst toe zodra hij wel start.
