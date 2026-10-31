# Lintje — design system

Lintje is de Rijkshuisstijl als web components, voor applicaties en websites van de
Rijksoverheid. Een dashboard is één toepassing ervan.

Dit document bevat de **uitgangspunten en de besluiten**: wat het ontwerp is, en waarom. Het
bevat geen maten. Elk soort feit heeft één plek:

| Feit | Plek |
|---|---|
| Een kleur, een maat, een duur | `src/tokens/tokens.css`, `src/tokens/themes.css` |
| Wat een token betekent | zijn commentaar in `tokens.css`; de Fundament-pagina's van de styleguide citeren het |
| Hoe één element eruitziet en zich gedraagt | zijn eigen `.css` en `.ts` in `src/` |
| De properties, events en slots van een tag | de broncode; de build leest de referentie daaruit |
| Hoe het eruitziet, in elke toestand, licht en donker, met die referentie | `examples/styleguide/` |
| De regels voor het wijzigen van de code | [`AGENTS.md`](../AGENTS.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md) |
| Wat nog openstaat | de [issues op GitHub](https://github.com/h11t-labs/lintje/issues) |

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

### Twee huisstijlen, één schakelaar

De Rijkshuisstijl tekent online sinds 2025 anders dan eerst: een wit menu, kleine afgeronde
hoeken op knoppen en velden, de kop van de pagina als band in de primaire kleur, een donkere
focusring met een witte lijn erin, de foutmelding boven het veld. Lintje tekent beide, en de
host kiest met één attribuut op de pagina: `data-style-version="new"` op `<html>` tekent de nieuwe
huisstijl, zonder dat attribuut (of `data-style-version="classic"`) de eerdere. Elk element spiegelt de
waarde op zijn eigen host, zoals `data-mode`, zodat zijn stylesheet hem leest. **Tot 1.0.0 is de
eerdere huisstijl de standaard**, zodat een host die bijwerkt niets ziet veranderen; bij 1.0.0
wisselt de standaard naar de nieuwe.

Onder de schakelaar staat alles wat de nieuwe huisstijl anders tekent: het lichte menu en de
band in de primaire kleur als paginakop, de kleine hoek op knoppen en velden (`--radius-control`), de grote hoek van
een lade en een smalle band (`--radius-corner`), de focusring, de keuzerand en de veldrand in het accent, de koelgrijze sluier,
de typografische schaal van de paginatitel, de marges en de inhoudsbreedte, de vier kolommen op
een telefoon, de foutmelding boven het veld met de balk en de fouttint, de balk en de gekleurde
iconen op een statusblok, een waarschuwing in donkergeel, de kaderloze tertiaire knop, de uitklapper als accordeonrij, de koppen
en het citaat in lopende tekst, het pijlvak van de select, de regel en de chevrons van de voet,
de getinte paginering, het kruimelpad zonder de pagina zelf, de dialoogknoppen links zonder lijnen, het gevulde submenu, de paginakop
boven de filterbalk, en in donker het gespiegelde grijs. Wat beide delen, staat niet onder de
schakelaar: de overgang op elke hover, de hooks van een band, en
elke correctie. De grote hoek heeft zijn eigen schakelaar, alleen van betekenis in de nieuwe
huisstijl: `data-style-new-corner="square"` laat hem weg, zonder attribuut is hij rond.

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
- **De standaard primaire kleur is lintblauw in de nieuwe huisstijl, donkerblauw in de eerdere.**
  In de eerdere huisstijl is het menu gevuld in de primaire kleur, en het lint, dat lintblauw is,
  zou op een menu van hetzelfde blauw verdwijnen. In de nieuwe huisstijl (`data-style-version="new"`)
  is het menu wit (zie [Navigatie en shell](#navigatie-en-shell)) en staat het lint op wit; daar is
  de standaard de eigen kleur van de huisstijl, lintblauw (`themes.css`, zonder thema en bij
  `rijksoverheid`). De primaire kleur kleurt daar de band, de knoppen en de woorden in het menu.

### Donker

**Licht is de koelgrijze reeks van rijksoverheid.nl.** Gedempte tekst neemt de stap die 4.5:1
houdt op het subtiele oppervlak, niet de stap die de reeks "500" noemt. De filterzone is de
uitzondering: zij is echt grijs, omdat het blauw van de reeks op een band van die breedte als kleur
leest en niet bij elk thema past.

**De hover is donkerder in licht en lichter in donker.** In licht draagt hij witte tekst en houdt
een donkerdere vulling die tekst in elk thema op AA; in donker zou een donkerdere vulling
wegzakken in de pagina.

**Donker is het spiegelbeeld van licht, in neutraal grijs.** De volgorde keert om: in licht is
het oppervlak (een tegel, de logobalk, een licht menu) het lichtst en ligt de pagina een stap
eronder; in donker is het oppervlak het donkerst en ligt de pagina een stap erboven, de subtiele
vulling weer een stap hoger. Het gevulde menu van de oude huisstijl staat een stap onder het
oppervlak, zoals zijn blauw in licht een eigen band is. De tinten zelf zijn niet de omgekeerde
koelgrijsreeks van de huisstijl: die is blauwgrijs, leest op donkere waarden als marineblauw en
concurreert met de blauwe datakleuren van een dashboard, dus Lintje neemt de neutrale reeks van
Logius, dezelfde voor elk thema behalve de primaire kleur. Donker herdefinieert de zeven
`--neutral-*` en laat de paar namen waarvan de betekenis verandert ergens anders naar wijzen. Een
losse donkere kleur wordt nooit geschreven. De band in de primaire kleur (de hero, de paginakop
bij een licht menu) is in donker gedempt: op de lichtheid van de waas, een stap boven de pagina,
met meer van de tint van het thema erin dan de waas heeft (OKLCH houdt de tint, de verzadiging
is begrensd) en wit erop; op volle sterkte zou hij het enige felle vlak van de pagina zijn.

Wit en bijna-zwart die in beide modi gelijk moeten blijven (tekst op een primaire knop, op het
menu, een QR-code, het beeld van een video), zijn `--ink-white` en `--ink-black`, geen neutralen.
Een media-oppervlak heeft daarvoor een eigen token, niet dat van tekst op een lichte vulling. Een QR-code wordt in
donker nooit geïnverteerd: veel camera-apps lezen alleen donkere modules op een lichte rustzone.
De bibliotheek maakt de code zelf (de generator van Nayuki, meegeleverd), zodat elk deelmenu hem
heeft zonder werk van de host.

**In donker splitst themakleur zich in drieën naar wat ze moet doen**, omdat de
contrastondergrenzen verschillen:

| Gebruik | Token | Ondergrens |
|---|---|---|
| Een vulling met witte inhoud erop | `--color-accent` (de primaire kleur zelf) | — |
| Een lijn: omlijning, ring, baan van een schuifregelaar; ook de stip van een radio, die zonder witte inhoud op het oppervlak staat | `--color-accent-line` | 3:1 (WCAG 1.4.11) |
| Een woord, of een icoon dat ervoor in de plaats staat | `--color-accent-text`, `--color-link` | 4.5:1 (WCAG 1.4.3) |

In licht zijn alle drie de primaire kleur. De lijntint is per constructie 3:1, dus **een woord
wordt nooit getekend in `--color-accent-line`**. Een lijn op een vlak dat lichter is dan het
oppervlak (een gekozen rij, een actief menu-item, een term) neemt in donker de teksttint: de
lijntint haalt alleen op het oppervlak 3:1. Daarvoor zijn er `--color-selected-edge`,
`--color-nav-active-edge` en `--color-term-line`.

**Een tint voor de donkere modus tilt alleen de waargenomen lichtheid op** (OKLCH): hij houdt de
eigen kleurtoon en chroma van de kleur, zodat hij leest als de primaire kleur, niet als
grijsblauw. Eén lichtheid per ondergrens, de kleinste die er in elk thema overheen komt, zodat
een tint even licht is wat de primaire kleur ook is; een kleur die al lichter is, houdt zijn
eigen. De statustekens en het woord en de rand van gevaar tillen op dezelfde manier op. De
tintladder van de datakleuren blijft een aandeel wit: dat is die van de Rijkshuisstijl zelf.

Vijf gevolgen:

- **De volgorde van licht houdt in donker: menu onder pagina onder oppervlak.** Het menu is
  bijna-zwart en neutraal, hetzelfde in de rail en in de balk, zodat het een eigen band is naast
  de pagina en onder de logobalk; hover en actief van een item zijn een stap hoger. De pagina
  ligt halverwege het menu en het oppervlak, zodat een tegel, een band en de logobalk erop staan
  en niet alleen hun rand ze scheidt.
- **Elke primaire vulling tekent een rand in `--color-action-primary-border`.** Onzichtbaar in
  licht; in donker het enige dat het vak een rand geeft. De huisstijl zet een donkere primaire
  knop in donker om naar een lichte variant; Lintje houdt de vulling, met die lichtere rand die
  3:1 haalt, ook in het pijlvak van de select, zodat de primaire kleur in beide modi dezelfde
  blijft. Een bewust besluit.
- **Een veld staat in de nieuwe huisstijl in donker een stap boven de pagina** (`--color-bg-field`),
  zoals de huisstijl een donker veld tekent: het oppervlak ligt daar onder de pagina, en een veld
  erop zou als een gat lezen. In licht en in de eerdere huisstijl is het veld het oppervlak.
- **Een woord op een statusoppervlak of een getint vlak (de sprekertint van een fragment) neemt
  `--color-link-on-status`**: geen tint van de primaire kleur haalt daar 4.5:1.
- **Een ondergrond die een veld, een knop of een paneel draagt, is `--color-bg-inset`**: een stap
  onder het oppervlak in beide modi, zodat wat erop staat ook in donker lichter is. Een rustige
  vulling onder alleen tekst of een icoon (een chip, een groepskop, code) is `--color-bg-subtle`
  en gaat in donker een stap omhoog. Een hover is `--color-bg-subtle`, nooit `--color-bg-selected`:
  dat is voor een gekozen of aangevinkte toestand.
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
  De volgorde ligt vast en een kleur komt er alleen achteraan bij: op een kaart is de vorm op
  haar plaats het standaardpaar van elke kleur, en een ingevoegde kleur zou elke reeks erna van
  vorm laten wisselen.
- **Het paar kleur-vorm van een kaartreeks is een standaard, geen garantie.** Zonder stijl
  tekent een reeks de kleur van haar naam met de vorm daarvan; met een stijl (`seriesStyles`:
  een kleur, een vorm, of allebei) beslist de pagina, zoals ze beslist welke variabele hemelblauw
  is. Een stijl is er voor reeksen die alleen in vorm verschillen, in één neutrale kleur, waar
  de kleur anders een betekenis zou dragen die er niet is; het onderscheid blijft dan bij de
  vorm en de legenda (regel 13).
- **Hemelblauw is de standaard.** Een figuur die geen kleur noemt, tekent in
  `--color-chart-default`, en de gedeelde tintladder (`--color-chart-tint-*`) is die van
  hemelblauw. Een grafiek met meer dan één variabele noemt per reeks de kleur van haar variabele;
  zonder kleur waarschuwt `lintje-chart` in de ontwikkelbuild. Een vergelijking telt niet mee.

- **Vergelijking is altijd grijs; trend, drempel en doel altijd de nadrukkleur.** `neutral` is
  de rol van een reeks die in kleur niets draagt, zoals gelijkwaardige bronnen op een kaart: ze
  tekent datzelfde grijs en is nooit een nieuwe datakleur.
- Vast is de kleur van een variabele. De grijzen (`--data-comparison`, `--data-other`), het
  raster en de nadrukkleur volgen de modus; geel als tekst heeft een eigen token
  (`--color-chart-dark-yellow-text`), omdat geel geen tekstkleur is. "Overig" is in donker zo
  licht dat bijna-zwart erop 4.5:1 haalt, en een label op de rest van een geheel (`remainder`)
  neemt de tekstkleur.
- **Een lichte kleur krijgt als lijn of teken een rand in haar eigen donkere kleur**, zodat ze in
  licht 3:1 haalt op het oppervlak en op het land van de kaart; in donker smelt de rand weg in de
  kleur. Een vlak krijgt geen rand.
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
  Oranje valt af: dat is het accent en de aandachtsstatus. Een spreker wordt altijd naast de
  kleur genoemd.
  Het rondje van een spreker deelt zijn kleur met de golfvorm en het transcript.

### Status en destructieve actie

Statuskleuren liggen vast. Elk heeft een achtergrondtint die over het oppervlak gemengd is, zodat
één declaratie beide modi dekt. Een teken op die tint neemt de lijnkleur van de status, die daar
in beide modi 3:1 haalt. Een actie die niet ongedaan kan worden, neemt de **foutkleur, nooit de
primaire kleur**. De kleur is de waarschuwing, niet de instemming: de actie vraagt nog steeds om
bevestiging in een dialoog.

De focusring heeft eigen tokens en volgt noch het accent noch een status.

## Typografie

RijksSans, de variabele editie, uit de assets van RVO (`@nl-rvo/assets`); hoe een pagina de
bestanden serveert, staat in
[Tokens, thema's, modus en het embleem](guides/theming.md#het-lettertype).

- **Elke maat is in `rem`**, zodat de tekst een lezer volgt die de tekst van de browser vergrootte.
- **Tekst blijft op de ondergrens van de tekstschaal** (`--text-small`). Alleen een kort label dat
  een getal of teken bij iets groters benoemt — as- en datalabels, een teller, een
  schaalverdeling — mag een stap kleiner (`--text-axis`). Secundaire tekst — een hint, een
  onderregel, een metaregel — is dat ene token, met één regelhoogte, zodat twee hints onder
  elkaar nooit verschillend lezen.
- **Eén schaal, die van de huisstijl**: 12, 14, 16, 20, 24, 32, 40, 48 en 64 px, als
  `--text-*`-tokens in rem; 28 en 18 staan er niet in. De namen volgen de hiërarchie van de
  pagina (de `h1` van de pagina, de `h2` van een titel, de titel van een tegel), niet een tag.
  Cijfers zijn tabulair waar ze in een kolom staan of ter plekke veranderen.

Tekst die een host niet zelf schreef — gerenderde markdown, een notitie — gaat door
`lintje-prose`, dat de schaal op gewone tags legt, zodat een pagina nooit een kop opnieuw opmaakt
in haar eigen stylesheet. De zes kopniveaus lopen af over de schaal, zoals de huisstijl ze tekent:
40, 32, 24, 20, 16 en 16 px; een blok dat onder de titel van een pagina staat, begint bij `h3`,
want de pagina heeft de `h1` en de titel de `h2`. De koppen staan in de primaire kleur, zoals de
huisstijl ze zet (de teksttint, want een kop is een woord). Een citaat is het kader van de
huisstijl: twee lijnen in de accentlijn, boven en links, met de ene afgeronde hoek waar ze elkaar
raken, en eronder de bron achter een streepje (`<cite>` of `<footer>` in het `<blockquote>`).

## Ruimte, maat en vorm

- **Een schaal van 4 px** (`--space-*`). Niets krijgt ruimte buiten de schaal.
- **Vaste hoogtes zijn tokens**: rijen, balken, velden, knoppen, chips. Een bedieningselement
  naast een ander neemt de hoogte van dat andere.
- **Elk aanwijsdoel is minstens `--h-target`.** Een vak dat kleiner tekent, haalt dat via een
  transparant klikgebied, nooit via een grotere tekening. Drie uitzonderingen: een lijst
  tekstlinks (de kolommen van een footer), waarin elke link een regel tekst op de WCAG
  AA-ondergrens is (`--h-target-text`), zoals op rijksoverheid.nl; een dichte rij keuzes — een
  dag in de datumkiezer, een optie in een keuzelijst, een rij in een boomstructuur — op
  `--h-option`; en een strook tussen twee panelen, waarvan het klikgebied over de randen van de
  panelen valt: een vinger krijgt daar de AA-ondergrens, een muis alleen de strook, omdat een
  breder gebied de inhoud en de scrollbalk van de panelen afdekt.
- **Een grid van 12 kolommen, met de maten van de huisstijl.** Op een desktop een buitenmarge
  van één lint en een goot van een halve lint; op een tablet beide een halve lint; op een
  telefoon een marge van 20 px, vier kolommen en een goot van 12 px (de stap van de schaal het
  dichtst bij de 10 px van de huisstijl). Een item neemt op een telefoon alle vier de kolommen,
  tenzij `span-mobile` er minder noemt, zoals een postcode en een huisnummer naast elkaar; de
  kerncijfers staan er vanzelf twee naast elkaar. In de oude huisstijl stapelt een telefoon in
  één kolom. De balken boven de pagina springen even ver
  in als de inhoud, zodat tegels uitlijnen met de tekst erboven.
- **De inhoud heeft een maximale breedte**, midden in de ruimte die het menu overlaat. Wat de
  pagina indeelt — de kleur van een balk, de lijn boven het vraagvak van het gesprek — loopt tot
  de randen; alleen wat erin staat, houdt zich aan die breedte.
- **De inhoud is hoogstens 1280 px breed**, zoals de huisstijl, behalve op een pagina met cijfers
  (1600 px, zie [Pagina's met cijfers](#paginas-met-cijfers)); een host die anders wil, zet
  `--lintje-content-width`.
- **De hoeken zijn klein, in de nieuwe huisstijl, en alleen op wat je bedient.** De huisstijl
  tekent online knoppen en velden met vier kleine afgeronde hoeken, en zo tekent Lintje onder
  `data-style-version="new"` elke knop (ook de icoonknop, de segmenten en de schakelgroep in de
  balk), elk invoervak, het vinkje en de chips (`--radius-control`, 4 px). Een omkaderd blok (een
  kaart, een tegel, een kerncijfer, een dialoog, een melding) blijft recht (`--radius`, 0), zoals
  de huisstijl een melding en een venster tekent. In de eerdere huisstijl staan beide op 0.
  Nooit groter dan de kleine hoek. Rond is alleen wat een cirkel ís: een stip, een radio, een
  schakelaar, een avatar, een teller, de laadring.
- **De ene afgeronde hoek loopt nooit van de pagina af.** De vormtaal van de huisstijl is een
  rechthoek met één afgeronde hoek: hoogstens drie per beeld, spaarzaam, nooit een vlak met een
  hoek in een vlak met een hoek, en nooit op een vlak dat van de pagina afloopt. De band aan de kop
  van de pagina (de hero, de paginakop bij een licht menu) en de voet lopen van rand tot rand, en
  zijn dus recht: dat ze de volle breedte nemen, weegt zwaarder dan de hoek. In de nieuwe
  huisstijl draagt een lade de hoek, een lint groot (`--radius-corner`, 48 px), aan de vrije kant
  bovenaan, en een band die met `narrow` binnen de marges staat, rechtsboven;
  `data-style-new-corner="square"` laat hem weg. De andere uitzondering is het
  citaat in lopende tekst: als citaat-element heeft het zijn eigen hoek van 24 px
  (`--radius-quote`), de hoek van de huisstijl als aanhalingsteken.
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

- **Het menu is gevuld in de themakleur, of licht; de huisstijl kiest, of de host.** Gevuld is
  de eerdere huisstijl: de rail en de navigatiebalk in de primaire kleur, met witte tekst. Licht
  is de nieuwe, en een host kiest zelf met `nav-tone` op de shell. Licht is
  de navigatiebalk zoals de huisstijl hem tekent en de side navigation van Mijn Omgeving: het
  oppervlak met een lijn eronder of ernaast, de woorden in de tekstkleur van het accent, een
  rij onder de aanwijzer gevuld in de primaire kleur met wit erop, de pagina van de lezer in de
  waas met de accentlijn als rand en vet, en in de balk onderstreept. Het is een tweede set
  waarden voor dezelfde menutokens, dus de rail, de balk en de mobiele header veranderen verder
  niet; de kop van de rail met het lint verandert in geen van beide. In donker is de lichte toon
  het spiegelbeeld van licht: de balk en de rail op het oppervlak, zoals de logobalk, een stap
  onder de pagina. Bij een licht menu verhuist de kleur naar de paginakop:
  `lintje-page-header` en `lintje-hero` in de shell worden dan vanzelf de band in de primaire
  kleur, recht van rand tot rand, en elke knop erop tekent zichzelf in zijn omgekeerde vorm; een
  host kiest daar niets voor, en een hero die de waas wil houden, zegt `tone="wash"`.
- **De navigatiebalk is één rij.** Als de items niet passen, gemeten en niet per breakpoint,
  maken ze plaats voor één item, "Menu", waarvan het paneel het hele menu bevat. Een groep opent
  bij hover; op een aanraakscherm opent een tik een groep en sluit een tweede tik hem. Een groep
  die een tik opende, sluit niet doordat de muis de balk verlaat; een groep die onder de muis
  openging wel. "Menu" opent en sluit met een klik en leest "Sluiten" zolang het open is, zoals in
  de mobiele header. "Menu" draagt geen actief-markering: de pagina van de lezer zit er bijna
  altijd in.
- **De bovenbalk van de indeling Links houdt zijn gereedschap ook op één rij.** Zoeken,
  "Weergave" en "Delen" zijn knoppen met hun woord — zoeken met zijn toets, `/` — totdat zij en
  de naam niet passen, gemeten; dan zijn het de kale iconen van de navigatiebalk.
- **Onder 768 px draagt de header dezelfde iconen**, en zoeken, "Weergave" en "Delen" openen van
  onderen als sheets met de kop van de filtersheet — hun naam en een sluitknop — en zijn modaal
  zoals die. Het open menu draagt dan alleen zijn sluitknop. Als het gereedschap van de header
  niet past, gemeten, toont "Menu" alleen zijn glyph; zijn woord blijft zijn naam.
- **Het lint is de eenheid.** De logobalk en het logo zijn afgeleid van `--w-ribbon`, en groeien
  dus samen mee met de tekstgrootte van de lezer. Het logo in het menu en in de mobiele header
  houdt de vaste maat van zijn balk.
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
  schermvullend. In de indeling Boven is die header een balk onder de logobalk, met de naam. De
  balk bovenaan is er altijd.
- **Tabs onderaan zijn een keuze van de host** (`mobile-tabs`): onder 768 px staan de losse
  pagina's dan als tabs onder de duim, ten hoogste vijf, met Menu als laatste. Het zijn dezelfde
  ingangen als de rail en de navigatiebalk, met dezelfde markering (de vulling en de lijn eronder,
  niet vet) en dezelfde badge, op de hoek van de glyph. Elk deel van de shell staat op één plek:
  wat `tab-parts` naar de tabs stuurt (standaard alleen Menu), staat niet ook in de balk. Wat
  geen tab is, zit in het paneel van Menu, dat boven de tabs opent; Menu is een knop en draagt
  nooit de markering. Een blad van de host bedekt de tabs, en zolang het toetsenbord open is,
  wijken ze. Een ingang met `action` opent iets van de host in plaats van een pagina.
- **De gebruiker heeft in elke indeling hetzelfde menu**: naam en rol met "Afmelden" als icoon
  ernaast, de rijen van de host en de versie. De avatar in de balk opent het naar beneden, de voet
  van het zijmenu naar boven, en op een telefoon staat het onderaan het menu. Met de pijltjes komt
  "Afmelden" na de rijen. Zolang het open is, blijft de rail uitgeklapt.
- **De shell bevat de pagina.** Zijn inhoud houdt zich aan de breedte en padding van de pagina;
  wat van rand tot rand loopt — een hero, de filterbalk, een gesprek — staat erboven.
- **De instellingen van de lezer zijn van de host**: modus, thema, waar het menu staat. De shell
  toont ze en vraagt om een wijziging; hij bewaart er geen en leest geen URL.
- **De voet is die van de huisstijl**: op de vulling van het menu, de regel die zegt wat de site
  is cursief in het gewone gewicht, kolommen met een vette kop en links met een chevron ervoor,
  en onder een lijn de vaste links. Een formulier of een taakpagina krijgt de compacte voet
  (`variant="compact"`): de regel en de vaste links op één rij, zonder kolommen, op het subtiele
  oppervlak (in de nieuwe huisstijl op de waas van de primaire kleur). De regel is 32 px en de
  koppen 20 px, een stap onder de maten van de huisstijl: de voet van een applicatie vraagt
  minder ruimte dan die van een site.
- **De taalkeuze staat aan het eind van de balk** (`lintje-language-nav`, in het slot `end`):
  een knop met de huidige taal en een pijltje, de talen in een lijst eronder met de taal van de
  pagina gevuld in de primaire kleur, elke taal in haar eigen `lang`. Een taal met een `href` is
  een link, zodat een pagina per taal zonder script werkt.
- **De logobalk en de mobiele header blijven onder de statusbalk van een telefoon**
  (`env(safe-area-inset-top)`): het lint begint onder de notch, zoals de huisstijl vraagt.
- **Een skiplink naar de inhoud is de eerste tabstop.**
- **De naam van de shell staat in een balk op één regel**, afgekapt met een beletselteken voordat
  hij de items eruit duwt.
- **Een startpagina mag openen met een hero** (`lintje-hero`): één band in de waas van de
  primaire kleur, zodat band en menu nooit samenvloeien. Eén per pagina, en nooit op een
  werkpagina dieper in. Zijn afbeelding ondersteunt de titel; ze is nooit een tweede weg verder en
  zegt nooit iets wat nergens anders staat.
- **De paginakop mag een band in de primaire kleur zijn** (`lintje-hero tone="primary"`), zoals
  de huisstijl hem op de sites van de Marechaussee en het RIVM tekent: kruimelpad, titel en
  inleiding in wit op de primaire kleur, van rand tot rand en recht. Met `narrow` staat de band
  binnen de marges, in de kolom van de inhoud, en draagt hij in de nieuwe huisstijl de ene hoek
  rechtsboven (`--radius-corner`, op een telefoon een halve lint); dat kan alleen een band die
  minstens drie keer zo hoog is als de hoek. Waar wit op een lichte primaire kleur geen 4,5:1 haalt
  (het oranje van Defensie), is de tekst bijna-zwart, zoals het omgevingslabel beslist. Dan is dat de ene band
  van de pagina: niet naast een hero in de waas, en klein naast een gevulde rail, anders vechten
  twee vlakken om de kleur.
- **Tabs komen in twee vormen.** Een rij boven de inhoud, de gekozen tab onderstreept; en grote
  tabs boven een omrand paneel, voor de paar modi waartussen een hele pagina wisselt: elk met een
  icoon en een hint, waarbij het eigen oppervlak van het paneel doorloopt in de gekozen, zonder
  lijn. Op een telefoon zet de grote tab zijn icoon boven zijn label en laat hij de hint weg.
- **Een submenu is de side navigation van de huisstijl** (`lintje-sub-nav`): links in de
  linkkleur zonder rand, de pagina van de lezer vet op de waas van de primaire kleur, een rij
  onder de aanwijzer gevuld in de primaire kleur met wit erop, groepen gescheiden door ruimte,
  nooit door een lijn.
- **"Op deze pagina" is het submenu, geen eigen element**: dezelfde rijen, met ankers naar de
  koppen van een lange pagina, en met `expanded`, zodat elk niveau er staat en de lijst niet
  verspringt terwijl ze gelezen wordt. De host vult de ankers, volgt het scrollen en zet de
  sectie in beeld als `active`, en plaatst de lijst: vanaf 1024 px plakt ze naast de tekst,
  onder de balk van de shell, en smaller staat ze erboven
  ([Een inhoudsopgave op de pagina](guides/page-contents.md)).

**Modus heeft drie instellingen**: systeem, licht, donker. Systeem is de standaard en volgt
`prefers-color-scheme` live; hoe de host hem herleidt, staat in
[Tokens, thema's, modus en het embleem](guides/theming.md#modus).

## Basis, bouwsteen, samengesteld

Alles in Lintje staat in één van drie lagen. Een laag gebruikt alleen wat in haar eigen laag of
eronder staat.

| Laag | Wat het is | Waar |
|---|---|---|
| **Basis** | Wat geen tag is: de tokens met hun eigen drie lagen (zie [Kleur](#kleur)), de lettertypen, de iconen, en gedrag zonder eigen uiterlijk, zoals focus, plaatsen, sneltoetsen en opmaak | `tokens/`, `icons/`, `core/` en de `shared/`-mappen |
| **Bouwsteen** | Eén bedieningselement, één waarde, één stuk inhoud of één kader | elke tag die niet samengesteld is |
| **Samengesteld** | Ordent een verzameling van de host — rijen, reeksen, berichten, velden, de delen van een pagina — uit bouwstenen | `composite` in `src/categories.json` |

- **De toets is van buiten.** Zet je hem als één ding ergens in, dan is hij een bouwsteen, hoe hij
  van binnen ook getekend is: een multiselect tekent checkboxen en is één veld, een tegel houdt
  elke inhoud vast en is één kader. Ordent hij zelf een verzameling, dan is hij samengesteld.
- **Een bouwsteen bereikt nooit iets samengestelds**, ook niet via een bestand in diens map. Een
  samengestelde tag mag een andere bevatten: een antwoord in het gesprek toont een grafiek.
- **Een tag gebruikt een andere via zijn tag, zijn module of zijn stylesheet.** Een hulpbestand
  dat meer tags nodig hebben, staat in een `shared/`-map, nooit in de map van één van hen.
- **Een onderdeel heeft de laag van zijn ouder**: `repeater-row` die van `repeater`, `filter-zone`
  die van `filter-bar`.
- **De laag is een label, de categorie de indeling.** Je zoekt een tag op wat hij doet, dus een
  veld staat bij de velden, welke laag het ook is. De stijlgids toont bij elke tag zijn laag,
  waaruit hij bestaat en waarin hij gebruikt wordt.
- **Een view is een rol, geen laag.** Een melding en een notitie zijn bouwstenen en toch een view
  die een host met `data` vult.

## Elementen

Hoe elk element eruitziet en zich gedraagt, staat in zijn eigen bestanden en in de styleguide.
De besluiten hieronder gelden voor alle elementen.

### Bedieningselementen en formulieren

- **Elk bedieningselement kent dezelfde toestanden, op dezelfde manier getekend.** Een fout is
  de melding boven het bedieningselement, gekoppeld aan dat element, zoals de huisstijl het veld
  opbouwt: label, toelichting, foutregel, dan het veld. In een rij staan de vakken van de velden
  op één lijn: een toelichting boven het ene veld tilt zijn label, niet de vakken ernaast. Een
  keuzelijst vult haar kolom zoals een tekstveld, tot `--w-field`. Het hele veld krijgt een balk links in de
  foutkleur (2 px, fijner dan de balk van een statusblok), en een invoervak een rand van 1 px in
  de foutkleur met de fouttint als vulling, zoals de huisstijl het tekent; in de eerdere huisstijl
  een zwaardere rand van 2 px zonder balk. Uitgeschakeld is het subtiele oppervlak. Een uitgeschakelde knop blijft focusbaar
  (`aria-disabled`); een uitgeschakeld veld valt uit de tabvolgorde.
- **De toelichting en de foutregel van een keuze springen in tot de tekst van haar label**, bij
  een vinkje, een schakelaar en een optie in een groep, zodat ze niet lijken op de kop van de
  optie eronder; bij een losse keuze staan ze onder haar label, want die heeft geen label erboven.
  Onder het label van een veld staan ze tegen de rand, net als in een rij van een instelling,
  waar de labeltekst zelf links staat.
- **Een waarde die afwijkt van haar standaard** draagt op elk bedieningselement twee markeringen:
  het label in de accentkleur en een oranje stip. Geen extra rand, geen gekleurd oppervlak.
- **Het vinkje en de radio hebben een rand van 1 px in de accentlijn**, zoals de huisstijl ze in
  lintblauw tekent; het label van een veld staat vet op de bodygrootte, en het kruimelpad ook.
- **Een keuzelijst draagt het pijlvak van de huisstijl**: aan het eind van het veld, binnen zijn
  rand, een vak in de primaire kleur met het witte teken; uitgeschakeld grijs, zoals het veld.
- **Een veld legt vast als de lezer het verlaat of op Enter drukt.**
- **Een vaste toevoeging aan een veld staat in een eigen vak** (een valutateken, een domein, een
  eenheid, een vast voorvoegsel): het gedempte oppervlak met een lichte lijn naar de invoer, zodat
  wat vaststaat apart staat van wat de lezer typt. Ze hoort nooit bij de waarde en beschrijft het
  veld voor een schermlezer. Eén knop in een veld is een secundaire knop aan het eind, zoals
  Tonen bij een wachtwoord; hij legt eerst vast wat getypt is, zoals Enter.
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
- **Een aantal bij een keuze is de tellerbadge achter het label**, in een tab en in een segment
  evengoed; nooit een getal in de tekst van het label.
- **Een opname die nu loopt, is de live-badge**: de foutvulling met een stip voor het woord, het
  enige rood dat geen fout is.
- **Wat op het punt staat te gebeuren, is een samenvatting in cellen** (`layout="grid"`): één cel
  per instelling, wat gewijzigd is in het rustige oppervlak van de gekozen optie met "Aangepast",
  een probleem in zijn statustoon met zijn glyph, zijn woorden en de actie die het oplost.
- **Een knop heeft de drie gewichten van de huisstijl.** Primair is gevuld, voor de ene
  hoofdactie; secundair is omlijnd in de primaire kleur, met onder de aanwijzer de waas; tertiair
  is alleen het woord in de primaire kleur, zonder kader, voor de derde actie in een rij (annuleren,
  wissen, de weg terug) en het gereedschap in een balk. Ingedrukt is elke knop een stap voorbij
  zijn hover. Op een themavulling (de band van een hero of van een paginakop) tekent elke knop
  zichzelf vanzelf omgekeerd, via de overervende `--lintje-button-*`-hooks die het vlak zet:
  primair wit met het woord in de primaire kleur, secundair wit omlijnd, tertiair een wit woord.
  Buiten zo'n vlak kiest een host die vorm zelf met `inverse` en `inverse-secondary`.
- **Een gesplitste knop is één knop: de menuknop met `split`**, nooit een eigen samenstelling van
  twee knoppen. De eigen helft doet de gewone actie, het pijltje opent de andere wegen ernaartoe:
  een menu met `items`, of zonder `items` de eigen inhoud als paneel, voor keuzes die geen actie
  zijn (hoe een bericht verstuurd wordt). Zo draagt hetzelfde element de export van de transcriptie
  en de verzendknop van het gesprek, met één bezige toestand en één manier van focus; een eigen
  tag zou de menuknop als tweede gesplitste knop laten staan. Alleen de buitenhoeken zijn rond, en
  tussen de helften staat een lijn in de inkt van het pijltje, niet een kier: een kier toont wat
  erachter ligt en leest alleen op een band als lijn. Met `action-disabled` is alleen de eigen
  helft uit, zodat een bericht dat nog niet weg kan zijn opties houdt; met `icon-only` is ze op
  een telefoon alleen haar icoon.
- **Een uitgeschakelde knop zegt waarom**: `reason` wordt met de knop voorgelezen; de host zegt
  het ook op de pagina.
- **Acties die niet op één regel passen, klappen in** naar één menu "Meer", vóór de acties die
  blijven staan; de laatste knop, de primaire, blijft altijd in het zicht. Gemeten, niet per
  breekpunt, zoals de navigatiebalk. De volgorde van de host is de prioriteit: de eerste knop gaat
  als eerste het menu in. Een menu met één rij bestaat niet: als één knop weg zou moeten, gaan er
  twee, en naast de primaire klapt een enkele knop nooit in. Dit is de algemene vorm van "Eén
  actie in het zicht, de rest in het menu" van de werklijst; de paginakop doet het.
- **Een naam wordt hernoemd waar hij staat.** De titel van een pagina toont een potlood als ernaar
  gewezen wordt of als hij focus heeft; een rij in een lijst verandert in haar veld met opslaan en
  annuleren. Geen dialoog voor één naam.
- **Opties die elk een regel nodig hebben, zijn kaarten** (`variant="cards"`): naast elkaar, de
  gekozen rustig zoals in de gesegmenteerde keuze.
- **Vinden is iets anders dan zoeken** (`lintje-find`). Zoeken stuurt een vraag weg en de host
  toont iets anders (`lintje-text-input type="search"`, `lintje-app-search`); vinden markeert een
  woord in wat al op het scherm staat en gaat langs de treffers, zonder iets weg te filteren. Wie
  alleen de treffers wil zien, kiest dat apart. De teller en vorige, volgende en wissen staan in
  het vak zelf, zodat typen niets eromheen laat verschuiven of groeien.
- **Een log volgt tot de lezer omhoog scrolt** (`lintje-log-viewer`): alleen omhoog scrollen
  stopt het volgen en alleen weer onderaan komen hervat het. Een balk onder het venster zegt altijd
  wat het doet, en telt wat er onder bijkwam. Een snelle stroom is geen live-regio: een eigen
  statusregio vat hoogstens eens per vijf seconden samen. Een regel zonder niveau krijgt er geen;
  het element raadt nooit. Leegmaken is alleen het venster, nooit de bron. Zijn filterrij leest
  haar eigen breedte: eerst klapt het niveau in tot een keuzelijst, pas daarna stapelt de rij en
  worden de drie knoppen één menu, zodat er nooit één knop alleen op een regel staat.
- **Een paar keuzes die allemaal in beeld blijven, zijn een groep vinkjes**
  (`lintje-checkbox-group`): één label, één hint en één foutregel voor de groep, zoals de
  radiogroep. Een lange lijst om in te zoeken is de multiselect.
- **Een eigen antwoord is een optie van de groep, met een veld eronder** (`other`): "Anders,
  namelijk" staat als laatste, en gekozen staat er een tekstveld onder, ingesprongen tot de lijn
  van de labels, zodat het leest als het vervolg van de keuze. Nooit een los veld van de host onder
  de groep. De tekst is een waarde naast de keuze (`<name>-other`) die blijft staan als de keuze
  weggaat, en de host controleert hem zoals elk veld. Een filter, een rij knoppen en kaarten hebben
  geen eigen antwoord.
- **Een tijd voor een afspraak is een optie in een dag** (`lintje-slot-picker`): de dagen naast
  elkaar, elke tijd een optie, de gekozen rustig zoals in een rij opties. Een optie die niet
  beschikbaar is, verdwijnt niet: ze blijft staan, uitgeschakeld, met het woord erbij ("Vol").
- **Een lade schuift van rechts in, of van links** (`side="left"`), in de nieuwe huisstijl met
  de ene hoek (`--radius-corner`) bovenaan aan de kant van de pagina, zoals de huisstijl een lade
  tekent; op een telefoon is ze schermvullend en zonder hoek.
- **De sluier onder een dialoog, een venster en een lade is het koelgrijs van de huisstijl op
  80 %** (Cool Gray 900); in donker is hij zwart op 60 %, omdat het koelgrijs een donkere pagina
  blauw kleurt. Het venster staat erop met zijn eigen oppervlak en rand.
- **Een dialoog met een formulier is smal** en zo hoog als zijn inhoud; de knoppen staan links in
  de voet, het antwoord eerst, zoals de huisstijl een dialoog tekent, en een zin over het
  resultaat erachter. De titel staat in de primaire kleur; het grote venster heeft geen lijnen
  tussen kop, inhoud en voet.
- **Een bezige knop houdt zijn breedte en zijn kleuren**; alleen de inhoud maakt plaats voor de
  ring.
- **Een limiet waarschuwt en blokkeert nooit**: een geplakte tekst komt er heel in.
- **Het concept van een formulier is van de lezer zelf**: alleen in de browser bewaard als de host
  erom vraagt, en nooit in de URL.
- **Een menurij kan een schakelaar zijn of één uit een keuze**: een schakelaar wordt gemarkeerd
  met een vinkje, één uit een keuze met het rondje van een radio, zoals in een formulier; een kop
  boven rijen noemt hun groep en staat aan de rand van het menu.
- **Een reeks hangt aan een rail**: vierkante tekens verbonden door een lijn, in de stepper, de
  tijdlijn en de stappen van de assistent evengoed. In de stepper is de lijn doorgetrokken
  tot de huidige stap en gestreept daarna, zodat de weg die nog te gaan is nooit op kleur alleen
  rust. Een stap kan eigen inhoud dragen, zonder vlak eromheen en zonder eigen kleur: in de kolom
  onder zijn kop, waar de rail langs doorloopt; in de rij en op een telefoon alleen die van de
  huidige stap, onder de rij of de balk.
- **Een tijdlijn is dezelfde rail, met de tijd erlangs**, en een logboek is een tijdlijn: wie
  deed wat, met het rondje van een persoon vóór de naam. De host bepaalt de volgorde, het oudste
  of het nieuwste boven; waar nu is, leest de tijdlijn uit wat gepland is of uit de tijden. Een
  moment staat aan één kant met de datum ervoor, om en om, of per kant met een naam erboven. Een
  moment heeft drie regels: boven de kop klein de datum en een label, dan de kop, en eronder de
  zin, een link en eigen inhoud van de host, zoals een badge. De datum staat altijd boven, of aan
  één kant in een kolom vóór de rail. Om en om schuiven de momenten
  in elkaar, maar een moment begint nooit vóór het vorige. Vandaag is een streep op de rail die de
  host noemt; daarna is de rail gestreept en is een teken hol. Het laatste moment dat geweest is,
  staat in de accentlijn. De rail van de tijdlijn weegt zwaar, met donkere tekens: wie een reeks
  leest, volgt de lijn. Een lange reeks krijgt koppen op de rail en toont eerst de momenten het
  dichtst bij nu; "Toon eerdere" staat waar de rest zit. Liggend staat elk moment op zijn plek in de tijd, met zijn
  label aan een steel boven of onder de rail; past een label niet tot het volgende, dan staat de
  tijdlijn. Op een telefoon staat alles aan één kant, de datum boven de kop.
- **Een kalender is één maandraster**, in de datuminvoer en de datumreeks evengoed: zoveel weken
  als de maand heeft, de dagen ernaast leeg, 1 px tussen de cellen, zodat twee gekozen dagen los
  van elkaar blijven. Vandaag is een ring in de accentlijn, nooit een statuskleur; een gekozen
  dag, en begin en eind van een periode, zijn gevuld in de primaire kleur met een lichtere rand,
  en de dagen ertussen dragen een tint ervan die binnen een week doorloopt. Een dag is zelf een
  cel van het raster, geen knop: de cel neemt de focus, de pijlen lopen erlangs en Enter en
  spatie kiezen hem, zoals het datumraster van de WAI-ARIA Authoring Practices.

### Feedback

- **Een fout in inhoud is altijd de melding**, nooit een eigen rood blok. De ene uitzondering is
  de videospeler: een mislukte laadpoging zegt dat op het beeld, waar de video zou staan, omdat de
  lichte vulling van de melding op het donker zou zweven.
- **Een melding is alleen een live-regio als de host dat zegt**: de host weet of het bericht
  nieuws is. Dan onderbreekt een storing en wachten de andere soorten hun beurt.
- **De actie van een melding staat naast de tekst waar de melding breed is**, en eronder waar ze
  smal is, zodat de volgende stap binnen bereik blijft zonder een eigen regel.
- **Een melding kiest haar marge naar haar eigen breedte**, op dezelfde grens als haar actie:
  smal is ze krap, breed ruim. De host kiest geen compacte vorm.
- **Wat vanzelf verdwijnt, is een toast; wat bij een veld hoort, is de foutregel van het veld.**
- **Een statusbericht draagt het gekleurde teken van de huisstijl voor zijn soort**: de vorm
  gevuld in de lijnkleur van de status met het teken erin wit, op de tint, met in diezelfde
  kleur de balk links: een driehoek voor een waarschuwing, een cirkel met een kruis voor een
  storing of mislukking, het vierkant met *i* voor info en de cirkel met een vinkje voor ok.
  Elders (een badge, een kaart, een regel) blijft het teken in één kleur. Een
  titel staat op een eigen regel naast het teken, de tekst eronder. Alleen de foutregel van een
  veld houdt de driehoek; de foutsamenvatting van een formulier en een geweigerd bestand nemen het
  teken en de tint van de toon fout, zoals elk statusblok.
- **Laden houdt het vak.** Een skelet heeft de maat van waar het voor staat, zodat de pagina niet
  springt. Een deel dat al inhoud toont, houdt zijn hoogte tijdens een tweede ophaling, en een
  verversing waar niemand om vroeg, tekent geen skelet.
- **Leeg zegt waarom**, en noemt de uitweg in woorden. Er is geen opnieuw-knop op een tegel: die
  herlaadt met de pagina.
- **Een pagina die er niet is, is een pagina, geen melding** (`lintje-error-page`): de code klein
  boven een titel die in woorden zegt wat er is, waarom, en de weg verder. Geen illustratie, geen
  groot getal, geen rood vlak; alleen geen toegang en een storing dragen een teken naast de code.
  Een storing geeft een referentie die de lezer kopieert en doorgeeft.
- **Er is één toonset.** Een toon is een statuskleur met haar teken: neutraal, subtiel, bezig,
  gelukt, let op, fout, informatie, aandacht en live. Elk element dat een status toont, tekent in
  die tonen, en een element dat eigen woorden heeft (de leveringsstatus van een bron, de staat
  van een taak, de soort van een melding) vertaalt ze zelf naar een toon; een host vertaalt
  nooit. De woordenschat staat één keer, in `components/shared/tone.ts`, met de staat van werk
  (wachtrij, bezig, onderbroken, klaar, mislukt, geannuleerd) ernaast.
- **Inhoud kent vier toestanden**: klaar, laden, leeg en fout, met één `message` en één
  `lastKnown`, voor een tegel en een kerncijfer evengoed. Een bron die niet antwoordt, is een
  fout in de toon fout, zoals de losse melding, niet een waarschuwing: de laatst bekende waarde
  eronder zegt wat er nog staat.
- **De tegel stelt samen.** Leeg en fout in een tegel zijn dezelfde blokken als de losse lege
  toestand en de losse melding (`components/shared/`), nooit nagetekend, en alle drie de
  toestanden zijn een live-regio van de tegel: wat erin laadt, zwijgt zelf.

### Links, toetsen en overlays

- **Een knop die navigeert, is een link**: met een `href` tekent de knop een `<a>` in dezelfde
  vorm.
- **Een link is een link**: een echte `<a href>` die de browser volgt. Een gewone linkerklik wordt
  ook gemeld als `lintje-navigate`, en een host met een router annuleert dat event om de klik over
  te nemen. Een klik met een modificatietoets is van de browser.
- **Een rij of teken met een `href` gaat erheen**, tenzij de host zijn event annuleert: een
  klikbare tabelrij, een teken in een grafiek en een markering op de kaart, zoals een linkrij van
  de lijst. Het element gaat via `lintje-navigate`, zodat een router het overneemt; een selectie
  ongedaan maken gaat zo naar de `clearHref`. Een klik met een modificatietoets of de middelste
  knop opent de `href` in een nieuw tabblad, zoals een link, via `lintje-navigate` met `newTab`.
- **Toetsen lopen via één register** (`src/core/shortcuts.ts`). Een toets is nooit de enige manier
  om iets te doen, en een toets zonder modificatietoets gaat nooit af zolang de focus in een veld
  staat. De eigen toetsen van een speler (spatie, de pijlen, F, C) werken alleen zolang de focus
  erin staat, buiten het register.
- **Een toets op het scherm wordt op één manier getekend**: `<kbd class="lintje-key">`, uit
  `components/shared/key.css`. Een host tekent hem met `<lintje-key>`, één element per toets; een
  combinatie is twee toetsen naast elkaar.
- **Escape sluit wat open is**, en in een popover alleen de popover. Een toast sluit met Escape
  alleen vanuit zichzelf: een Escape elders is niet de zijne. Of er een dialoog boven een open
  popup staat, volgt uit de focus: Escape blijft ongemoeid zolang de focus in een
  `aria-modal="true"` staat waar de popup niet in zit. Een dialoog zet dus `aria-modal` en
  neemt de focus bij het openen; één die dat niet doet, telt niet mee.
- **Twee vensters: een groot voor inhoud, een klein voor een vraag of een kort formulier.**
  `lintje-modal` toont inhoud, zoals een vergrote tegel of een tekst, en is zo hoog als die
  inhoud, ten hoogste het venster: een grafiek die de ruimte vult, maakt hem vol, een halter of
  een korte tabel een lagere. `lintje-dialog` stelt een
  vraag of vraagt een paar velden, in één kader zonder lijnen tussen kop, inhoud en knoppen. Een
  vraag die een antwoord nodig heeft, is een `alert`: geen sluitknop, de focus op de veilige knop
  (`autofocus`), en het antwoord als laatste knop, zodat het op een telefoon bovenaan staat.
- **Een venster met vaste woorden is een recept, geen element**: een bevestiging, de sessie die
  verloopt en het overzicht van de sneltoetsen zijn een `lintje-dialog` met inhoud van de host,
  voorgedaan in de stijlgids.

### Uitklappers

- **De uitklapper is de accordeonrij van de huisstijl**: een lijn erboven en eronder, de pijl
  vooraan, de kop vet in de tekstkleur van het accent, de inhoud ingesprongen in lijn met de
  titel. Open of dicht, de kop houdt dezelfde kleur. Een losse uitklapper die een eigen vlak
  nodig heeft, is de variant `card`: omlijnd op het oppervlak; in een tegel is hij `flat`, zonder
  lijnen en zonder vlak.
- **Een accordeon is de gestapelde uitklapper** (`lintje-accordion`), geen tweede element: de rijen
  zijn uitklappers, getekend met de lijnen van de lijst, één boven de stapel en één onder elke
  rij, zonder vlak of kaart per rij.
- **Meer rijen tegelijk open is de standaard.** Eén tegelijk laat de inhoud onder de lezer vandaan
  schuiven en is er alleen op verzoek, net als "Alles openen". Wat elke lezer nodig heeft, staat
  niet achter een kop.
- **In een tegel is een accordeon een werklijst in een `flush`-tegel**, en op papier staat het
  open, zoals alles wat dichtklapt.

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

- **Een kop heeft geen vulling**, ook gefilterd niet: een vulling is hoe een geselecteerde rij
  eruitziet.
- **De kop zegt alleen wat nu geldt.** Alleen de gesorteerde kolom draagt haar pijl; een andere
  kolom toont de hare onder de aanwijzer of met focus. Een kolom met een filter draagt de
  trechter, altijd, ook op een aanraakscherm, in het grijs van de kop; gefilterd is dat één
  markering, de gevulde trechter, en de chips boven de tabel zeggen in woorden waarop.
- **Sorteren en bladeren laten de kolommen staan.** Een kolom neemt de breedte van haar breedste
  waarde over alle rijen, niet alleen die van de pagina, en de sorteerpijlen staan boven elkaar in
  een vak dat even breed blijft, gesorteerd of niet.
- **Kolommen kiezen staat waar de kolommen staan**: een stil icoon in de kop van de laatste
  kolom, boven de ⋮ van de rijen, met zijn naam als tooltip; het kost geen regel boven de
  tabel. Wat de rijen raakt ("Filters wissen", "Alles inklappen") staat met zijn woord in de
  werkbalk. De telling staat één keer: onder de rijen als er gebladerd wordt, anders in de
  werkbalk.
- **Een naam die opent, is donker**, zoals in de werklijst: een kolom blauw leest als een kolom
  links en weegt zwaarder dan de cijfers ernaast. De naam onderstreept zich onder de aanwijzer en
  met focus.
- **Hoogstens één vulling per rij.** Alleen een overschreden drempel vult zijn cel; dicht bij de
  drempel is een teken en vet. Een waarde als label is een badge, in de tonen van `lintje-badge`,
  met haar woord.
- **Een totaal is van de host.** De tabel rekent nooit: een som, een gemiddelde en een gewogen
  cijfer komen binnen als waarde, met het woord dat zegt hoe ("gem."). De totaalrij staat onder de
  rijen, vet, boven een zware lijn, en plakt niet.
- **Een rij klapt open voor de rest van zichzelf**: de kolommen die de lezer verborg en de velden
  die nooit een kolom zijn, op desktop en telefoon dezelfde lijst. Open of dicht is beeld, geen
  toestand: het gaat niet naar de host en niet in de URL.
- **Groepen houden de volgorde van de host.** Sorteren werkt binnen een groep, een pagina breekt
  nooit in een groep, en een ingeklapte groep draagt haar subtotalen op haar eigen regel. In een
  kiesbare tabel heeft een groepskop een vinkje voor haar rijen, aan, half of uit zoals "Alles
  selecteren", ook ingeklapt.
- **Een rij is klikbaar of selecteerbaar**, nooit allebei. Een naam die zijn rij opent, maakt de
  rij niet klikbaar: de naam is de link, dus een selecteerbare tabel kan zijn rijen nog steeds
  openen. Een naam die opent, wordt niet in zijn cel bewerkt.
- **Rijacties zijn een rustige ⋮**: plat, zonder vak. Een vak in elke rij weegt zwaarder dan de
  data ernaast.
- **Op een applicatiepagina staat een tabel op de pagina**, zonder tegel: de kop of tab van de
  pagina noemt hem. In een dashboard blijft hij een tegel tussen tegels.
- **Pagineren is plat, zoals de huisstijl het tekent**, gecentreerd onder wat het pagineert: de
  nummers in de linkkleur zonder vak, de huidige pagina het ene licht getinte vierkant met het
  cijfer donker en vet, "Vorige" en
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
  hele waarde. De woorden staan in de tooltip van het pijltje — de hele verandering, of wat de
  host per rij laat zien met een sjabloon (`tooltip`, met `{sleutel}` uit de rij). Zoals bij
  afgekapte tekst staan ze nooit alleen in de tooltip: onder de focus van het toetsenbord en
  zonder hover staan ze voluit op de plaats van het pijltje. Een rij zonder bediening krijgt
  daarvoor zelf toetsenbordfocus; die focus maakt de rij niet klikbaar. Als enige meetwaarde van een rij
  onder 768 px staat de verandering er heel.
- **Onder 768 px wisselt een tabel van vorm**: de identiteit van de rij en één meetwaarde, met de
  andere kolommen op verzoek onder de rij (zie [Toegankelijkheid](#toegankelijkheid)). Geen
  rijkaarten, geen zijwaarts scrollen.

### Personen

- **Een persoon is neutraal.** Het rondje heeft één vulling voor iedereen; alleen waar de
  personen zelf de variabele zijn — de sprekers van een opname — neemt het hun datakleur. De naam
  staat er altijd naast. Wat geen persoon is, zoals "Systeem", krijgt een rondje met een icoon in
  plaats van initialen, zodat de namen in een tijdlijn op één lijn blijven. Een persoon in een
  tabel, rij of kaart die zelf opent, is geen link.

### Afbeeldingen en kaarten

- **Een schermafbeelding wordt heel getoond, nooit bijgesneden**; alleen een miniatuur in een
  galerij (`lintje-gallery`) toont haar linkerbovenhoek, en de miniatuur van een bijlage
  (`lintje-attachment`) haar midden: zo klein blijft alleen het midden herkenbaar.
- **Een kaart is één item van een collectie** (`lintje-card`), vierkant en plat, zonder schaduw;
  een kaart die een link is, reageert op de aanwijzer zoals een lijstrij. Zonder afbeelding is ze
  korter, nooit een grijs vak.
- **Rijen data die items vergelijken, zijn een tabel**, geen kaarten.

### Entiteitendiagram

- **Een graaf van knopen en relaties tekent zichzelf** (`lintje-graph`): de host stuurt de knopen,
  hun soorten en de relaties, het element deelt in, tekent, klapt in en uit en zoomt. Gelaagd en
  kracht komen uit een bibliotheek (dagre, d3-force), radiaal is eigen werk; alle drie geven voor
  dezelfde graaf hetzelfde beeld, en een grote graaf wordt buiten de pagina ingedeeld. Tekenen doet
  het element zelf, met de tokens. Zonder indeling van de host kiest het element er een naar de
  vorm: een keten van gerichte relaties gelaagd naar rechts, een naaf radiaal, een hiërarchie
  gelaagd omlaag, een kring of een groot netwerk door kracht. Die keuze ligt vast zolang het
  middelpunt er is.
- **Een knoop is een kaart**: het icoon van haar soort, haar naam in hooguit twee regels, en alleen
  een tweede regel voor een status of een groep. Uitgezoomd is ze een merkteken met het icoon, de
  naam ernaast waar hij past; ver uitgezoomd alleen het icoon, de naam in de tooltip.
- **Soortkleur staat aan**: het icoon en het merkteken nemen de datakleur van hun soort, in de
  volgorde waarin de host zijn soorten noemt. De legenda boven de tekening noemt per soort icoon,
  naam en aantal, en zet een soort uit; wat blijft, staat waar het stond.
- **Het middelpunt is de drukste knoop zoals de host de graaf stuurt, en ligt vast.** Achter een
  knoop hangt wat het middelpunt alleen via die knoop bereikt, welke kant de pijlen ook op wijzen;
  daar staat een teller voor, in de kaart aan het eind van de naamregel, de enige plek waar nooit
  een lijn komt. Dicht toont hij een plusteken en het aantal en staat hij er altijd; open toont hij
  een minteken, alleen onder de aanwijzer, met focus of als de knoop gekozen is. Hij heeft de
  opmaak van de avatar. Op een merkteken staat hij rechtsboven op de rand.
- **Meer dan vijf bladeren van één soort aan één knoop zijn één groep**, als een stapeltje kaarten
  met hun meervoud als naam: het "Overig" van de taart, toegepast op een graaf. De teller opent ze.
- **Wat de host nog niet laadde, haalt de teller op**: de knoop vraagt het met een event en de
  teller is bezig tot de host het stuurt.
- **Gekozen, ingeklapt en geopend zijn van de host**, zoals een selectie op de kaart: het element
  toont een klik meteen en vraagt het met een event. Zoom, de uitgezette soorten en de aanwijzer
  zijn van het element.
- **Onder de aanwijzer of gekozen blijven de knoop, haar buren en haar lijnen in het licht**, de
  lijnen in de donkere lijnkleur; de rest stapt terug. Een gekozen knoop draagt de accentrand en de
  lichte vulling, zonder tooltip: de host toont haar relaties.
- **De tooltip is die van Lintje**: de naam, een grijze regel met wat bijzonder is (wat verborgen
  is, wie in een groep zit, anders soort en status), dan een paar relaties als zin en hoeveel er
  nog zijn. Hij staat onder de knoop, erboven als de ruimte op is. Een lijn onder de aanwijzer
  noemt haar twee knopen en haar woord.
- **Een lijn is recht in gelaagd en kracht, gebogen in radiaal**, en haaks als de host dat kiest
  in een gelaagde indeling. Een rechte lijn buigt om een knoop die in de weg staat. Ze heeft de
  kleur van de nullijn, een pijlpunt als de relatie een richting heeft, en wordt dikker met het
  getal dat ze draagt. Het woord staat op de lijn met een halo, mijdt knopen en andere woorden en
  blijft weg waar het geen plek heeft; uitgezoomd alleen op lijnen in het licht.
- **Zoomen gaat zoals op de kaart**: Ctrl of ⌘ en het wiel rond de aanwijzer, slepen op de
  achtergrond, knijpen met twee vingers, en de knoppen rechtsboven: in- en uitzoomen,
  terugzetten en inzoomen op de gekozen knoop. Terugzetten is dat van de kaart: de hele tekening
  in beeld, niets gekozen, elke tak weer open en elke groep weer dicht. Past de tekening niet
  meer, dan staat rechtsonder het overzicht; een klik erop gaat daarheen, en het kader erin is te
  slepen. Een gepaste tekening houdt de strook van de knoppen vrij.
- **Bij openen blijft wat er stond staan**: wat verschuift, beweegt naar zijn nieuwe plek, een
  nieuwe knoop komt uit de knoop waar hij aan hangt en vervaagt in. **Wat wegvalt, gaat eerst**:
  het vervaagt waar het stond, met zijn lijnen, en pas daarna schuift de rest en volgt de zoom.
  Wat tegelijk binnenkomt, wacht tot het weg is. Onder verminderde beweging staat alles meteen.
- **Er is geen tabel of lijst in het element**: het is de tekening. De beschrijving van de host is
  haar tekstalternatief en de tooltip geeft de relaties. Downloaden geeft de tekening als PNG,
  zoals de lezer haar ziet, met de legenda en de woorden van de tegel.

### Gesprek

- **Een antwoord is een lijst blokken die al bestaan** — lopende tekst, cijfers, een grafiek, een
  tabel. Het gesprek voegt geen eigen visueel patroon toe.
- **Wat de assistent deed, is een reeks aan de rail die inklapt tot één regel**
  (`lintje-chat-steps`) — de uitzondering die geen is, want de rail bestaat al. De dichte regel
  toont wat nu telt: de stap die loopt, anders een mislukte, anders een gestopte, anders het
  aantal. De groep gaat nooit vanzelf open of dicht, zodat ze niet van hoogte verandert terwijl de
  lezer leest. Het teken is de staat, niet de soort stap: het werkwoord zegt wat de stap deed.
  Alleen de eerste stap en een mislukking worden voorgelezen; het antwoord spreekt voor zichzelf.
- **Een scheidslijn tussen beurten staat gecentreerd**, lijn — label — lijn, als een grens tussen
  twee delen en niet als kop boven het volgende. Een scheidslijn die over het deel erboven gaat
  ("Gesprek ingekort"), wijst ernaar en zegt het in woorden, zodat de pijl of het gewicht nooit de
  enige drager is.
- **Een suggestie staat onder het antwoord, een vraag van de assistent boven het tikveld.** Een
  suggestie is gestreept: iets wat de lezer zou kunnen vragen. Een vraag van de assistent wacht
  op antwoord en staat in de vragenlijst, waar de lezer antwoordt (`lintje-chat-questions`), in
  hetzelfde kader als het tikveld. Het tikveld blijft eronder werken: een nieuwe vraag slaat de
  open vragen over, en pas versturen doet dat, nooit het openklappen ervan.
- **Het antwoord van de lezer is altijd zijn bericht.** Wat hij in de vragenlijst koos, staat in
  het gesprek als een gewoon bericht van hem, één regel per vraag, zodat het gesprek leest zoals
  het ging en hij het kan bewerken zoals elke vraag.
- **"Iets anders" staat altijd in een vraag van de assistent**: de lezer zit nooit vast aan de
  opties die de assistent bedacht. Het is de `other` van de keuzegroepen, ook in de korte vorm.
- **Een bestand in het gesprek is een bijlage** (`lintje-attachment`), in het vraagvak, het
  bericht en het antwoord evengoed: een stille chip die lichter weegt dan een bericht. Een bijlage
  met een fout gaat nooit mee.
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
7. **Breder dan een leespagina.** De 1280 px van de huisstijl is een leesbreedte, voor lopende
   tekst; een pagina met cijfers vergelijkt tegels, tabellen en grafieken naast elkaar en zet de
   inhoud tot 1600 px (`--lintje-content-width` op de pagina), in beide huisstijlen.

**De filterbalk is in rust dicht**: wat tijdens het lezen op de pagina staat, is de zin; de
bedieningselementen zijn er zolang de lezer kiest, en verder scrollen sluit ze. Op een telefoon
zijn de filters een sheet, en wijzigingen gelden pas bij "Toepassen". De zin opent hem: de hele
balk is de knop, met het aantal aangepaste filters en een pijl, dus de header heeft geen eigen
knop "Filters". Op elke breedte plakt de zin bij het scrollen direct onder de balk van de shell,
en de shell houdt zijn hoogte vrij boven de focus.

**De pijl van een KPI draagt de richting; de kleur bevestigt die alleen.** Waar stijgen slecht is,
draait de kleur om en de pijl niet.

**Het verloop in een KPI is een lijn met haar vlak, zonder assen** (`sparkline`): de eigen
waarden van de variabele, dus in haar kleur, met het vlak eronder zoals de lijngrafiek het tekent,
nooit de nadrukkleur.
Ze schaalt van de laagste tot de hoogste waarde, niet vanaf nul, want ze toont de beweging, niet de
hoogte; het cijfer ernaast is de hoogte. De laatste waarde is een punt, een ontbrekende waarde
breekt de lijn, en de beschrijving van de host is haar tekstalternatief, zoals bij een grafiek.

## Grafieken

Eén grammatica, geen grafiekbibliotheek.

**Een grafiek kies je op de vraag van de lezer**, niet op wat er mooi uitziet: verloopt het in de
tijd, hoe verhouden groepen zich, uit welke delen bestaat het geheel en waar komen ze terecht, hoe
is het verdeeld, hangen twee maten samen, halen we het doel. Elke soort beantwoordt één van die vragen en zegt ook wanneer
een andere beter past; die keuze staat bij de soorten in `components/shared/charts/kinds.ts` en in
de stijlgids. Past geen soort, dan is het een tabel.

- **Eén kleur per variabele**, met de tintladder voor de onderverdelingen. Vergelijking grijs;
  nadruk voor trend, drempel en doel.
- **De legenda staat boven de grafiek** en is klikbaar. Het symbool zegt welk teken het is: een
  vierkant voor een staaf of vlak, een lijn voor een lijn, de vorm van de reeks voor een punt,
  gestreept voor een drempel of vergelijking. Elke reeks en elke referentielijn (drempel,
  mediaan) is een schakelaar; een sleutel als "geen gegevens" niet, en één reeks zonder
  referentielijn ernaast ook niet, want uitgezet laat ze een lege grafiek achter. Een raming en
  haar marge zijn sleutels, geen schakelaars: ze zeggen hoe de reeks getekend is. Alleen de reeks
  schakelt, en haar raming en marge gaan mee. Is er niets uit te zetten zonder het geheel te
  breken, zoals een knoop van een sankey, dan heeft de legenda geen schakelaar. Een klasse van
  de heatmap gaat in dezelfde legenda uit, maar haar cellen dimmen: een lege cel leest als
  geen meting.
- **De nullijn is donkerder dan het raster.**
- **Datalabels zijn alles of niets**: als er één niet past, toont de grafiek er geen, en de
  tooltip geeft nog steeds elke waarde.
- **Meten, niet rekken.** De tekening krijgt de maat van de gemeten breedte, zodat astekst zijn
  echte maat houdt in een smalle tegel.
- **Elke grafiek heeft een `<desc>`** met een leesbare samenvatting: het toegankelijke
  alternatief.
- **Een tegel toont één weergave**: geen wissel tussen de tekening en een tabel, ook niet bij een
  kaart of een diagram. De tooltip en de CSV geven de cijfers; een tabel die de lezer nodig heeft,
  staat apart.
- **Hover verandert nooit de lengte die de waarde draagt.**
- **Een taart rangschikt en vouwt zelf.** Haar delen zijn de onderverdelingen van één variabele:
  de kleur van de spec, of hemelblauw. Het grootste deel is het donkerste, in welke volgorde de
  host ze ook stuurt, en de tinten spreiden over de ladder met het aantal delen. Meer dan vijf
  delen worden vier en één grijs "Overig" dat niet klikbaar is: een samengevoegd stuk heeft geen
  plek om naartoe te gaan. "Overig" en de rest van een geheel (`remainder`) zijn geen delen; ze
  staan achteraan, de rest het lichtst. De legendatabel volgt de getekende volgorde; zonder
  legendatabel staat de gewone legenda boven de tekening, een item per deel en geen schakelaar.
- **Een treemap vouwt op aandeel, niet op aantal.** Ze toont veel delen en hun onderdelen in één
  vlak, dus een deel blijft staan zolang het telt: wat onder 1 % van het geheel blijft, wordt
  samen één grijs "Overig" dat niet klikbaar is, ook binnen een deel, en één klein deel blijft
  zichzelf. De CSV noemt elk samengevoegd deel apart. Het geheel is het kader: de legenda draagt
  alleen de sleutels en schakelt niets uit, en de grafiek noemt zelf het totaal van wat getekend
  is en wat daarin ontbreekt.
- **Onderdelen van een deel delen zijn tint.** Een eigen tint zou een tweede variabele
  suggereren; de maat draagt de waarde en de lijn in de oppervlaktekleur de indeling, dun tussen
  onderdelen en breder tussen delen. Bij twee niveaus is het deel het klikdoel, ook vanuit een
  onderdeel.
- **Een vlak noemt zichzelf zo volledig als past**: naam, bedrag en aandeel, dan kleiner, dan
  zonder aandeel, dan alleen de naam, en als laatste stap de naam afgekapt; waar zelfs dat niet
  past, blijft het vlak leeg. In een treemap zijn er altijd vlakken te klein voor tekst, dus daar
  geldt "alles of niets" niet: de maat is er altijd, de naam waar hij past, de tooltip en de
  CSV geven alles.
- **Een gestapeld vlak toont de onderverdelingen van één variabele** in haar ladder, de eerste
  onderaan en de donkerste, in volle tinten met een lijn in de oppervlaktekleur tussen de lagen.
  Ontbreekt een laag op een punt, dan breken die laag en alles erboven daar af, want hun
  ondergrens is onbekend; de lagen eronder blijven staan en erboven is het gearceerd. De tooltip
  leest de tekening van boven naar onder en sluit af met het totaal, dat ontbreekt zolang een
  getoonde laag ontbreekt.
- **Een grafiek houdt haar assen als je iets uitzet**: wat blijft, staat waar het stond, zodat
  het oog alleen ziet wat verdwijnt. Een stapel houdt het geheel als kader.
- **De klassen van een histogram raken elkaar**, omdat de as doorloopt: geen ruimte tussen de
  staven, alleen de scheidingslijn in de oppervlaktekleur, en de labels staan op de grenzen van de
  klassen, niet onder hun midden. Een open laatste klasse ("30+") heeft geen grens om op te staan
  en wordt onder haar midden genoemd.
- **Een mediaan is een doorgetrokken nadruklijn**, naast de gestreepte van een drempel, elk met
  zijn label naast de lijn. Raken de labels elkaar, dan zakt het rechter een regel.
- **Een staaf begint bij 0, want haar lengte draagt de waarde.** Een grafiek die een positie
  draagt in plaats van een lengte, zoals het halterdiagram, mag de as inkorten.
- **Een waarde buiten een ingekorte as staat op de rand, met een afkapteken**: een klein
  driehoekje in de kleur van het punt dat naar buiten wijst. De as blijft zoals de host haar koos;
  de echte waarde staat in de tooltip en de CSV, en een verschil rekent ermee. De
  legenda noemt het teken "Buiten de as" zolang er zo'n punt is. Een punt verdwijnt nooit en de as
  rekt nooit stilletjes op.

**Een sankey toont hoe één aantal door de stappen van een proces stroomt.** Een stap is een
kolom knopen, een stroom een band zo breed als zijn aantal, met één schaal voor alle stappen.
Wat stroomt is één variabele, dus knopen en banden hebben één kleur: de uitkomsten zijn
onderverdelingen, en hun naam en getal zeggen wat ze zijn.

- **Een variabele kleurt niet naar haar uitkomst.** "Afgewezen" in rood en "Toegekend" in groen
  is oordelen met kleur, en het rood leest als een status die het niet is. Ook geen tint per
  stap: de kolom draagt de stap al, en een lichtere kolom leest als minder.
- **Banden van één kleur mogen elkaar kruisen; vlakken van meer kleuren niet.** Waar banden van
  één variabele over elkaar liggen, wordt het donkerder in dezelfde kleur. Vlakken van twee
  variabelen mengen tot een kleur die geen variabele heeft (zie het spinnendiagram).
- **Een knoop is een deel van het geheel, een stroom een deel van zijn bron.** Zo staat het
  aandeel in het label, de tooltip en de CSV, en nergens door elkaar.
- Een ontbrekende stroom is een gearceerde stomp bij de bron, nooit een band van 0, en het doel is
  dan "minstens" het bekende deel. Een kleine stroom houdt een zichtbare band rond zijn echte
  plek; zijn echte getal staat in de woorden. Stromen samenvoegen tot "Overig" doet de host, want
  het verandert de route die hij declareerde.
- De namen staan er altijd: de tekening wordt hoger met de drukste stap. Getal en aandeel zijn
  alles of niets.
- Onder 768 px stelt hij per overgang zijn vraag — waar gaat het heen — met per bron één staaf,
  verdeeld over haar doelen in de tintladder, en een rij per doel eronder als legenda.

**Een kerncijfer op zijn schaal is een KPI, geen grafiek.** De meter is een instelling van
`lintje-kpi`: een halve boog met het getal in de mond, of een balk onder het getal. De vulling is
de kleur van de variabele, de rest van de schaal het lichtgrijs van een rest, het doel gestreept in
de nadrukkleur. De vulling oordeelt niet: of het cijfer goed staat, zegt de trendregel met pijl en
woord, zoals bij elke KPI. Een cijfer zonder meting tekent de schaal en het doel, nooit een lege
vulling als nul.

**Onvolledige perioden.** Een periode die nog loopt, is gearceerd. Als er nog veel van open is,
wordt de reeks afgekapt bij het laatste volledige punt en zegt een peilmomentlijn waar. De assen
houden de volledige periode en schaal, zodat de vorm herkenbaar blijft en een ochtend niet wordt
opgeblazen tot een piek.

**Een raming zet een gemeten reeks voort**, op een lijn of in staven; het is geen eigen soort.
Gemeten en geraamd staan nooit ongemarkeerd naast elkaar. Stippels betekenen raming, en alleen
dat: gestreept blijft van vergelijking en drempel. Een geraamde staaf is open, een geraamd
hoverpunt ook, en de tooltip en de CSV noemen elk geraamd punt zo. De marge rond een raming vult
alleen bij één reeks, of bij de reeks die de lezer in de legenda aanwijst, om dezelfde reden als
bij het spinnendiagram. Met een raming heeft de grafiek één grens: de lijn tussen gemeten en
geraamd, met beide woorden erboven en het geraamde deel op een eigen ondergrond. Een lopende
periode wordt dan niet gearceerd of afgekapt; de host laat haar weg of rekent haar tot de raming.
Een vergelijking heeft geen raming: haar waarden zijn gemeten.

**Gebeurtenissen.** Wat er op een moment gebeurde, is een genummerd vierkantje boven zijn
categorie met een doorgetrokken lijn tot de nullijn, apart van de gestreepte peilmomentlijn; de
reeksen liggen eroverheen. Ze zijn genummerd van links naar rechts, en een vierkantje dat een
ander zou raken, zakt een rij, zodat elk nummer zichtbaar blijft. De tekst staat altijd in een lijst onder de grafiek, ook op een
telefoon, en in de tooltip en de CSV: de tekening alleen draagt de betekenis nooit.

**Klassen** (heatmap, choropleet) krijgen hun grenzen uit de getoonde data, afgerond op stappen
die een lezer herkent. Een host zet de grenzen vast als twee perioden op kleur vergelijkbaar
moeten zijn.

**Op een kaart is een reeks een kleur en een vorm**, en een selectie kan altijd ongedaan worden
gemaakt.

**Een spinnendiagram toont een profiel op één schaal.** De schaal begint in het midden bij 0,
want het vlak draagt de waarde; de ringen zijn veelhoeken in het raster en de spaken zijn de
assen, in de kleur van de nullijn, met hun naam waar ze voorbij de buitenste ring doorlopen. De
cijfers van de schaal staan op één as, omdat alle assen haar delen. Een laag is een lijn met de
vorm van haar reeks op elk hoekpunt, de vergelijking een doorgetrokken grijze lijn, de norm een
gestreepte veelhoek in de nadrukkleur: gestreept is hier alleen de norm, want een gestreepte
vergelijking erover leest als een tweede norm. Vlakken over elkaar mengen tot een kleur die geen variabele heeft:
één laag vult haar vlak, van meer lagen alleen de laag die de lezer in de legenda aanwijst, en
de andere stappen terug. Elk vlak staat er al, ook ongevuld, zodat de nadruk niets opnieuw laat
intekenen; een laag die de legenda uitzet, blijft onzichtbaar staan, en de schaal, de ruimte voor
de waarden en de rijen op een telefoon bewegen niet mee. De tooltip tekent een laag zoals de
legenda: de vorm van haar reeks, een grijze lijn voor de vergelijking, gestreept voor de norm. Een ontbrekende waarde breekt de lijn, laat het vlak vervallen en arceert de spaak.
Onder 768 px wordt elke as een rij staven.

**Een halterdiagram toont één maat op twee momenten, per rij.** Het eerdere moment is een open
ring in het grijs van de vergelijking, het latere een stip in de kleur van de variabele: ze
verschillen in vorm én kleur. De verbinding ertussen oordeelt niet, net als de vulling van de
meter: of stijgen goed is, weet de grafiek niet, en groen of rood zou een oordeel vellen dat de host
niet gaf. De richting staat als verschil met teken in een vaste kolom naast elke rij, ook bij het
kleinste verschil, waar een pijlpunt niet past. De rijen staan in de volgorde van de host; een
ontbrekend moment laat de verbinding en het verschil vallen en arceert de rij. Onder 768 px staat
de naam op een eigen regel boven de halter.

**In een spreidingsdiagram is een reeks ook een kleur en een vorm**: dezelfde vorm die die kleur
op de kaart heeft, met gelijke oppervlakte, zodat geen reeks luider is. Een punt heeft een rand in
de oppervlaktekleur, zodat punten die elkaar overlappen te onderscheiden blijven. Alleen de punten
die de host noemt, tonen hun naam; de rest leest de lezer uit de tooltip of de CSV.

**Een kaart stapelt haar lagen en blijft één kaart.** De eerste laag ligt onder en de laatste
boven, en het toetsenbord volgt de stapel; een choropleet kleurt het land zelf en ligt daarom
altijd onderop. Er is één selectie over alle lagen en één legenda, boven de kaart zoals bij
elke grafiek, met per laag één regel: haar naam — die van de host, anders die van haar soort —
met het vakje van een checkbox ervoor, dat de laag aan en uit zet, dan haar sleutel — of niets,
voor een laag van punten waarvan het getal geen maat is —, dan haar reeksen, elk een schakelaar
zoals in elke legenda, en achteraan "geen gegevens" als een mark van die laag geen cijfer heeft.
Een kleur die in meer lagen dient, staat bij elke laag en schakelt per laag. De sleutel is
dezelfde tekening als de kaart: vijf klassen van 0 tot het maximum, drie cirkels van klein naar
groot met het bereik, of één wig van dun naar dik met het bereik; een cijfer spreekt altijd de
eenheid van zijn eigen laag.
Meer dan drie lagen vouwen op de tegel onder "Nog n lagen"; de vergroting toont alles, en daar
krijgt elke klasse haar bereik en staan de cirkels genest op ware maat met hun getal. Op een
telefoon staat de naam boven de sleutel en krijgen de reeksen een eigen regel. Een vlak dat niet
in de geometrie van de kaart staat, draagt zijn eigen omtrek en is verder een gebied: dezelfde
klassen, gearceerd zonder cijfer, en met focus een ring om zijn vorm, zoals een punt die krijgt.

**Een host kiest welke bediening een kaart heeft** (`controls`): zoomen, wiel, slepen, reset,
lasso, cirkel, rechthoek, schaalbalk en legenda. Standaard staat alles aan behalve de tekenvormen,
want die zijn alleen zinvol als de host op een gebied filtert. Een vorm is gereedschap: eenmaal gekozen
blijft hij in de hand, een nieuw gebied vervangt het vorige, en hij gaat pas neer met een klik op
de knop, Escape of de reset. Eén vorm is een knop die hem opneemt en neerlegt; bij twee of meer
is het een selectieknop met een hoekje rechtsonder, en opent een klik het menu van de vormen — de
laatst gebruikte aangevinkt en gefocust, zodat Enter meteen verder gaat. Met een vorm in de hand
toont de knop die vorm, primair gekleurd zoals een icoonknop die aanstaat, en heet hij "Stop met
selecteren". De knoppen staan rechtsboven,
ook op een telefoon alle, op de aanraakmaat op een hogere kaart: knijpen is een gebaar met twee
vingers en uitzoomen moet ook met één. De schaalbalk staat rechtsonder, zonder kader, op een
ondergrond op het oppervlak boven de bronvermelding: een ronde afstand en daarnaast een beugel
zo lang als die afstand op de kaart, zoals op een wegenkaart. Hij meet over het midden van het
zicht. De bronvermelding van een ondergrond staat op het oppervlak in de eigen tekstkleuren, ook
in donker, één regel hoog. Het selectiepaneel staat linksonder, weg van de knoppen en
de schaal; onder 768 px is het een regel onder de kaart, niet op wat net gekozen is.

**Een gebied kiezen is een filter van de host.** Een lasso, cirkel of rechthoek kiest wat er
helemaal in ligt: een plaats met haar punt, een vlak of land met zijn hele omtrek, een stroom met
beide uiteinden en zijn boog. Wat de rand raakt, telt niet mee, en tijdens het tekenen licht op
wat erin zou vallen. De kaart stuurt het gebied en de ids — een rechthoek als lasso van vier
hoeken, want in Mercator is een rechthoek op het scherm er een in graden —, en de host bewaart
het gebied in de URL zoals elk filter. Het gebied blijft staan tot de lezer het wegklikt, ook
naast een gekozen mark. Wie niet sleept, tekent met klikken; onderaan staat hoe, per vorm, zolang
de vorm in de hand is; Escape legt haar neer. De resetknop zet de kaart terug: het hele gebied in beeld en niets
gekozen.

**Leaflet draagt de kaart, het design system tekent de data.** Projectie, verslepen, zoomen en
de tegels van een ondergrond zijn van Leaflet; land, vlakken, punten en stromen tekent het design
system zelf in Leaflets svg, met dezelfde klassen, toestanden en animaties als elke grafiek. Zo is
er één kaart, met of zonder ondergrond. Een ondergrond kan een donkere tegenhanger hebben, een
tweede WMS-kaart als andere laag of op een ander adres; de kaart kiest hem op de modus, in de
browser, en wisselt bij een omslag alleen de tegels. De projectie is Web Mercator, zoals elke
webkaart, ook voor Nederland: op tegelformaat is het verschil met de landsprojectie niet te zien.

**Een kaart is met de muis te verslepen en zoomt rond de aanwijzer: met een dubbelklik, en op
het wiel alleen met Ctrl of ⌘ ingedrukt.** Zonder die toets scrolt het wiel de pagina door en
toont de kaart kort hoe het wel kan; anders zit wie door een dashboard scrolt vast op de kaart.
Een knijpbeweging op een trackpad komt als wiel met Ctrl binnen en zoomt dus ook; een dubbelklik
met Shift zoomt uit. Uitzoomen stopt bij het hele gebied, inzoomen een paar verdubbelingen
verder. Op een telefoon versleept een vinger de pagina, niet de kaart: knijpen, dubbeltikken en
de knoppen zoomen. De knoppen en de laagkiezer op een kaart tekenen compact, zoals de knoppen van
een balk, en halen hun aanwijsdoel via het klikgebied in de richting waar ze ruimte hebben.

## Iconen

- **Nooit een met de hand getekend icoon, nooit een bewerkt bestand**, behalve een generiek
  bedieningselement dat RVO mist (de lasso, de punaise): dat tekent Lintje als eigen bestand in de
  stijl van zijn set. De regels staan in de [projectregels](../AGENTS.md) (regel 11), de set in
  [`assets/README.md`](../assets/README.md).
- **Een naam zonder bestand tekent niets en het bedieningselement toont zijn Nederlandse label.**
  Dat is een ondersteunde staat: een host mag een bestand weglaten of vervangen en het
  bedieningselement blijft zeggen wat het doet. Een icoon met een label houdt dat label als
  tekstalternatief, ook terwijl het bestand laadt en zonder bestand. Een gat in de set dat nog
  openstaat, is een issue op GitHub.

## Responsief gedrag

Vier breedtes zijn ontworpen en getest: desktop (vanaf 1440), 1024, 768 en 390 px.

**Onder 768 px wisselt een onderdeel van vorm; het stapelt niet alleen.** Dat geldt voor de
navigatie (header en schermvullend menu), de filters (een sheet), de KPI-rij, de tabel
(identiteit en één meetwaarde) en de heatmap. Tussen de breedtes lopen bedieningselementen door
naar een volgende regel; ze overlappen nooit.

**Wat op een telefoon minder telt, schuift achteraan of klapt in; weglaten is het laatste.** Een
host kiest per item `order-mobile` (alleen de tekening schuift, de lees- en focusvolgorde niet),
`collapsed-mobile` op een tegel (de kop met een knop, de inhoud één tik verder), of `hide-mobile`
en `hide-desktop`. Weglaten is er voor wat de pagina ook anders zegt: een desktop die tot 400 %
inzoomt, krijgt de telefoonweergave, en mag niets missen (1.4.10). Op papier telt de
desktopweergave. Een grafiek tekent zich pas in als hij een maat heeft en in beeld is, ook in een
tegel die openklapt.

**Een sheet die bij een telefoon hoort, sluit als het scherm 768 px of breder wordt** — het menu
van de shell, de lijst van de meldingen — en geeft de focus aan zijn knop als die blijft staan,
zoals de bel.

**Bij weinig hoogte plakt de actiebalk van een formulier niet**: onder een viewporthoogte van
30 rem — een telefoon dwars, 400 % zoom — staat hij na het laatste veld (1.4.10).

**Een element dat zijn vorm kiest naar zijn eigen breedte, meet een frame nadat die veranderde.**
Zo verandert zijn maat nooit in de ronde van zijn waarnemer, die de browser anders als fout van de
pagina meldt. Een rij die niet meer past, staat hooguit één frame te breed.

## Beweging

- **Twee curves**: wat binnenkomt, vertraagt; wat vertrekt, versnelt. Een vervaging die heen en
  terug gaat, is de uitzondering: die gaat recht.
- **Eén duur voor interfacebeweging** (`--dur-base`). Elk onderdeel heeft een eigen token dat
  ernaar wijst, zodat er één kan veranderen zonder een component aan te raken. Hoverfeedback is
  korter, en alles wat onder de aanwijzer van kleur, vulling of rand verandert, doet dat met die
  overgang; databeweging (een grafiek intekenen, een waarde optellen) is langer.
- **Een grafiek tekent zich één keer in, als hij in beeld komt**, per soort teken: een lijn van
  links naar rechts, een staaf vanaf de nullijn, een punt vanuit zijn midden, een taart en een
  donut met de klok mee vanaf twaalf uur, in de richting waarin hun punten lopen. Met minder
  beweging staat hij er meteen.
- **Een vak dat openklapt, knipt zijn inhoud af zolang het groeit en niet langer**: daarna hangt
  een popover of focusring eruit. Het wacht alleen op een hoogte die echt beweegt; staat die
  meteen, dan laat het meteen los.
- **Een teller van ongelezen springt erin als hij verschijnt**, voorbij zijn maat en terug. Een
  nieuw getal in een teller die al getoond wordt, schuift omhoog naar binnen, zoals een KPI-tegel
  doet.
- **Data tekent één keer in**, als de grafiek in beeld komt; terugscrollen speelt het niet
  opnieuw af.
- **Punten groeien één voor één uit hun midden**, op de kaart en in een spreidingsdiagram, met de
  timing van de staven; een referentielijn komt daarna in, met haar label.
- **Wat je in de legenda aan- of uitzet, vervaagt in of uit**; een deel van een stapel of een
  staaf in een groep krimpt of groeit en de rest schuift mee, zodat het oog volgt wat er verschijnt
  of verdwijnt. Een vervaging gaat recht, zonder curve, zodat uit precies in is, achteruit: met
  een curve blijft bij het uitgaan een schim staan. Het tekent nooit opnieuw in.
- **Een keuze beweegt mee**: het vinkje van een checkbox groeit in bij aanvinken en krimpt weg bij
  uitvinken, op de duur van hoverfeedback.
- **De focusring is nooit geanimeerd.**
- **Verminderde beweging laat niets weg, alleen de beweging.** Alleen een vervaging blijft, kort;
  al het andere, ook de focusring en een kleur, staat meteen.

## Afdrukken

Een pagina op papier is een document: wat de lezer zag, zonder wat hij bediende. De lezer kiest
staand of liggend; Lintje zet geen paginaformaat.

- **Papier is altijd licht en wit.** De donkere modus geldt alleen op een scherm, en wat onder de
  inhoud ligt (de pagina, de titelband, de filterband) is wit.
- **Lintje drukt zijn eigen kleur af**, ook als de browser achtergronden uitzet: een vulling
  draagt betekenis (een legendavlak, een drempelcel, de huidige pagina). Daarom ligt er onder de
  inhoud geen groot vlak.
- **Papier kent geen telefoonvorm.** Een staand vel is smaller dan 768 px en neemt de vorm van
  768 tot 1024; een liggend vel die van 1024. Een host schrijft zijn eigen telefoonregels als
  `screen and (max-width: 767px)`.
- **Bediening verdwijnt; wat gekozen is, blijft.** Knoppen, menu's, het vraagvak, de actiebalk,
  zoomen, sorteren en bladeren drukken niet af; de "Je ziet"-zin, de gekozen tab, de filters van
  een tabelkolom en het aantal rijen wel. Wat dichtgeklapt is, staat open.
- **Niets beweegt.** Elk teken staat in zijn eindtoestand, ook wat nog niet in beeld kwam; een
  kerncijfer toont zijn waarde, nooit de nul waar het van optelt.
- **Een kaart toont op papier het gebied dat de lezer zag**, passend in haar smallere doos, met
  haar schaal daarvoor opnieuw berekend; na het afdrukken staat het schermbeeld er weer.
- **Een tegel blijft op één vel** waar hij past. Een tabel breekt tussen zijn rijen (`breakable`
  op de tegel) en zijn kop staat één keer.
- **Het vel zegt wat het is**: het embleem en de naam van de applicatie staan bovenaan, in plaats
  van de balken. Adres, datum en paginanummers zijn van de browser.
- **Het vel heeft een eigen marge**, ook als de browser er geen geeft: ruim genoeg voor de kop-
  en voetregel van de browser, smal genoeg dat een staand vel de vorm van 768 tot 1024 houdt.
  Balken en inhoud beginnen op die marge, op één lijn.
- **Een plaatje van een grafiek (PNG) volgt dezelfde regel als papier**: wat de grafiek op het
  scherm toont — legenda, astitels, tekening, gebeurtenissen, legendatabel — in de schikking van
  het scherm; tooltip, focus, hover en knoppen niet. Anders dan papier blijft het in de modus van
  de lezer.

## Toegankelijkheid

WCAG AA is de ondergrens, ook waar de huisstijl anders suggereert: houd de identiteit, maak de
kleinste correctie, en leg die hier vast.

- Eerst semantische HTML: `nav`, `main`, `table` met `th` en `scope`, `dl` voor definities.
- **Focus is de ring van de huisstijl**: een lijn van `--focus-width` in `--color-focus` op
  `--focus-offset` buiten de rand, met in die tussenruimte een lijn in de tegengestelde inkt
  (`--color-focus-inner`), zodat de ring op elke ondergrond leest; binnen (`focus-inset`) alleen
  waar buiten zou worden afgesneden, de lichte lijn dan aan de rand. In licht is de ring
  bijna-zwart met wit erin, in donker wit met bijna-zwart erin. Op de eigen vulling van het thema
  (het menu, de band van een hero) is het de inverse ring: wit met de donkere lijn erin. Een vlak
  dat een andere ring draagt, zet `--lintje-focus` en `--lintje-focus-inner`, die overerven in
  alles wat erop staat.
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
- **Nog niet geladen is iets anders dan leeg.** De eerste waarde die de host een lijst geeft, al
  is het `[]`, is het laden en wordt niet voorgelezen; elke wijziging erna wel, ook de eerste rij
  in een lijst die leeg laadde.
- Een waarde die animeert, houdt haar eindwaarde in de toegankelijkheidsboom.
- Tekst die met CSS `content` getekend wordt (een regelnummer, een placeholder), heeft een leeg
  alternatief, `content: … / ''`; wat een lezer ervan moet horen, staat in de markup
  (`aria-placeholder`).
- **Tekst die met een beletselteken is afgekapt, staat nooit alleen in een tooltip**: waar geen
  aanwijzer hem toont — onder 768 px, zonder hover, onder de focus van het toetsenbord — loopt hij
  door op een volgende regel. Tekst die geen focus kan krijgen en geen tooltip heeft, kapt nooit
  af: hij loopt altijd door. De uitzondering is het label van een tab onderaan (`mobile-tabs`):
  één regel van 12 px, afgekapt, want een tweede regel past niet in de balk; het hele woord is de
  naam van de tab, en de ontwikkelbuild waarschuwt, zodat een host een label op één kort woord
  houdt.
- **Wat verdwijnt terwijl de focus erop staat, geeft de focus eerst door**: een toast terug naar
  waar hij vandaan kwam (anders `<main>`), een gesloten mededeling naar de volgende stop op de
  pagina, "Alles gelezen" naar de eerste melding. Een element dat leeg raakt en zelf niets
  zichtbaars overhoudt, vraagt eerst de host met een event dat hij annuleert om de focus op zijn
  eigen doel te zetten; anders gaat de focus naar de statusregel die zegt dat het leeg is.
- **Een sessie die verloopt, waarschuwt minstens 20 seconden vooraf** en wordt met één knop
  verlengd (WCAG 2.2.1): in een `lintje-dialog alert persistent`, waarin Escape en de achtergrond
  niets doen omdat de sessie hoe dan ook afloopt.
- **Een sneltoets van één teken kan uit** (`/`, `?`) met `setCharacterKeys(false)`,
  onthouden per browser, met de schakelaar in het overzicht van de sneltoetsen. Een combinatie met
  Ctrl, Alt of Cmd werkt altijd.
- **De popup van een veld sluit als de focus het veld verlaat**, zodat hij nooit het volgende veld
  bedekt; gesloten met Escape of met zijn eigen actie, geeft hij de focus terug aan het veld.
- De optie waarop de toetsen van een lijst staan (`aria-activedescendant`), draagt de focusring
  binnen haar rij: haar vulling alleen haalt ongeveer 1.1:1.
- **Een mark van een grafiek of kaart tekent na een klik geen kader.** Chromium geeft een
  SVG-element met `tabindex` zijn eigen outline, ook zonder `:focus-visible`; `:focus` zet die af,
  en de ring blijft die van het toetsenbord.
- **Een live-regio wordt leeg getekend en krijgt haar woorden een frame later** (tegel, laadring,
  toast): een regio die samen met haar tekst wordt ingevoegd, wordt niet voorgelezen. Zo gaat elke
  melding, ook dezelfde twee keer na elkaar: de regio staat er al, wordt leeg en krijgt de woorden
  een frame later.
- **Wat verandert waar de focus niet staat, zegt een live-regio**: de nieuwe waarde na − of +, de
  beschrijving van de gekozen optie, een verbinding die wisselt. Een bedieningselement zegt alleen
  wat de lezer zelf deed, niet een waarde die de host zet; de eerste keer tekenen zwijgt.
- **Iets wordt één keer gezegd**: wat de focus krijgt, is geen live-regio — de focus is de
  melding (de foutsamenvatting is een groep met haar kop als naam); een tweede kopie van een
  tegel begint met een lege regio; een naam bevat niet de waarde die het element ook als waarde
  zegt.
- **Wat niet geopend kan worden, zegt dat in woorden**: een menurij zonder pagina of toegang
  draagt een verborgen "niet beschikbaar" of "geen toegang"; `aria-disabled` op een gewoon element
  zegt niets.
- **De naam van een bedieningselement is wat je ziet, en het zegt zijn staat één keer** (2.5.3):
  zijn woord, of de naam in zijn logo, zonder `aria-label` dat het vervangt en zonder tooltip die
  het herhaalt. Alleen wat geen woord toont, een icoon of een logo zonder naam, krijgt een naam in
  eigen woorden; een tooltip mag zeggen wat het doet ("Naar de startpagina"). Een knop die zijn
  woord wisselt ("Menu", "Sluiten"), heeft geen `aria-expanded`; een knop met een vast woord
  ("Filters") wel.
- **Een knop die initialen toont, begint zijn naam met wat te zien is** (2.5.3): het
  gebruikersmenu in de balk heet "JV, menu van J. de Vries", het rijtje personen "AB SY MJ +3,
  Meelezers: A. Bakker, …". Zonder initialen is het alleen de naam.
- **Een paneel met gereedschap is een disclosure, geen menu** ("Weergave", "Delen"):
  `aria-expanded` zonder `aria-haspopup`, Tab loopt erdoorheen en sluit het bij het verlaten, en
  Escape of een afgerond item geeft de focus terug aan zijn knop.
- **Een werkbalk is één Tab-stop**: de pijlen lopen rond langs zijn knoppen, ook langs een die
  niet kan, en Tab komt terug op de laatst gebruikte. Een rij knoppen met elk een eigen Tab-stop
  is een `group` met een naam, geen `toolbar`.
- **Een ingedrukte knop (`aria-pressed`) toont dat hij aan staat** met de primaire vulling en haar
  rand, ook onder een aanwijzer; uit is hij plat.
- **Escape geeft de focus alleen terug vanaf waar die was**: een paneel of submenu dat het sluit,
  zet de focus terug op zijn knop alleen als de focus erin of op die knop stond, nooit vanaf
  elders op de pagina.
- **Onder 768 px houdt de tabel elke kolom binnen bereik** (1.4.10): een rij toont haar identiteit
  en één meetwaarde, haar rijmenu, en een knop die de andere kolommen eronder opent als
  beschrijvingslijst; "Sorteren" sorteert op elke kolom. Een cel bewerken blijft voor de bredere
  tabel.
- **Een vastgeplakte balk bedekt nooit de focus** (2.4.11): de actiebalk van het formulier
  reserveert zijn hoogte als `scroll-padding-bottom` van de scroller, en de foutsamenvatting
  scrolt een veld naar het midden. Een element waar de focus toch onder belandt, scrollen de
  actiebalk en de selectiebalk van de tabel van zich vrij, met rand en al. De vastgeplakte vraag
  en het vraagvak van het gesprek houden hun hoogte vrij als `scroll-padding` van de scroller,
  nooit lager dan wat een andere balk daar zette.
- **Een grafiek is ook met het toetsenbord te lezen.** Haar tekening neemt de focus en de
  pijltoetsen lopen langs de categorieën met de tooltip, die een live-regio uitspreekt; Escape
  verbergt een tooltip. De tekening is een afbeelding, of een groep met haar beschrijving als naam
  zodra een teken een knop is. Een teken met focus krijgt zijn ring buiten een opening van 1 px in
  het oppervlak, zodat een oranje teken zijn ring houdt; op een kaart, waar tekens elkaar raken,
  ligt het met die ring boven alle andere. De nullijn, de arcering en de rand van
  een kaartgebied met een cijfer halen 3:1; aangrenzende tinten worden gescheiden door een lijn in
  het oppervlak; een donkergele lijn krijgt een rand in zijn tekstkleur; een label op een vulling
  neemt de tekstkleur van die vulling; een gedimd teken of een uitgeschakelde reeks vervaagt zijn
  kleur, nooit zijn woorden.
- **Een entiteitendiagram is één Tab-stop met zijn teller erna**: de gekozen knoop, anders het
  middelpunt. De pijlen gaan naar de buur die het meest in hun richting ligt, Home naar het
  middelpunt, Enter kiest en Escape maakt het ongedaan. Elke knoop is een knop met haar naam en
  haar soort; een knoop die met de focus verdwijnt, geeft die aan de knoop die hem inklapte, het
  eerste lid van de groep die openging, anders het middelpunt.
- **Een knoop buiten het licht vervaagt zijn icoon en zijn lijnen, nooit zijn naam**:
  die neemt de gedempte tekstkleur, die 4.5:1 houdt. Het ontwerp liet de hele kaart terugstappen;
  dat zou haar naam onder de ondergrens brengen.
- **Een label op een vulling neemt de inkt die op die sport van de ladder 4.5:1 haalt**, wit of
  bijna-zwart, uit één tabel per kleur en per sport. Een sport waar geen van beide dat haalt,
  draagt geen label: de tooltip en de CSV noemen het.
  Waar een label op een band ligt (de rechte strook na een middelste stap van een sankey), wordt
  gedempte tekst de gewone tekstkleur zodra die band nadruk krijgt: op de sterkere tint haalt
  gedempt geen 4.5:1.
- **Een bewerking ter plekke houdt haar toetsen**: Enter en Escape tellen alleen in haar veld,
  niet op haar knoppen, en haar Escape beëindigt de bewerking en verder niets. Beëindigd, geeft
  ze de focus aan haar rij of cel.
- **De toevoeging van een alleen-lezen veld draagt haar tekst in de tekstkleur**, zoals het veld
  zelf: het gedempte grijs haalt op haar donkerdere vlak in donker geen 4.5:1.
- **Een element met een naam in eigen woorden houdt wat zijn label zegt**: een greep, knop of
  popup waarvan de naam als tekst wordt opgebouwd, draagt "(niet verplicht)" en het "afwijkend
  van standaard" van de stip zoals het label doet (`labelText` in
  `components/inputs/shared/input.ts`).
- **De terugzetknop van een veld noemt het veld na zijn eigen woorden**: "Terugzetten naar 2 tot
  12, Leeftijd", het label in verborgen tekst, zodat de naam begint met wat er staat (2.5.3).
- **Een natief veld in een formulier draagt zijn fout zelf**: naast `aria-invalid` de melding als
  `aria-description`, want `aria-describedby` reikt niet tot in de shadow root van het formulier.
  Is de fout weg, dan krijgt het veld de beschrijving van de host terug.
- **Een live-regio die zinnen uitspreekt, is `aria-atomic="false"`**: een nieuwe zin wordt los
  voorgelezen; vervangen tekst, niet voortgezet, wordt vanaf het begin uitgesproken.
- **Een zwevend paneel aan een knop sluit als de focus het verlaat** (een menu, de bel, de
  linkdialoog, Weergave en Delen, het kolomfilter en de kolomkiezer van een tabel): Tab voorbij
  zijn laatste stop sluit het en gaat verder vanaf zijn knop, een focus elders blijft daar, en een
  klik op wat erin geen focus neemt, houdt het open. Een popup-dialoog (het kolomfilter, de
  kolomkiezer) neemt bij het openen de focus naar zijn eerste veld, en Shift+Tab voorbij zijn
  eerste stop sluit hem ook. Escape in een popover is eerst van zijn element (een opgetilde greep
  zet zijn rij terug), dan van de popover.
- **Onder 768 px volgt de CSS van de shell, de tabel en de filterzone hun mediacontroller**
  (`is-phone`, op een host `:state(phone)`), niet een mediaquery: WebKit past een mediaquery in een
  shadow root na het verkleinen van het venster niet opnieuw toe, terwijl het sjabloon al op
  `MOBILE` wisselt.

**Correcties op de huisstijl.** De twee tinten van de primaire kleur in de donkere modus (zie
[Donker](#donker)); `--color-link-on-status`; de lijnkleur van een statusteken (`--color-*-line`),
de statuskleur bijgesteld naar 3:1 op haar eigen tint; de tekstkleur van een statuswoord
(`--color-error-text`, `--color-success-text`), bijgesteld naar 4.5:1 — lichter in donker, het
groen ook donkerder in licht; de eigen tekstkleur van donkergeel; de donkere rand van een lichte
datakleur als lijn of teken; tekst op de sequentiële reeks
vast op bijna-zwart of wit in beide modi; de tekst van het omgevingslabel is bijna-zwart waar wit
op het accent geen 4.5:1 haalt; geel is nooit een lijn of tekst: een los teken in de
toon "let op" neemt de lijnkleur van "aandacht", en een gele vulling staat alleen naast een woord.

**Geaccepteerde tekortkomingen.** Geen ervan draagt op zichzelf betekenis; elk gaat samen met een
glyph, een getal of een woord.

- De datakleuren rood, violet, donkergroen, paars, robijnrood, donkerbruin en donkerblauw halen
  geen 3:1 op het donkere oppervlak, paars daar nagenoeg niet zichtbaar.
- In het thema `defensie` haalt de lijn onder een herkende term geen 3:1 in licht.
- De omlijning van een zwevende sheet in donker haalt geen 3:1.
- In het thema `defensie` haalt alles wat in `--primary` tekent geen AA: witte tekst op het
  oranje van het menu en de footer is 3.2:1, onder de 4.5:1 die WCAG voor gewone tekst vraagt, en
  de tweede regel van het menu (82 % wit) 2.6:1; wit op de oranje vulling van de primaire knop,
  de kopieerknop en de badge `busy` is 3.22:1 (de hover in
  donker 2.80:1); een link en accenttekst op wit zijn 3.22:1, en de gekozen optie van
  `lintje-segmented` 2.81:1. Het wacht op een donkerdere vulling voor dat thema.

## Hergebruik, variant of nieuw

- **Hergebruik** als de betekenis en de vorm bestaan. Verreweg het vaakst.
- **Voeg een variant toe** — een property op de bestaande component — als de betekenis dezelfde
  is en de situatie verschilt: compact, een telefoon, een extra staat. Nooit een kopie onder een
  andere naam.
- **Bouw een nieuwe component** alleen als de betekenis nieuw is en meer dan één pagina hem nodig
  heeft. Hij gaat in `src/components/`, met tokens in plaats van vaste waarden, en in de
  styleguide.

Een bouwsteen bestaat omdat meerdere tags hem nodig hebben, niet omwille van de abstractie.
