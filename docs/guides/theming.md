# Tokens, thema's, modus en het embleem

## `tokens.css`

Eén bestand dat het bouwen oplevert: de thema's, dan de tokens. Het moet op de *pagina* staan: de thema's
zijn op documentniveau. Het is ook waarmee je eigen inhoud zich opmaakt:

```css
body {
  margin: 0;
  background: var(--color-bg-page);
  color: var(--color-text-primary);
  font: var(--text-ui);
}
```

**Het bestand is niet optioneel.** De variabelen van het thema staan alleen daar, dus zonder het bestand heeft een
element geen primaire kleur.

## Het lettertype

RijksSans komt uit de set van RVO (`@nl-rvo/assets`). `fonts.css` bevat de twee `@font-face`-regels
en noemt de twee bestanden in `fonts/` ernaast, waar het bouwen ze neerzet. Serveer `fonts/` met
`fonts.css` en link het op de pagina; een pagina zonder tekent in het reservelettertype van `--font-ui`.

## Het thema

Eén attribuut op het document: `<html data-theme="marine">`. Een pagina die er geen zet, krijgt
`rijksoverheid`. De bibliotheek draagt er zes: `rijksoverheid`, `marechaussee`, `landmacht`,
`marine`, `luchtmacht`, `defensie`.

**Een eigen thema is één regel in je eigen stylesheet**, na `tokens.css`:

```css
[data-theme='mijn-organisatie'] {
  --primary: #01689b;
  --accent: #e17000;
}
```

Die twee zijn alles wat een thema zet; de kleur bij aanwijzen, lijnen en tinten worden afgeleid. In donker krijgen lijnen
en tekst een lichtere tint van de primaire kleur, afgestemd op de zes thema's die de bibliotheek draagt; een
eigen thema is niet getoetst aan de ondergrenzen van Lintje.
[`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) zegt waarom.

De afgeleide kleuren gebruiken `color-mix()` en relatieve kleur (`oklch(from …)`): Chrome/Edge 122+,
Firefox 128+, Safari 18+.

## De huisstijl

De Rijkshuisstijl tekent online sinds 2025 anders dan eerst: een wit menu, kleine afgeronde
hoeken op knoppen en kaders, één grote hoek op de kop van de pagina, een donkere focusring met
een witte lijn erin, de foutmelding boven het veld. Lintje tekent beide. Tot 1.0.0 is de eerdere
huisstijl de standaard; de nieuwe kies je met één attribuut op de pagina, dat elk element op zijn
eigen host spiegelt, zoals `data-mode`:

```html
<html lang="nl" data-style-version="new">
```

De grote hoek van de paginakop en de voet (`--radius-corner`, een lint) hoort bij de nieuwe
huisstijl en heeft zijn eigen schakelaar: `data-page-corner="square"` op de pagina laat hem weg,
zonder dat attribuut is hij rond. In de eerdere huisstijl is alles recht. Het menu van
`lintje-shell` volgt de huisstijl (licht in de nieuwe, gevuld in de eerdere), tenzij de host het
zelf kiest met `nav-tone`.

## Modus

Elk element bepaalt hem zelf, en de eerste stap die iets zegt, wint: zijn eigen `mode`-attribuut;
de dichtstbijzijnde voorouder met `data-mode`, over shadow roots heen; `mode` in zijn `data`;
dan `light`.

Het gewone geval is één regel: `<html data-mode="dark">`. Een element
leest `prefers-color-scheme` nooit zelf. Om het systeem van de lezer te volgen, zet je het attribuut
vanuit script, voordat de pagina voor het eerst getekend wordt:

```js
const dark = matchMedia('(prefers-color-scheme: dark)')
const apply = () => (document.documentElement.dataset.mode = dark.matches ? 'dark' : 'light')
dark.addEventListener('change', apply)
apply()
```

`data-mode` bevat altijd alleen `light` of `dark`. `lang` is het
gewone HTML-attribuut; geen element leest het, dus zet `lang="nl"` voor schermlezers en woordafbreking.

## Het embleem

De `data` van de shell heeft er twee velden voor, en `logo` wint.

- **`logo`** — een URL of data-URI die je zelf hebt bepaald, getekend als afbeelding.
- **`emblem`** — `{ name, label, byline? }`, op iconbestandsnaam: `name` is het lint, `label`
  de naam van de organisatie, geschreven als tekst naast het lint in de logobalk, en `byline` een
  tweede regel eronder. De bestanden zijn de `embleem-*` in `dist-icons/`.

Zonder een van beide houdt de shell op die plek een leeg vak van de juiste maat.

**Teken een Rijkshuisstijl-embleem nooit na en benader het nooit.** Zonder het bestand lever je de lege plek.
