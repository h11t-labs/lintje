# Eigen iconen

Lintje haalt elk icoon op uit de iconenmap die jouw pagina serveert: de map die je met
`setIconSource` aanwijst ([laden](loading.md#iconen)). Een eigen icoon toevoegen is dus: een
SVG-bestand in die map zetten en het bij zijn naam noemen. Er is niets te bouwen of te registreren.

Er is één iconenmap per pagina. Iconen uit een andere bron — een eigen map, een package van je
organisatie — kopieer je dus in die map, naast de iconen van Lintje.

## Zit het al in de set?

De iconenmap heeft ruim duizend iconen, van RVO en van Lintje zelf. Een icoon uit de set past bij
de rest, dus kijk daar eerst. Elke naam is `<categorie>-<naam>` in kleine letters, zoals
`functioneel-home` of `gebouwen-ziekenhuis`, en de bestanden staan op naam in de map:

```bash
ls dist-icons | grep document
```

## In drie stappen

**1. Maak het bestand.** Een vierkante `viewBox` van 24, en geen kleur: Lintje tekent het icoon in
de tekstkleur, zodat het meekleurt met licht, donker en het thema. Een gevuld icoon:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M6 2h8l4 4v16H6z" />
</svg>
```

Een omtrekicoon zet de lijn op de `<svg>` en `fill="none"` op elke vorm erin:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path fill="none" d="M6 2h8l4 4v16H6z" />
</svg>
```

**2. Zet het in je iconenmap,** naast de andere bestanden. De bestandsnaam zonder `.svg` is de
naam van het icoon. Begin hem met de naam van je applicatie, zoals `meldingen-dossier.svg`: zo botst
hij nooit met een icoon uit de set, ook niet met een naam die er in een volgende versie bij komt.

**3. Noem het bij zijn naam,** overal waar Lintje een icoon neemt. In HTML:

```html
<lintje-icon name="meldingen-dossier" label="Dossier"></lintje-icon>
```

En in de data van een element, bij elk veld `icon` (een menu-item, een tegel, een KPI, een
rijactie):

```js
navigation: [{ label: 'Dossiers', icon: 'meldingen-dossier', href: '/dossiers' }]
```

Zonder `label` is het icoon versiering en slaat een schermlezer het over; met `label` is het een
afbeelding met die naam. Lintje haalt het bestand op de eerste keer dat de naam getekend wordt, één
keer per pagina.

## Een hele set uit een eigen package

Heeft je organisatie een package met iconen, bijvoorbeeld in `icons/svg/*.svg`, kopieer de
bestanden dan in je build-stap in de iconenmap, elk met hetzelfde voorvoegsel:

```bash
mkdir -p public/icons
cp -R pad/naar/lintje/dist-icons/. public/icons/
for f in node_modules/@organisatie/iconen/icons/svg/*.svg; do
  cp "$f" "public/icons/intern-$(basename "$f")"
done
```

Met `setIconSource({ base: '/icons/' })` is `icons/svg/dossier.svg` uit het package daarna
`intern-dossier`, en de iconen van Lintje werken gewoon door. Doordat de kopie in de build-stap
staat, gaat een nieuwe versie van Lintje of van het package vanzelf mee.

Controleer een paar bestanden uit het package voordat je de hele set gebruikt. Een set uit een
ontwerptool wijkt vaak af van wat Lintje tekent:

- **Een kleur als attribuut** (`fill="#154273"`) blijft staan: het icoon kleurt dan niet mee met de
  tekst en verandert niet in donker. Alleen zwart in een export met `fill="none"` op de `<svg>`
  wordt de tekstkleur.
- **Kleuren en lijnen in `style="…"` of een `<style>`-blok met klassen** (`.cls-1 { … }`) tekent
  Lintje niet. Een gevuld icoon wordt dan in de tekstkleur gevuld en ziet er meestal goed uit; een
  omtrekicoon verliest zijn lijnen.
- **Een omtrekicoon** heeft `fill="none"` op elke vorm nodig, niet alleen op de `<svg>`.

Wijkt de set af, zet de bestanden dan één keer om in het package zelf, of in de build-stap met een
SVG-optimalisator die stijlen omzet naar attributen (SVGO met `inlineStyles` en
`convertStyleToAttrs`), en vervang de vaste kleuren door `currentColor`.

## Werkt het niet?

Een naam zonder bestand tekent niets, zonder foutmelding. Kijk in het netwerkpaneel van de browser
welk adres er werd opgevraagd:

- **`/icons/meldingen-dossier.svg` in plaats van jouw map:** `setIconSource` is niet aangeroepen,
  of in een andere kopie van Lintje dan die de elementen tekent. Laad alles uit één map
  ([laden](loading.md#twee-manieren-van-laden-en-een-pagina-kiest-er-één)).
- **Een 404 in jouw map:** de bestandsnaam klopt niet met de naam. Let op hoofdletters en laat
  `.svg` weg uit de naam.
- **Het oude icoon blijft staan:** de browser heeft het bestand gecachet. Geef `setIconSource` een
  nieuwe `version`.
- **Een omtrekicoon is een gevuld vlak:** zet `fill="none"` op elke vorm, niet alleen op de
  `<svg>`.
- **Het icoon heeft een vaste kleur, of verdwijnt in donker:** het bestand noemt een kleur. Haal
  die `fill` of `stroke` weg, of maak hem `currentColor`.
- **Een deel van het icoon ontbreekt:** het bestand gebruikt `style` of `<style>`, en die tekent
  Lintje niet. Zet de vorm in attributen als `fill` en `stroke`.

## Een icoon dat je al als URL hebt

Heb je het icoon als URL of als data-URI, dan kan het zonder bestand in de iconenmap, op twee
plekken: `<lintje-icon>` en de navigatie van de shell.

```html
<lintje-icon src="/static/meldingen/dossier.svg" label="Dossier"></lintje-icon>
```

```js
navigation: [{ label: 'Dossiers', iconSrc: 'data:image/svg+xml,…', href: '/dossiers' }]
```

Het icoon wordt in de tekstkleur geschilderd: alleen de vorm telt, niet de kleuren in het bestand.
Een tegel, een KPI en de andere elementen nemen alleen een naam.

## Een icoon uit de set vervangen

Een bestand met de naam van een icoon uit de set vervangt dat icoon. Weglaten kan ook: dan tekent
de naam niets, en een knop toont zijn tekst in plaats van het icoon.

De iconen die de elementen zelf tekenen — de pijltjes, het kruis, de statustekens, de knoppen van
de spelers — zitten in Lintje zelf en zijn niet te vervangen. De styleguide toont ze bij het
element `icon`, onder "register".

## Een nieuwe versie van Lintje

Een nieuwe versie brengt een nieuwe iconenmap mee. Bewaar je eigen iconen daarom in een eigen map
of package en kopieer ze in je build-stap in de iconenmap, zoals hierboven; geef `setIconSource`
daarna een nieuwe `version`.

Een icoon dat ook andere applicaties nodig hebben, hoort in Lintje zelf:
[`CONTRIBUTING.md`](../../CONTRIBUTING.md).
