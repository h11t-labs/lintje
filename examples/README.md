# Voorbeelden

Gewone HTML-pagina's die het design system **gebruiken**; geen ervan is er onderdeel van. Er is geen
framework, geen bundler en geen backend: elke pagina laadt één bundel — `dist-elements/lintje.js`
— plus `tokens.css` ernaast, en leest zijn iconen bestand voor bestand uit `dist-icons/`
(dat `npm install` samenstelt) en zijn lettertype uit `@nl-rvo/assets` (`src/tokens/fonts.css`).
`meldingen/` is de uitzondering die de andere manier van laden laat zien: de categorieën en de tags
die hij gebruikt, niet de hele bundel (`docs/guides/loading.md`). Geen TypeScript, dus elke statische
server volstaat.

| | |
|---|---|
| [`index.html`](index.html) | de voorpagina: één tegel voor de styleguide, één per applicatie |
| [`styleguide/`](styleguide/) | **de styleguide**: elk element per categorie, in zijn toestanden |
| [`dashboard/`](dashboard/) | een dashboardpagina: shell, filterbalk, KPI's, grafieken, kaart, tabel |
| [`chat/`](chat/) | chatten met data, als pagina van dat dashboard |
| [`meldingen/`](meldingen/) | een register van meldingen: de tabel als werkblad, en een nieuwe melding in drie stappen |
| [`transcriptie/`](transcriptie/) | een opname, live of achteraf: gestart met één druk, gelezen naast de audio, met AI-werk in een eigen tab |
| [`vertalen/`](vertalen/) | een tekst vertalen |
| [`catalogus/`](catalogus/) | een productcatalogus: een startpagina met een vraag, de catalogus met filters en een productpagina |
| [`_data/`](_data/) | de fictieve cijfers die het dashboard, de chat en de styleguide delen |
| [`_shared/`](_shared/) | de instellingen van de lezer die elke pagina deelt: thema's, emblemen, modus, wat meereist; en in `page.js` wat de applicaties op dezelfde manier doen |

Een map die met `_` begint, is geen voorbeeld: daarin staat wat de voorbeelden delen.

De styleguide toont elk element op zichzelf; de applicaties tonen wat ermee gebouwd is.

## De styleguide

Hij is de levende referentie: een wijziging aan een component in `src/` wordt daar gecontroleerd, in licht
**en** donker, op 1440 **en** 390 px. Onder elk element toont hij de referentie van de tag.

Het menu van de shell somt de categorieën op; de pagina tekent er één tegelijk. `?category=<name>` is een
categorie uit `src/categories.json`. De sectie van elk element heeft het id
`el-<tag without lintje->` (`#el-form`, `#el-tabs`); een adres dat er één noemt opent de
categorie waar het in staat, dus `styleguide/#el-tabs` is genoeg.

Een element staat er één keer, op volle breedte, in de eigen modus van de pagina: de modusknop in de
balk van de shell toont het in licht en in donker, zoals in elke applicatie. In de
bovenindeling (`?layout=top`) is elk van de vier koppen een item van de navigatiebalk met zijn
categorieën in een submenu; de huidige categorie is de actieve.

`styleguide/menu.js` zet **het menu** uit de categorieën (`src/categories.json`, via de bundel):
per kop de categorieën, en per categorie de elementen die hij toont, op volgorde.
`styleguide/specimens/` bevat **de specimens**, één module per categorie (`frame.js`,
`inputs.js`, …): een module exporteert `{ elements }`; elk element is een `tag`, een Nederlandse
`title` en zijn `specimens`, elk een `label`, gewone `html` en een optionele `setup(stage)` voor wat
een attribuut niet kan dragen (een rijke property, een listener). `styleguide/shared.js` bevat dat
contract en tekent een element als één `<lintje-tile>`, met eronder hoe je het laadt. Een tag van
de bundel die geen categorie heeft, wordt in de console gemeld, en zo ook een module die
ontbreekt of een fout gooit.

**Een nieuwe tag krijgt zijn plek in `src/categories.json` en zijn specimens in de module van zijn
categorie** (regel 6 en 20).

## Ze draaien

Elke geslaagde release (een versietag, `v0.2.0`) publiceert de voorbeelden op GitHub Pages
([`.github/workflows/pages.yml`](../.github/workflows/pages.yml)), onder
`https://h11t-labs.github.io/lintje/examples/`. Lokaal wordt de bundel niet gecommit, dus bouw hem eerst:

```bash
npm run build:elements    # → dist-elements/
```

Dan ofwel:

```bash
npm run dev               # een statische server op 5180 → /examples/
```

of een willekeurige statische server **in de root van de repository** — de paden van de pagina's zijn relatief en reiken
terug naar `dist-elements/`, `dist-icons/` en `src/`:

```bash
python3 -m http.server --protocol HTTP/1.1    # in de root, open dan
                                              # http://localhost:8000/examples/
```

De server moet zijn verbindingen openhouden (`--protocol HTTP/1.1` doet dat voor die van Python):
`meldingen/` laadt zo'n vijftig kleine bestanden, en een server die de verbinding na elk
bestand sluit, laat er een paar vallen.

`?theme=<name>` tekent een pagina in een van de zes thema's — `rijksoverheid` (de standaard),
`marechaussee`, `landmacht`, `marine`, `luchtmacht`, `defensie` — `?mode=dark` in donker (zonder
beslist het systeem van de lezer). De twee reizen mee van pagina naar pagina; elke pagina leest ze via `_shared/settings.js`, en elke link tussen voorbeelden
gaat via zijn `carry()`.

Elke pagina staat in `lintje-shell`. De styleguide, het dashboard, de chat en de voorpagina
laten de lezer de indeling kiezen: het menu naast de pagina (de standaard) of, met
`?layout=top`, een logobalk en één navigatiebalk erboven. Het menu "Weergave" van de shell biedt
de keuze, en `layout` en `menu` reizen met de andere instellingen mee tussen die pagina's; de
vier applicaties houden de navigatie boven de pagina en laten ze weg. De shell leest geen
URL: elke pagina zet de query om in de `data` van de shell en een `lintje-view-change` terug in
de query (`shellSettingsOf()` en `searchWith()` in `_shared/settings.js`).

Het dashboard houdt zijn filters ook in de query, één sleutel per filter, zodat een link de
weergave deelt: `?region=<id>`, `?kind=counter` (of `service`, `mobile`) en `?period=<from>..<to>` in
ISO-datums. Een waarde die de standaard van het filter is, wordt niet geschreven, en de drie blijven op het
dashboard — ze reizen niet mee naar een andere pagina.

## De data

`_data/*.json` is volledig fictief: een verzonnen vergunningendienst ("Dienst Vergunningen") met
vijftien loketten in stadscentra, verdeeld over vijf regio's, met aanvragen, wachttijden en
afwijzingen, en de aanvragen uit het buitenland naar de woonplaats van de aanvrager. Er staan geen
echte cijfers in. De bestanden zijn de bron — bewerk ze met de hand. `_data/load.js` haalt ze op voor
een pagina; `_data/chat.js` bevat het gesprek dat het chatvoorbeeld afspeelt. De vier applicaties dragen
hun eigen fictieve data in hun `app.js`.
