<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/h11t-labs/lintje/main/assets/logo/lintje-wordmark-dark.svg" />
  <img src="https://raw.githubusercontent.com/h11t-labs/lintje/main/assets/logo/lintje-wordmark.svg" alt="Lintje" height="80" />
</picture>

# Lintje

[![npm](https://img.shields.io/npm/v/lintje?label=npm)](https://www.npmjs.com/package/lintje)
[![Licentie: EUPL-1.2](https://img.shields.io/npm/l/lintje?label=licentie)](LICENSE)

**Met Lintje bouw je webapplicaties en websites in de Rijkshuisstijl.** Bijvoorbeeld:

- een dashboard met filters, kerncijfers, grafieken, een kaart en een tabel;
- een register van meldingen: een tabel die je sorteert en filtert, en een nieuwe melding in drie
  stappen;
- een formulier dat een concept bewaart en zijn fouten op één plek samenvat;
- een productcatalogus met filters en een pagina per product;
- een chat met je gegevens, of een opname die je als tekst naast de audio leest.

Bekijk ze, en elk element los in de stijlgids, op
[h11t-labs.github.io/lintje](https://h11t-labs.github.io/lintje/).

Je schrijft een tag als `<lintje-button>` in je HTML, en het element tekent zich in de huisstijl:
in licht en donker, in zes thema's, op elk scherm tot een telefoon van 390 px breed, en met WCAG
AA als ondergrens. De elementen zijn standaard webcomponenten (custom elements), geschreven met
[Lit](https://lit.dev). Ze werken dus in elke pagina, hoe die ook gemaakt wordt: met PHP, Python,
als statisch bestand of als JavaScript-applicatie. Ze kennen geen domein: wat ze tonen, geeft je
pagina ze mee.

> **Over de naam**
>
> Lintje is genoemd naar het lint: de staande blauwe band in het logo van de Rijksoverheid. Het
> logo van Lintje is dat lint, één keer gevouwen tot een L, zonder embleem en zonder de naam van
> een organisatie.
>
> Lintje is **geen officieel product van de Rijksoverheid** en is er niet aan verbonden. De
> Rijkshuisstijl en de emblemen zijn van de Rijksoverheid en van de organisatie wier embleem het
> is; alleen een organisatie die de huisstijl mag voeren, gebruikt ze. Lintje levert de code, niet
> dat recht.

Lintje is nog in versie 0.x: tot 1.0 kan een tag, een eigenschap of een event nog veranderen.
[`CHANGELOG.md`](CHANGELOG.md) zegt per versie wat er veranderde en wat dat voor je pagina breekt.
Lintje wordt getest in Chromium, WebKit en Firefox.

## Wat erin zit

De elementen staan in groepen, dezelfde als in de stijlgids:

| Groep | Wat erin zit |
|---|---|
| Paginakader | wat om elke pagina staat: het menu, de paginakop met het kruimelpad, het submenu, de voet, zoeken en meldingen |
| Indeling | het raster, de tegel, tabs, uitklappers en twee panelen naast elkaar |
| Vensters en panelen | het venster, de dialoog, het paneel opzij, het zwevende paneel en de tooltip |
| Knoppen en iconen | knoppen, kopiëren (ook als QR-code), de iconen en het beeldmerk van je organisatie |
| Tekst en media | lopende tekst en code, audio en video met een meelopend transcript, een document, afbeeldingen en bijlagen |
| Meldingen en status | een mededeling, een korte bevestiging, een lege toestand, een foutpagina, een status, laden en voortgang |
| Invoervelden | elk veld om iets in te vullen of te kiezen: tekst, getal, keuzelijst, datum, tijd, bestand en een teksteditor |
| Formulier | secties, stappen, een groep velden die zich herhaalt, het overzicht van fouten en de knoppen onderaan |
| Filters | de filterbalk met de zin die zegt wat je ziet, en op een telefoon een blad |
| Kerncijfers en grafieken | de cijfers bovenaan een pagina, de grafieken en de tekst die ze uitlegt |
| Kaart | een kaart met stromen, punten of gebieden in kleur |
| Netwerk | een diagram van dingen en hun relaties, dat zichzelf indeelt |
| Tabellen en lijsten | de tabel als overzicht en als werkblad, lijsten, kaarten, een boom, een logboek en personen |
| Chat met data | een gesprek over de gegevens: de vraag, en het antwoord met cijfers en grafieken |

## Gebruiken

Installeer het pakket:

```bash
npm install lintje
```

Het pakket bevat de gebouwde bestanden, in `node_modules/lintje/dist-elements/`. Serveer die map,
zet drie regels in de `<head>` van je pagina, en schrijf daarna tags:

```html
<link rel="stylesheet" href="dist-elements/tokens.css" />
<link rel="stylesheet" href="dist-elements/fonts.css" />
<script type="module" src="dist-elements/lintje.js"></script>

<lintje-tile heading="Aanvraag">
  <lintje-text-input label="Naam"></lintje-text-input>
  <lintje-button variant="primary">Versturen</lintje-button>
</lintje-tile>
```

`tokens.css` bevat de kleuren, maten en thema's, `fonts.css` het lettertype RijksSans en
`lintje.js` alle elementen. Werk je met een bouwtool, dan importeer je dezelfde bestanden uit het
pakket `lintje`. Hoe je verder gaat, hangt af van je pagina:

- **Een pagina die op de server wordt opgebouwd, heeft geen eigen script nodig.** Een link is een
  gewone link, een formulier verstuurt zoals elk HTML-formulier, en gegevens voor een tabel of
  grafiek geef je als JSON mee in het element: [een eerste pagina](docs/guides/start.md).
- **Een pagina met script reageert op events.** Een element meldt wat de gebruiker doet (een
  waarde kiezen, opslaan, sorteren) en wacht tot je pagina het nieuwe gegevens geeft:
  [events](docs/guides/events.md).
- **Een pagina laadt alles, of alleen wat ze gebruikt**: een groep als `forms.js` of `charts.js`,
  of één element als `tag/button.js` — nooit allebei: [laden](docs/guides/loading.md).

De iconen zijn losse bestanden in `dist-icons/`: zet een kopie op `/icons/` van je site, of zeg
waar ze staan ([iconen laden](docs/guides/loading.md#iconen)). Het lettertype en de iconen komen
uit de set van RVO ([`@nl-rvo/assets`](https://www.npmjs.com/package/@nl-rvo/assets)), met de
emblemen en een paar eigen bedieningselementen erbij ([`assets/`](assets/README.md)).

Verder lezen:

- [Thema's](docs/guides/theming.md): het thema van je organisatie, en licht of donker.
- [Eigen iconen](docs/guides/icons.md), [een dashboard](docs/guides/dashboard.md) en
  [een inhoudsopgave op de pagina](docs/guides/page-contents.md).
- De [stijlgids](https://h11t-labs.github.io/lintje/) (in deze repository
  [`examples/styleguide/`](examples/styleguide/)): per element zijn voorbeelden, hun code en wat
  je kunt instellen — attributen, eigenschappen, events en de plekken voor eigen inhoud.
- [`skills/lintje/`](skills/lintje/SKILL.md): bouw je met een AI-assistent, dan helpt deze skill
  hem de elementen en de tokens op te zoeken en je eigen CSS te controleren.

## Bijdragen

Bijdragen is welkom. Welke weg je neemt, hangt af van wat je verandert:

- **Een fout of een kleine verbetering**: stuur direct een pull request.
- **Een nieuw element, een nieuwe variant of een ander ontwerp**: open eerst een issue met het
  sjabloon *Voorstel*, voordat je code schrijft. Daarin wordt afgesproken wat er komt.
- **Iets oppakken**: wat nog openstaat, staat in de
  [issues](https://github.com/h11t-labs/lintje/issues). Een issue met het label `agent` is zo
  volledig beschreven dat ook een AI-assistent het kan oppakken.
- **Een kwetsbaarheid** meld je niet in een issue, maar zoals [`SECURITY.md`](SECURITY.md) zegt.

Aan de slag, met Node 20.19+ of 22.12+:

```bash
npm ci                                   # installeert alles en zet de iconen klaar
npx playwright install chromium webkit   # eenmalig: de browsers voor de tests
npm run build:elements                   # bouwt de elementen in dist-elements/
npm run dev                              # de stijlgids en de voorbeelden op localhost:5180/examples/
```

Een pull request slaagt voor deze controles; GitHub draait ze ook, in Chromium, WebKit en Firefox:

```bash
npm run typecheck      # de typen kloppen
npm run lint           # de code volgt de regels, ook welke laag wat mag importeren
npm run format:check   # de opmaak klopt; npm run format zet hem goed
npm test               # de unittests, en elk voorbeeld uit de stijlgids in een browser
npm run build:elements # de build lukt
```

Bekijk je wijziging in de stijlgids, in licht én donker, breed én smal. Elke pull request schrijft
zijn regel voor de changelog in een eigen bestand in [`changes/`](changes/).

Lees vooraf:

- [`CONTRIBUTING.md`](CONTRIBUTING.md): hoe je bijdraagt, en het recept voor een element.
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md): de uitgangspunten en besluiten van het ontwerp.
- [`AGENTS.md`](AGENTS.md): de projectregels, voor mensen en voor AI-assistenten.

Code en commentaar zijn Engels. Alles wat een gebruiker leest, de documentatie, commits, pull
requests en issues zijn Nederlands.

## Licentie

De code en de documentatie vallen onder de [EUPL-1.2](LICENSE). De Rijkshuisstijl en de
emblemen niet, en het lettertype en de iconen van RVO hebben hun eigen licentie
([`NOTICE.md`](NOTICE.md)).
