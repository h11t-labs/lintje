# Assets

Elk bestand dat de componenten naast code nodig hebben, op één plek.

| Map | Wat | Licentie |
|---|---|---|
| `icons/` | De eigen iconen van Lintje: wat de set van RVO (`@nl-rvo/assets`) mist of niet mag bepalen — de 24 generieke bedieningselementen die de componenten tekenen (afspelen, pauze, min, volledig scherm, de chevrons, de statustekens, …) en het favorietenpaar dat de voorbeelden noemen, gevuld, 24×24 — en zes emblemen. `npm run build:icons` (dat `npm install` draait) legt ze over de set van RVO in `../dist-icons/` (niet gecommit), de map waaruit een pagina ophaalt: **de iconnaam is daar de bestandsnaam** zonder `.svg`, uniek in de hele map, RVO's `<category>/<name>.svg` als `<category>-<name>.svg`, en een eigen bestand wint van dat van RVO met dezelfde naam. | de set van RVO: CC0 · de emblemen: hun organisatie |
| `geo/` | Kaartgeometrie: `world.json` en `netherlands.json` voor de SVG-kaart, `*.lonlat.json` voor Leaflet. Geschreven door `npm run build:geo`; bronnen, projectie en de variabelen voor een mirror staan in `scripts/build-geo.mjs`. De vereenvoudiging is zo fijn als het budget toelaat: `world.json` ten hoogste 150 kB, `netherlands.json` 25 kB; de gekozen toleranties en wat ze wegen staan in het script. | Natural Earth (publiek domein) · CBS/PDOK (CC0) |
| `logo/` | Het eigen logo van Lintje: het beeldmerk en het beeldmerk met het woordmerk, elk voor een licht en voor een donker oppervlak. | deze repository |

Een host die andere of eigen iconen wil, legt ze in zijn kopie van `dist-icons/` en wijst
`setIconSource` ernaar ([`../docs/guides/icons.md`](../docs/guides/icons.md)). Dat werkt voor elke
naam buiten het register: de iconen die de bundel inline meeneemt, zijn niet te vervangen.

De namen in `dist-icons/` dragen hun categorie als voorvoegsel: `gebouwen-` (86), `vervoersmiddelen-` (85),
`functioneel-` (84), `personen-` (76), `gebruiksvoorwerpen-` (72), `op-kantoor-` (67),
`embleem-` (6) en nog 29 categorieën.

`<lintje-icon>` tekent een icoon in gewone HTML; zijn attributen staan in de styleguide
(`examples/styleguide/`, element `icon`). De bundel bevat een paar dozijn iconen inline — de
bediening die een component zelf tekent — en haalt elke andere naam per bestand op, eenmaal per
naam. Een naam buiten dat register zonder bestand tekent niets, en het bedieningselement toont
zijn Nederlandse label.

## De emblemen

Vijf `embleem-*`-bestanden zijn het lint van Defensie en van de vier krijgsmachtdelen (`defensie`,
`landmacht`, `luchtmacht`, `marine`, `marechaussee`), één per thema. Welk embleem bij welk
thema hoort, kiest de host: hij zet `emblem` (of `logo`) in de data van de shell. De shell tekent het lint inline,
met zijn zwart omgezet in `currentColor` zodat het op het menu leesbaar is. **Teken nooit een Rijkshuisstijl-embleem
na**: een lege plek is beter dan een gok.

`embleem-rijksoverheid.svg` is het headerlogo van rijksoverheid.nl, het lint alleen op
`viewBox="0 0 50 100"`, opgeslagen zoals gepubliceerd.

## Het logo

Het beeldmerk is het lint van de Rijksoverheid in lintblauw, hangend vanaf de bovenrand en één keer
gevouwen tot de L van Lintje; het woordmerk *lintje* staat ernaast. Het draagt geen embleem en geen naam van een organisatie: het is het lint, geen
Rijkslogo.

| Bestand | Wat | Oppervlak |
|---|---|---|
| `logo/lintje.svg` | het beeldmerk | licht |
| `logo/lintje-wordmark.svg` | het beeldmerk en het woordmerk | licht |
| `logo/lintje-diap.svg` | het beeldmerk in wit | donker, of de kleur van het menu |
| `logo/lintje-wordmark-dark.svg` | het beeldmerk en het woordmerk in wit | donker, of de kleur van het menu |

Lintblauw heeft te weinig contrast met een donker oppervlak of met het menu van een thema, dus die nemen het `-diap`-bestand.
Een pagina die het kleurenschema van de lezer volgt, noemt ze allebei:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo/lintje-wordmark-dark.svg" />
  <img src="assets/logo/lintje-wordmark.svg" alt="Lintje" height="80" />
</picture>
```
