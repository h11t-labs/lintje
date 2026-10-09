# Events: wat een element vraagt, en wat jij antwoordt

Een element haalt nooit iets op, schrijft nooit de URL en navigeert nooit. Het stuurt een event en wacht
tot jij een property zet. Elk event is een `CustomEvent`, bubbling en composed, dus één listener
op `document` hoort het vanaf elke diepte: de payload is `event.detail`, `event.target` het element
dat het stuurde. Welke tag wat stuurt, staat in de styleguide, onder elk element.

## Links

Een element dat een bestemming tekent, tekent een echte `<a href>`, en **de browser volgt die**: een
pagina per adres heeft geen script nodig. Een gewone klik wordt ook gemeld als `lintje-navigate`. Een pagina
met een eigen router annuleert dat event en gaat er zelf heen:

```js
document.addEventListener('lintje-navigate', (event) => {
  event.preventDefault() // the click is now yours
  router.push(event.detail.href)
})
```

Een klik met een modifier, of met een andere knop, is altijd van de browser: een nieuw tabblad, een
download. Waar geen klik te volgen is — een resultaat dat je met Enter kiest in de zoekfunctie, een
klik naast de titel van een kaart, een rij van de takenlijst — gaat het element zelf naar het adres, tenzij je het event annuleert. Een linkrij van `lintje-list` (`lintje-row-click`) en een melding met een `href`
(`lintje-notification-open`) werken op dezelfde manier.

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
- `dirty` zegt dat de lezer niet-opgeslagen invoer heeft; toon een `<lintje-confirm-dialog>` voordat je weggaat.
- Met `draft-key` bewaart het formulier een concept in `localStorage`; zonder, in het geheugen.

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
| `lintje-mark-select` | `lintje-map-tile`, `lintje-chart-tile` | actie |
| `lintje-layer-change` | `lintje-map-tile` | toestand |
| `lintje-filters-open-change` | `lintje-filter-bar` | toestand |
| `lintje-retry` | `lintje-error-summary`, `lintje-streaming-text` | actie |
| `lintje-files-add`, `lintje-file-remove`, `lintje-file-cancel` | `lintje-file-upload` | actie |
| `lintje-search` | `lintje-combobox` (`remote`), `lintje-app-search` | actie |
| `lintje-open` | `lintje-app-search`, `lintje-shortcuts` | actie |
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
| `lintje-toggle` | `lintje-expander`, `lintje-toggletip` | actie (niets te beantwoorden) |
| `lintje-copy`, `lintje-copy-error` | `lintje-copy-button`, `lintje-qr-code` | actie (niets te beantwoorden) |
| `lintje-job-cancel`, `lintje-job-resume`, `lintje-job-retry`, `lintje-job-remove` | `lintje-job-list` | actie |
| `lintje-stop` | `lintje-streaming-text` | actie |
| `lintje-text-change`, `lintje-languages-swap` | `lintje-translator` | toestand, actie |
| `lintje-segment-edit`, `lintje-segment-save`, `lintje-segment-cancel`, `lintje-segment-speaker`, `lintje-speaker-new`, `lintje-speaker-rename` | `lintje-transcript` | actie |
| `lintje-action` | `lintje-menu-button`, `lintje-user-menu`, `lintje-app-search`, `lintje-sub-nav` | actie |
| `lintje-search-open`, `lintje-logout`, `lintje-login`, `lintje-session-extend`, `lintje-draft-discard`, `lintje-notification-open`, `lintje-notifications-read` | de shell: `lintje-shell`, `lintje-user-menu`, `lintje-session-expiry`, `lintje-notifications` | actie |
| `lintje-conflict-keep-mine`, `lintje-conflict-take-theirs`, `lintje-conflict-compare` | `lintje-conflict-alert` | actie |
| `lintje-message-send`, `lintje-message-edit`, `lintje-suggestion-select`, `lintje-answer-retry`, `lintje-answer-rate`, `lintje-answer-stop` | de chat | actie |
| `lintje-sources-change`, `lintje-draft-change`, `lintje-strip-change` | de chat | toestand |

**Het verzoek en zijn antwoord.** Een opslag, een zoekactie, een bestand, een taak om te annuleren, een cel om op te slaan: het
element stuurt het verzoek en wacht op de property die het beantwoordt (`.options`, `.jobs`,
`busy`, `.errors`, `busyCells`). Het toont de wijziging van de lezer meteen en verwacht dat je volgende
waarde die bevestigt.

**Events die niet van jou zijn.** Een composed event dat niet in de tabel staat, hoort bij wie het
onderdeel heeft geopend: `lintje-close` van een modal, een drawer, een popover of een bevestigingsdialoog,
`lintje-confirm`, en `lintje-invalid` van het formulier (een echo van je eigen `.errors`). Een view
vangt de events van zijn eigen onderdelen af — het uitvouwen en downloaden van de tegel, het sluiten van de modal — zodat één
actie voor jou één event is. Een pagina die zo'n onderdeel zelf opent, is die eigenaar, en hoort ze.
