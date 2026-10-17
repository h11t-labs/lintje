# Events: wat een element vraagt, en wat jij antwoordt

Een element haalt nooit iets op en schrijft nooit de URL; het gaat alleen naar een adres dat jij gaf,
en nooit als je zijn event annuleert ([links](#links)). Het stuurt een event en wacht tot jij een
property zet. Elk event is een `CustomEvent`, bubbling en composed, dus één listener
op `document` hoort het vanaf elke diepte: de payload is `event.detail`, `event.target` het element
dat het stuurde. Welke tag wat stuurt, staat in de styleguide, onder elk element.

## Links

Een element dat een bestemming tekent, tekent een echte `<a href>`, en **de browser volgt die**: een
pagina per adres heeft geen script nodig. Een gewone klik wordt ook gemeld als `lintje-navigate`. Een pagina
met een eigen router annuleert dat event en gaat er zelf heen:

```js
const shell = document.querySelector('lintje-shell')

document.addEventListener('lintje-navigate', async (event) => {
  event.preventDefault() // the click is now yours
  const view = await router.push(event.detail.href) // draws the new view
  document.title = `${view.title} — Meldingen`
  shell.focusContent()
})
```

Een router wisselt de inhoud zonder een nieuwe pagina te laden, dus de browser doet niet wat hij
bij een nieuwe pagina doet: de focus blijft op een link die weg is en valt naar `body`, en het
tabblad houdt de titel van de vorige weergave. Staat de nieuwe weergave er, dan doet de router drie
dingen:

1. **De paginatitel.** `document.title` wordt "Paginatitel — Naam van de applicatie", met de titel
   van de paginakop, het product of de stap: "Nieuwe melding, stap 2 van 3: Opvolging — Meldingen".
2. **De focus.** Bij een nieuwe pagina `shell.focusContent()`: de focus gaat naar de inhoud van
   `lintje-shell`, onder de balken, zoals met de skiplink. Bij een wissel binnen een pagina, zoals
   de volgende stap van een formulier, gaat de focus naar het begin van wat nieuw is, zoals het
   eerste veld van de stap.
3. **Wat weggaat.** Verbergt de host iets dat de focus had, zonder dat er een nieuwe weergave komt —
   een knop die zijn werk deed, een melding die oplost — dan zet hij de focus vóór het verbergen op
   een buur die blijft: het veld ernaast, de lijst, de paginakop.

Zet de focus ook bij Terug en Vooruit in de browser (`popstate`): ook dan tekent de router een
nieuwe weergave.

Een klik met een modifier, of met een andere knop, is altijd van de browser: een nieuw tabblad, een
download. Waar geen klik te volgen is — een resultaat dat je met Enter kiest in de zoekfunctie, een
klik naast de titel van een kaart, een rij van de takenlijst — gaat het element zelf naar het adres, tenzij je het event annuleert. Een linkrij van `lintje-list` (`lintje-row-click`) en een melding met een `href`
(`lintje-notification-open`) werken op dezelfde manier.

Zo werken ook een klikbare rij van `lintje-data-table` (`lintje-row-click`, `lintje-row-open`), een
teken in `lintje-chart` en een markering op `lintje-map` (`lintje-mark-select`) met een `href`:
eerst het event, en annuleert niemand het, dan gaat het element naar de `href`, via
`lintje-navigate`, zodat een router het daar opvangt. Een selectie ongedaan maken gaat zo naar de
`clearHref`. Zonder `href` is er alleen het event. Een klik met een modifier of met de middelste
knop op zo'n rij of teken stuurt hun event niet, maar opent de `href` in een nieuw tabblad, zoals
een link: dan heeft `lintje-navigate` `{ href, newTab: true }`. Een router die `lintje-navigate`
annuleert, ziet aan `newTab` dat de lezer een nieuw tabblad vroeg, en opent het zelf of laat het.

Een instelling van de lezer in de shell — modus, thema, waar het menu staat — is geen link:
`lintje-shell` stuurt `lintje-view-change` met de instelling die veranderde en laat het aan jou over
([dashboards](dashboard.md)).

## Formulieren

In een native `<form>` posten de invoerelementen hun waarden zoals native bedieningselementen dat doen, en geen event heeft
een antwoord nodig ([een eerste pagina](start.md) heeft de tabel van wat elk bedieningselement post). Een invoer met een naam
stuurt daar toch `lintje-values-change`; negeer het.

`<lintje-form>` is het formulier dat opslaat zonder de pagina te verlaten. Het verzamelt de waarden van de
velden met een naam erin en vraagt één keer:

```js
form.addEventListener('lintje-submit', async (event) => {
  form.busy = true
  const refused = await save(event.detail.values) // your request
  form.busy = false
  if (refused) form.errors = { fields: refused }   // { name: 'message' }
  else form.saved()
})
```

- In een `<lintje-form>` wordt de waarde van een veld gemeld in `lintje-submit`, niet gepost.
- `dirty` zegt dat de lezer niet-opgeslagen invoer heeft; vraag het in een `<lintje-dialog alert>` voordat je weggaat.
- Met `draft-key` bewaart het formulier een concept in `localStorage`; zonder, in het geheugen.
  Het teruggezette concept lees je met `restoredDraft` en het moment waarop het geschreven is met
  `restoredAt`, al vóór de velden bestaan, zodat je eerst de rijen tekent die het noemt; zonder concept
  zijn beide `null`. Zet `draft-key` vóór je ze leest.

## Toestand en acties

Een *toestand* is iets wat je bewaart en terugzet op het element (en in de URL mag zetten). Een
*actie* is iets waar je op handelt.

| event | van | soort |
|---|---|---|
| `lintje-navigate` | elk element dat een link tekent | actie |
| `lintje-view-change` | `lintje-shell`: "Weergave" en de pin van het menu | toestand |
| `lintje-title-edit` | `lintje-page-header` | actie |
| `lintje-submit`, `lintje-dirty-change` | `lintje-form` | actie, toestand |
| `lintje-values-change` | een invoer met een `name` buiten een `lintje-form`, `lintje-filter-bar`, `lintje-tree-view` en `lintje-sortable-list` met een `name` | toestand |
| `lintje-sort-change`, `lintje-filter-change`, `lintje-columns-change` | `lintje-data-table` | toestand |
| `lintje-checked-change` | `lintje-data-table`, `lintje-sortable-list` | toestand |
| `lintje-row-click` | `lintje-data-table`, `lintje-list` | actie |
| `lintje-row-open`, `lintje-cell-edit`, `lintje-row-action`, `lintje-bulk-action` | `lintje-data-table` (`lintje-row-action` ook `lintje-list`) | actie |
| `lintje-row-rename`, `lintje-row-rename-cancel` | `lintje-list` | actie |
| `lintje-card-action` | `lintje-card` (ook binnen `lintje-card-list`) | actie |
| `lintje-mark-select` | `lintje-map`, `lintje-chart` | actie |
| `lintje-layer-change` | `lintje-map` | toestand |
| `lintje-area-select` | `lintje-map` (met `controls.lasso`, `controls.circle` of `controls.rect`) | toestand |
| `lintje-node-select`, `lintje-node-toggle`, `lintje-node-expand` | `lintje-graph` | toestand, toestand, actie |
| `lintje-filters-open-change` | `lintje-filter-bar` | toestand |
| `lintje-retry` | `lintje-error-summary`, `lintje-streaming-text`, `lintje-audio-player`, `lintje-video-player` | actie |
| `lintje-files-add`, `lintje-file-remove`, `lintje-file-cancel` | `lintje-file-upload` | actie |
| `lintje-search` | `lintje-combobox` (`remote`), `lintje-app-search` | actie |
| `lintje-open` | `lintje-app-search` | actie |
| `lintje-row-add`, `lintje-row-remove` | `lintje-repeater`, `lintje-repeater-row` | actie |
| `lintje-tab-change` | `lintje-tabs` | toestand |
| `lintje-page-change` | `lintje-pagination`, `lintje-document-viewer` | toestand |
| `lintje-page-size-change` | `lintje-pagination` | toestand |
| `lintje-zoom-change`, `lintje-download` | `lintje-document-viewer` | toestand, actie |
| `lintje-gallery-change` | `lintje-gallery` | toestand |
| `lintje-split-change`, `lintje-pane-change` | `lintje-split-pane` | toestand |
| `lintje-time-change`, `lintje-play`, `lintje-pause` | `lintje-audio-player`, `lintje-video-player` | toestand |
| `lintje-seek` | `lintje-audio-player`, `lintje-video-player`, `lintje-transcript` | actie |
| `lintje-node-toggle` | `lintje-tree-view` | actie |
| `lintje-toggle` | `lintje-expander`, `lintje-toggletip`, `lintje-user-menu`, `lintje-person-group` | actie (niets te beantwoorden) |
| `lintje-copy`, `lintje-copy-error` | `lintje-copy-button`, `lintje-qr-code` | actie (niets te beantwoorden) |
| `lintje-job-cancel`, `lintje-job-resume`, `lintje-job-retry`, `lintje-job-remove` | `lintje-job-list` | actie |
| `lintje-jobs-empty` | `lintje-job-list`: de laatste taak ging met de focus erin; annuleer het en zet de focus zelf op een zichtbaar doel | actie |
| `lintje-stop` | `lintje-streaming-text` | actie |
| `lintje-text-change`, `lintje-languages-swap` | `lintje-translator` | toestand, actie |
| `lintje-segment-edit`, `lintje-segment-save`, `lintje-segment-cancel`, `lintje-segment-speaker`, `lintje-speaker-new`, `lintje-speaker-rename` | `lintje-transcript` | actie |
| `lintje-action` | `lintje-menu-button`, `lintje-user-menu`, `lintje-app-search`, `lintje-sub-nav` | actie |
| `lintje-search-open`, `lintje-logout`, `lintje-notification-open`, `lintje-notifications-read` | de shell: `lintje-shell`, `lintje-user-menu`, `lintje-notifications` | actie |
| `lintje-conflict-keep-mine`, `lintje-conflict-take-theirs`, `lintje-conflict-compare` | `lintje-conflict-alert` | actie |
| `lintje-message-send`, `lintje-questions-answer`, `lintje-message-edit`, `lintje-suggestion-select`, `lintje-answer-retry`, `lintje-answer-rate`, `lintje-answer-stop` | de chat | actie |
| `lintje-sources-change`, `lintje-draft-change`, `lintje-strip-change` | de chat | toestand |

**Eén vorm voor een rij.** De lijst en de tabel sturen hetzelfde: `lintje-row-action` draagt
`{ id, label, action }` (`RowActionDetail`), de sleutel van de rij, haar naam en de `value` van de
gekozen actie; `lintje-row-click` en `lintje-row-open` dragen `{ id, label, href? }`
(`RowClickDetail`). Beide types komen uit het pakket.

**Het verzoek en zijn antwoord.** Een opslag, een zoekactie, een bestand, een taak om te annuleren, een cel om op te slaan: het
element stuurt het verzoek en wacht op de property die het beantwoordt (`.options`, `.jobs`,
`busy`, `.errors`, `busyCells`). Het toont de wijziging van de lezer meteen en verwacht dat je volgende
waarde die bevestigt.

**Een keuze in de strook van de chat.** Een `lintje-strip-change` beantwoord je ter plekke: hetzelfde
antwoord met de nieuwe aanname, meteen in de toestand `ready`. Een streamend antwoord laat de strook
verdwijnen terwijl de lezer erin kiest, en de focus valt naar het vraagvak; in een keuzelijst gebeurt
dat op Windows al bij een pijltoets.

**Afspelen vanaf een tijdcode.** De tijdcode van `lintje-transcript` heet "Speel af vanaf 0:18" en
stuurt `lintje-seek`. Zet de speler op die tijd en roep daarna zijn `play()` aan; zonder dat zet de
knop alleen de positie.

```js
transcript.addEventListener('lintje-seek', (event) => {
  player.currentTime = event.detail
  player.play()
})
```

**Events die niet van jou zijn.** Een composed event dat niet in de tabel staat, hoort bij wie het
onderdeel heeft geopend: `lintje-close` van een modal, een dialoog, een drawer of een popover, en `lintje-invalid` van het formulier (een echo van je eigen `.errors`). Een view
vangt de events van zijn eigen onderdelen af — het uitvouwen en downloaden van de tegel, het sluiten van de modal — zodat één
actie voor jou één event is. Een pagina die zo'n onderdeel zelf opent, is die eigenaar, en hoort ze.
