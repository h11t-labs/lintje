<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/h11t-labs/lintje/main/assets/logo/lintje-wordmark-dark.svg" />
  <img src="https://raw.githubusercontent.com/h11t-labs/lintje/main/assets/logo/lintje-wordmark.svg" alt="Lintje" height="80" />
</picture>

# Lintje

[![npm](https://img.shields.io/npm/v/lintje)](https://www.npmjs.com/package/lintje)
[![Release](https://github.com/h11t-labs/lintje/actions/workflows/release.yml/badge.svg)](https://github.com/h11t-labs/lintje/actions/workflows/release.yml)
[![Pages](https://github.com/h11t-labs/lintje/actions/workflows/pages.yml/badge.svg)](https://h11t-labs.github.io/lintje/)
[![Licentie: EUPL-1.2](https://img.shields.io/npm/l/lintje)](LICENSE)

De Rijkshuisstijl als standaard **custom elements**, geschreven met [Lit 3](https://lit.dev) —
genoemd naar het lint van het logo van de Rijksoverheid. Eén module registreert de
`lintje-*`-tags; een pagina schrijft een tag en zet zijn attributen of properties.

```html
<link rel="stylesheet" href="dist-elements/tokens.css" />
<link rel="stylesheet" href="dist-elements/fonts.css" />
<script type="module" src="dist-elements/lintje.js"></script>

<lintje-tile heading="Aanvraag">
  <lintje-text-input label="Naam"></lintje-text-input>
  <lintje-button variant="primary">Versturen</lintje-button>
</lintje-tile>
```

Het is voor applicaties en websites; een dashboard is er één van. De componenten kennen geen
domein en staan in dertien categorieën (`src/categories.json`), van het paginakader rond elke
pagina tot de chat met data. Zes thema's, in licht en donker, tot 390 px breed.

> **Lintje is geen officieel product van de Rijksoverheid** en is er niet aan verbonden. De
> Rijkshuisstijl en de emblemen zijn van de Rijksoverheid en van de organisatie wier embleem het
> is; alleen een organisatie die de huisstijl mag voeren, gebruikt ze. Lintje levert de code, niet
> dat recht.

## Status

Versie 0.x: de tags, hun properties en events en `src/types.ts` kunnen vóór 1.0 nog breken.
[`CHANGELOG.md`](CHANGELOG.md) markeert elke brekende wijziging. Lintje wordt getest in Chromium,
WebKit en Firefox.

Lintje staat op npm als [`lintje`](https://www.npmjs.com/package/lintje); de styleguide en de
voorbeelden van de laatste versie staan op [h11t-labs.github.io/lintje](https://h11t-labs.github.io/lintje/).

```bash
npm install lintje
```

Een host met een bundler importeert `lintje` of een van zijn ingangen; een host zonder serveert
`node_modules/lintje/dist-elements/`, of bouwt deze repository. Wat de pagina rendert maakt niet
uit — PHP, Python, een statisch bestand, een JavaScript-applicatie:

- **Een pagina die een server rendert, heeft geen eigen script nodig.** De browser volgt links,
  de invoer post in een native `<form>`, en rijke data is een JSON-script in het element:
  [`docs/guides/start.md`](docs/guides/start.md).
- **Een pagina met script beantwoordt events.** Een tag stuurt een event (een waarde, een
  opslag, een sortering) en wacht tot de pagina een property zet:
  [`docs/guides/events.md`](docs/guides/events.md).
- **Een pagina laadt de hele bundel of de delen die ze gebruikt** (een categorie als
  `frame.js` of `charts.js`, of `tag/<name>.js`), nooit allebei: [`docs/guides/loading.md`](docs/guides/loading.md).

## Lettertype en iconen

RijksSans en de iconen komen uit de assets van RVO (`@nl-rvo/assets`), met de emblemen en een paar
eigen bedieningselementen erbij: [`assets/README.md`](assets/README.md). Hoe een host ze serveert,
staat in [`docs/guides/loading.md`](docs/guides/loading.md).

## Eraan werken

Node 20.19+ of 22.12+ (de CI draait op 20).

```bash
npm ci
npx playwright install chromium webkit   # eenmalig: de browsers waarin `npm test` tekent
npm run typecheck        # tsc --noEmit over src/ en de configs
npm run lint             # oxlint, ook de laaggrens
npm run format           # oxfmt; format:check controleert alleen
npm test                 # vitest: de unittests, en de styleguide in een browser
npm run build:elements   # → dist-elements/, en dan:
npm run dev              # een statische server op 5180 → /examples/
npm run release 0.2.0    # changelog en versie in één commit; de tag v0.2.0 op main publiceert (CONTRIBUTING.md)
```

| script | uitvoer | gecommit |
|---|---|---|
| `npm run build:elements` | `dist-elements/` — de bundel en zijn delen, `tokens.css`, `fonts.css` met `fonts/`, `custom-elements.json`, de typen (`*.d.ts`, `types/`), de handleidingen (`guides/`) en de skill voor een agent (`skills/lintje/`) ([`loading.md`](docs/guides/loading.md)) | nee |
| `npm run build:icons` | `dist-icons/`, uit de set van RVO en de eigen iconen in `assets/icons/`; `src/icons/register.ts`, de iconen die de bundel inline meeneemt | alleen `register.ts` |
| `npm run build:geo` | `assets/geo/*.json` — de kaartgeometrie, uit Natural Earth en PDOK | **ja** |

Bijdragen is welkom: [`CONTRIBUTING.md`](CONTRIBUTING.md) zegt hoe, en wanneer je eerst een issue
opent.

## Waar je wat leest

| | |
|---|---|
| [`examples/styleguide/`](examples/styleguide/) | de styleguide: elk element in zijn toestanden, met zijn referentie — properties, events, slots — eronder |
| [`docs/guides/`](docs/guides/start.md) | de elementen gebruiken op een eigen pagina: [een eerste pagina](docs/guides/start.md), [laden](docs/guides/loading.md), [thema's](docs/guides/theming.md), [eigen iconen](docs/guides/icons.md), [events](docs/guides/events.md), [een dashboard](docs/guides/dashboard.md) |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | de uitgangspunten en besluiten van het ontwerp |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | bijdragen, en het recept voor een component |
| [`AGENTS.md`](AGENTS.md) | de projectregels, voor mensen en voor AI-assistenten |
| [`skills/lintje/`](skills/lintje/SKILL.md) | de skill voor een AI-assistent die met Lintje een applicatie bouwt; de build zet hem in `dist-elements/skills/` |
| [`CHANGELOG.md`](CHANGELOG.md) | wat er veranderde, en wat een host breekt |
| [`examples/`](examples/index.html) | de voorbeeldapplicaties, met fictieve data |
| [`assets/`](assets/README.md) | de iconen, de emblemen, de kaartgeometrie en het logo |
| [`docs/OPEN_ISSUES.md`](docs/OPEN_ISSUES.md) | wat nog openstaat: iconen, tokens, browsercontroles, bekende afwijkingen |
| [`SECURITY.md`](SECURITY.md) | een kwetsbaarheid melden |

## Licentie

De code en de documentatie vallen onder de [EUPL-1.2](LICENSE). De Rijkshuisstijl en de
emblemen niet, en het lettertype en de iconen van RVO hebben hun eigen licentie
([`NOTICE.md`](NOTICE.md)).
