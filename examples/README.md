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
| [`styleguide/`](styleguide/) | **de styleguide**: de tokens, en elk element per categorie, in zijn toestanden |
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
**en** donker, op 1440 **en** 390 px.

Het menu van de shell begint met **Fundament**: drie pagina's, Kleur, Typografie en Maat en beweging
(`?foundation=colour`, `typography`, `size`), met elk token dat een component mag noemen. Een rij
geeft de naam, de waarde zoals de modus en het thema van de lezer hem berekenen
(`lintje-token-value`), hoe hij eruitziet en het commentaar uit `tokens.css`, als citaat. De build
schrijft de tokens met hun commentaar in `tokens.json` (`scripts/tokens.mjs`);
`styleguide/foundation.js` deelt ze in groepen in. Een nieuw token krijgt daar een groep, anders
faalt `src/bundle/tokens.test.ts`.

Daarna somt het menu de categorieën op. De pagina van een categorie (`?category=<name>`, uit
`src/categories.json`) is een overzicht: per element een kaart met een schets van zijn vorm, in grijs
en in de modus van de pagina (`styleguide/sketches.js`), wat het is en hoeveel het toont. Elk
element heeft een
eigen pagina, `?element=<tag without lintje->` (`?element=tabs`). Bovenaan staat een witte band
van rand tot rand (de `full`-slot van de shell): het kruimelpad, de naam, in één zin wat het is, één
regel met zijn feiten en een link naar de broncode, en vier tabs — Voorbeelden, Referentie,
Toegepast in en Gebruiken; de open tab staat in de URL (`&tab=`). Naast de inhoud staat "Op deze
pagina" voor de open tab (`lintje-sub-nav` met `expanded`). Daarop staan:

- **de voorbeelden**, een per rij: links de titel (`label`) en de uitleg (`note`), rechts het
  element in een wit vlak; een breed element (`wide`) staat onder zijn titel, over de hele rij, en
  een venster (`frame`) staat open in een eigen pagina'tje. De expander "Code" opent de code in
  tabs: de markup, en wat `setup` zette als script (`el.data = …`) en als JSON in de
  markup voor een pagina die een server rendert. Die code wordt gelezen uit wat het voorbeeld
  tekende, dus hij klopt altijd. Standaard is hij dicht, zodat de pagina rustig blijft;
- **de referentie**: een rij per eigenschap, gegroepeerd in attributen (wat je in de HTML zet; de
  vijf die de voorbeelden het meest gebruiken eerst, de rest achter "Alle tonen") en data (rijke
  waarden, met de velden van hun type open te klappen eronder), dan events, slots en methoden.
  Elke rij geeft de waarden, de standaard, het commentaar uit de broncode — als citaat, in het
  Engels — en de voorbeelden die hem tonen. Bovenaan staan een zoekveld en de keuze tussen
  attributen en data, onderaan het kopcommentaar van de tag. Alles komt uit `custom-elements.json`
  en `data-types.json`, die de build uit de broncode schrijft (`scripts/manifest.mjs`);
- **hoe je hem gebruikt**, in twee stappen: laad de tag (alleen de tag, zijn categorie of de hele
  bundel, elk met wat het kost) en zet hem in je pagina, zoals het eerste voorbeeld.

Een tag die meer soorten van één ding tekent, `lintje-chart`, toont er één tegelijk
(`&soort=pie`): gekozen op de vraag van de lezer, met wanneer je hem neemt en wanneer niet
(`src/components/shared/charts/kinds.ts`), zijn voorbeelden en zijn eigen velden. Onder "Voor elke
soort" staan de staten — laden, leeg, fout — getekend voor de gekozen soort, en wat elke soort
deelt.

`#el-<tag without lintje->`, het oudere adres, opent de pagina van het element, dus
`styleguide/#el-tabs` werkt nog. Een element staat in de eigen modus van de pagina: de modusknop
in de balk van de shell toont het in licht en in donker, zoals in elke applicatie. In de
bovenindeling (`?layout=top`) is elke kop een item van de navigatiebalk met zijn pagina's in een
submenu; de huidige pagina is de actieve. Past de balk niet, dan wijken de koppen voor "Menu".

`styleguide/menu.js` zet **het menu**: de Fundament-pagina's, en de categorieën
(`src/categories.json`, via de bundel) per kop, en per categorie de elementen die hij toont, op
volgorde.
`styleguide/specimens/` bevat **de specimens**, één module per categorie (`frame.js`,
`inputs.js`, …): een module exporteert `{ elements }`; elk element is een `tag`, een Nederlandse
`title` en zijn `specimens`, elk een `label`, gewone `html` en een optionele `setup(stage)` voor wat
een attribuut niet kan dragen (een rijke property, een listener). Een element met soorten heeft
`groups` en `states`. Het overzicht tekent elk element als schets, uit zijn recept in
`styleguide/sketches.js`; een nieuw element krijgt daar een regel.
`styleguide/shared.js` bevat dat contract, `page.js` tekent de twee soorten pagina's, `code.js` de
code onder een voorbeeld, `reference.js` de referentie en `usage.js` zoekt het element in de
voorbeeldapplicaties (`_shared/apps.js`). Een tag van
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
