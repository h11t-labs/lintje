# Lintje — design system

Lintje is de Rijkshuisstijl als web components, voor applicaties en websites van de
Rijksoverheid. Een dashboard is één toepassing ervan.

Dit document bevat de **uitgangspunten en de besluiten**: wat het ontwerp is, en waarom. Het
bevat geen maten. Elk soort feit heeft één plek:

| Feit | Plek |
|---|---|
| Een kleur, een maat, een duur | `src/tokens/tokens.css`, `src/tokens/themes.css` |
| Hoe één element eruitziet en zich gedraagt | zijn eigen `.css` en `.ts` in `src/` |
| De properties, events en slots van een tag | de broncode; de build leest de referentie daaruit |
| Hoe het eruitziet, in elke toestand, licht en donker, met die referentie | `examples/styleguide/` |
| De regels voor het wijzigen van de code | [`AGENTS.md`](../AGENTS.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md) |
| Wat onbeslist is of afwijkt | [`OPEN_ISSUES.md`](OPEN_ISSUES.md) |

Een besluit dat voor meer dan één element geldt, hoort hier. Een waarde niet: die hier herhalen
maakt een tweede bron die veroudert.

## Wat de Rijkshuisstijl geeft, en wat Lintje beslist

De Rijkshuisstijl geeft de kleuren, het lettertype, het logo met zijn lint, de iconenset en de
header van een overheidssite. Hij is geschreven voor communicatie, niet voor applicaties, dus het
meeste van wat een applicatie nodig heeft, staat er niet in.

Lintje beslist de rest, in de geest van de huisstijl: de tokenlagen, de donkere modus, de
thema's van organisaties, beide navigatie-indelingen, de bedieningselementen en hun toestanden,
tabellen, grafieken, feedback, en hoe alles verandert op een telefoon. Waar de huisstijl en WCAG
AA het oneens zijn, wint AA met de kleinste correctie (zie [Toegankelijkheid](#toegankelijkheid)).

## Principes

1. **Functioneel, niet decoratief.** Vierkante vormen, ingetogen randen, vlakke oppervlakken.
   Geen verlopen, geen glas, geen zwevende widgets, geen afgeronde kaarten.
2. **Kleur is nooit de enige drager van betekenis.** Naast een kleur staat altijd een glyph, een
   getal of een woord.
3. **Staat wordt in woorden gezegd.** Een status heeft een label, een filter een zin, een fout een
   melding die de uitweg noemt.
4. **Een pagina componeert; ze vormt niet.** Een pagina die er anders uitziet dan de rest, is
   fout. Een nieuw patroon komt in het design system, met tokens, toestanden en een plek in de
   styleguide.
5. **Van alles één.** Eén set iconen, één schaal van maten, één popover, één manier om een fout te
   tonen. Een tweede component met dezelfde betekenis is een bug.
6. **De host bezit de staat.** Een element haalt nooit iets op, leest nooit de URL en houdt nooit
   een timer voor de server bij. Een verzoek vertrekt als event; de host antwoordt door een
   property te zetten.
7. **Beide modi, elk thema, elke breedte.** Niets is ontworpen voor alleen licht, desktop en één
   organisatie.

## Kleur

**Drie groepen.** *UI*-kleur volgt het thema. *Data*kleur en *status*kleur zijn vaste
Rijkshuisstijl: dezelfde in licht, in donker en in elk thema, zodat een grafiek of een
waarschuwing hetzelfde leest waar die ook staat.

**Drie lagen, in één richting.** Een component noemt een *component*- of *semantisch* token
(`--color-*`), dat zegt wat een kleur betekent. Die wijzen naar *primitieven* (`--neutral-*`,
`--data-*`, `--status-*`, `--ink-*`, `--primary`, `--accent`), de enige plek waar een
kleurliteral staat. Een component noemt nooit een primitief en schrijft nooit een literal. Om een
kleur in beide modi te veranderen, verander je de primitief; in één modus laat je de semantische
naam ergens anders naar wijzen.

### Thema's

Een thema is de kleur van een organisatie. Het zet **twee properties en verder niets**: `--primary`
en `--accent`. Al het andere dat een thema verandert, is daarvan afgeleid, met `color-mix()` en
OKLCH.

- **Een host voegt een thema toe zonder een component aan te raken**: één blok van die twee
  properties ([Tokens, thema's, modus en het embleem](guides/theming.md#het-thema)).
- **Het thema komt uit de configuratie van de host**, als `data-theme` op het document, nooit uit
  URL-staat.
- **`themes.css` blijft op documentniveau** en wordt nooit in een shadow root geadopteerd. Elk
  element adopteert `tokens.css` op zijn eigen host, dus een token dat daar gedeclareerd is, zou
  het geërfde thema verslaan. De properties van het thema staan daarom alleen in `themes.css` en
  erven naar binnen.
- **De standaard primaire kleur is donkerblauw, niet lintblauw.** Het lint is lintblauw; op een
  menu van hetzelfde blauw verdwijnt het. De navigatiebalk is het menu, een kwartslag gedraaid:
  dezelfde kleuren.

### Donker

**Licht is de koelgrijze reeks van rijksoverheid.nl.** Gedempte tekst neemt de stap die 4.5:1
houdt op het subtiele oppervlak, niet de stap die de reeks "500" noemt.

**De hover is donkerder in licht en lichter in donker.** In licht draagt hij witte tekst en houdt
een donkerdere vulling die tekst in elk thema op AA; in donker zou een donkerdere vulling
wegzakken in de pagina.

**Donker is geen inversie.** Het is de reeks van Logius: dezelfde voor elk thema behalve de
primaire kleur. Donker herdefinieert de zeven `--neutral-*` en laat de paar namen waarvan de
betekenis verandert ergens anders naar wijzen. Een losse donkere kleur wordt nooit geschreven.

Wit en bijna-zwart die in beide modi gelijk moeten blijven (tekst op een primaire knop, op het
menu, een QR-code), zijn `--ink-white` en `--ink-black`, geen neutralen. Een QR-code wordt in
donker nooit geïnverteerd: veel camera-apps lezen alleen donkere modules op een lichte rustzone.
De bibliotheek maakt de code zelf (de generator van Nayuki, meegeleverd), zodat elk deelmenu hem
heeft zonder werk van de host.

**In donker splitst themakleur zich in drieën naar wat ze moet doen**, omdat de
contrastondergrenzen verschillen:

| Gebruik | Token | Ondergrens |
|---|---|---|
| Een vulling met witte inhoud erop | `--color-accent` (de primaire kleur zelf) | — |
| Een lijn: omlijning, geselecteerde rand, ring, baan van een schuifregelaar; ook de stip van een radio, die zonder witte inhoud op het oppervlak staat | `--color-accent-line` | 3:1 (WCAG 1.4.11) |
| Een woord, of een icoon dat ervoor in de plaats staat | `--color-accent-text`, `--color-link` | 4.5:1 (WCAG 1.4.3) |

In licht zijn alle drie de primaire kleur. De lijntint is per constructie 3:1, dus **een woord
wordt nooit getekend in `--color-accent-line`**.

**Een tint voor de donkere modus tilt alleen de waargenomen lichtheid op** (OKLCH): hij houdt de
eigen kleurtoon en chroma van de kleur, zodat hij leest als de primaire kleur, niet als
grijsblauw. Eén lichtheid per ondergrens, de kleinste die er in elk thema overheen komt, zodat
een tint even licht is wat de primaire kleur ook is; een kleur die al lichter is, houdt zijn
eigen. De statustekens en het woord en de rand van gevaar tillen op dezelfde manier op. De
tintladder van de datakleuren blijft een aandeel wit: dat is die van de Rijkshuisstijl zelf.

Vijf gevolgen:

- **Het menu in donker is de stap onder de pagina**: bijna-zwart en neutraal, hetzelfde in de
  rail en in de balk, zodat het een eigen band is naast de pagina en onder de logobalk; hover en
  actief van een item zijn een stap hoger. Pagina en tegels delen daar het oppervlak, en de rand
  scheidt ze; in licht is de pagina een stap onder het oppervlak.
- **Elke primaire vulling tekent een rand in `--color-action-primary-border`.** Onzichtbaar in
  licht; in donker het enige dat het vak een rand geeft.
- **Een woord op een statusoppervlak neemt `--color-link-on-status`**: geen tint van de primaire
  kleur haalt daar 4.5:1.
- **Een ondergrond die een veld, een knop of een paneel draagt, is `--color-bg-inset`**: een stap
  onder het oppervlak in beide modi, zodat wat erop staat ook in donker lichter is. Een rustige
  vulling onder alleen tekst of een icoon (een chip, een groepskop, code) is `--color-bg-subtle`
  en gaat in donker een stap omhoog.
- **De filterzone onderscheidt zich in beide modi als band van de pagina**, en haar velden een
  stap onder de zone.

**Het lichte oppervlak van de primaire kleur is één waas, vast in waargenomen lichtheid**
(`--primary-wash`, in OKLCH): even licht in elk thema, in de eigen kleurtoon van de primaire
kleur, onder de hero en achter een term. Een aandeel wit in sRGB valt per thema lichter of
donkerder uit en maakt een donkere primaire kleur grauw. In donker ligt de waas halverwege tussen
het menu en de pagina, onder de pagina zoals in licht, zodat een paneel of een tab die op de
hero staat lichter is dan de hero, zoals in licht; het vak van een term is daar het subtiele
oppervlak.

### Datakleuren

Eén kleur per variabele, genoemd naar de Rijkshuisstijlkleur die het is (`sky-blue`,
`dark-yellow`, `red`, `green`, `mint-green`, `violet`, `orange`, `pink`, `dark-green`, `purple`,
`ruby-red`, `yellow`, `dark-brown`, `brown`, `dark-blue`, `light-blue`, `moss-green`), nooit naar
letter of naar domein: welke variabele hemelblauw is, beslist de pagina.

- **De namen bestaan één keer**, in `src/tokens/colors.ts`. De unies van het contract, de
  accenten van een KPI, de kleurentabel van de grafieken en de reeksen van de kaart volgen eruit.
  De volgorde ligt vast en een kleur komt er alleen achteraan bij: op een kaart heeft elke kleur
  de vorm op haar plaats, en een ingevoegde kleur zou elke reeks erna van vorm laten wisselen.
- **Hemelblauw is de standaard.** Een figuur die geen kleur noemt, tekent in
  `--color-chart-default`, en de gedeelde tintladder (`--color-chart-tint-*`) is die van
  hemelblauw.

- **Vergelijking is altijd grijs; trend, drempel en doel altijd de nadrukkleur.**
- Vast is de kleur van een variabele. De grijzen (`--data-comparison`, `--data-other`), het
  raster en de nadrukkleur volgen de modus; geel als tekst heeft een eigen token
  (`--color-chart-dark-yellow-text`), omdat geel geen tekstkleur is.
- Elke datakleur heeft de tintladder van de Rijkshuisstijl. Een component leest er een van twee
  benoemde reeksen uit — *onderverdelingen van één variabele* (donkerste eerst) en *ordinale
  klassen* (lichtste eerst) — nooit direct een sport. Een kleur waar een animatie naartoe loopt,
  staat als literal in de tokens, niet als `color-mix()`: Chromium interpoleert naar een mix
  verkeerd. Daarom is de ladder van hemelblauw, waaruit de klassen van de kaart komen, uitgeschreven.
- **Een figuur die een kleur meebrengt, brengt haar tinten mee**: elke kleur heeft haar eigen
  componentladder (`--color-chart-<kleur>-tint-2` … `-5`) naast `--color-chart-<kleur>`.
- **De onderverdelingen spreiden over de ladder met hun aantal** (`tintsFor`): twee buren op de
  ladder lezen naast elkaar als één kleur, dus twee delen nemen de eerste en de vierde sport, vijf
  de hele ladder. Nooit lichter dan het aantal vraagt.
- Categorische kleuren alleen als de variabelen echt verschillende dingen zijn.
- **De sprekers van een opname zijn categorisch**: ze nemen hemelblauw, donkergeel, roze,
  mintgroen, violet en groen in volgorde van eerste optreden, daarna het grijs van "overig".
  Oranje valt af: dat is de focusring. Een spreker wordt altijd naast de kleur genoemd.

### Status en destructieve actie

Statuskleuren liggen vast. Elk heeft een achtergrondtint die over het oppervlak gemengd is, zodat
één declaratie beide modi dekt. Een teken op die tint neemt de lijnkleur van de status, die daar
in beide modi 3:1 haalt. Een actie die niet ongedaan kan worden, neemt de **foutkleur, nooit de
primaire kleur**. De kleur is de waarschuwing, niet de instemming: de actie vraagt nog steeds om
bevestiging in een dialoog.

De focusring heeft een eigen token en volgt noch het accent noch een status.

## Typografie

RijksSans, de variabele editie, uit de assets van RVO (`@nl-rvo/assets`); hoe een pagina de
bestanden serveert, staat in
[Tokens, thema's, modus en het embleem](guides/theming.md#het-lettertype).

- **Elke maat is in `rem`**, zodat de tekst een lezer volgt die de tekst van de browser vergrootte.
- **Tekst blijft op de ondergrens van de tekstschaal** (`--text-small`). Alleen een kort label dat
  een getal of teken bij iets groters benoemt — as- en datalabels, een teller, een
  schaalverdeling — mag een stap kleiner (`--text-axis`).
- Eén schaal, als `--text-*`-tokens. Cijfers zijn tabulair waar ze in een kolom staan of ter
  plekke veranderen.

Tekst die een host niet zelf schreef — gerenderde markdown, een notitie — gaat door
`lintje-prose`, dat de schaal op gewone tags legt, zodat een pagina nooit een kop opnieuw opmaakt
in haar eigen stylesheet. In prose begint een blok bij `h3`; `h1` en `h2` lezen hetzelfde, want de
pagina heeft de `h1` en de titel de `h2`.

## Ruimte, maat en vorm

- **Een schaal van 4 px** (`--space-*`). Niets krijgt ruimte buiten de schaal.
- **Vaste hoogtes zijn tokens**: rijen, balken, velden, knoppen, chips. Een bedieningselement
  naast een ander neemt de hoogte van dat andere.
- **Elk aanwijsdoel is minstens `--h-target`.** Een vak dat kleiner tekent, haalt dat via een
  transparant klikgebied, nooit via een grotere tekening. Twee uitzonderingen: een lijst
  tekstlinks (de kolommen van een footer), waarin elke link een regel tekst op de WCAG
  AA-ondergrens is (`--h-target-text`), zoals op rijksoverheid.nl; en een dichte rij keuzes — een
  dag in de datumkiezer, een optie in een keuzelijst, een rij in een boomstructuur — op
  `--h-option`.
- **Een grid van 12 kolommen.** De tussenruimte is gelijk aan de zijpadding van de pagina en de
  tekstinspringing van de balken erboven, zodat tegels uitlijnen met de tekst erboven.
- **De inhoud heeft een maximale breedte**, midden in de ruimte die het menu overlaat. Wat de
  pagina indeelt — de kleur van een balk, de lijn boven het vraagvak van het gesprek — loopt tot
  de randen; alleen wat erin staat, houdt zich aan die breedte.
- **Radius is 0.** Rond is alleen wat een cirkel ís: een stip, een radio, een schakelaar, een
  avatar, een teller, de laadring.
- **Schaduwen geven diepte aan en verder niets**: een vastgeplakte balk, een popover, het menu
  over de pagina. Alleen de gedefinieerde `--shadow-*`.

**Er is één dichtheid.** De huisstijl heeft geen compacte weergave; een pagina die meer op het
scherm nodig heeft, kiest wat ze toont, niet kleinere maten.

## Navigatie en shell

Eén shell rond elke pagina, die van een dashboard en die van een applicatie evengoed, in twee
indelingen, naar keuze van de host:

- **Links**: het menu naast de pagina, vastgezet of als rail die over de inhoud uitklapt. Onder
  1440 px is het altijd de rail.
- **Boven**: de header van de Rijkshuisstijl — de logobalk met het hele logo, en daaronder een
  navigatiebalk waarvan de groepen een submenu openen. De logobalk scrolt weg met de pagina; de
  balk eronder blijft bovenaan staan.

Besluiten die voor beide gelden:

- **De navigatiebalk is één rij.** Als de items niet passen, gemeten en niet per breakpoint,
  maken ze plaats voor één item, "Menu", waarvan het paneel het hele menu bevat. Een groep opent
  bij hover; "Menu" opent en sluit met een klik en leest "Sluiten" zolang het open is, zoals in de
  mobiele header. "Menu" draagt geen actief-markering: de pagina van de lezer zit er bijna altijd
  in.
- **De bovenbalk van de indeling Links houdt zijn gereedschap ook op één rij.** Zoeken,
  "Weergave" en "Delen" zijn knoppen met hun woord — zoeken met zijn toets, `/` — totdat zij en
  de naam niet passen, gemeten; dan zijn het de kale iconen van de navigatiebalk.
- **Onder 768 px draagt de header dezelfde iconen**, en zoeken, "Weergave" en "Delen" openen van
  onderen als sheets met de kop van de filtersheet — hun naam en een sluitknop — en zijn modaal
  zoals die. Het open menu draagt dan alleen zijn sluitknop. Als het gereedschap van de header
  niet past, gemeten, tonen "Filters" en "Menu" alleen hun glyph; hun woord blijft hun naam.
- **Het lint is de eenheid.** De logobalk en het logo zijn afgeleid van `--w-ribbon`.
- **Het embleem is het eigen bestand van het thema**, door de host genoemd en getekend zoals het
  bestand tekent. Zonder het bestand is een lege plek beter dan een gok. Eén uitzondering, die van
  de huisstijl zelf: in donker neemt een lintblauw lint de lichtere tint van de Rijkshuisstijl,
  alleen in het logo.
- **Niets anders staat in de logobalk**, met één uitzondering: de omgeving, buiten productie.
- **De omgeving wordt getoond in het accent van het thema**, niet in een statuskleur: het is geen
  waarschuwing.
- **Het menu naast de pagina tekent zijn eigen scrollbalk.** De balk van de browser is een
  vreemd licht vlak op het menu, en een gestileerde neemt breedte, zodat de vulling van de rijen
  de rand van het menu niet meer haalt. Een smalle duim over de rechterrand volgt de scrollpositie
  en is te slepen; hij verschijnt zacht als de aanwijzer op het menu staat, en meteen als de focus
  in de lijst staat. Een schermlezer hoort hem niet: toetsen en het wiel scrollen de lijst zoals
  altijd.
- **Onder 768 px is er geen rail**: een header met een Menu-knop, en het menu opent
  schermvullend. In de indeling Boven is die header een balk onder de logobalk, met de naam.
- **De shell bevat de pagina.** Zijn inhoud houdt zich aan de breedte en padding van de pagina;
  wat van rand tot rand loopt — een hero, de filterbalk, een gesprek — staat erboven.
- **De instellingen van de lezer zijn van de host**: modus, thema, waar het menu staat. De shell
  toont ze en vraagt om een wijziging; hij bewaart er geen en leest geen URL.
- **Een skiplink naar de inhoud is de eerste tabstop.**
- **De naam van de shell staat in een balk op één regel**, afgekapt met een beletselteken voordat
  hij de items eruit duwt.
- **Een startpagina mag openen met een hero** (`lintje-hero`): één band in de waas van de
  primaire kleur, zodat band en menu nooit samenvloeien. Eén per pagina, en nooit op een
  werkpagina dieper in. Zijn afbeelding ondersteunt de titel; ze is nooit een tweede weg verder en
  zegt nooit iets wat nergens anders staat.
- **Tabs komen in twee vormen.** Een rij boven de inhoud, de gekozen tab onderstreept; en grote
  tabs boven een omrand paneel, voor de paar modi waartussen een hele pagina wisselt: elk met een
  icoon en een hint, waarbij het eigen oppervlak van het paneel doorloopt in de gekozen, zonder
  lijn. Op een telefoon zet de grote tab zijn icoon boven zijn label en laat hij de hint weg.
- **Een submenu is typografisch** (`lintje-sub-nav`), naar de side-nav van de Rijkshuisstijl
  Community: links zonder vulling en zonder rand, de pagina van de lezer vet in de tekstkleur,
  groepen gescheiden door ruimte, nooit door een lijn.

**Modus heeft drie instellingen**: systeem, licht, donker. Systeem is de standaard en volgt
`prefers-color-scheme` live; hoe de host hem herleidt, staat in
[Tokens, thema's, modus en het embleem](guides/theming.md#modus).

## Elementen

Hoe elk element eruitziet en zich gedraagt, staat in zijn eigen bestanden en in de styleguide.
De besluiten hieronder gelden voor alle elementen.

### Bedieningselementen en formulieren

- **Elk bedieningselement kent dezelfde toestanden, op dezelfde manier getekend.** Een fout is een
  zwaardere rand in de foutkleur met een melding die aan het bedieningselement gekoppeld is;
  uitgeschakeld is het subtiele oppervlak. Een uitgeschakelde knop blijft focusbaar
  (`aria-disabled`); een uitgeschakeld veld valt uit de tabvolgorde.
- **Een waarde die afwijkt van haar standaard** draagt op elk bedieningselement twee markeringen:
  het label in de accentkleur en een oranje stip. Geen extra rand, geen gekleurd oppervlak.
- **Een veld legt vast als de lezer het verlaat of op Enter drukt.**
- **Een schakelaar is alleen voor direct effect**, nooit in een formulier. Uit is zijn baan
  gevuld in het grijs van de veldrand, niet bleek met een ring: de vulling alleen haalt 3:1.
- **Een instelling is een rij**: de naam in normaal gewicht en de uitleg eronder links, het
  bedieningselement rechts (`layout="row"`); de kop van de sectie erboven is de vette. De rij
  leest haar eigen breedte, dus ze stapelt op een telefoon en in een lade evengoed. Een instelling
  die afwijkt van haar standaard, is gemarkeerd en biedt haar weg terug ("Terugzetten naar …").
- **Een gekozen optie is rustig, niet gevuld.** In een rij opties neemt de gekozen de waas van de
  primaire kleur, een rand in de accentlijn en vette tekst; het gevulde oppervlak blijft voor de
  ene primaire actie, zodat een formulier nooit meerdere gevulde blokken boven zijn knop toont.
  Een rij die breder is dan haar ruimte, staat als kolom, elke optie een rij over de volle
  breedte; ze loopt nooit uit beeld.
- **Een opname die nu loopt, is de live-badge**: de foutvulling met een stip voor het woord, het
  enige rood dat geen fout is.
- **Wat op het punt staat te gebeuren, is een samenvatting in cellen** (`layout="grid"`): één cel
  per instelling, wat gewijzigd is in het rustige oppervlak van de gekozen optie met "Aangepast",
  een probleem in zijn statustoon met zijn glyph, zijn woorden en de actie die het oplost.
- **Een uitgeschakelde knop zegt waarom**: `reason` wordt met de knop voorgelezen; de host zegt
  het ook op de pagina.
- **Een naam wordt hernoemd waar hij staat.** De titel van een pagina toont een potlood als ernaar
  gewezen wordt of als hij focus heeft; een rij in een lijst verandert in haar veld met opslaan en
  annuleren. Geen dialoog voor één naam.
- **Opties die elk een regel nodig hebben, zijn kaarten** (`variant="cards"`): naast elkaar, de
  gekozen rustig zoals in de gesegmenteerde keuze.
- **Een dialoog met een formulier is smal** en zo hoog als zijn inhoud; een zin over het resultaat
  staat links in de voet, de knoppen rechts.
- **Een bezige knop houdt zijn breedte en zijn kleuren**; alleen de inhoud maakt plaats voor de
  ring.
- **Een limiet waarschuwt en blokkeert nooit**: een geplakte tekst komt er heel in.
- **Het concept van een formulier is van de lezer zelf**: alleen in de browser bewaard als de host
  erom vraagt, en nooit in de URL.
- **Een menurij kan een schakelaar zijn of één uit een keuze**: een schakelaar wordt gemarkeerd
  met een vinkje, één uit een keuze met het rondje van een radio, zoals in een formulier; een kop
  boven rijen noemt hun groep en staat aan de rand van het menu.
- **Een reeks hangt aan een rail**: vierkante tekens verbonden door een lijn, in de stepper en het
  activiteitenlog evengoed. In de stepper is de lijn doorgetrokken tot de huidige stap en
  gestreept daarna, zodat de weg die nog te gaan is nooit op kleur alleen rust.

### Feedback

- **Een fout in inhoud is altijd de melding**, nooit een eigen rood blok. De ene uitzondering is
  de videospeler: een mislukte laadpoging zegt dat op het beeld, waar de video zou staan, omdat de
  lichte vulling van de melding op het donker zou zweven.
- **Een melding is alleen een live-regio als de host dat zegt**: de host weet of het bericht
  nieuws is. Dan onderbreekt een storing en wachten de andere soorten hun beurt.
- **De actie van een melding staat naast de tekst waar de melding breed is**, en eronder waar ze
  smal is, zodat de volgende stap binnen bereik blijft zonder een eigen regel.
- **Wat vanzelf verdwijnt, is een toast; wat bij een veld hoort, is de foutregel van het veld.**
- **Een statusbericht draagt het eigen teken van de set voor zijn soort**, los op de tint in de
  lijnkleur van de status: een driehoek voor een waarschuwing, een cirkel met een kruis voor een
  storing of mislukking, het vierkant met *i* voor info en de cirkel met een vinkje voor ok. Een
  titel staat op een eigen regel naast het teken, de tekst eronder. De foutregel van een veld
  houdt de driehoek.
- **Laden houdt het vak.** Een skelet heeft de maat van waar het voor staat, zodat de pagina niet
  springt. Een deel dat al inhoud toont, houdt zijn hoogte tijdens een tweede ophaling, en een
  verversing waar niemand om vroeg, tekent geen skelet.
- **Leeg zegt waarom**, en noemt de uitweg in woorden. Er is geen opnieuw-knop op een tegel: die
  herlaadt met de pagina.

### Links, toetsen en overlays

- **Een knop die navigeert, is een link**: met een `href` tekent de knop een `<a>` in dezelfde
  vorm.
- **Een link is een link**: een echte `<a href>` die de browser volgt. Een gewone linkerklik wordt
  ook gemeld als `lintje-navigate`, en een host met een router annuleert dat event om de klik over
  te nemen. Een klik met een modificatietoets is van de browser.
- **Toetsen lopen via één register** (`src/core/shortcuts.ts`). Een toets is nooit de enige manier
  om iets te doen, en een toets zonder modificatietoets gaat nooit af zolang de focus in een veld
  staat. De eigen toetsen van een speler (spatie, de pijlen, F, C) werken alleen zolang de focus
  erin staat, buiten het register.
- **Een toets op het scherm wordt op één manier getekend**: `<kbd class="lintje-key">`, uit
  `components/shared/key.css`.
- **Escape sluit wat open is**, en in een popover alleen de popover.

### Werklijsten

- **Wat iemand maakte of liet maken, is één lijst**, in elke applicatie: vertaalde teksten,
  documenten, transcripties. Lopend en afgerond werk staan in dezelfde rij (`lintje-list`); de
  wachtrij (`lintje-job-list`) tekent die rij ook, zodat de twee nooit uit elkaar groeien.
- **Eén rij, altijd even hoog als de volgende**: de soort als icoon, de titel op één regel
  afgekapt met een beletselteken, één regel context (of wat te doen aan een mislukking), de staat
  als woord met een balk zolang hij loopt, het moment, en de acties. De titel is donker, niet de
  linkkleur: de rij is het doel, en een kolom blauw leest als een kolom links.
- **Eén actie in het zicht, de rest in het menu.** Wat een staat vraagt ("Annuleren", "Opnieuw")
  staat in de rij; verwijderen en dergelijke zitten achter de rustige ⋮. Afgerond werk vraagt om
  niets: de rij opent het resultaat, zonder "Openen" ernaast.
- **In een kader reiken de rijen tot de randen** (een `flush`-tegel): de kop van het kader noemt
  de lijst, de rijen houden de inspringing van de kop, en de lijn van de laatste rij is de streep
  van de voetnoot.
- **"Klaar" alleen waar werk nog loopt.** In een lijst met alleen afgerond werk is de staat ruis.
- **Nieuwste eerst, gegroepeerd per moment** ("Vandaag", "Gisteren", "Eerder") waar de lijst lang
  is. Een register om te doorzoeken en te sorteren is een tabel, geen werklijst.

### Tabellen

- **Een kop heeft geen vulling**: een vulling is hoe een geselecteerde rij eruitziet.
- **Een rij is klikbaar of selecteerbaar**, nooit allebei. Een naam die zijn rij opent, maakt de
  rij niet klikbaar: de naam is de link, dus een selecteerbare tabel kan zijn rijen nog steeds
  openen. Een naam die opent, wordt niet in zijn cel bewerkt.
- **Rijacties zijn een rustige ⋮**: plat, zonder vak. Een vak in elke rij weegt zwaarder dan de
  data ernaast.
- **Op een applicatiepagina staat een tabel op de pagina**, zonder tegel: de kop of tab van de
  pagina noemt hem. In een dashboard blijft hij een tegel tussen tegels.
- **Pagineren is plat, zoals op rijksoverheid.nl**, gecentreerd onder wat het pagineert: de
  nummers in de linkkleur zonder vak, de huidige pagina het ene gevulde vierkant, "Vorige" en
  "Volgende" woorden met een chevron. Waar de woorden niet passen, blijven alleen de chevrons; het
  woord blijft de naam. Aan beide uiteinden blijft de stap staan, uitgeschakeld, zodat de rij niet
  verschuift.
- **Een brede tabel scrolt binnen zijn vak**, met een schaduw waar kolommen verborgen zijn.
- **Een kolom kan haar waarden afkappen** (`truncate`): één regel met een beletselteken, zo breed
  als haar langste waarde tot een grens, zodat één lange toelichting de tabel niet breder maakt.
  Zoals elke afgekapte tekst staat de hele waarde in de tooltip en loopt ze door onder de focus
  van het toetsenbord en zonder hover; onder 768 px kapt niets af.
- **Een verandering kan alleen haar pijltje tonen** (`change-compact`): ▲ ▼ ● in de kleur van de
  verandering, voor een smalle kolom. Wat het oog ziet en wat een schermlezer hoort, zijn dan twee
  kopieën: de getekende is verborgen voor de schermlezer, een visueel verborgen kopie draagt de
  hele waarde. Als enige meetwaarde van een rij onder 768 px staat de verandering er heel.
- **Onder 768 px wisselt een tabel van vorm**: de identiteit van de rij en één meetwaarde, met de
  andere kolommen op verzoek onder de rij (zie [Toegankelijkheid](#toegankelijkheid)). Geen
  rijkaarten, geen zijwaarts scrollen.

### Afbeeldingen en kaarten

- **Een schermafbeelding wordt heel getoond, nooit bijgesneden**; alleen een miniatuur in een
  galerij (`lintje-gallery`) toont haar linkerbovenhoek.
- **Een kaart is één item van een collectie** (`lintje-card`), vierkant en plat, zonder schaduw;
  een kaart die een link is, reageert op de aanwijzer zoals een lijstrij. Zonder afbeelding is ze
  korter, nooit een grijs vak.
- **Rijen data die items vergelijken, zijn een tabel**, geen kaarten.

### Gesprek

- **Een antwoord is een lijst blokken die al bestaan** — lopende tekst, cijfers, een grafiek, een
  tabel. Het gesprek voegt geen eigen visueel patroon toe.
- **Gestreept is een suggestie, doorgetrokken is een keuze.** Een gestreepte omlijning is iets wat
  de lezer zou kunnen zeggen; een doorgetrokken omlijning is een antwoord waar de assistent op
  wacht. Een bijschrift zegt welke, zodat de lijnstijl nooit de enige drager is.
- **Niets wordt opgeslagen.** De host bezit het gesprek en het transport ervan.
- **Het gesprek scrolt mee met de pagina**, zoals alle inhoud. Het vraagvak blijft onderaan in
  beeld, en een lezer aan het eind blijft daar terwijl een antwoord groeit; wie omhoog scrolde,
  wordt niet verplaatst.

### Vertalen

- **Een tekst en zijn vertaling zijn één oppervlak van twee helften** (`lintje-translator`), geen
  twee velden. De vertaling volgt het typen: er is geen vertaalknop, en kopiëren is de ene
  primaire knop.
- **Het gereedschap bij een helft is plat**: icoonknoppen zonder vak, met hun naam als tooltip;
  een vak om elk zou zwaarder wegen dan de tekst. Alleen de wisselknop houdt zijn vak, omdat hij op
  de lijn tussen de helften staat.
- **Wat nu luistert of spreekt, is live**: de primaire vulling met bewegende balkjes naast het
  icoon (`live` op de icoonknop), en een label dat zegt hoe je het stopt.
- **Kaal is een variant, geen component** (`variant="plain"`): binnen zo'n oppervlak laten het
  veld en de streamende tekst hun eigen vak weg en nemen ze de typografie van het oppervlak over.

## Pagina's met cijfers

Deze gelden waar een pagina getallen toont die filters vernauwen: een dashboard, een rapport.

1. **Dicht, zolang de hiërarchie overeind blijft.** De lezer is een analist.
2. **Eén plek voor filters**: de filterbalk onder de titel. De balken erboven bevatten
   instellingen, nooit filters.
3. **De "Je ziet"-zin** zegt in woorden wat elk getal op de pagina betekent. Hij wordt gebouwd uit
   de gedeclareerde filters en verandert mee — een regel, geen optie.
4. **Filters zijn data.** De host declareert ze; de bibliotheek bezit geen filter en noemt geen
   domein.
5. **Een link delen is het beeld delen.** Alles wat de getallen verandert, gaat in de URL, en
   alleen waarden die afwijken van hun standaard. Een standaard staat nooit in de URL.
6. **Ontbrekende data is nooit nul.** Een ontbrekende waarde is `null` en wordt overgeslagen,
   gearceerd of afgekapt.

**De filterbalk is in rust dicht**: wat tijdens het lezen op de pagina staat, is de zin; de
bedieningselementen zijn er zolang de lezer kiest, en verder scrollen sluit ze. Op een telefoon
zijn de filters een sheet, en wijzigingen gelden pas bij "Toepassen".

**De pijl van een KPI draagt de richting; de kleur bevestigt die alleen.** Waar stijgen slecht is,
draait de kleur om en de pijl niet.

**Het verloop in een KPI is een lijn met haar vlak, zonder assen** (`sparkline`): de eigen
waarden van de variabele, dus in haar kleur met haar lichtste tint eronder, nooit de nadrukkleur.
Ze schaalt van de laagste tot de hoogste waarde, niet vanaf nul, want ze toont de beweging, niet de
hoogte; het cijfer ernaast is de hoogte. De laatste waarde is een punt, een ontbrekende waarde
breekt de lijn, en de beschrijving van de host is haar tekstalternatief, zoals bij een grafiek.

## Grafieken

Eén grammatica, geen grafiekbibliotheek.

- **Eén kleur per variabele**, met de tintladder voor de onderverdelingen. Vergelijking grijs;
  nadruk voor trend, drempel en doel.
- **De legenda staat boven de grafiek** en is klikbaar. Het symbool zegt welk teken het is: een
  vierkant voor een staaf of vlak, een lijn voor een lijn, gestreept voor een drempel of
  vergelijking.
- **De nullijn is donkerder dan het raster.**
- **Datalabels zijn alles of niets**: als er één niet past, toont de grafiek er geen, en de
  tooltip geeft nog steeds elke waarde.
- **Meten, niet rekken.** De tekening krijgt de maat van de gemeten breedte, zodat astekst zijn
  echte maat houdt in een smalle tegel.
- **Elke grafiek heeft een `<desc>`** met een leesbare samenvatting: het toegankelijke
  alternatief.
- **Hover verandert nooit de lengte die de waarde draagt.**
- **Een taart rangschikt en vouwt zelf.** Haar delen zijn de onderverdelingen van één variabele:
  de kleur van de spec, of hemelblauw. Het grootste deel is het donkerste, in welke volgorde de
  host ze ook stuurt, en de tinten spreiden over de ladder met het aantal delen. Meer dan vijf
  delen worden vier en één grijs "Overig" dat niet klikbaar is: een samengevoegd stuk heeft geen
  plek om naartoe te gaan. "Overig" en de rest van een geheel (`remainder`) zijn geen delen; ze
  staan achteraan, de rest het lichtst. De legendatabel volgt de getekende volgorde.

**Onvolledige perioden.** Een periode die nog loopt, is gearceerd. Als er nog veel van open is,
wordt de reeks afgekapt bij het laatste volledige punt en zegt een peilmomentlijn waar. De assen
houden de volledige periode en schaal, zodat de vorm herkenbaar blijft en een ochtend niet wordt
opgeblazen tot een piek.

**Klassen** (heatmap, choropleet) krijgen hun grenzen uit de getoonde data, afgerond op stappen
die een lezer herkent. Een host zet de grenzen vast als twee perioden op kleur vergelijkbaar
moeten zijn.

**Op een kaart is een reeks een kleur en een vorm**, en een selectie kan altijd ongedaan worden
gemaakt.

**Een kaart stapelt haar lagen en blijft één kaart.** De eerste laag ligt onder en de laatste
boven, en het toetsenbord volgt de stapel; een choropleet kleurt het land zelf en ligt daarom
altijd onderop. Er is één selectie over alle lagen, één legenda boven de kaart met een regel per
kleur, ook als die kleur in meer lagen dient, en linksonder een regel per laag met haar eigen
eenheid: een cijfer spreekt altijd de eenheid van zijn eigen laag. Een vlak dat niet in de
geometrie van de kaart staat, draagt zijn eigen omtrek en is verder een gebied: dezelfde klassen,
gearceerd zonder cijfer, en met focus een ring om zijn vorm, zoals een punt die krijgt.

## Iconen

- **Nooit een met de hand getekend icoon, nooit een bewerkt bestand.** De regels staan in de
  [projectregels](../AGENTS.md) (regel 11), de set in [`assets/README.md`](../assets/README.md).
- **Een naam zonder bestand tekent niets en het bedieningselement toont zijn Nederlandse label.**
  Dat is een ondersteunde staat: een host mag een bestand weglaten of vervangen en het
  bedieningselement blijft zeggen wat het doet. De bekende gaten in de set staan in
  `OPEN_ISSUES.md`.

## Responsief gedrag

Vier breedtes zijn ontworpen en getest: desktop (vanaf 1440), 1024, 768 en 390 px.

**Onder 768 px wisselt een onderdeel van vorm; het stapelt niet alleen.** Dat geldt voor de
navigatie (header en schermvullend menu), de filters (een sheet), de KPI-rij, de tabel
(identiteit en één meetwaarde) en de heatmap. Tussen de breedtes lopen bedieningselementen door
naar een volgende regel; ze overlappen nooit.

## Beweging

- **Twee curves**: wat binnenkomt, vertraagt; wat vertrekt, versnelt.
- **Eén duur voor interfacebeweging** (`--dur-base`). Elk onderdeel heeft een eigen token dat
  ernaar wijst, zodat er één kan veranderen zonder een component aan te raken. Hoverfeedback is
  korter; databeweging (een grafiek intekenen, een waarde optellen) is langer.
- **Een teller van ongelezen springt erin als hij verschijnt**, voorbij zijn maat en terug. Een
  nieuw getal in een teller die al getoond wordt, schuift omhoog naar binnen, zoals een KPI-tegel
  doet.
- **Data tekent één keer in**, als de grafiek in beeld komt; terugscrollen speelt het niet
  opnieuw af.
- **Een keuze beweegt mee**: het vinkje van een checkbox groeit in bij aanvinken en krimpt weg bij
  uitvinken, op de duur van hoverfeedback.
- **De focusring is nooit geanimeerd.**
- **Verminderde beweging laat niets weg, alleen de beweging.**

## Toegankelijkheid

WCAG AA is de ondergrens, ook waar de huisstijl anders suggereert: houd de identiteit, maak de
kleinste correctie, en leg die hier vast.

- Eerst semantische HTML: `nav`, `main`, `table` met `th` en `scope`, `dl` voor definities.
- **Focus is `--color-focus`, `--focus-width` breed, buiten de rand** — binnen (`focus-inset`)
  alleen waar buiten zou worden afgesneden. Op de eigen vulling van het thema (het menu in licht)
  is de ring wit; op de waas van de hero in licht neemt hij de tekstkleur, omdat oranje daar geen
  3:1 haalt.
- **Een veld is verplicht tenzij het anders zegt**: de optionele zijn gemarkeerd, "(niet
  verplicht)", binnen het label. Geen sterretje.
- **Eén `h1` per pagina**: de naam van de shell, ook onder 768 px. Een paginatitel is een `h2`,
  die van een tegel een `h3` ([Een eerste pagina](guides/start.md)).
- **Geforceerde kleuren zijn het palet van de lezer, geen thema**: een component tekent alleen
  opnieuw wat een vulling of een schaduw droeg, in systeemkleuren.
- Elke grafiek heeft een `<desc>`, elke tabel een `<caption>`.
- **Wat vaak verandert, wordt niet uit de lijst zelf voorgelezen.** Streamende tekst, een
  takenlijst en een waarde die optelt, worden uitgesproken vanuit een live-regio ernaast, in hele
  zinnen.
- Een waarde die animeert, houdt haar eindwaarde in de toegankelijkheidsboom.
- Tekst die met CSS `content` getekend wordt (een regelnummer, een placeholder), heeft een leeg
  alternatief, `content: … / ''`; wat een lezer ervan moet horen, staat in de markup
  (`aria-placeholder`).
- **Tekst die met een beletselteken is afgekapt, staat nooit alleen in een tooltip**: waar geen
  aanwijzer hem toont — onder 768 px, zonder hover, onder de focus van het toetsenbord — loopt hij
  door op een volgende regel.
- **Wat verdwijnt terwijl de focus erop staat, geeft de focus eerst door**: een toast terug naar
  waar hij vandaan kwam (anders `<main>`), een gesloten mededeling naar de volgende stop op de
  pagina, "Alles gelezen" naar de eerste melding.
- **Een sneltoets van één teken kan uit** (`/`, `?`): onder de lijst in `lintje-shortcuts`,
  onthouden per browser. Een combinatie met Ctrl, Alt of Cmd werkt altijd.
- **De popup van een veld sluit als de focus het veld verlaat**, zodat hij nooit het volgende veld
  bedekt; gesloten met Escape of met zijn eigen actie, geeft hij de focus terug aan het veld.
- De optie waarop de toetsen van een lijst staan (`aria-activedescendant`), draagt de focusring
  binnen haar rij: haar vulling alleen haalt ongeveer 1.1:1.
- **Een mark van een grafiek of kaart tekent na een klik geen kader.** Chromium geeft een
  SVG-element met `tabindex` zijn eigen outline, ook zonder `:focus-visible`; `:focus` zet die af,
  en de ring blijft die van het toetsenbord.
- **Een live-regio wordt leeg getekend en krijgt haar woorden een frame later** (tegel, laadring,
  toast): een regio die samen met haar tekst wordt ingevoegd, wordt niet voorgelezen.
- **Wat niet geopend kan worden, zegt dat in woorden**: een menurij zonder pagina of toegang
  draagt een verborgen "niet beschikbaar" of "geen toegang"; `aria-disabled` op een gewoon element
  zegt niets.
- **Een paneel met gereedschap is een disclosure, geen menu** ("Weergave", "Delen"):
  `aria-expanded` zonder `aria-haspopup`, Tab loopt erdoorheen en sluit het bij het verlaten, en
  Escape of een afgerond item geeft de focus terug aan zijn knop.
- **Escape geeft de focus alleen terug vanaf waar die was**: een paneel of submenu dat het sluit,
  zet de focus terug op zijn knop alleen als de focus erin of op die knop stond, nooit vanaf
  elders op de pagina.
- **Onder 768 px houdt de tabel elke kolom binnen bereik** (1.4.10): een rij toont haar identiteit
  en één meetwaarde, haar rijmenu, en een knop die de andere kolommen eronder opent als
  beschrijvingslijst; "Sorteren" sorteert op elke kolom. Een cel bewerken blijft voor de bredere
  tabel.
- **Een vastgeplakte balk bedekt nooit de focus** (2.4.11): de actiebalk van het formulier
  reserveert zijn hoogte als `scroll-padding-bottom` van de scroller, en de foutsamenvatting
  scrolt een veld naar het midden; de selectiebalk van de tabel scrolt een element waar de focus
  onder belandt ervan vrij. De vastgeplakte vraag en het vraagvak van het gesprek houden hun hoogte
  vrij als `scroll-padding` van de scroller, nooit lager dan wat een andere balk daar zette.
- **Een grafiek is ook met het toetsenbord te lezen.** Haar tekening neemt de focus en de
  pijltoetsen lopen langs de categorieën met de tooltip, die een live-regio uitspreekt; Escape
  verbergt een tooltip. De tekening is een afbeelding, of een groep met haar beschrijving als naam
  zodra een teken een knop is. Een teken met focus krijgt zijn ring buiten een opening van 1 px in
  het oppervlak, zodat een oranje teken zijn ring houdt. De nullijn, de arcering en de rand van
  een kaartgebied met een cijfer halen 3:1; aangrenzende tinten worden gescheiden door een lijn in
  het oppervlak; een donkergele lijn krijgt een rand in zijn tekstkleur; een label op een vulling
  neemt de tekstkleur van die vulling; een gedimd teken of een uitgeschakelde reeks vervaagt zijn
  kleur, nooit zijn woorden.
- **Een bewerking ter plekke houdt haar toetsen**: Enter en Escape tellen alleen in haar veld,
  niet op haar knoppen, en haar Escape beëindigt de bewerking en verder niets. Beëindigd, geeft
  ze de focus aan haar rij of cel.
- **Een element met een naam in eigen woorden houdt wat zijn label zegt**: een greep, knop of
  popup waarvan de naam als tekst wordt opgebouwd, draagt "(niet verplicht)" en het "afwijkend
  van standaard" van de stip zoals het label doet (`labelText` in
  `components/inputs/shared/input.ts`).
- **Een live-regio die zinnen uitspreekt, is `aria-atomic="false"`**: een nieuwe zin wordt los
  voorgelezen; vervangen tekst, niet voortgezet, wordt vanaf het begin uitgesproken.
- **Een zwevend paneel aan een knop sluit als de focus het verlaat** (een menu, de bel, de
  linkdialoog, Weergave en Delen, het kolomfilter en de kolomkiezer van een tabel): Tab voorbij
  zijn laatste stop sluit het en gaat verder vanaf zijn knop, een focus elders blijft daar, en een
  klik op wat erin geen focus neemt, houdt het open. Een popup-dialoog (het kolomfilter, de
  kolomkiezer) neemt bij het openen de focus naar zijn eerste veld, en Shift+Tab voorbij zijn
  eerste stop sluit hem ook. Escape in een popover is eerst van zijn element (een opgetilde greep
  zet zijn rij terug), dan van de popover.
- **Onder 768 px volgt de CSS van de shell en de tabel hun mediacontroller** (`is-phone`), niet
  een mediaquery: WebKit past een mediaquery in een shadow root na het verkleinen van het venster
  niet opnieuw toe, terwijl het sjabloon al op `MOBILE` wisselt.

**Correcties op de huisstijl.** De twee tinten van de primaire kleur in de donkere modus (zie
[Donker](#donker)); `--color-link-on-status`; de lijnkleur van een statusteken (`--color-*-line`),
de statuskleur bijgesteld naar 3:1 op haar eigen tint; de tekstkleur van een statuswoord
(`--color-error-text`, `--color-success-text`), bijgesteld naar 4.5:1 — lichter in donker, het
groen ook donkerder in licht; de eigen tekstkleur van donkergeel; tekst op de sequentiële reeks
vast op bijna-zwart of wit in beide modi.

**Geaccepteerde tekortkomingen.** Geen ervan draagt op zichzelf betekenis; elk gaat samen met een
glyph, een getal of een woord.

- De datakleuren rood, violet, donkergroen, paars, robijnrood, donkerbruin en donkerblauw halen
  geen 3:1 op het donkere oppervlak, paars daar nagenoeg niet zichtbaar; geel en lichtblauw
  halen geen 3:1 op het lichte. Geel heeft geen eigen tekstkleur en geen rand zoals donkergeel.
- De witte kapitalen van de omgevingsband op het accent van het thema halen geen AA in vijf van de
  zes thema's.
- In het thema `defensie` haalt de lijn onder een herkende term geen 3:1 in licht, en is ze
  hetzelfde oranje als de focusring.
- De omlijning van een zwevende sheet in donker haalt geen 3:1.
- In het thema `defensie` haalt alles wat in `--primary` tekent geen AA: witte tekst op het
  oranje van het menu en de footer is 3.2:1, onder de 4.5:1 die WCAG voor gewone tekst vraagt, en
  de tweede regel van het menu (82 % wit) 2.6:1; wit op de oranje vulling van de primaire knop, de
  huidige pagina van de paginering, de kopieerknop en de badge `busy` is 3.22:1 (de hover in
  donker 2.80:1); een link en accenttekst op wit zijn 3.22:1, en de gekozen optie van
  `lintje-segmented` 2.81:1. Het wacht op een donkerdere vulling voor dat thema.

De omgevingsband wacht op een ontworpen antwoord.

## Hergebruik, variant of nieuw

- **Hergebruik** als de betekenis en de vorm bestaan. Verreweg het vaakst.
- **Voeg een variant toe** — een property op de bestaande component — als de betekenis dezelfde
  is en de situatie verschilt: compact, een telefoon, een extra staat. Nooit een kopie onder een
  andere naam.
- **Bouw een nieuwe component** alleen als de betekenis nieuw is en meer dan één pagina hem nodig
  heeft. Hij gaat in `src/components/`, met tokens in plaats van vaste waarden, en in de
  styleguide.

Een primitief bestaat omdat meerdere componenten hem nodig hebben, niet omwille van de
abstractie.
