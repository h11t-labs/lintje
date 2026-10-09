---
name: lintje
description: Lintje gebruiken in een eigen applicatie — een pagina, formulier, tabel of dashboard bouwen met `lintje-*`-tags, een tag kiezen, zijn data zetten of op zijn events reageren. Leest de tag-referentie uit `custom-elements.json`.
---

# Lintje in een eigen applicatie

Lintje is de Rijkshuisstijl als custom elements. De applicatie **stelt samen**: ze zet tags op de
pagina, geeft ze data en reageert op hun events. Het uiterlijk, licht en donker, de thema's en het
responsieve gedrag zitten in de elementen.

## 1. Vind de build

Zoek de map met `lintje.js` en `custom-elements.json` naast elkaar:

```bash
find . -name custom-elements.json -not -path '*/.git/*' | xargs -n1 dirname
```

Vindt dat niets, dan is het de map waaruit de `<script src>` van de pagina `lintje.js` of
`core.js` laadt. Die map is de **naslag** voor de rest van deze skill. Ernaast staan `lintje.d.ts`, `core.d.ts`, de
categorieën (`frame.d.ts`, `forms.d.ts`, …) en `tag/<naam>.d.ts`, en in `types/types.d.ts` alle datavormen
(`ShellData`, `DataTableData`, `FilterDefinition`, …). Klaar als je het pad hebt.

## 2. Kies de tags

Zoek in de lijst een tag die doet wat de pagina nodig heeft, voordat je zelf iets bouwt:

```bash
node <deze skill>/reference.mjs <naslag>/custom-elements.json
node <deze skill>/reference.mjs <naslag>/custom-elements.json lintje-data-table
```

De eerste geeft elke tag met zijn eerste regel, de tweede één tag:

- **De beschrijving** is wat een host over de tag moet weten: wat hij tekent, zijn slots en events.
- **Attributes** zet je in HTML: platte configuratie (`variant`, `label`, `heading`).
- **Properties** zet je vanuit script: rijke data (`.data`, `.items`, `.options`). Het type
  noemt de vorm in `types/types.d.ts`.
- **Events** zijn wat de tag vraagt; de vorm van `detail` is daar een schets.

Lees `custom-elements.json` via het script; het `path` erin wijst naar broncode die de applicatie
niet heeft.

## 3. Schrijf de pagina

- **Laad één keer, uit één build**: `lintje.js` voor alles, of `core.js` met de categorieën en
  `tag/<naam>.js` die de pagina gebruikt, nooit beide. Link `tokens.css` (en `fonts.css`) in
  `<head>`. Laad `dev.js` tijdens het ontwikkelen: de console noemt dan een vergeten tag.
- **Wijs de iconenmap aan** voordat het eerste element tekent:
  `setIconSource({ base: '/icons/' })`. Een icoon is zijn bestandsnaam zonder `.svg`.
- **Zet rijke data als nieuw object.** Lit vergelijkt op identiteit: bouw bij elke wijziging een
  nieuw object (`shell.data = { ...shell.data, name }`). Een server-gerenderde pagina zet hem als
  `<script type="application/json">` in het element (met `data-prop="options"` voor een andere
  property dan `data`).
- **Beantwoord events met data.** Een element haalt nooit op en schrijft nooit de URL: het stuurt
  een `lintje-*`-event (bubbling, composed) en wacht tot de applicatie een property zet. Een link
  is een echte `<a href>`; een applicatie met een router annuleert `lintje-navigate`.
- **Bewaar wat de cijfers verandert in de URL** — filters, sortering, pagina, modus — en zet het
  terug als data.
- **Stijl eigen inhoud met de tokens**: `var(--color-*)`, `var(--space-1)` … `var(--space-10)`,
  `var(--text-*)`. Een element zelf krijgt geen eigen CSS; een variant is een attribuut.
- **Schrijf Nederlands**: elke tekst die een lezer ziet, en `lang="nl"` op `<html>`. Thema en modus
  zijn `data-theme` en `data-mode` op `<html>`.
- **Toon ontbrekende cijfers als `null`**, nooit als `0`. Een grafiek krijgt zijn `description`,
  een tabel zijn `caption`: ze worden de tekst voor een schermlezer.

In TypeScript geven de `.d.ts`-bestanden de vormen en de tags
(`document.querySelector('lintje-shell')` is een `LintjeShell`). Importeer een vorm met
`import type { ShellData } from '<naslag>/lintje.js'`; met `lit` 3 als devDependency zijn ook de
geërfde leden van een element getypeerd.

## 4. Controleer

De pagina is klaar als:

- de typecheck slaagt en de console met `dev.js` stil is;
- elk zichtbaar onderdeel een `lintje-*`-tag is of eigen inhoud die alleen tokens noemt;
- hij werkt in licht en donker, en op 390, 768 en 1024 px breed;
- een herladen of gedeelde URL dezelfde weergave toont.

## Verder

De handleidingen staan in `<naslag>/guides/`: `start.md` (een eerste pagina en wat een formulier
post), `loading.md` (laden en iconen), `events.md` (elk event en zijn
antwoord), `theming.md` (thema, modus, embleem), `dashboard.md` (filters en de URL),
`icons.md` (eigen iconen). Lees de handleiding van het onderwerp voordat je eraan begint. De
styleguide (`https://h11t-labs.github.io/lintje/examples/styleguide/`) toont elke tag in zijn
toestanden.
