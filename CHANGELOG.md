# Changelog

Wat er veranderde, per versie, de nieuwste bovenaan. Elke pull request, ook een kleine, schrijft
zijn regel in een eigen bestand in [`changes/`](changes/), `<nummer>-<titel>.md`, met zijn nummer
erachter: `(#12)`; `npm run release` zet ze hier bij elkaar. De opzet volgt
[Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) en de versies
[Semantic Versioning](https://semver.org/lang/nl/): de kopjes zijn de zes soorten van Keep a
Changelog in het Nederlands (Toegevoegd, Gewijzigd, Verouderd, Verwijderd, Opgelost, Beveiliging).
`src/types.ts` en de attributen, properties en events van de tags zijn het contract: er één
hernoemen of verwijderen is een brekende wijziging en begint hier met **Brekend:**.

## [Unreleased]

## [0.9.1] - 2026-10-20

### Gewijzigd

- Tijdens het slepen in `lintje-sortable-list` schuiven de andere rijen opzij naar hun nieuwe plek, omhoog en omlaag op hetzelfde moment; de lijn en de zichtbare statusregel vervallen (een schermlezer hoort de melding nog). Na het loslaten krijgt de greep alleen focus als hij die al had. (#307)
- "Afmelden" staat in het gebruikersmenu als icoon naast de naam, in de balk, in de zijbalk en op een telefoon; met de pijltjes komt het na de rijen. Op een telefoon staan de rijen van het gebruikersmenu verticaal gecentreerd, en in de indeling Boven vallen "Afmelden" en de versie niet meer onder de rand van het scherm. (#306)

## [0.9.0] - 2026-10-20

### Toegevoegd

- De voorbeelden en de stijlgids hebben een favicon: het beeldmerk van Lintje in wit op lintblauw. (#301)

### Gewijzigd

- De README begint met wat je met Lintje maakt, legt de naam en de verhouding tot de Rijksoverheid uit in een eigen kader, toont welke groepen elementen er zijn, en zegt daarna in gewoon Nederlands hoe je Lintje gebruikt en hoe je bijdraagt; de buildscripts, het uitbrengen en de bestanden van de build staan in `assets/README.md`, `CONTRIBUTING.md` en de handleiding *Laden*. De handleidingen gebruiken dezelfde woorden: stijlgids, eigenschap, pakket, venster en paneel in plaats van styleguide, property, package, modal en drawer. (#304)
- Onder 768 px opent de "Je ziet"-zin onder de header de filtersheet, met het aantal aangepaste filters en een pijl; de knop "Filters" in de header vervalt. Een losse filterbalk (`standalone`) opent voortaan ook zijn eigen sheet. (#303)
- De naam naast het lint staat zoals op rijksoverheid.nl: gewicht 625, 15 px naast een lint van 48 px en 12 px naast een lint van 40 px, met dezelfde tussenruimte, hoogte en breedte, in lintblauw (in donker in de tekstkleur); de tweede regel is rechtop. (#302)

## [0.8.3] - 2026-10-19

### Gewijzigd

- De filterbalk is in licht echt grijs in plaats van blauwgrijs, in elk thema; het zoekveld in de shell volgt hem. Donker blijft gelijk. (#299)

## [0.8.2] - 2026-10-18

### Opgelost

- De tekst en het icoon van het AI-label staan in het midden van de badge; voorheen stond de tekst te hoog. (#297)

## [0.8.1] - 2026-10-17

### Opgelost

- Een groot venster of zijpaneel zonder subtitel zet zijn titel op één lijn met het kruisje; voorheen stond de titel hoger. (#274)

## [0.8.0] - 2026-10-17

### Toegevoegd

- Entiteitendiagram `lintje-graph` in een eigen categorie, Netwerk: een host stuurt knopen, hun soorten en hun relaties, en het element deelt ze in (gelaagd, door kracht of radiaal), tekent ze als kaarten of uitgezoomd als merktekens, groepeert meer dan vijf bladeren van één soort, klapt takken in en uit met een teller in de kaart, haalt op aanvraag buren op, zoomt zoals de kaart, met een overzicht, en geeft de tekening als PNG. Boven honderd knopen wordt de indeling in een worker berekend (`dist-elements/workers/`). (#247)
- Een treemap (`kind: 'treemap'`) toont de delen van een groot geheel en hun onderdelen in één vlak; de inkt van een label op een vulling staat per kleur en per sport in één tabel. (#220)
- `<lintje-person>` toont één persoon met foto, initialen of icoon en de naam ernaast, en
  `<lintje-person-group>` een rijtje overlappende rondjes dat een lijst van iedereen opent.
  Een persoon staat ook in de tabel (`format: 'person'`), op een rij van de lijst, als feit op
  een kaart en in de geschiedenis. (#219)
- `lintje-accordion`: uitklappers gestapeld als één lijst, met de lijnen van de lijst en de pijl
  vooraan, met `exclusive` en `toggle-all`; `lintje-expander` krijgt `level` voor het kopniveau.
  (#218)
- Een lijn- en een staafgrafiek tonen na het gemeten deel een raming (`forecastFrom`) met
  optioneel haar marge (`forecast: { low, high }`): gestippeld of als open staaf, achter één grens
  met "Gemeten" en "Raming", met een open hoverpunt, "raming" in de tooltip en de grenzen en de
  soort in de tabel en de CSV. (#217)
- `lintje-chart` tekent een halterdiagram (`kind: 'dumbbell'`, "Voor en na"): één maat per rij op
  twee momenten, een grijze ring en een stip in de kleur van de variabele, met het verschil met
  teken ernaast. De host mag de as inkorten; een waarde erbuiten staat op de rand met een
  afkapteken en heet in de legenda "Buiten de as". (#216)
- `lintje-chart` tekent een sankey (`kind: 'sankey'`): hoe één aantal over twee tot vier stappen van een proces stroomt. Hij heeft één kleur en één schaal, een gearceerde stomp voor een ontbrekende stroom, toetsenbord en tooltip, een tabel per stroom en onder 768 px een staaf per bron. De vraag `parts` luidt nu "Uit welke delen bestaat het geheel, en waar komen ze terecht?". (#215)
- `lintje-chat-questions`: de vragen van de assistent in een box boven het tikveld, in de korte
  vorm (knopjes, één tik verstuurt) of in stappen met Vorige, Volgende en Versturen, met "Iets
  anders…" in elke keuzevraag en het event `lintje-questions-answer`. `lintje-chat` tekent de box
  bij `questions` op het laatste antwoord en klapt het tikveld op de telefoon in tot één regel, met
  het aantal bijlagen. (#212)
- `lintje-chart` waarschuwt in de ontwikkelbuild als een lijn, gegroepeerde staaf, dubbele as, spreiding of spinnendiagram meer dan één variabele heeft en een reeks daarvan geen kleur noemt; een vergelijking telt niet mee en het beeld verandert niet. (#208)
- De skill voor een host zoekt ook de tokens op (`reference.mjs` op `tokens.json`, per groep en te
  filteren) en controleert de eigen CSS en HTML van een applicatie met `check.mjs`: een literal
  kleur, een primitief, een token dat niet bestaat, ruimte buiten de 4 px-schaal, en als hint een
  element waar een tag voor is. `tokens.json` draagt daarvoor de groep van elk token. (#202)
- `<lintje-chat-steps>` toont wat de assistent deed voor een antwoord als een reeks stappen aan de
  rail die inklapt tot één regel: de stap die loopt, een mislukte, of het aantal en de duur.
  `lintje-chat-answer` tekent hem uit `steps`, in plaats van zijn eigen laadring, en `lintje-chat`
  tekent met `divider` een scheidslijn boven een beurt: "Gisteren", "Nieuw onderwerp" of "Gesprek
  ingekort". (#184)
- Het overzicht van de sneltoetsen heeft in zijn voet de schakelaar "Sneltoetsen van één teken":
  uit werken alleen de toetsen met Ctrl, Alt of Cmd, en de keuze blijft bewaard in de browser.
  (#183)
- `<lintje-key>` tekent een toets zoals Lintje dat binnen zijn elementen doet, en
  `lintje-description-list` toont met `keys` een waarde als toetsen; het overzicht van de
  sneltoetsen toont daarmee toetsen in plaats van labels. (#176)
- `lintje-video-player` heeft een knop "Ondertiteling" rechts in de bedieningsbalk, naast "Meer opties" en volledig scherm; zolang de ondertitels aanstaan is hij ingedrukt en onderstreept zoals een actief tabblad, met een eigen icoon `functioneel-ondertiteling`. De toets C blijft; de rij in "Meer opties" staat er alleen nog op een balk die te smal is voor de knop. (#175)
- `<lintje-attachment>` toont een bestand als stille chip van één regel: het icoon of een
  miniatuur, de naam en de maat, bezig of met een fout. Het vraagvak van de chat krijgt een
  paperclip, slepen en plakken; een bericht en een antwoord tonen hun bijlagen. (#173)

### Gewijzigd

- Alle ruimte in de invoervelden en formulieren ligt op de 4 px-schaal: de zijruimte van een veld is 16 px (was 14), de ruimte tussen een keuzevakje en zijn label 12 px (was 10), en de andere maten schuiven hooguit 2 px; de vaste hoogtes blijven. (#263)
- Ook in tabellen, lijsten, grafieken, tegels, de filterbalk, het gesprek, de kaart en de gedeelde onderdelen ligt alle ruimte op de schaal van 4 px: rijen en tegels worden 2 tot 6 px hoger, een knop in een balk 4 px breder, en een cel die wordt bewerkt maakt haar rij niet meer hoger. Een unittest faalt nu op elke ruimte buiten de schaal in de CSS onder `src/`. (#262)
- `renderStatusDot()` tekent de statusstip ook in een root zonder het element, zoals `renderBadge()`; de legenda van een grafiek kan per item een icoon en een aantal tonen; `place()` kent `bottom-center`; het plaatje van `chartImage()` tekent ronde vakken, snijdt af wat het scherm afsnijdt, en laat een element eigen bedieningselementen weglaten en eigen knoppen tekenen. (#247)
- De invoeren delen hun hostregels in `inputs/shared/input.css`, met één telefoonregel, en tekstveld, datum en tijd delen daar hun box en datum en tijd hun knop rechts in het veld. Er verandert niets zichtbaars. (#246)
- Alle ruimte in het paginakader ligt op de schaal van 4 px: de kop van een groep in het zijmenu en het telefoonmenu, de paginakop, de panelen "Weergave" en "Delen", de meldingen en het submenu schuiven 1 tot 4 px, en in de rail staat een icoon onder het midden van het logo. (#245)
- De markering van een zoekterm, het aantal resultaten, de plek van een zwevend paneel, een uniek id en een kop op het gevraagde niveau komen elk uit één functie; wat een lezer ziet en hoort, blijft gelijk. De referentie van `lintje-form-actions` zegt bij `state` wat elke waarde toont. (#243)
- Het venster van een vergrote tegel (`lintje-modal`) is zo hoog als zijn inhoud, ten hoogste het venster: een grafiek die de ruimte vult, maakt het vol, een halterdiagram of een korte tabel een lager venster. (#240)
- Het gebruikersmenu en het zijmenu tekenen de avatar met dezelfde tekening als een persoon,
  en kunnen een foto tonen; `initials` is optioneel. `who` in de geschiedenis kan een persoon
  zijn, en `value` op een feit van een kaart is optioneel. (#219)
- De knoppen Opsomming en Link van `lintje-text-editor` zijn een icoon in plaats van een woord,
  even breed als B, I en H; Link neemt het nieuwe eigen icoon `functioneel-link`. Elke knop van de
  opmaakbalk toont zijn naam als tooltip. (#214)
- De slot van `lintje-prose` is voor gewone tekst; opgemaakte inhoud gaat via `html`. Het
  specimen en de voorbeelden zetten geen koppen of lijsten meer in de slot. (#201)
- De meldingen-app leest het teruggezette concept uit `restoredDraft` en `restoredAt` van `lintje-form` in plaats van uit `localStorage`, en de handleiding over events noemt beide. Transcriptie, vertalen en catalogus wisselen van modus en thema zonder de pagina te herladen; hun links nemen de nieuwe instellingen mee. (#188)
- `lintje-date-input` en `lintje-date-range` delen één maandraster. De kalender van de datumreeks ziet er nu uit als die van de datuminvoer: zoveel rijen als de maand nodig heeft, 1 px tussen de cellen (met de tint van een periode doorlopend binnen een week), een gekozen dag met een lichtere rand ook in licht, vandaag als ring in de accentlijn in plaats van statusblauw, en de dagen buiten de maand leeg. De rijen voorkeuzes staan dichter op elkaar, als een dichte rij keuzes op `--h-option`. De dagen in de kalender heten nu `lintje-month-grid__day`. (#180)
- Wat in `lintje-audio-player` nog moet spelen, heeft een vaste, lichtere kleur van zijn spreker in plaats van die kleur op 40 % dekking: de sprekerkleur gemengd met het oppervlak (`--tint-speaker-ahead`), in licht de trede `-tint-4` van haar tintladder. De ondergrond schemert niet meer door. (#178)
- `<lintje-file-upload>` toont zijn bestanden als bijlagen in plaats van rijen, met Opnieuw als de
  host `retry` zet; een fout van de host heet voor een schermlezer "mislukt". (#173)
- "Opnieuw proberen" in `lintje-audio-player` en `lintje-video-player` laadt de opname opnieuw en stuurt nu ook `lintje-retry`, zodat een host een nieuwe `src` kan zetten of de fout kan melden. (#166)
- In de kalender van `lintje-date-range` krijgen de dagen tussen begin en eind een lichte tint van de primaire kleur, het nieuwe token `--color-range-bg`, in plaats van het bijna onzichtbare grijs. De vulling loopt in een rij zonder naad door en blijft staan onder de muis. (#164)
- Het beeld van `lintje-video-player` neemt een eigen token, `--color-media-bg`, inktzwart in licht en donker, in plaats van de kleur van tekst op een lichte vulling. Er verandert niets zichtbaars. (#162)

### Verwijderd

- **Brekend:** het veld `tableSwitch` is weg uit `ChartData`, dus een host die het nog meegeeft, krijgt een typefout. Een grafiektegel wisselt niet meer tussen grafiek en tabel: `lintje-chart` tekent geen "Grafiek" / "Tabel" meer in zijn kop. De cijfers staan in de tooltip en de CSV; een tabel die de lezer nodig heeft, staat apart. (#244)
- **Brekend:** `ChatAnswerData.choices` en de property `choices` van `lintje-chat-answer`, `kind`
  en `hint` van `lintje-chat-suggestions` en `kind` in `lintje-suggestion-select`. Een host die
  `choices` zette, zet op hetzelfde antwoord `questions` met één vraag van het soort `one` en zijn
  eigen vraagtekst, en luistert naar `lintje-questions-answer`. (#212)

### Opgelost

- Een tweede klik op de gebruiker in de voet van het zijmenu sluit het gebruikersmenu, in plaats van het opnieuw te openen. `lintje-popover` kent daarvoor `opener`: de knop die het paneel opent, als dat niet het anker is. (#238)
- Mintgroen, lichtblauw, roze, geel en oranje halen als lijn of teken in licht 3:1: ze krijgen een
  rand in hun eigen donkere kleur (`--color-chart-<kleur>-edge`), onder de lijn, om een punt van
  een spreiding of de kaart en om hun vorm in de legenda, zoals donkergeel die al had. In donker
  smelt de rand weg in de kleur. (#210)
- Een aanraking die afbreekt of buiten het element wordt losgelaten, laat niets meer achter: in `lintje-split-pane` werkt de volgende klik weer, en in `lintje-tabs` tekent een focus met het toetsenbord weer zijn ring. (#207)
- De strook van `lintje-split-pane` heeft op een aanraakscherm een onzichtbaar raakvlak van 24 px, zodat een vinger hem kan verslepen of optillen; met een muis en in beeld blijft hij 9 px. (#203)
- Het plaatje van een grafiek ("Downloaden als PNG") ziet eruit als de tegel: de titel en
  ondertitel boven, de bron onder, met de marge en de rand van de tegel, en daarbinnen de
  legenda, de astitels, de gebeurtenissen en de legendatabel van een taart, waar ze op het
  scherm staan. Een uitgezette
  reeks staat doorgestreept in de legenda en ontbreekt in de tekening. (#195)
- Een dag in de kalender van `lintje-date-input` en `lintje-date-range` is een cel van het raster
  die zelf de focus neemt, geen knop met de rol van een cel; Enter en spatie kiezen de dag met de
  focus, zoals een klik. (#193)
- In `lintje-transcript` als gegroepeerd gesprek gaat de focus van een sprekerknop die verdwijnt naar de naam van zijn beurt, niet naar de pagina. In de lijst ligt het raakvlak van de tijdcode niet meer over de sprekerknop erboven: een klik op de naam opent altijd het sprekermenu. (#174)
- Het paneel van `lintje-date-range` staat vast aan zijn veld en wordt niet meer afgesneden door een tegel of filterzone die scrolt; het klapt boven het veld als daar meer ruimte is en volgt een scroll. `lintje-multiselect` plaatst zijn paneel met dezelfde rekensom en loopt op een laag scherm niet meer buiten beeld. (#168)

## [0.7.0] - 2026-10-17

### Toegevoegd

- Een trendpijltje (`change-compact`) draagt zijn woorden in een tooltip: de hele verandering, of
  per rij een sjabloon met het nieuwe kolomveld `tooltip` (`{sleutel}` uit de rij). Een
  schermlezer hoort dezelfde woorden, en onder de focus van het toetsenbord en zonder hover staan
  ze voluit op de plaats van het pijltje. Ook een rij zonder bediening is met Tab bereikbaar om
  de uitleg te lezen. (#228)
- `lintje-text-input` krijgt `prefix` en `suffix`, een vaste tekst vóór of achter de invoer in een
  eigen vak, en `action`, een knop aan het eind die eerst vastlegt en dan `lintje-action` stuurt;
  `lintje-number-input` krijgt `prefix`, en zijn eenheid staat in hetzelfde vak. (#213)
- `lintje-radio-group` en `lintje-checkbox-group` hebben `other`: de laatste optie "Anders,
  namelijk" met een tekstveld eronder zolang ze gekozen is. De tekst is `otherText`, gemeld als
  `lintje-other-change` en meegestuurd als `<name>-other` in de post, in `lintje-values-change` en
  in het concept en de submit van `lintje-form`; een fout van de host onder `<name>-other` staat
  onder het veld (`other-error`), met een ingang in de foutsamenvatting. `OTHER_MISSING_TEXT` is
  de standaardtekst. (#199)
- Een omschrijving van een optie staat in `lintje-radio-group` ook in de gewone rijen, onder het
  label en gekoppeld aan haar radio. (#199)
- Een groepskop in een gegroepeerde, kiesbare `lintje-data-table` heeft een vinkje voor de kiesbare rijen van haar groep: aan, half of uit, ook ingeklapt en op een telefoon, en het stuurt `lintje-checked-change` zoals een rijvinkje. (#171)
- `lintje-form-actions` werpt een schaduw naar boven zolang het formulier erachter scrolt, met het nieuwe token `--shadow-sticky-up`; op zijn eigen plek onder het formulier heeft hij geen schaduw. (#160)

### Gewijzigd

- De teller van `lintje-textarea` staat rechts op de regel van de toelichting of de foutmelding,
  in plaats van op een eigen regel; past het niet naast elkaar, dan valt hij eronder, rechts. (#190)
- Een actieve `lintje-icon-button` heeft een echte rand, ook in donker en in geforceerde kleuren,
  en houdt zijn vulling onder de muis. (#189)
- De voet van het zijmenu opent het gebruikersmenu, boven de voet, met de rijen van de host,
  "Afmelden" en de versie, zoals de avatar in de bovenindeling; de losse knop "Afmelden" in de
  voet verdwijnt. `lintje-user-menu` krijgt daarvoor `variant="side"` en `folded`, en stuurt
  `lintje-toggle` als het menu opent of sluit. (#187)
- `lintje-form-actions` plakt niet bij een viewport lager dan 30 rem (een telefoon dwars, 400 % zoom): hij staat dan na het laatste veld en houdt geen ruimte vrij onderaan de scroller. (#170)
- Een open sheet van `lintje-notifications` sluit als het scherm 768 px of breder wordt, net als het menu van de shell, en de focus gaat naar de bel. Daarvoor werd hij een popover. (#169)
- **Brekend:** `lintje-row-action` van `lintje-list` stuurt `action` in plaats van `value`, zoals de tabel; beide sturen `{ id, label, action }`, en `RowActionDetail` en `RowClickDetail` staan als gedeelde types in het pakket. (#163)
- `lintje-app-search`, de sheet van `lintje-notifications` onder 768 px en `lintje-filter-sheet` houden zich vast met `DialogHold`, net als de dialoog, de modal en de drawer: de pagina erachter scrolt niet, de focus blijft erin en Escape sluit alleen het bovenste venster, met één stuk code voor alle zes. Voor een gebruiker verandert er niets. (#161)

### Verwijderd

- **Brekend:** `size` op `lintje-icon-button` is weg; het deed niets, de knop is altijd
  `--h-icon-button`. Een host in TypeScript die `.size` zet, haalt die regel weg. (#200)

### Opgelost

- Het getal in een badge staat midden in zijn vlak, in elke browser: de waarde is afgesneden op hoofdletterhoogte en basislijn, en het tellertje tilt het niet meer een pixel op. (#232)
- Een live `lintje-log-viewer` opent bij de nieuwste regel in plaats van de oudste, en blijft daar zolang je volgt, ook als een regel openklapt. Het logvenster en `lintje-chat` bepalen "onderaan" met één gedeelde regel. Tab uit een `lintje-menu-button` gaat ook in Firefox naar de volgende stop, en Shift+Tab terug naar de knop. (#211)
- Onder 768 px blijft de filterzin van `lintje-filter-bar` bij het scrollen direct onder de balk
  van de shell staan, in de zij- en in de bovenindeling, en de shell houdt de gemeten hoogte van
  de zin vrij boven de focus. (#209)
- De toelichting en de foutmelding onder `lintje-checkbox` en `lintje-toggle` beginnen onder de
  labeltekst, niet onder het vakje of de schakelaar; daarmee springt ook de toelichting bij een
  optie van `lintje-checkbox-group` en `lintje-multiselect` in. (#206)
- Elementen die na het tekenen meten (popover, tooltip, toggletip, segmentkeuze, paginering, tabs, schuifbereik, chatinvoer, filterzone, schil en paginakop) tekenen zich niet meer een tweede keer, en `/` staat één keer in het register, hoeveel `lintje-app-search` de pagina ook heeft. Een browsertest faalt voortaan op beide waarschuwingen. (#205)
- `lintje-page-header` toont zijn beschrijving ook onder 768 px buiten de shell, zodat wat de host onder de titel zet op een telefoon te lezen blijft; de afstand tot de titel is op elke breedte `--space-2`. (#204)
- `lintje-job-list` leest ook de eerste taak in een lijst die leeg laadde voor: `jobs` is
  `undefined` tot de host hem zet, en alleen die eerste waarde geldt als laden. Gaat de laatste
  taak met de focus erin, dan stuurt de lijst `lintje-jobs-empty`; annuleert de host het, dan zet
  hij de focus zelf op een zichtbaar doel, anders gaat ze naar de statusregel. (#198)
- Het lint in de logobalk groeit mee met de tekstgrootte van de lezer, net als de balk: in de logobalk en op papier neemt `lintje-logo` zijn breedte uit `--w-ribbon`. (#197)
- De foutsamenvatting, de uitgeklapte tabel en een enkele `lintje-range` worden niet meer dubbel
  voorgelezen: de samenvatting is een groep met haar kop als naam en de focus is de melding, de
  tabel wist haar laatste bericht bij uitklappen en sluiten, en een enkele schuif heet naar zijn
  label zonder de waarde, die hij één keer zegt uit `aria-valuetext`. (#194)
- `lintje-map` is een groep met de beschrijving van de kaart als naam; een stroom met focus krijgt
  de ring van elk ander teken, 3 px buiten een opening van 1 px; en het teken met focus ligt met
  zijn ring boven alle andere tekens, ook langs een rand die het met een later vlak deelt. (#192)
- De werkbalk van `lintje-document-viewer` is één Tab-stop: de pijlen lopen rond langs de knoppen,
  Home en End blijven de eerste en de laatste pagina. "Passend" staat gevuld zolang hij aan staat,
  en zijn percentage volgt de breedte van de weergave. (#189)
- De selectiebalk van `lintje-data-table` is een groep, geen werkbalk: elke knop blijft een eigen
  Tab-stop. (#189)
- Een bezig `lintje-form` zet ook elke `lintje-repeater` uit: tijdens het opslaan komt er geen rij
  bij of af, ook niet bij een rij of repeater die dan pas verschijnt. (#186)
- Een invoer in een `<fieldset disabled>` gaat weer aan zodra de fieldset aan gaat: hij is weer te bedienen, post zijn waarde en houdt een leeg verplicht veld weer tegen. `disabled` blijft van de host; de fieldset schrijft er niet meer in. (#185)
- Afgekapte tekst loopt door onder de focus van het toetsenbord, zonder hover en onder 768 px in het zijmenu van `lintje-shell`, de resultaten van `lintje-app-search`, de menurijen, `lintje-tree-view`, de rijlabels van een heatmap en de chips van `lintje-multiselect`, en staat met een aanwijzer heel in de tooltip; de stapnaam van `lintje-stepper` op een telefoon, de sprekersnaam in een `readonly` `lintje-transcript` en de naam in `lintje-document-viewer` kappen nooit meer af; een afgekapte filterzin in de dichtgeklapte filterbalk staat heel in de tooltip. (#181)
- De shell heet naar wat je ziet: de thuislink naar de organisatie in het logo, met "Naar de
  startpagina" als tooltip, en de knoppen in "Weergave" naar hun woord. `lintje-logo` zegt ook
  de ondertitel waar die getekend is, het icoon van de feedbacklink zit in de bundel (zonder
  bestand toont de link zijn woord), en een `<lintje-icon label>` houdt zijn label tijdens het
  laden en zonder bestand. (#177)
- Het label van een knop loopt door op een volgende regel onder de focus van het toetsenbord, zonder hover en onder 768 px, en een afgekapt label staat heel in de tooltip; een filterchip van `lintje-data-table` loopt altijd door en blijft binnen de tabel. (#167)
- `lintje-form-actions` scrolt een element met focus dat deels onder de vastgeplakte balk valt, helemaal van zich vrij, met rand en padding; in WebKit bleef de onderkant van een tekstveld bedekt. (#165)
- De menuknop en de knop Filters zeggen hun staat één keer: de menuknop van `lintje-shell` op een telefoon en de knop "Menu" van een ingeklapte navigatiebalk heten "Menu" of "Sluiten", naar hun woord, zonder `aria-expanded`, en de knop van `lintje-filter-zone` heet in beide standen "Filters", met `aria-expanded`. (#159)
- Een knop en de datumreeks zeggen hun hele staat aan een schermlezer: een uitgeschakelde `lintje-button` met een reden leest ook zijn beschrijving, de telefoonknop "Filters" van `lintje-data-table` zegt dat hij een venster opent en of het open is, beide helften van een gesplitste `lintje-menu-button` zijn `aria-disabled` terwijl hij bezig is, en het raster van `lintje-date-range` is meervoudig te kiezen. (#157)
- Een afgedrukte `lintje-data-table` houdt geen lege cellen over in een groepskop, een subtotaalrij en de totaalrij: die rijen hebben per vinkjes-, detail- en actiekolom een eigen cel die op papier met de kolom verdwijnt, zodat ze niet meer opschuiven ten opzichte van de rijen eronder. (#156)

## [0.6.0] - 2026-10-16

### Toegevoegd

- De kaart neemt `size`, op de kaart en per laag: `min`/`max` zetten het pixelbereik van een
  punt (standaard 3–18), `by: 'none'` tekent elke punt op `min` zonder groottesleutel in de
  legenda, en `zoom: true` laat de straal met de zoom meegaan, tussen 2 en 28 px. Nieuw specimen
  *Kaart · puntgrootte met de zoom*. (#225)
- Een kaartreeks krijgt met `seriesStyles` een eigen stijl — een datakleur of `neutral` (het
  vergelijkingsgrijs), en/of een van de zeventien vormen — los van haar naam; punten, legenda en
  selectiepaneel tekenen dezelfde stijl. Een reeks zonder stijl is wat ze was. Nieuw specimen
  *Kaart · reeksen in één kleur*. (#224)
- Een stap van `lintje-stepper` kan eigen inhoud dragen: een stap met een `value` heeft een slot
  met die naam. In de kolom staat de inhoud van elke stap onder zijn kop; in de rij en op een
  telefoon alleen die van de huidige stap, onder de rij of de balk. De referentie noemt een slot
  met een gebonden naam, zoals dat van `lintje-tabs`, als één slot per item. (#143)

### Gewijzigd

- De build minificeert de modules en de ingesloten CSS: `lintje.js` gaat van 1,9 naar 1,5 MB (gzip van 468 naar 389 kB), `tag/map.js` van 624 naar 438 kB. De CSS wordt niet omlaag vertaald: `color-mix()` en `oklch()` blijven zoals ze geschreven zijn. (#221)
- De unittests delen één happy-dom-venster per worker en `npm run test:unit` draait daardoor bijna drie keer zo snel; `src/bundle/unit-setup.ts` zet vóór elk bestand de pagina terug, en een test die een lege registry nodig heeft of een module mockt, draait in het project `unit-window`. (#221)
- Een klikbare rij van `lintje-data-table`, een teken in `lintje-chart` en een markering op
  `lintje-map` met een `href` gaan erheen na hun event, en een selectie ongedaan maken gaat naar
  `clearHref`. Een klik met een modifier of de middelste knop opent de `href` in een nieuw tabblad.
  Een host die zelf navigeert of `selectedId` zet, annuleert het event. (#149)
- Geen hover neemt nog `--color-bg-selected`; een herkende term met toelichting toont onder de
  muis een dikkere lijn. (#139)

### Opgelost

- Een brede tabel krijgt geen verticale scrollbalk meer naast zijn smalle horizontale: het vak
  scrolt alleen opzij. (#226)
- De legendatabel onder een taart houdt haar kolommen ook in Edge: de rijkop is weer een
  tabelcel, zodat aantal en % onder hun eigen kop staan; een lang etiket springt in onder zijn
  eerste regel, met het kleurblokje op die regel. (#222)
- Een schermlezer hoort de nieuwe waarde na − of + in `lintje-number-input`, de beschrijving van
  een gekozen optie in `lintje-segmented` en een wisselende verbinding in
  `lintje-recording-status`; een cel met een toon in `lintje-description-list` draagt het woord
  van haar teken verborgen vóór de waarde. (#196)
- De focusring van een optie van `lintje-segmented` naast de gekozen optie is aan alle kanten heel,
  en de knop van `lintje-file-upload` houdt zijn focus tijdens en na een sleep over de pagina.
  (#191)
- Een groep in de navigatiebalk die een tik opende, sluit niet meer meteen weer als er een muis
  op de pagina staat: het verlaten van de balk sluit alleen een groep die onder de muis openging.
  (#182)
- `lintje-expander`, `lintje-explainer` en `lintje-filter-zone` laten hun inhoud los zodra hun
  hoogte staat; ze wachten alleen op een overgang van de hoogte die echt loopt. (#179)
- Na wissen leest `lintje-find` geen melding meer voor die nog onderweg was. `lintje-notifications`,
  `lintje-log-viewer`, `lintje-find`, `lintje-card` en `lintje-card-list` spreken via de gedeelde
  live-regio, dus ook dezelfde melding twee keer na elkaar klinkt twee keer. (#158)
- Een element dat zijn vorm kiest naar zijn eigen breedte, meet een frame later, zodat de browser
  geen `ResizeObserver`-lus meer als fout van de pagina meldt; een lusfout laat de browsertest
  falen. Onder verminderde beweging loopt alleen opacity nog, en staan de focusring en een
  kleurwissel meteen. (#152)
- `lintje-segmented` blijft een rij als hij hoogstens één pixel te breed meet: bij zoom in Safari wisselde hij eindeloos tussen rij en kolom tot de pagina werd afgeschoten. In de transcriptie-app delen "Soort gesprek" en "Opnemen met" de breedte niet meer 50/50, zodat de soorten naast de recente opnames op één rij blijven. (#151)
- Na nieuwe data sluit de tooltip van het toetsenbord en wordt de statusregio leeg; de volgende
  pijltoets begint binnen de nieuwe data. Een taart neemt altijd de focus en loopt met de pijltjes
  door haar delen, en zonder legendatabel staat de gewone legenda boven de taart. (#150)
- Op een aanraakscherm sluit een tweede tik op een geopende groep in de navigatiebalk hem weer. Muis,
  toetsenbord en "Menu" werken zoals ze deden. (#148)
- Een bestand dat naast de dropzone van `lintje-file-upload` valt, opent niet meer in de browser:
  zolang de upload bestanden aanneemt, doet zo'n bestand niets en zegt de aanwijzer buiten de zone
  dat loslaten niet kan. De zone wijst zichzelf aan zolang je sleept en vult zich pas als het bestand erboven hangt. (#147)
- Een melding klinkt ook als ze er meteen staat, of voor de tweede keer. Het woord van het wachtvak
  van `lintje-streaming-text` wordt voorgelezen, en dezelfde melding twee keer na elkaar klinkt
  twee keer in `lintje-tag-input`, `lintje-file-upload`, `lintje-repeater` en
  `lintje-sortable-list`. (#146)
- De terugzetknop van een veld noemt het veld na zijn eigen woorden, en `reset-label` werkt nu
  ook op `lintje-text-input` en `lintje-textarea`. Een natief veld in `lintje-form` krijgt bij een
  fout de melding als `aria-description`. (#145)
- In donker halen de stip van een gekozen keuze in een menu, de balk van een gekozen rij, de lijn
  onder een term, een link in een getinte cel van `lintje-description-list`, de vulling en het
  spoor van `lintje-progress-bar`, een foutstap in `lintje-stepper` en de tijdcode op een getint
  fragment hun contrast. (#139)
- De stippellijn "lage zekerheid" van `lintje-highlight` haalt in licht 3:1 op haar tint. (#139)
- De focusring haalt in licht 3:1 op elke lichte ondergrond, ook op de waas van de hero: hij is
  daar een donkerder oranje; in donker blijft hij het oranje van de huisstijl. (#139)
- Het omgevingslabel haalt 4,5:1: de tekst is bijna-zwart op het oranje accent en blijft wit op
  het blauw van defensie. (#139)
- Een gestapelde staaf leest zijn percentages ook in donker: "Overig" is daar iets lichter, en een
  label op de rest neemt de tekstkleur. (#139)
- Escape sluit een toast alleen nog vanuit de toast zelf, en de Escape die een opgetilde verdeling
  van `lintje-split-pane` terugzet, sluit geen venster eromheen meer. (#139)
- `lintje-popover` vraagt ook om te sluiten als de focus hem verlaat (`lintje-close` met
  `reason: 'focus'`); de linkdialoog van `lintje-text-editor` en de panelen van
  `lintje-data-table` laten de focus dan waar hij heen ging. (#139)
- De trendlijn van een staafgrafiek breekt bij een ontbrekende waarde in plaats van die te
  overbruggen; een losse bekende waarde is een stip, zoals in de lijngrafiek. (#139)
- Een invoer met `required` houdt een native formulier tegen zolang hij leeg is, voor elke invoer
  en niet alleen tekst, getal en textarea, met de melding van de browser bij het
  bedieningselement. (#139)

## [0.5.1] - 2026-10-15

### Gewijzigd

- Donker houdt de volgorde van licht: menu onder pagina onder oppervlak. De pagina ligt halverwege
  het menu en het oppervlak, zodat een band, een tegel en de logobalk erop staan; de hero-waas
  ligt onder de pagina, zoals in licht. (#137)
- Een inhoudsfout in een tegel, een tabel of een kerncijfer is de toon fout, zoals de losse melding; de foutsamenvatting en een geweigerd bestand nemen het teken en de tint van die toon. Secundaire tekst is één token, `--text-small` (`--text-meta` en `--text-tile-sub` blijven als alias). De duren van de menurail hangen aan `--dur-rail`, de maten van hero en transcript staan op de tekstschaal, en de ruimte tussen een icoon en zijn woord is `--space-2`. (#136)
- Wat nog openstaat, staat als issue op GitHub; `docs/OPEN_ISSUES.md` is weg. Een issue met het label
  `agent` zegt wat er mis is, hoe het moet zijn, waar het zit en wanneer het klaar is. (#135)

## [0.5.0] - 2026-10-14

### Toegevoegd

- `<lintje-log-viewer>` toont logregels die live binnenkomen en volgt de nieuwste tot je omhoog
  scrolt; een balk eronder telt wat erbij kwam. Filteren op niveau, zoeken met `lintje-find`,
  kopiëren en downloaden, het venster leegmaken, acties van de host, en ook regels zonder tijd of
  niveau en ruwe uitvoer. (#49)

### Gewijzigd

- Elke grafieklegenda schakelt op dezelfde manier. Elke reeks en elke referentielijn (drempel,
  mediaan) gaat uit vanuit de legenda, ook in de gestapelde staaf, de grafiek met twee assen, het
  histogram en de radar; een reeks die alleen staat alleen als er een referentielijn naast staat.
  De heatmap gebruikt dezelfde legenda boven het rooster, en een uitgezette klasse dimt haar
  cellen. Wat je uitzet vervaagt, recht en heen en terug even lang, of krimpt in een stapel of
  groep, en tekent niet opnieuw in; de assen blijven staan. (#57)

### Opgelost

- De schetsen op de kaartjes van de stijlgids kloppen met hun element: de stepper is
  horizontaal, het filterblad schuift van onderen in, de lijst markeert alleen de gekozen rij, het
  label van een filter toont zijn stip en de voet heeft kolommen; geen rij wordt meer afgesneden
  en de lichtste vakjes en vlakken zijn ook in donker te zien. (#92)
- Het doel van een kerncijfer met een balk als schaal staat boven de balk naast zijn streep, zodat
  het label nooit meer over het eindgetal van de schaal loopt. (#64)
- Een klik op een stapknop of de wisknop van `lintje-find` geeft die knop ook in Safari de focus,
  zodat Enter of spatie verder stapt en de focus niet terugvalt op de pagina. (#50)

## [0.4.0] - 2026-10-13

### Toegevoegd

- `lintje-chart` tekent het spinnendiagram (`kind: 'radar'`): het profiel van een tot drie
  lagen over vijf tot acht assen op een schaal, met een grijze vergelijking en een norm. Van
  meer lagen vult alleen de laag die de lezer in de legenda aanwijst; een ontbrekende waarde
  breekt de lijn en arceert de spaak; onder 768 px wordt elke as een rij staven. (#46)
- De stijlgids heeft een groep Fundament met drie pagina's, Kleur, Typografie en Maat en
  beweging: elk token dat een component mag noemen, met zijn waarde in de gekozen modus en het
  thema en zijn commentaar uit `tokens.css`, en getekend: kleuren als vlak, de tintladders als
  tegels, hoeken, focus en schaduwen als vorm, bewegingen om af te spelen. De build schrijft de
  tokens in `tokens.json`.
  `lintje-token-value` is terug: het toont wat een token op zijn plek berekent, een kleur als
  staal en hex, een lengte in rem ook in px en een tekststijl als dikte, maat en regelhoogte;
  `no-swatch` laat het staal weg. (#45)
- `<lintje-find>` vindt een woord in wat al op het scherm staat en gaat langs de treffers: één
  vak met de teller, vorige, volgende en wissen erin, zodat typen niets laat verschuiven.
  Transcriptie gebruikt het in plaats van het eigen zoekveld. (#43)

### Gewijzigd

- Elke tag is een bouwsteen of samengesteld, met de basis (tokens, iconen, gedrag) eronder; de
  stijlgids toont bij elke tag zijn laag, waaruit hij bestaat en waarin hij gebruikt wordt.
  `src/primitives/` is opgeheven: elke tag staat in de map van zijn categorie. Voor een host
  verandert er niets. (#47)
- De pipeline draait de browsertests per browser in een eigen job, naast de andere checks, en
  binnen een browser meerdere testbestanden tegelijk; de stijlgidstest wacht niet meer op een
  animatie die al afgelopen is, en de release roept dezelfde checks aan. (#39)
- De changelogregel van een pull request staat in een eigen bestand,
  `changes/<nummer>-<titel>.md`, niet meer onder `[Unreleased]` in `CHANGELOG.md`; twee pull
  requests botsen zo niet meer. `npm run release` zet de bestanden per kop bij elkaar, de nieuwste
  bovenaan, en haalt ze weg. (#36)

### Opgelost

- De browsertests in Firefox draaien hun bestanden na elkaar. Firefox houdt de pointer capture van
  de muis over al zijn pagina's vast, zodat een klik in een ander testbestand op een gesleepte greep
  landde en de sleeptests van `lintje-split-pane`, `lintje-sortable-list` en de schil af en toe
  faalden. (#48)
- `lintje-map` op papier: kreeg de kaart haar papiermaat vóór het bericht dat de pagina naar
  papier gaat, dan toonde ze alleen het midden van wat op het scherm stond; nu altijd het hele
  gebied. (#39)

## [0.3.0] - 2026-10-12

### Toegevoegd

- `lintje-segmented` toont een aantal per optie: `count` op `FilterOption` wordt de tellerbadge
  achter het label, zoals in `lintje-tabs`. (#33)
- Welke grafiek welke vraag beantwoordt (`CHART_KINDS`, `CHART_QUESTIONS`): per soort haar
  Nederlandse naam, de vraag van de lezer, waarvoor je haar neemt en wanneer een andere beter
  past. Het principe staat in `DESIGN_SYSTEM.md`; de stijlgids kiest er een grafiek mee. (#25)
- `dist-elements/data-types.json`: de types uit de broncode veld voor veld, met hun
  toelichting, en per variant van een union op `kind` een eigen lijst (`scripts/manifest.mjs`).
  (#25)
- **`lintje-dialog`, het kleine venster** voor een vraag of een kort formulier, naast
  `lintje-modal`, het grote voor inhoud. `alert` maakt er een `alertdialog` van zonder
  sluitknop, `persistent` laat Escape en de achtergrond niets vragen, `wide` geeft de breedte van
  een formulier, en met `busy` wacht de knop van het antwoord terwijl de andere uit staan. De
  knoppen komen in `actions`; de focus gaat naar wat `autofocus` heeft. De bevestiging, de sessie
  die verloopt en de sneltoetsen zijn recepten ervan in de stijlgids. (#31)
- `lintje-data-table` als werkblad: een kolom met `format: 'label'` tekent een waarde als badge
  met woord, toon en icoon (`labels`); `totals` geeft de totaalrij van de host en `groupBy` zet
  de rijen per waarde onder een kop, met `groupTotals` als subtotalen en `groupsPerPage`; met
  `detailFields` of een verborgen kolom klapt elke rij open voor wat haar kolommen niet tonen,
  op desktop en telefoon dezelfde lijst. "Filters wissen" bij twee of meer filters,
  "Terugzetten naar standaard" in de kolomkiezer, en `lintje-pagination` zegt met
  `filtered-from` dat een filter de telling versmalde. `lintje-badge` krijgt `icon`. (#29)
- **Eén toonset.** `Tone` (neutraal, subtiel, bezig, gelukt, let op, fout, informatie, aandacht,
  live), `WorkState` (wachtrij, bezig, onderbroken, klaar, mislukt, geannuleerd) en
  `ContentStateKind` staan één keer, in `primitives/shared/tone.ts`, en `src/types.ts` exporteert
  ze. `lintje-status-dot` neemt elke toon naast zijn vier leveringswoorden; `lintje-card` en
  `lintje-description-list` elke toon met haar glyph; `lintje-announcement` kent de soort
  `error` (te sluiten, anders dan een storing); `lintje-toast` kent `info` en `warning`, en
  `shell.showToast(text, kind)` geeft de soort door; `lintje-kpi` heeft `message` en
  `last-known`, zoals elke tegel (`KpiData` erft `ContentState`). (#26)
- De paginakop klapt acties die niet op één regel passen in naar één menu "Meer", vóór de
  knoppen die blijven staan; de laatste knop, de primaire, blijft altijd in het zicht en een menu
  met één rij bestaat niet. Gemeten, niet per breekpunt (`components/shared/overflow.ts`). (#23)
- `lintje-checkbox-group`: meer keuzes onder één label, een vinkje per optie, met één hint en
  één foutregel voor de groep, zoals de radiogroep. De waarde is `selected`, de aangevinkte
  waarden in de volgorde van de opties; een `description` staat onder haar optie. (#19)
- `lintje-sub-nav` krijgt `expanded`: elk niveau staat er, niet alleen dat op het pad van de
  lezer. Daarmee is het submenu ook de inhoudsopgave van een lange pagina; hoe een host hem
  vult, de sectie in beeld volgt en naast de tekst laat plakken, staat in de nieuwe handleiding
  `docs/guides/page-contents.md`. (#24)
- Het gestapelde vlak als grafieksoort (`kind: 'stacked-area'`): de onderverdelingen van één
  variabele in haar tintladder, de donkerste onderaan; een ontbrekende waarde breekt haar laag en
  alles erboven af, de lagen eronder blijven staan. Een laag aan- of uitzetten laat de as staan en
  laat de laag groeien of krimpen over het nieuwe token `--dur-layer`. De tooltip sluit af met
  een totaal en de tabel krijgt een kolom Totaal. Daarvoor krijgt `TooltipRow` een `divider` en
  `core/motion.ts` een `easing`. (#11)
- Een lijngrafiek toont gebeurtenissen (`events`): een genummerd vierkantje boven de categorie,
  met de tekst in een lijst onder de grafiek, in de tooltip, de tabel en de CSV. (#12)
- Afdrukken geeft een nette pagina, staand en liggend: altijd licht en wit, met een eigen marge,
  zonder telefoonvorm, bediening of beweging, met het embleem en de naam van de applicatie
  bovenaan, elke tegel heel op een vel en een tabel die tussen zijn rijen breekt (`breakable` op
  `lintje-tile`). Een kerncijfer toont op papier zijn waarde, ook als het nog niet in beeld was,
  en een kaart het gebied dat de lezer zag. (#22)
- De foutpagina (`lintje-error-page`): de code met een teken voor geen toegang en een storing,
  een titel in woorden, de tekst, een slot voor een zoekveld of melding en een voor de knoppen,
  een referentie met kopieerknop en de lijst "Verder naar". De stijlgids toont niet gevonden,
  geen toegang, een storing en gepland onderhoud. (#18)

### Gewijzigd

- De stijlgids heeft een pagina per element: wat het is, de voorbeelden een per rij met hun naam
  ernaast en hun code in een expander (markup, script en JSON voor een pagina die een server
  rendert, gelezen uit wat het voorbeeld tekende), de referentie met de velden van `data`, waar het
  in de voorbeeldapplicaties staat en hoe je het laadt. De pagina van een categorie is een
  overzicht met een schets per element. `lintje-chart` toont één soort tegelijk, gekozen op de
  vraag van de lezer, met haar staten eronder. De delen van een elementpagina staan in tabs
  (`&tab=`). `#el-…` leidt naar de nieuwe pagina. (#25)
- **Brekend:** `lintje-confirm-dialog`, `lintje-session-expiry` en `lintje-shortcuts` zijn weg:
  een bevestiging is een `lintje-dialog alert` met de knoppen van de host, een sessie die
  verloopt een `lintje-dialog alert persistent` en het teruggezette concept een
  `lintje-announcement`. `lintje-modal` verliest `narrow` (een formulier is een
  `lintje-dialog wide`), heeft geen kop "Vergroot" meer en zet `csv` en `png` standaard uit. Het
  overzicht van de sneltoetsen is een `lintje-dialog` die de pagina vult uit `shortcuts()`.
  Modal, dialoog en drawer delen hun scrollvergrendeling, focusval en Escape
  (`components/shared/dialog.ts`). (#31)
- De voorbeeldapplicatie Meldingen gebruikt de tabel als werkblad: Ernst en Status staan als
  label, alleen een hoge ernst gevuld, en een rij klapt open voor haar locatie en notitie. (#32)
- Het kopcommentaar van elke tag, dat de stijlgids onder "Over deze tag" toont, heeft één vorm,
  vastgelegd in `CONTRIBUTING.md`. De eventregels zijn compleet: ook `lintje-reset` van elk
  invoerveld en `lintje-seek` van de videospeler. (#30)
- De kop van `lintje-data-table` zegt alleen wat nu geldt: sorteerpijlen alleen op de gesorteerde
  kolom en elders onder de aanwijzer of met focus, en een gefilterde kolom draagt alleen haar
  gevulde trechter, zonder vlak of stip. De kolomkiezer is een stil icoon met drie kolommen
  (`functioneel-kolommen`, nieuw eigen icoon) en een tooltip in de kop van de laatste kolom, in
  plaats van het tandwiel. De telling staat één keer. Een naam die opent is donker,
  onderstreept onder de aanwijzer, en een drempel dichtbij is een teken en vet in plaats van een
  gele vulling. Sorteren en bladeren laten de kolommen staan: een kolom neemt de breedte van
  haar breedste waarde over alle rijen, en de sorteerpijlen staan boven elkaar. De kop van een
  filterbare kolom draagt een trechter, een nieuw eigen icoon (`functioneel-trechter`). (#29)
- De tegel stelt leeg en fout samen uit dezelfde blokken als `lintje-empty-state` en
  `lintje-announcement` (`primitives/shared/announcement-block.ts`, `empty-state-block.ts`), en
  alle drie de toestanden zijn een live-regio van de tegel: ook een tegel die leeg wordt, wordt
  uitgesproken, en het skelet van een grafiek zwijgt erin. Grafiek, kaart en tabel geven `state`,
  `message` en `last-known` aan de tegel. `renderChartEmpty`, `renderChartError` en
  `liveAnnouncement` zijn weg; `announcement.css` en `empty-state.css` zijn de blokken in
  `primitives/shared/`. (#27)
- **Brekend:** `lintje-progress-bar` zegt zijn staat met `state` (`busy`, `done`, `error`,
  `paused`), de staat van werk, in plaats van `tone` (`run`, `done`, `error`, `paused`); het type
  `ProgressTone` heet `ProgressState`. `lintje-job-list` en `lintje-list` zijn mee. (#26)
- **Brekend:** `lintje-announcement` heeft geen `compact` meer: een melding kiest haar marge naar
  haar eigen breedte, krap onder 560 px en ruim daarboven, op dezelfde grens als haar actie. Een
  `compact` dat blijft staan, doet niets. (#35)
- De telefoonvorm geldt alleen op een scherm: `MOBILE` is `screen and (max-width: 767px)`, en een
  host schrijft zijn eigen telefoonregels zo. (#22)

### Opgelost

- `lintje-data-table`: een tabel die breder is dan zijn plek en zijwaarts scrolt, is met het
  toetsenbord te bereiken; het scrollvlak krijgt dan de focus, een rol en de caption als naam,
  zoals het blok van `lintje-code` (WCAG 2.1.1). (#25)
- `lintje-map` gooit geen fout meer als de kaart weggaat terwijl een zoom nog loopt: Leaflet
  rondt de zoom af op een timer die `remove()` laat staan, en die las de weggehaalde kaart. (#20)

## [0.2.0] - 2026-10-10

### Toegevoegd

- `lintje-slot-picker`: een tijd voor een afspraak kiezen, de dagen naast elkaar met hun tijden
  als opties; een volle tijd blijft staan met het woord "Vol", een dag zonder tijden zegt dat.
  (#8)
- `lintje-time-input` opent een lijst met tijden van `min` tot `max`, om de `step` minuten, zoals
  het datumveld zijn kalender: met de klokknop of Alt+pijl omlaag, en te typen blijft het. (#8)
- `lintje-kpi` zet één kerncijfer op zijn schaal met `gauge`: een halve boog met het getal in de
  mond (`shape: 'arc'`) of een balk eronder (`shape: 'linear'`), met het doel gestreept. Het type
  `KpiGauge` staat in `src/types.ts`; `lintje-kpi-row` geeft het door. (#13)
- Het histogram als grafieksoort (`kind: 'histogram'`): klassen die elkaar raken, labels op de
  grenzen, een open laatste klasse, een mediaan en een drempel. (#9)
- `lintje-kpi` toont het verloop van zijn variabele met `sparkline`: een lijn met haar vlak in de
  kleur van de variabele, zonder assen, geschaald van de laagste tot de hoogste waarde; een
  ontbrekende waarde breekt de lijn en de beschrijving is het tekstalternatief. Het type
  `KpiSparkline` staat in `src/types.ts`; `lintje-kpi-row` geeft het door. (#15)
- Het spreidingsdiagram als grafieksoort (`kind: 'scatter'`): een reeks is een kleur en de vorm
  die die kleur op de kaart heeft, met een norm, datalabels voor de punten die de host noemt en een
  tabel met een rij per punt. (#10)
- **De kaart kent `controls`.** Een host zet elk onderdeel van `lintje-map` aan of uit: `zoom`,
  `wheel`, `drag`, `reset`, `lasso`, `circle`, `rect`, `scale` en `legend`. Zonder waarde staat
  alles aan behalve de tekenvormen. Nieuw is de schaalbalk rechtsonder: een ronde afstand met een
  beugel zo lang als die op de kaart, die met zoomen meeloopt. (#16)
- **Een gebied kiezen op de kaart.** Met `controls.lasso`, `controls.circle` of `controls.rect`
  staat onder de zoomknoppen een tekenvorm; bij twee of meer opent één selectieknop met een
  hoekje het menu van de vormen, en toont hij de vorm die in de hand is. Een vorm blijft in de
  hand na het tekenen — een nieuw gebied vervangt het vorige — tot een klik op de knop, Escape of
  de reset haar neerlegt. Slepen tekent het gebied in één beweging; klikken zet de hoeken van een
  lasso, het midden en de rand van een cirkel of twee hoeken van een rechthoek, en onderaan staat
  hoe. De kaart stuurt `lintje-area-select` met het gebied en de ids van alle marks erin — een
  rechthoek als lasso van vier hoeken —; een host bewaart het gebied in zijn URL en geeft het
  terug als `selectedArea`. Alleen wat helemaal in het gebied ligt telt; tijdens het tekenen licht
  dat op. Het gebied blijft staan tot het wordt weggeklikt in het paneel linksonder (op een
  telefoon onder de kaart), met Escape of met de resetknop, die het huisje vervangt en zicht,
  mark en gebied terugzet. (#16)
- **De legenda van de kaart leest per laag.** Eén regel per laag, ook bij één laag: haar naam
  met een vakje dat de laag aan en uit zet, haar sleutel — de klassen van 0 tot het maximum, drie
  cirkels met het bereik of een wig met het bereik — en haar eigen reeksen, elk een schakelaar;
  een kleur in twee lagen schakelt per laag. Meer dan drie lagen vouwen onder "Nog n lagen"; de
  vergroting toont alles, met het bereik per klasse en de cirkels genest op ware maat. Een mark
  die uitgaat krimpt of vervaagt, en komt van west naar oost terug. Op een telefoon is de kaart
  280 px hoog, met alle knoppen op de aanraakmaat. (#16)

### Gewijzigd

- **Brekend:** `lintje-chart-tile` heet `lintje-chart` en `lintje-map-tile` heet `lintje-map`,
  in de build `tag/chart.js` en `tag/map.js`. De typen volgen: `ChartTileData` wordt `ChartData`,
  `MapTileViewData` wordt `MapData` en `MapTileData` wordt `MapSpec`; een `ChatBlock` noemt
  `kind: 'chart'`. (#14)
- **De kaart is één kaart, op Leaflet.** Met of zonder `basemap` draagt Leaflet de kaart en tekent
  Lintje de data zelf in zijn svg, dus slepen, dubbelklik, knijpen en het wiel met Ctrl of ⌘
  werken overal gelijk; zonder die toets scrolt het wiel de pagina en zegt de kaart kort hoe het
  wel kan. Nederland staat in Web Mercator, zoals de wereld en elke ondergrond; de
  voorgeprojecteerde `assets/geo/world.json` en `netherlands.json` zijn weg. De knoppen op de
  kaart zijn compact (40 px) met een klikgebied tot het aanwijsdoel, en de legenda linksonder en
  de knop "Legenda" op een telefoon zijn weg: er is één legenda, boven de kaart. De
  bronvermelding van een ondergrond staat in de eigen tekstkleuren, ook in donker. (#16)
- **Het menu zet je vast met een punaise** (`functioneel-punaise`, open als
  `functioneel-punaise-outline`) in plaats van met een bladwijzer. (#16)
- De actieknoppen van een tegel (vergroten, downloaden) steken boven en onder de titelregel uit,
  zodat de kop van een tegel zonder ondertitel niet hoger is dan haar titel. In de stijlgids
  staat om een brede specimen — een tegel of tabel, die zichzelf omlijst — geen tweede lijn. (#16)

## [0.1.1] - 2026-10-09

### Gewijzigd

- De README en `docs/guides/loading.md` noemen het npm-pakket (`npm install lintje`); de README
  heeft badges voor de versie, de release, Pages en de licentie. (#6)
- Elke pull request zet een regel in deze changelog, met zijn nummer. (#6)
- Commitberichten, pull requests en issues zijn Nederlands. (#5)
- Check draait één keer per pull request, niet meer ook bij elke push en op `main` na een merge.
  (#4)

### Opgelost

- Drie verdwaalde screenshots (`undefined/dashboard*.png`) zijn uit de repository. (#3)

## [0.1.0] - 2026-10-09

### Toegevoegd

- Eerste uitgave: de Rijkshuisstijl als custom elements, in dertien categorieën
  (`src/categories.json`), met zes thema's in licht en donker, de styleguide, de handleidingen in
  `docs/guides/` en de voorbeeldapplicaties met fictieve data.

[unreleased]: https://github.com/h11t-labs/lintje/compare/v0.9.1...HEAD
[0.9.1]: https://github.com/h11t-labs/lintje/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/h11t-labs/lintje/compare/v0.8.3...v0.9.0
[0.8.3]: https://github.com/h11t-labs/lintje/compare/v0.8.2...v0.8.3
[0.8.2]: https://github.com/h11t-labs/lintje/compare/v0.8.1...v0.8.2
[0.8.1]: https://github.com/h11t-labs/lintje/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/h11t-labs/lintje/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/h11t-labs/lintje/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/h11t-labs/lintje/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/h11t-labs/lintje/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/h11t-labs/lintje/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/h11t-labs/lintje/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/h11t-labs/lintje/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/h11t-labs/lintje/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/h11t-labs/lintje/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/h11t-labs/lintje/releases/tag/v0.1.0
