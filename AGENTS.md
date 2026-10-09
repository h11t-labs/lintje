# Projectregels — Lintje

Lintje is het design system van de Rijkshuisstijl als web components (Lit), voor applicaties en
websites — een dashboard is er één van. [`DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) bevat de
uitgangspunten en besluiten van het ontwerp — lees het eerst. [`CONTRIBUTING.md`](CONTRIBUTING.md)
is het recept voor een component, [`docs/guides/`](docs/guides/start.md) zijn de handleidingen
voor een host, en `examples/styleguide/` toont elk element in zijn toestanden met zijn referentie,
die de build uit de broncode leest. Code en docs citeren de regelnummers hieronder; ze veranderen
niet.

## De harde regels

1. **`DESIGN_SYSTEM.md` bevat de principes en besluiten; de code bevat de waarden.** Een maat,
   kleur of duur staat in de tokens en in de eigen bestanden van het component, nooit in dat
   document. Een besluit dat voor meer dan één element geldt, komt daar te staan, in dezelfde
   commit. Ontwerp niets opnieuw — ook niet "net iets netter".
2. **Hergebruik vóór je bouwt.** Zoek eerst in `src/primitives/` en `src/components/`. Een tweede
   component met dezelfde betekenis is een fout.
3. **Nooit een kleur hardcoden.** Een component noemt een semantisch of componenttoken
   (`var(--color-*)`), nooit een literal en nooit een primitief (`--neutral-*`, `--data-*`,
   `--status-*`, `--ink-*`, `--primary`): alleen `tokens.css` en `themes.css` noemen die.
4. **Nooit willekeurige ruimte.** De 4 px-schaal (`--space-1` … `--space-10`) en de vaste
   componenthoogtes. Geen `padding: 13px`.
5. **Geen nieuwe visuele patronen in hostcode.** Een pagina die er anders uitziet dan de rest, is
   fout.
6. **Nieuwe generieke patronen horen in het design system**, met tokens, met toestanden, en
   getoond in de styleguide.
7. **Een host stelt samen.** Hij zet `data` op een tag en luistert naar zijn events.
   Domeinlogica hoort niet in een primitive.
8. **Beide modi en alle zes thema's blijven werken.** Test licht *en* donker. Donker herdefinieert
   de zeven `--neutral-*` en wijst opnieuw aan wat van betekenis verandert — nooit een losse
   donkere kleur. Een thema zet alleen `--primary` en `--accent`, in `tokens/themes.css`, dat op
   documentniveau blijft en nooit in een shadow root wordt geadopteerd. In donker neemt een lijn
   `--color-accent-line` (3:1) en tekst `--color-accent-text` / `--color-link` (4.5:1); teken
   nooit een woord in `--color-accent-line`.
9. **Responsief gedrag blijft intact**: desktop, 1024, 768 en 390 px. Onder 768 px wisselen de
   navigatie, filters, KPI-rij, tabel en heatmap van weergave — niet alleen stapelen.
10. **Alleen de vaste grafiekgrammatica**: één kleur per variabele met de tintladder, grijs voor
    vergelijking, nadruk voor trend/drempel/doel, legenda boven, datalabels 12 px, nullijn
    donkerder. Een variabele heet naar de Rijkshuisstijlkleur die hij is (`sky-blue`,
    `dark-yellow`, `red`, `green`, `mint-green`, `violet`, `orange`, `pink`, `dark-green`,
    `purple`, `ruby-red`, `yellow`, `dark-brown`, `brown`, `dark-blue`, `light-blue`,
    `moss-green`), nooit naar een letter. De namen staan één keer in `src/tokens/colors.ts`, in
    een vaste volgorde waar een kleur alleen achteraan bij komt; een nieuwe kleur komt daar en in
    `tokens.css`, met haar tintladder. Datakleur is gelijk in licht, donker en elk thema, behalve
    `--data-comparison`, `--data-other` en `--color-chart-dark-yellow-text`. Geen
    grafiekbibliotheek.
11. **Iconen zijn bestanden, genoemd naar de bestandsnaam** (`functioneel-delta-omlaag`): de set
    van RVO (`@nl-rvo/assets`), met die van Lintje zelf in `assets/icons/` eroverheen — de
    emblemen en de generieke bedieningselementen die RVO mist; `npm run build:icons` stelt beide
    samen in `dist-icons/`. Teken nooit zelf, bewerk nooit een bestand —
    `src/icons/normalise.mjs` maakt het tekenbaar; de andere richting is `rotate`/`flip`. Gebruik
    in een component `renderIcon(name)`; `<lintje-icon>` is voor gewone HTML. Een naam zonder
    bestand tekent niets en het bedieningselement toont zijn Nederlandse label. Een icoon dat een
    component *zelf* tekent, komt in `COMPONENT_ICONS` (`scripts/build-icons.mjs`) +
    `npm run build:icons` — houd die lijst kort; elke andere naam wordt per bestand opgehaald.
12. **Geen afgeronde SaaS-kaarten.** `--radius` is 0. Geen verlopen, geen glassmorphism, geen
    zwevende widgets, geen schaduwen buiten de gedefinieerde.
13. **Kleur is nooit de enige drager van betekenis.** Voeg een glyph, getal of tekst toe.
14. **Filterstatus blijft deelbaar.** Alles wat de cijfers verandert, is de status van de host,
    bewaard in de URL: een element krijgt hem als `data` en stuurt een wijziging als event, en
    houdt hem nooit zelf vast.
15. **Ontbrekende data toont nooit als nul.** Gebruik `null`, arceer de periode of breek de reeks
    af op het peilmoment.
16. **De zin "Je ziet" blijft gelijk met de filters.** `lintje-filter-bar` bouwt hem uit de
    gedeclareerde filters; een nieuw soort filter voegt toe hoe zijn waarde daarin leest
    (`components/filters/shared/sentence.ts`).

## De laaggrens

`bundle` → `components` + `primitives` (met `core/`, `tokens/`, `icons/` eronder). Nooit andersom.

17. **Het design system kent geen domein.** Niets onder `src/` behalve `bundle/` importeert uit
    `bundle/` of uit een host.
18. **Een component kent geen data.** Organisatie, menu, gebruiker, titel en peilmoment komen
    binnen via de `data` van de view (`src/types.ts`). Het haalt nooit zelf op.
19. **Imports zijn altijd relatief.** Geen `@/`-alias, geen path mapping.
20. **Elke tag hoort bij één categorie.** `src/categories.json` is de enige indeling: een
    categorie is een map onder `components/`, een pagina van de stijlgids, een ingang van de
    build en een export van het pakket. Een nieuwe tag krijgt een map naar zijn naam, zonder het
    voorvoegsel, in zijn categorie (`components/charts/note/` voor `<lintje-note>`, met `note.ts`
    — de klasse `LintjeNote` —, `note.css` en zijn test; een primitive staat in `primitives/`; een
    deel dat alleen binnen een ander element bestaat, mag in diens map; wat een categorie deelt,
    staat in haar `shared/`, wat categorieën delen in `components/shared/`), **komt in
    `categories.json`, in `bundle/<category>.ts` en in de barrel** (`components/index.ts` of
    `primitives/index.ts`). Een nieuwe *view* komt daarnaast in `LINTJE_VIEWS` (`bundle/index.ts`)
    en in `src/types.ts`. De tag-referentie wordt gegenereerd (`scripts/manifest.mjs`): wat een
    host over een tag leest, is zijn kopcommentaar, de JSDoc bij zijn properties en zijn
    `emit()`-aanroepen. Zijn bestand in de build (`tag/<name>.js`) volgt uit zijn
    `define()`-aanroep. Een tag importeert de tags die hij tekent via hun pad, nooit via een barrel.
21. **Filters zijn data.** Een host declareert zijn filters (`FilterDefinition` in
    `src/types.ts`) en `lintje-filter-bar` tekent ze met de zone, de sheet en de
    bedieningselementen in `components/filters/` en `components/inputs/`. De bibliotheek heeft
    geen eigen filter: een filter dat een domein noemt, is een fout.
22. **`src/bundle/` is het ingangspunt, geen bibliotheeklaag.** `bundle/index.ts` is de module die
    een pagina laadt (`npm run build:elements` → `dist-elements/`, niet gecommit). Ernaast staan
    de ingangen voor een pagina die minder laadt: `core.ts` (de host-API), één bestand per
    categorie en `dev.ts`. Niets eronder importeert het. `src/types.ts` is het contract met elke
    host: een veld hernoemen of weghalen is een brekende wijziging.

## Codeconventies

23. **Code in het Engels, UI en documentatie in het Nederlands.** Namen en commentaar zijn Engels,
    ook de JSDoc waaruit de tag-referentie komt, en ook bestanden, mappen, slugs en
    URL-parameters van het design system en de stijlgids. Alles wat een gebruiker in de interface
    leest en elk `.md`-bestand is Nederlands; de voorbeeldapplicaties in `examples/` zijn
    implementaties en mogen Nederlandse namen hebben. Ook commitberichten, pull requests (titel
    en beschrijving) en issues zijn Nederlands: een squash-merge neemt de titel en de beschrijving
    van de pull request als commitbericht.
24. **CSS volgt BEM.** `lintje-<block>`, `__<element>`, `--<modifier>`; toestanden zijn
    `is-*`-klassen, vastgemaakt aan een BEM-klasse. Geen typeselectors in een blok. Wat het
    *element* nodig heeft (`:host`), staat boven de `/* --- */`-scheiding; de eigen regels van
    het blok eronder.

## Praktisch

- Vóór een commit: `npm run typecheck`, `npm run lint` (oxlint — dat bewaakt ook de laaggrens),
  `npm run format:check` (oxfmt) en `npm test`; na een wijziging onder `src/` ook
  `npm run build:elements`, zodat de voorbeelden hem tonen — de uitvoer staat in `.gitignore`.
- `npm test` draait de unittests (`happy-dom`) en de browsertests (`*.browser.test.ts`, in
  Chromium): elk specimen van de styleguide wordt getekend en met axe gecontroleerd, dus een
  nieuw element of een nieuwe toestand heeft een specimen nodig. `npm run test:unit` en
  `npm run test:browser` draaien er één van; `npm run test:browser:all` voegt WebKit toe, vóór
  een merge. De browsers komen eenmalig uit `npx playwright install chromium webkit`.
- Een browsertest hoort bij een mechanisme, niet bij een component: een element dat een gedeeld
  mechanisme gebruikt (trap, popover, focus bij weggaan, breekpunt, plakken), krijgt een rij in diens
  contract in `src/bundle/contracts/`. Zie Tests in [`CONTRIBUTING.md`](CONTRIBUTING.md).
- Elke pull request zet een regel in `CHANGELOG.md` onder `[Unreleased]`, met zijn nummer
  erachter (`(#12)`); open de pull request eerst als je het nummer nog niet weet.
- Commentaar en docs beschrijven wat is, in de tegenwoordige tijd.
- Commentaar zegt waarom, in een regel of twee, en alleen wat de code en de docs nog niet zeggen.
  Geen verwijzingen naar secties in de docs, geen vertelling van de volgende regels, geen lange
  bestandskoppen.
- Start geen dev-server als er al een draait (poort 5180).
- Demodata (`examples/_data/`) is fictief; nooit echte operationele cijfers.
- Het embleem is dat van het thema, aangewezen door de host. Teken nooit een embleem van de
  Rijkshuisstijl na en bewerk er nooit een in `assets/icons/` — zonder het bestand is een
  lege plek beter dan een gok.

## Toegankelijkheid

WCAG AA is de ondergrens, ook waar het ontwerp iets anders suggereert: houd de identiteit, maak
de kleinste correctie en leg die vast in `DESIGN_SYSTEM.md` onder Toegankelijkheid. Focus is
altijd `--color-focus`, 3 px, nooit geanimeerd. Elke grafiek krijgt een `<desc>`, elke tabel een
`<caption>`.
