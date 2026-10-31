# Laden

`npm install && npm run build:elements` schrijft `dist-elements/`. De map staat niet in git:
bouw hem in je eigen bouwstap en serveer hem in zijn geheel als statische bestanden. Link `tokens.css` in
`<head>` en laad de elementen als module; de import is de registratie.

Het npm-pakket `lintje` (`npm install lintje`) bevat dezelfde map, met een naam per ingang:
`lintje` is `lintje.js`, `lintje/core` is `core.js`, `lintje/<category>` een categorie,
`lintje/tag/<name>` één tag, en `lintje/tokens.css`, `/fonts.css` en `/icons/<name>.svg` de
bestanden ernaast. Het heeft geen verplichte afhankelijkheden: Lit, Leaflet, dagre en d3-force zitten in de bestanden. `lit` 3 is een optionele
`peerDependency`, alleen voor de typen van de geërfde leden van een element.

## Twee manieren van laden, en een pagina kiest er één

| bestand | wat het is |
|---|---|
| `lintje.js` | alles in één verzoek: elke tag, Lit, en elke stylesheet in de module |
| `core.js` | de functies voor je pagina, zonder tag: `setIconSource`, `setHostConfig`, `registerShortcut`, en `LINTJE_VERSION`, de versie van deze bestanden |
| `frame.js`, `inputs.js`, `charts.js`, … | een categorie: de tags die bij elkaar horen, zoals de stijlgids ze indeelt |
| `tag/<name>.js` | één tag: `tag/shell.js` is `<lintje-shell>` |
| `dev.js` | een controle voor tijdens het ontwikkelen: het waarschuwt voor een tag die je vergat te importeren |
| `chunks/` | de code die die bestanden delen. Importeer er nooit uit: de namen veranderen elke keer dat je bouwt |
| `workers/layout-worker.js` | de indeling van een groot entiteitendiagram (`lintje-graph`), buiten de pagina berekend. De module vindt hem naast zich; ontbreekt hij, of laat het beleid van de pagina geen worker toe, dan deelt de pagina de graaf zelf in |
| `tokens.css` | de thema's en de tokens ([thema's](theming.md)) |
| `fonts.css` | de twee `@font-face`-regels voor RijksSans, die wijzen naar `fonts/` ernaast. Optioneel |
| `custom-elements.json` | de tag-referentie, gelezen uit de broncode |
| `tokens.json` | elk token dat een pagina mag noemen, met zijn groep en zijn commentaar uit `tokens.css`; zonder waarde, want die hangt af van modus en thema |
| `*.d.ts`, `types/` | de typen: een `.d.ts` naast elk bestand hierboven, en de datavormen in `types/types.d.ts`. Met `lit` 3 als devDependency zijn ook de geërfde leden van een element getypeerd |
| `guides/` | deze handleidingen |
| `skills/lintje/` | een skill voor een AI-assistent die met Lintje bouwt: kopieer de map naar de skills-map van je assistent, bij Claude Code `.claude/skills/` van je applicatie. Hij leest `custom-elements.json` en `tokens.json`, en controleert de eigen CSS van je applicatie |

De iconen staan niet in `dist-elements/`: je serveert zelf een kopie van `dist-icons/`
([iconen](#iconen)). Het npm-pakket brengt die map mee.

**Eén kopie van de toestand van de module.** `setIconSource()`, `setHostConfig()` en `registerShortcut()`
schrijven in de toestand van de module. Laad daarom `lintje.js` of de losse bestanden, nooit beide, alles uit één map
van één versie, en spel overal dezelfde URL: anders laadt de browser twee instanties en komt je aanroep
terecht in de instantie die de elementen niet gebruiken.

### Alles: `lintje.js`

Eén bestand: de eenvoudigste manier, en de juiste voor een pagina die het meeste toont van wat Lintje heeft.

### Wat de pagina gebruikt: categorieën en tags

```js
import { setIconSource } from './dist-elements/core.js'
import './dist-elements/frame.js'
import './dist-elements/forms.js'
import './dist-elements/tag/toast.js'

setIconSource({ base: './icons/' })
```

`examples/meldingen/` laadt op deze manier.

| categorie | tags |
|---|---|
| `frame.js` — Paginakader | `shell`, `page-header`, `breadcrumbs`, `sub-nav`, `hero`, `footer`, `user-menu`, `language-nav`, `app-search`, `notifications` |
| `layout.js` — Indeling | `grid`, `grid-item`, `tile`, `tabs`, `expander`, `accordion`, `split-pane` |
| `overlays.js` — Vensters en panelen | `modal`, `dialog`, `drawer`, `popover`, `tooltip`, `toggletip` |
| `actions.js` — Knoppen en iconen | `button`, `icon-button`, `menu-button`, `copy-button`, `qr-code`, `icon`, `logo` |
| `content.js` — Tekst en media | `prose`, `code`, `key`, `highlight`, `token-value`, `translator`, `audio-player`, `video-player`, `transcript`, `log-viewer`, `document-viewer`, `gallery`, `attachment` |
| `feedback.js` — Meldingen en status | `announcement`, `toast`, `conflict-alert`, `empty-state`, `error-page`, `badge`, `status-dot`, `spinner`, `skeleton`, `progress-bar`, `job-list`, `streaming-text`, `ai-label`, `level-meter`, `recording-status` |
| `inputs.js` — Invoervelden | `field`, `text-input`, `find`, `textarea`, `number-input`, `select`, `combobox`, `multiselect`, `tag-input`, `checkbox`, `checkbox-group`, `radio-group`, `toggle`, `segmented`, `range`, `date-input`, `time-input`, `date-range`, `slot-picker`, `file-upload`, `text-editor` |
| `forms.js` — Formulier | `form`, `form-section`, `stepper`, `repeater`, `repeater-row`, `error-summary`, `form-actions` |
| `filters.js` — Filters | `filter-bar`, `filter-zone`, `filter-sheet` |
| `charts.js` — Kerncijfers en grafieken | `kpi-row`, `kpi`, `chart`, `note`, `explainer` |
| `map.js` — Kaart | `map` |
| `graph.js` — Netwerk | `graph` |
| `tables.js` — Tabellen en lijsten | `data-table`, `pagination`, `list`, `card`, `card-list`, `description-list`, `tree-view`, `sortable-list`, `timeline`, `person`, `person-group` |
| `chat.js` — Chat met data | `chat`, `chat-message`, `chat-answer`, `chat-steps`, `chat-composer`, `chat-questions`, `chat-strip`, `chat-suggestions` |

De tabel volgt `src/categories.json`. `forms.js` laadt `inputs.js` mee: een formulier is niets
zonder zijn velden. Een pagina met alleen filters of losse velden laadt `filters.js` of
`inputs.js` zonder de formuliercode. Een tag die je los wilt, laad je als `tag/<name>.js`. Wat
geldt voor deze manier van laden:

- **Een tag brengt mee wat hij tekent.** Je noemt de tags die je HTML en script schrijven, niet hun onderdelen.
- **Noem hem voordat je hem maakt.** Een tag die je script bij een klik aanmaakt
  (`document.createElement('lintje-toast')`) wordt bovenaan geïmporteerd zoals de andere. Niets wordt
  op verzoek opgehaald.
- **Elk bestand laadt de basis**: Lit, de tokens, de iconen die de elementen tekenen en de
  bouwstenen die bijna elke tag tekent. Een bouwsteen als `button` of `grid` hoef je dus niet apart te laden. De kaart, met Leaflet en zijn geometrie, is de zwaarste tag.
- **Het zijn tientallen kleine bestanden.** Serveer de map over HTTP/2, of met verbindingen die
  open blijven: een server die de verbinding na elk bestand sluit, laat er een paar vallen, en één module die
  niet laadt, laat de pagina zonder zijn tags. De bestanden in `chunks/` dragen een hash in hun naam en
  mogen voor altijd in de cache blijven; de andere houden hun naam, dus laat de browser ze telkens controleren.
- **`dev.js` tijdens het ontwikkelen.** Een vergeten tag tekent niets en zegt niets; met
  `dev.js` op de pagina noemt de console hem en het bestand om te importeren. Laat het weg in productie.

## Iconen

**De iconnaam is de bestandsnaam** in `dist-icons/`, zonder `.svg`: `functioneel-home`. Een
element noemt het bestand dat het tekent, en je data ook (het `icon` van een menu-item).

Een naam wordt in deze volgorde opgezocht: `src` (een SVG die je zelf hebt bepaald) → de iconen die de bundel
meedraagt (die de elementen zelf tekenen) → **één bestand opgehaald uit je iconenmap**
→ niets.

Serveer een kopie van `dist-icons/` en zeg waar die staat, voordat het eerste element tekent:

```js
setIconSource({ base: '/static/lintje/icons/', version: '<build>' })
```

De iconenlader haalt `<base><name>.svg` op de eerste keer dat die naam getekend wordt, één keer per naam. Zonder
`base` is het `/icons/`. **Een naam zonder bestand tekent niets**, en een bedieningselement toont dan zijn
Nederlandse label: een ondersteunde toestand, dus je mag een bestand weglaten of vervangen. Een
eigen icoon toevoegen: [eigen iconen](icons.md).

## Sneltoetsen

Registreer de toetsen van je pagina in het ene register in plaats van te luisteren op het document:

```js
const remove = registerShortcut({ keys: '/', description: 'Zoeken', handler })
```

Een toets zonder Ctrl, Alt of Meta gaat nooit af terwijl de focus in een veld staat, een toets met een
ervan alleen met `inFields: true`. De laatste registratie van een toets wint, dus een dialoog neemt een
toets over van de pagina. `shortcuts()` somt op wat
geregistreerd is: het overzicht is een `<lintje-dialog heading="Sneltoetsen">` die de pagina
daarmee vult en op `?` opent, voorgedaan in de stijlgids (`examples/_shared/shortcuts.js`).

Een toets van één teken zonder Ctrl, Alt of Meta (`/`, `?`) kan de lezer uitzetten, met
`setCharacterKeys(false)`; de keuze blijft bewaard in `localStorage`. Het recept heeft die
schakelaar al: "Sneltoetsen van één teken" staat in de voet van het overzicht, onder de lijst.
Met die toetsen uit opent `?` niets, dus bied het overzicht ook aan vanuit een knop of een menu.

## Een pagina die een eigen vak scrollt

Een venster boven de pagina zet het scrollen van de pagina vast, en sommige onderdelen lezen of zetten het scrollen ervan. Dat is
het eigen scrollende element van het document, tenzij je een ander noemt, één keer, voordat het eerste element
tekent:

```js
setHostConfig({ scrollRoot: () => document.querySelector('#content') })
```

Houd de elementen buiten elke voorouder met een `transform`, `filter` of `contain`: de verduistering achter een venster
is `position: fixed` en zou relatief worden aan die voorouder.

De bovenindeling van `lintje-shell` zet haar navigatiebalk vast aan het venster, dus die vraagt een pagina die
zelf scrolt. Scrollt je applicatie een eigen vak, kies dan de zij-indeling (`layout="side"`): die werkt
met een eigen `scrollRoot`.
