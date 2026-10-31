# Een eerste pagina

Lintje is een set standaard webcomponenten (custom elements). Eén module registreert de tags; je
pagina schrijft een tag en zet de attributen ervan. Het maakt niet uit hoe de pagina gemaakt wordt:
met PHP, Python, als statisch bestand of als JavaScript-applicatie.

De andere handleidingen: [laden](loading.md) · [thema's](theming.md) · [eigen iconen](icons.md) · [events](events.md) ·
[dashboards](dashboard.md). Elke tag, in zijn toestanden en met zijn eigenschappen, events en
slots (de plekken voor eigen inhoud), staat in de stijlgids (`examples/styleguide/`).

## Wat je krijgt, en wat van jou blijft

Je krijgt de visuele laag: de shell om de pagina's, formulieren en hun invoer, tabellen, grafieken,
meldingen, navigatie, media. Licht en donker en het responsieve gedrag tot 390 px zitten
in de elementen. In `lintje-shell` is de `name` van de applicatie
de ene `h1` van de pagina, en de paginatitel is een `lintje-page-header` in de `header`-slot (een
`h2`, met slots voor `breadcrumbs` erboven en `actions` ernaast); de titel van een tegel, notitie,
uitleg of uitklapper is een `h3`. Zonder `name` levert de pagina de `h1` zelf. Een dashboard staat in dezelfde shell, met het menu naast de pagina
([dashboards](dashboard.md)).

Wisselt een lezer op een telefoon steeds tussen drie tot vijf pagina's, zet dan `mobile-tabs` op
`lintje-shell`: onder 768 px staan de losse pagina's van `navigation` als tabs onderaan, met Menu
als laatste. Met `tab-parts` stuur je ook Zoeken, Meldingen of jouw menu naar de tabs (`tab-parts="notifications user menu"`); wat een tab is, staat niet ook in de balk bovenaan. Een pagina dieper krijgt `back` in de data van de shell. Een ingang die geen pagina
opent maar een blad van jou, krijgt `action` in plaats van `href`; de shell stuurt dan
`lintje-action` met die naam. Wat onderaan plakt, staat boven de tabs met
`bottom: var(--lintje-shell-bottom, 0px)`; een blad van jou dat uit een tab komt, stopt daar ook
en is ten hoogste `var(--h-sheet)` hoog, zoals de bladen van Lintje.

Al het andere lever jij:

- **Geen datalaag.** Wat een element tekent, komt uit zijn eigenschappen, als platte JSON.
- **Geen router.** De browser volgt een link. Een pagina met een router neemt dat over.
- **Geen URL schrijven.** De elementen raken `location` en `history` nooit aan.
- **Geen aanmelden of sessie.** De naam van een gebruiker is data; "geen toegang" wordt getekend, niet afgedwongen.
- **Geen teksten.** Wat een lezer leest, is Nederlands en schrijf jij.

## Een pagina die de server opbouwt

Bouw de bundel (`npm install && npm run build:elements`) en serveer `dist-elements/`, en een
kopie van `dist-icons/` op `/icons/` (een andere plek: [laden](loading.md)). De pagina heeft één
stylesheet en één module nodig; al het andere is HTML uit je eigen sjablonen:

```html
<!doctype html>
<html lang="nl" data-mode="light"> <!-- data-style-version="new" draws the new house style; see theming.md -->
  <head>
    <meta charset="UTF-8" />
    <link rel="stylesheet" href="/static/lintje/fonts.css" /> <!-- with fonts/ beside it; optional -->
    <link rel="stylesheet" href="/static/lintje/tokens.css" />
    <link rel="icon" type="image/svg+xml" href="/static/lintje/favicon-lint.svg" /> <!-- assets/logo/favicon-lint.svg: the ribbon alone, as the house style's favicon -->
    <script type="module" src="/static/lintje/lintje.js"></script>
    <!-- the body block of theming.md -->
    <style>body { margin: 0; background: var(--color-bg-page); color: var(--color-text-primary); font: var(--text-ui); }</style>
  </head>
  <body>
    <lintje-shell>
      <script type="application/json">
        {
          "name": "Meldingen",
          "navigation": [
            { "label": "Nieuwe melding", "href": "/nieuw", "active": true },
            { "label": "Overzicht", "href": "/overzicht" }
          ]
        }
      </script>
      <lintje-page-header slot="header">
        <script type="application/json">{ "title": "Nieuwe melding" }</script>
      </lintje-page-header>

      <form method="post" action="/meldingen">
        <input type="hidden" name="csrf_token" value="…" />
        <lintje-text-input name="naam" label="Naam" value="…" error="…"></lintje-text-input>
        <lintje-textarea name="omschrijving" label="Omschrijving"></lintje-textarea>
        <lintje-checkbox name="spoed" label="Spoed"></lintje-checkbox>
        <lintje-button type="submit" variant="primary">Versturen</lintje-button>
      </form>
    </lintje-shell>
  </body>
</html>
```

Drie dingen laten dit werken zonder eigen script.

**Links zijn links.** De navigatie tekent echte `<a href>`-elementen en de browser volgt
ze.

**Rijke data is een JSON-script in het element.** Het gaat naar de eigenschap die zijn `data-prop`
noemt — `<script type="application/json" data-prop="options">` — en zonder die naar `data`.
Het wordt gelezen wanneer het element op de pagina verschijnt en daarna verwijderd; een server die een nieuwe
pagina stuurt, stuurt een nieuw element. Schrijf `</` in de JSON als `<\/`, zodat het scriptblok niet te vroeg sluit;
het JSON-filter van je sjabloontaal doet dat.

**De invoer doet mee in een gewoon HTML-formulier.** Een `lintje-button` met `type="submit"` verstuurt het,
Enter in een tekst- of getalveld ook (Ctrl+Enter in een tekstvak), en `type="reset"`, een
`disabled` veld en een `<fieldset disabled>` gedragen zich als bij de bedieningselementen van de browser. Elke
invoer met `required` houdt het versturen tegen met de eigen melding van de browser zolang hij leeg is:
hij post dan niets, of een van zijn waarden is leeg. De verzendknop post zijn eigen `name` en `value`
niet: wil de server weten met welke knop er verstuurd is, zet dat dan in een veld. Wat elk
bedieningselement onder zijn `name` post:

| bedieningselement | post |
|---|---|
| tekst, tekstvak, keuzelijst, combobox, keuzerondjes, segmentknop, tijd, teksteditor | `name=value` |
| getal | `name=3`, of `name=` als het leeg is |
| datum | `name=2026-10-04` (ISO) |
| selectievakje, schakelaar | `name=on` als aangevinkt, niets als niet |
| meerkeuzelijst, trefwoordveld | `name=a&name=c`, één keer per gekozen waarde |
| datumbereik | `name-from=2026-10-01&name-to=2026-10-04` (ISO) |
| bereik met twee grepen | `name=5&name=20`, de twee stapindexen; met één greep `name=15`, de stap |
| bestandsupload | `name=<id>` per voltooid bestand: de upload zelf loopt via zijn events |

Toon een geweigerde waarde door het veld met zijn `error`-attribuut in de pagina te zetten. Een `error` houdt het
versturen niet tegen: het is het antwoord van de server op een eerdere verzending.

## Een pagina met script

Script is voor wat een pagina doet zonder weg te gaan: een event beantwoorden met nieuwe data.

```html
<lintje-form id="form">
  <lintje-text-input name="naam" label="Naam"></lintje-text-input>
  <lintje-textarea name="omschrijving" label="Omschrijving"></lintje-textarea>
  <lintje-form-actions>
    <lintje-button variant="primary" type="submit">Versturen</lintje-button>
  </lintje-form-actions>
</lintje-form>
```

`<lintje-form>` slaat ter plekke op en voegt toe wat een gewoon formulier niet heeft: met `draft-key`
een concept dat herladen overleeft, een foutoverzicht, en een actiebalk die zegt wat er is opgeslagen.
[Events](events.md) toont hoe je zijn `lintje-submit` beantwoordt en somt op wat elk element vraagt en
wat het terug verwacht.

## Eigenschappen zetten vanuit script

- **Platte configuratie is een attribuut**: `variant`, `size`, `label`, `heading`.
- **Rijke data is een eigenschap**: `.data`, `.items`, `.options`, `.errors`. Als attribuut
  doet het niets.
- **Opnieuw zetten tekent alleen opnieuw bij een ander object.** Lit vergelijkt op identiteit, dus
  `shell.data.name = '…'` verandert niets: bouw elke keer een nieuw object. Dit is de meest
  voorkomende fout op een met de hand geschreven pagina.
- **De vormen zijn het contract**: `types/types.d.ts` in de gebouwde bestanden, of
  `import type { ShellData } from './dist-elements/lintje.js'` in TypeScript. Kopieer een vorm en
  hernoem nooit een veld.

Een *view* is een tag die één `data`-object neemt (`lintje-shell`, `lintje-data-table`,
`lintje-chart`, …); elke andere tag is een *onderdeel* met eigen attributen en eigenschappen.

## De indeling van een pagina

`<lintje-grid>` verdeelt de inhoud in 12 kolommen. Zijn kinderen zijn de items: een tegel en een
veld dragen `span` zelf, andere inhoud zet je in een `<lintje-grid-item>`. `span` is het aantal
kolommen op een desktop; zonder `span` neemt een item er één.

```html
<lintje-grid>
  <lintje-tile span="8" heading="Aanvragen per week">…</lintje-tile>
  <lintje-tile span="4" heading="Afgehandeld">…</lintje-tile>
  <lintje-text-input span="4" span-mobile="2" label="Postcode"></lintje-text-input>
  <lintje-text-input span="4" span-mobile="2" label="Huisnummer"></lintje-text-input>
  <lintje-grid-item span="4"><p>Toelichting bij het adres.</p></lintje-grid-item>
</lintje-grid>
```

| breedte | kolommen | wat een item neemt |
|---|---|---|
| desktop, vanaf 1024 px | 12 | zijn `span` |
| tablet, 768 tot 1023 px | 12 | zijn `span`, behalve `span="4"`, dat 6 wordt, en `span="8"`, dat 12 wordt |
| telefoon, onder 768 px, oude huisstijl | 1 | de hele breedte |
| telefoon, onder 768 px, nieuwe huisstijl | 4 | alle vier, of zoveel als `span-mobile` zegt (1 tot 4) |

`columns` op het grid kiest een ander aantal kolommen op een desktop, en `variant="kpi-row"`
zet kerncijfers op een tablet drie en op een telefoon twee naast elkaar. De breedte van de
inhoud en de marges eromheen komen uit de huisstijl ([thema's](theming.md#de-huisstijl-oud-en-nieuw));
een andere breedte zet je met `--lintje-content-width` op de pagina.

**Wat op een telefoon minder telt, zet je achteraan of klap je in; weglaten is het laatste.**
Wie een telefoon gebruikt, of op een desktop tot 400 % inzoomt, krijgt deze weergave, en heeft
recht op dezelfde inhoud (WCAG 1.4.10). Kies daarom van boven naar beneden:

1. **Achteraan**: `order-mobile` op een item zet het op een telefoon verder naar achteren (`1`)
   of naar voren (`-1`); zonder het attribuut is het 0. Alleen de tekening schuift: de volgorde
   waarin een schermlezer en de Tab-toets gaan, blijft die van de markup. Verplaats dus een
   heel blok, zoals een kaart naar het eind, en nooit één veld tussen andere.
2. **Ingeklapt**: `collapsed-mobile` op `lintje-tile` (en `collapsedMobile` in de `data` van een
   grafiek, kaart, tabel, graaf of logboek) toont op een telefoon alleen de kop met een knop
   Tonen; de inhoud staat één tik verder.
3. **Van vorm gewisseld**: dat doet een element zelf. Het menu wordt een balk bovenaan, waaruit
   Menu, Meldingen, jouw menu, Weergave, Delen en Zoeken als blad van onderen openen, net als de
   filters; een tabel toont per rij de identiteit en één
   meetwaarde, het kruimelpad alleen de weg terug, en de afbeelding naast een hero valt onder
   1024 px weg.
4. **Weggelaten**: `hide-mobile` laat een item op een telefoon weg, `hide-desktop` vanaf 768 px.
   Gebruik het alleen voor wat de pagina ook op een andere manier zegt, zoals een kaart waarvan
   de cijfers in een tabel staan. Op papier telt de desktopweergave: wat `hide-desktop` draagt,
   wordt niet afgedrukt. Een verborgen veld in een formulier wordt nog steeds verstuurd.

Op een gewoon element in het grid, zonder eigen Lintje-tag, werkt `order-mobile` van `-3` tot `3`;
zet het in een `<lintje-grid-item>` voor meer.

## Afdrukken

Een pagina drukt af zonder dat je er iets voor doet: licht, zonder bediening, met het embleem en de naam
van de applicatie bovenaan, en elke tegel heel op een vel waar hij past. Wat je pagina zelf schrijft,
houdt zich aan dezelfde regels:

- **De achtergrond van `body` is `var(--color-bg-page)`**: die is wit op papier.
- **Een telefoonregel in de eigen CSS is `@media screen and (max-width: 767px)`**: een staand vel
  is smaller dan 768 px, maar krijgt geen telefoonvorm.
- **Een eigen `<lintje-tile>` met een lange lijst krijgt `breakable`**: dan breekt hij tussen twee
  vellen in plaats van als geheel naar het volgende te gaan.

## De complete voorbeelden

[`../../examples/`](../../examples/README.md) bevat applicaties gebouwd met script, elk een gewone
pagina met fictieve data.
