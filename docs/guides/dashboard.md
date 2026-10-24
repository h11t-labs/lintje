# Een dashboard

Een pagina met cijfers die filters versmallen, in `lintje-shell`: `lintje-page-header`,
`lintje-filter-bar`, en daaronder kerncijfers, grafieken, een kaart en tabellen. De regels erachter staan in
[`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md), "Pagina's met cijfers".
[`../../examples/dashboard/`](../../examples/dashboard/index.html) is de complete pagina.

## De URL is de toestand

**Een link delen deelt de weergave.** Alles wat de cijfers verandert, en de instellingen van de lezer,
horen in de query van de URL: de toestand van je pagina, die jij bewaart. De elementen lezen geen
URL: ze krijgen de toestand in hun `data` en sturen een wijziging als event ([events](events.md);
`lintje-view-change` draagt de ene sleutel uit de tabel hieronder die veranderde).

Schrijf de wijziging in de query en zet daarna `data` opnieuw op basis daarvan. Een standaardwaarde wordt nooit geschreven, dus
een link die zonder `?mode=` gedeeld wordt, volgt het systeem van de lezer en niet dat van de afzender.
[`../../examples/_shared/settings.js`](../../examples/_shared/settings.js) is één manier om het te doen:

| sleutel | waarden | afwezig betekent |
|---|---|---|
| `mode` | `light` · `dark` | systeem: de `prefers-color-scheme` van de lezer |
| `menu` | `unpinned` | vastgezet |
| `layout` | `top` | het menu naast de pagina |
| `theme` | een thema | `rijksoverheid` |
| `style` | `classic` · `new` | de huisstijl die je pagina kiest ([thema's](theming.md#de-huisstijl-oud-en-nieuw)) |
| `corner` | `square` | de grote hoek van de nieuwe huisstijl, rond |
| `filters` | of de filterbalk openstaat (`data.open`) | ingeklapt |

De sleutel van een filter is degene die je declareert. Spiegel modus en thema naar `data-mode` en
`data-theme` op `<html>`, en de huisstijl naar `data-style-version` en `data-style-new-corner`,
want de elementen lezen ze daar: `applySettings` in de
[minimale pagina](#een-minimale-dashboardpagina) doet het voor modus en thema.

## Filters

Jij declareert de filters (`FilterDefinition` in `src/types.ts`) en `lintje-filter-bar` tekent
ze, met de "Je ziet"-zin opgebouwd uit hun waarden. `lintje-values-change` draagt
`{ key: value, … }` wanneer filters vastleggen: zet elke waarde in zijn filter, teken opnieuw en bewaar haar
in de URL. `lintje-filters-open-change` meldt dat de lezer de balk in- of uitklapte: bewaar het en zet
het terug als `data.open`.

Zet **één** filterbalk op een pagina: twee zouden allebei eigenaar zijn van het aantal filters, de paginanaam en de
filters onder 768 px.

## De shell draagt de pagina

`lintje-shell` met `layout: 'side'` zet het menu naast de pagina: vastgezet vanaf 1440 px, een smalle strook
daaronder, een kop met "Menu" onder 768 px. Boven de pagina staat een balk met de naam van het dashboard,
"Weergave" en "Delen". Met `layout: 'top'` is het de kop boven de pagina — de logobalk,
en de navigatiebalk met de naam, de items en dezelfde hulpmiddelen. De shell deelt de
ruimte in; je pagina zet zelf geen `padding`.

"Delen" (`share: true`) biedt "Open op mijn telefoon": een QR-code van de huidige link, gemaakt door
de shell. Waar telefoons links openen in een beheerde browser, zet `qrScheme` de link in het
schema van die browser (`mibrowsers` voor Ivanti Web@Work), terwijl kopiëren en e-mail `https` houden.

Zet de inhoud in de shell. De filterbalk gaat in de `full`-slot, die van rand tot rand loopt
boven de inhoud; al het andere in de standaardslot, die zich houdt aan de breedte en
binnenruimte van de pagina (`--w-content`; een andere breedte is `--lintje-content-width` op `<html>`). De
filterbalk zet zichzelf vast onder de balk. Een dashboard is breder dan een leespagina: zet de
inhoud op 1600 px, zodat tegels en tabellen naast elkaar passen.

```css
:root {
  --lintje-content-width: 1600px;
}
```

```html
<lintje-shell id="shell">
  <lintje-filter-bar id="filters" slot="full"></lintje-filter-bar>
  <lintje-page-header id="page-header"></lintje-page-header>
  <lintje-kpi-row id="kpis"></lintje-kpi-row>
</lintje-shell>
```

Alles van jezelf wat je onder de balk vastzet, gebruikt `top: var(--h-topbar)`, in beide indelingen.
Iets wat je vastzet aan het
venster begint bij `left: var(--lintje-shell-left)`, de breedte van het menu, binnen de shell.

De link "Naar de inhoud", de eerste tabstop in beide indelingen, brengt de focus naar de `<main>` van de shell.

**Een pagina die een gesprek is** zet één `lintje-chat` in de `full`-slot en verder niets:
de chat houdt een eigen regelbreedte aan, en de lijn boven zijn vraagvak loopt over de hele ruimte
zoals een balk dat doet. Met niets in de standaardslot neemt de chat de ruimte die de shell overlaat, zodat een
kort gesprek zijn vraagvak toch onderaan het venster heeft. In een eigen vak scrollt
de chat in plaats daarvan met dat vak mee: geef het vak een hoogte, `overflow-y: auto` en
`display: grid`.

**Koppen** gaan zoals in [een eerste pagina](start.md); de `name` van de shell is hier de naam van het
dashboard. In de standaardslot is de paginakop een band; in de `header`-slot is hij de titelrij van een
applicatie.

## Doorklikken en selectie

`lintje-row-click` en `lintje-mark-select` komen van de tabel en van de grafiek- en
kaarttegels. Heeft de rij of markering een `href`, dan gaat het element erheen, tenzij je het event
annuleert; dan zet je `data.selectedId` zelf. Een selectie ongedaan maken is hetzelfde event met de
id null, en gaat zo naar de `href` die je als `clearHref` gaf.
`lintje-sort-change` zet `data.sort`, `lintje-checked-change` `data.checkedIds`,
`lintje-layer-change` de `data.layer` van de kaart.

De tabel rekent niets uit. Een totaalrij geef je zelf mee als `totals`, per kolom een waarde of
`{ value, how }`, waarbij `how` het woordje is dat zegt hoe ("gem."); met `groupBy` op een kolom
staan de rijen per waarde onder een kop, en `groupTotals` geeft per groep haar subtotalen. Een
kolom met `format: 'label'` tekent een waarde als label: in `labels` noem je per waarde het woord,
de toon van `lintje-badge` en eventueel een icoon. Wat de kolommen niet tonen, zet je in
`detailFields`: elke rij krijgt dan een knop die de verborgen kolommen en die velden onder de rij
toont. Open rijen en ingeklapte groepen zijn beeld, geen toestand: ze komen niet in de URL.

`ChartData.description` en `DataTableData.caption` zijn verplicht: ze worden de `<desc>` van de grafiek
en de `<caption>` van de tabel. Schrijf ze alsof de figuur er niet was.

## Een minimale dashboardpagina

```html
<!doctype html>
<html lang="nl" data-mode="light" data-theme="rijksoverheid">
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="./dist-elements/fonts.css" /> <!-- with fonts/ beside it -->
  <link rel="stylesheet" href="./dist-elements/tokens.css" />
  <!-- the body block of theming.md -->
  <style>body { margin: 0; background: var(--color-bg-page); color: var(--color-text-primary); font: var(--text-ui); }</style>
  <lintje-shell id="shell">
    <lintje-kpi-row id="kpis"></lintje-kpi-row>
  </lintje-shell>
  <script type="module">
    import { setIconSource } from './dist-elements/lintje.js'
    setIconSource({ base: './icons/' })
    const shell = document.getElementById('shell')
    function applySettings(search) {
      const params = new URLSearchParams(search)
      const setting = params.get('mode') // absent → system
      const dark =
        setting === 'dark' ||
        (setting !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.dataset.mode = dark ? 'dark' : 'light'
      document.documentElement.dataset.theme = params.get('theme') ?? 'rijksoverheid'
    }
    function render() {
      const params = new URLSearchParams(location.search)
      shell.data = {
        // a new object every time
        name: 'Dashboard Vergunningen',
        layout: 'side',
        navigation: [{ label: 'Overzicht', icon: 'functioneel-home', href: './', active: true }],
        view: { mode: params.get('mode') ?? 'system' },
        menu: params.get('menu') === 'unpinned' ? 'unpinned' : 'pinned',
        user: { initials: 'JV', name: 'J. Vermeer', role: 'Analist' },
      }
      applySettings(location.search)
    }
    shell.addEventListener('lintje-view-change', (event) => {
      const params = new URLSearchParams(location.search)
      const { mode, menu } = event.detail
      if (mode) mode === 'system' ? params.delete('mode') : params.set('mode', mode)
      if (menu) menu === 'unpinned' ? params.set('menu', menu) : params.delete('menu')
      const query = params.toString()
      history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}`)
      render()
    })
    render()
    document.getElementById('kpis').data = {
      kpis: [{ label: 'Aanvragen', value: '148.230', variable: 'sky-blue' }],
    }
  </script>
</html>
```
