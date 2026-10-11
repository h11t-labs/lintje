# Een eerste pagina

Lintje is een set standaard custom elements. Eén module registreert de tags; je pagina schrijft een
tag en zet de attributen ervan. Het maakt niet uit wat de pagina rendert: PHP, Python, een statisch
bestand of een JavaScript-applicatie.

De andere handleidingen: [laden](loading.md) · [thema's](theming.md) · [eigen iconen](icons.md) · [events](events.md) ·
[dashboards](dashboard.md). Elke tag, in zijn toestanden en met zijn properties, events en slots,
staat in de styleguide (`examples/styleguide/`).

## Wat je krijgt, en wat van jou blijft

Je krijgt de visuele laag: de shell om de pagina's, formulieren en hun invoer, tabellen, grafieken,
feedback, navigatie, media. Licht en donker en het responsieve gedrag tot 390 px zitten
in de elementen. In `lintje-shell` is de `name` van de applicatie
de ene `h1` van de pagina, en de paginatitel is een `lintje-page-header` in de `header`-slot (een
`h2`, met slots voor `breadcrumbs` erboven en `actions` ernaast); de titel van een tegel, notitie,
uitleg of uitklapper is een `h3`. Zonder `name` levert de pagina de `h1` zelf. Een dashboard staat in dezelfde shell, met het menu naast de pagina
([dashboards](dashboard.md)).

Al het andere lever jij:

- **Geen datalaag.** Wat een element tekent, komt uit zijn properties, als platte JSON.
- **Geen router.** De browser volgt een link. Een pagina met een router neemt dat over.
- **Geen URL schrijven.** De elementen raken `location` en `history` nooit aan.
- **Geen auth of sessie.** De naam van een gebruiker is data; "geen toegang" wordt getekend, niet afgedwongen.
- **Geen teksten.** Wat een lezer leest, is Nederlands en schrijf jij.

## Een pagina die een server rendert

Bouw de bundel (`npm install && npm run build:elements`) en serveer `dist-elements/`, en een
kopie van `dist-icons/` op `/icons/` (een andere plek: [laden](loading.md)). De pagina heeft één
stylesheet en één module nodig; al het andere is markup die je template schrijft:

```html
<!doctype html>
<html lang="nl" data-mode="light">
  <head>
    <meta charset="UTF-8" />
    <link rel="stylesheet" href="/static/lintje/fonts.css" /> <!-- with fonts/ beside it; optional -->
    <link rel="stylesheet" href="/static/lintje/tokens.css" />
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

**Rijke data is een JSON-script in het element.** Het gaat naar de property die zijn `data-prop`
noemt — `<script type="application/json" data-prop="options">` — en zonder die naar `data`.
Het wordt gelezen wanneer het element op de pagina verschijnt en daarna verwijderd; een server die een nieuwe
pagina stuurt, stuurt een nieuw element. Escape de JSON voor een scriptblok (`</` als `<\/`); het JSON-filter
van je template-engine doet dat.

**De invoer doet mee in een native formulier.** Een `lintje-button` met `type="submit"` verstuurt het,
Enter in een tekst- of getalveld ook (Ctrl+Enter in een textarea), en `type="reset"`, een
`disabled` veld en een `<fieldset disabled>` gedragen zich als bij native bedieningselementen. Een `required`
tekstveld, getalveld of textarea houdt het versturen tegen met de eigen melding van de browser. Wat elk
bedieningselement onder zijn `name` post:

| bedieningselement | post |
|---|---|
| tekst, textarea, select, combobox, radiogroep, segmented, tijd, teksteditor | `name=value` |
| getal | `name=3`, of `name=` als het leeg is |
| datum | `name=2026-10-04` (ISO) |
| checkbox, toggle | `name=on` als aangevinkt, niets als niet |
| multiselect, trefwoordveld | `name=a&name=c`, één keer per gekozen waarde |
| datumbereik | `name-from=2026-10-01&name-to=2026-10-04` (ISO) |
| bereik met twee grepen | `name=5&name=20`, de twee stapindexen; met één greep `name=15`, de stap |
| bestandsupload | `name=<id>` per voltooid bestand: de upload zelf loopt via zijn events |

Toon een geweigerde waarde door het veld te renderen met zijn `error`-attribuut.

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

`<lintje-form>` slaat ter plekke op en voegt toe wat een native formulier niet heeft: met `draft-key`
een concept dat herladen overleeft, een foutoverzicht, en een actiebalk die zegt wat er is opgeslagen.
[Events](events.md) toont hoe je zijn `lintje-submit` beantwoordt en somt op wat elk element vraagt en
wat het terug verwacht.

## Properties zetten vanuit script

- **Platte configuratie is een attribuut**: `variant`, `size`, `label`, `heading`.
- **Rijke data is een property**: `.data`, `.items`, `.options`, `.errors`. Als attribuut
  doet het niets.
- **Opnieuw zetten rendert alleen opnieuw bij een ander object.** Lit vergelijkt op identiteit, dus
  `shell.data.name = '…'` verandert niets: bouw elke keer een nieuw object. Dit is de meest
  voorkomende bug op een met de hand geschreven pagina.
- **De vormen zijn het contract**: `types/types.d.ts` in de build, of
  `import type { ShellData } from './dist-elements/lintje.js'` in TypeScript. Kopieer een vorm en
  hernoem nooit een veld.

Een *view* is een tag die één `data`-object neemt (`lintje-shell`, `lintje-data-table`,
`lintje-chart`, …); elke andere tag is een *onderdeel* met eigen attributen en properties.

## De complete voorbeelden

[`../../examples/`](../../examples/README.md) bevat applicaties gebouwd met script, elk een gewone
pagina met fictieve data.
