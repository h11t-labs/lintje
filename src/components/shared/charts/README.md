# Grafieken

De grafieken van het Lintje-design system als lit-html-templates: handgemaakte SVG, de vaste
grammatica van `DESIGN_SYSTEM.md` (Grafieken), geen grafiekbibliotheek.

Grafieken zijn **renderfuncties**, geen elementen. Het element eromheen
(`<lintje-chart>`) is eigenaar van de tegel, de toestanden en de events; een grafiek tekent en
geeft zijn staat aan een controller. `components/charts/chart/chart.ts` is het echte werk,
in hoofdlijnen:

```ts
import { ChartController } from '../../shared/charts/shared/controller'
import { renderChart } from '../../shared/charts/shared/render-chart'
import { chartStyles } from '../../shared/charts/shared/chart-styles'
import { MediaController } from '../../../core/media'
import { LintjeContentTileElement } from '../../shared/content-tile'

export class LintjeChart extends LintjeContentTileElement {
  static override styles = [/* the tile's own sheets */ ...chartStyles]

  readonly #chart = new ChartController(() => this.requestUpdate())
  readonly #mobile = new MediaController(this)

  protected override render(): TemplateResult {
    // The real element renders the tile, the data states and the expand modal
    // around this; `data` is optional, so it guards before it draws.
    return renderChart(this.data!.chart, {
      controller: this.#chart,
      description: this.data!.description,
      mobile: this.#mobile.matches,
    })
  }

  override disconnectedCallback(): void {
    this.#chart.detach()
    super.disconnectedCallback()
  }
}
```

De basis is `LintjeContentTileElement` (`components/shared/content-tile.ts`), die
de drie inhoudstegels hun gedeelde vergrotingsmodal geeft en de events van die modal stopt; de
events van de eigen tegel stopt elke subklasse zelf. Een grafiektegel houdt
**twee** controllers bij, omdat dezelfde grafiek twee keer getekend wordt — één keer in de tegel,
één keer in de modal — en de gemeten breedte van de modal niet die van de tegel is.

## De API

```ts
renderChart(spec: ChartSpec, options: ChartOptions): TemplateResult
renderMap(data: MapSpec, options: MapOptions): TemplateResult
```

`ChartSpec` en `MapSpec` zijn gedeclareerd in `components/shared/charts/shared/types.ts`; `types.ts`
exporteert ze opnieuw. Een spec
mag zijn kleuren bij paletnaam noemen (`'sky-blue'`, `'dark-yellow'`); elke
renderfunctie zet ze zelf om via `chartColor()`, dus een host geeft
de spec direct door.

Per soort is er ook een benoemde functie, met de kaderonderdelen en de toestanden ernaast: zie
`components/shared/charts/index.ts`.

### `ChartOptions`

| veld | betekenis |
| --- | --- |
| `controller` | de `ChartController` voor deze grafiek. Eén per grafiek. |
| `description` | de `<desc>`: het toegankelijke alternatief. Verplicht. |
| `mobile` | onder 768 px. De host beslist, op basis van een media query (`MediaController`, `core/media.ts`). De heatmap neemt dan het `mobile`-grid van de spec — zonder dat kantelt een grid dat breder is dan hoog (`phoneGrid`) — en laat zijn hover-tooltip vallen; de kaart wordt lager, met de legenda ingeklapt. |
| `height` | een vaste hoogte in px in plaats van het token `--chart-h-main` / `--chart-h-small`. |
| `plotArea` | een eigen `PlotArea` in plaats van de gemeten. |
| `expanded` | getekend in de vergrotingsmodal: de grafiek mag de hoogte van de body nemen; de taart groeit en zijn tabel wordt een kolom. |

Het plotgebied begint bij `DEFAULT_PLOT_AREA` (`scale.ts`) met de gemeten breedte en hoogte
van de controller. Elke grafiek met assen vervangt daarna `left` door
`axisColumn(ticks, width, { fontFamily })`: het breedste ticklabel (gemeten op een
canvas in het aslettertype) plus `AXIS_GAP`, begrensd op `AXIS_COLUMN_MAX` en
`AXIS_COLUMN_SHARE`. Als de volledige labels niet
binnen de grenzen passen, is de `format` van de kolom de compacte — geef die aan
`renderChartFrame` als `formatTick`. De grafiek met twee assen meet beide kolommen;
een lijngrafiek geeft als `minimum` de halve breedte van het eerste x-label mee, dat
gecentreerd staat op de linkerrand van de plot. Grafieken met een label per rij (horizontale
staven, doelvoortgang) gebruiken in plaats daarvan `rowLabelColumn(labels, width, { fontFamily })`:
het breedste label, begrensd op `ROW_LABEL_SHARE` en `ROW_LABEL_MAX`, waarbij `fit()`
een breder label inkort met een beletselteken.

### De kaart

`MapOptions` voegt `onSelect(mark: MapValue)`, `onClear(previousId)` en `onLayerChange(value)`
toe — wat het element omzet in de events `lintje-mark-select` (`{id, label, href?}` met de eigen
href van de markering, of `{id: null, label: null, href: clearHref}` als de selectie ongedaan wordt gemaakt)
en `lintje-layer-change`, die een host in de URL schrijft.

De kaart over WMS-tegels (`map-chart/leaflet.ts`) pakt een imperatieve bibliotheek in. Drie
dingen bijten:

- het oppervlak ervan kan niet in een Lit-template leven, dus het hangt aan de `ChartController`
  en `controller.detach()` haalt het weg;
- een `ref`-callback vuurt terwijl de node nog in het fragment staat waarin hij gekloond is: bouw
  vanaf de eerste meting van de `ResizeObserver`, niet vanaf de `ref`;
- de container heeft een eigen stacking context nodig (`z-index: 0`): Leaflet nummert zijn panes
  tot 700.

### Een markering die doorklikt

Elke grafieksoort met een markering om op te klikken — staven, gegroepeerde staven, horizontale staven,
taartpunten, gestapelde segmenten, heatmapcellen; geen lijnpunten — volgt datzelfde
contract, via `ChartOptions`: `selectedId`, `onSelect` en `onClear`. Een markering
wordt een `role="button"` met `aria-pressed` als, en alleen als, haar datapunt
een `href` draagt die de host heeft aangemaakt. Een markering die een record is (`rows`, `segments`)
draagt zelf `id` en `href`, zoals een tabelrij; een markering die een kaal
getal is, krijgt een `ChartLink` uit de `links` van de grafiek, item voor item.
`components/shared/charts/shared/mark-select.ts` doet het werk: `markSelection(options, links)` geeft een renderfunctie
de attributen per markering en de Escape-handler voor de wrapper.

Twee verschillen met de kaart. Een grafiek houdt **geen** eigen selectie bij:
`selectedId` is alles wat er is en komt uit de URL, dus een klik navigeert en
het antwoord komt met de pagina mee. En een `selectedId` die geen van de markeringen noemt
die de grafiek tekent, is helemaal geen selectie — de grafiek tekent elke markering ongedimd.

### `ChartController`

Alles wat een render overleeft. De host maakt hem aan met zijn eigen
`requestUpdate` en houdt hem vast zolang de grafiek leeft:

```ts
new ChartController(() => this.requestUpdate())
```

- `id` — stabiel per grafiek; `<desc>` en het arceringspatroon worden ermee geadresseerd.
- `attach` — een gebonden `ref`-callback voor het buitenste element van de grafiek. Elke
  renderfunctie plaatst hem zelf; de host doet niets.
- `width`, `height`, `inView` — wat `attach` meet. De viewBox wordt 1:1 gezet op
  de gemeten pixels, zodat astekst van 12 px 12 px blijft in een smalle tegel; de
  hoogte komt uit een token dat op het element zelf gelezen wordt, zodat een lokale override (de
  `--chart-h-main` van de modal, de hoogte van de body) wordt opgepikt. `inView` is de poort voor het intekenen: de
  markeringen blijven in hun beginstand tot 35 % van de grafiek in beeld is geweest, één keer.
- `tooltip`, `hoverIndex`, `status`, `hiddenSeries`, `hoverSegment`, `selectedCell`,
  `dimmedClass`, `zoom`, `mapCentre`, `mapSelection`, `legendOpen` — de interactiestaat,
  met `showTooltip`, `showTooltipAt`, `hideTooltip`, `hoverAt`, `dismiss` (Escape) en
  `toggleSeries` om hem te wijzigen.
- `detach()` — stopt de observers. Roep hem aan vanuit `disconnectedCallback`.

De tekening van elke grafiek met assen neemt de focus: `plotKeys` (`shared/plot-keys.ts`) loopt
met de pijltjestoetsen, Home en End door haar categorieën, zet de tooltip op de bereikte en
schrijft die in `status`, die `renderPlotStatus` uitspreekt. Een markering die doorklikt, houdt
haar eigen Enter.

Er vuurt een `requestUpdate` per muisbeweging. Een `LitElement` bundelt die al; een
host zonder Lit moet ze zelf bundelen.

## De CSS

`shared/chart.css`, `pie-chart/pie-chart.css`, `heatmap-chart/heatmap-chart.css` en `map-chart/map-chart.css` bevatten de eigen BEM-regels
van de grafieken. De knopreset, `visually-hidden` en de keyframes komen uit
`tokens/base.css`, dat elk element adopteert.

Een shadow-DOM-host adopteert ze via `chartStyles` in `shared/chart-styles.ts`, en een kaart voegt
`mapStyles` toe (`map-chart/map-styles.ts`: het stylesheet van de kaart en dat van Leaflet) — apart, zodat een grafiek die
geen kaart tekent geen Leaflet meedraagt. De **tokens** komen van buiten — custom properties
gaan over de shadow-grens heen.

De skeleton en de foutstaat schrijven de eigen markup van het design system
(`lintje-skeleton`, `lintje-announcement`) maar niet hun CSS; die brengt de host mee,
zoals hij de tokens meebrengt. Zonder eigen announcement schrijft `renderChartError`
`liveAnnouncement` — een `<lintje-announcement>`, die de aanroeper definieert (de bundel doet dat); een
host met een eigen announcement geeft die mee aan `renderChartError({ announcement })`.

## Een grafiek schrijven

Alles binnen een `<svg>` moet gebouwd worden met de `svg`-tag van lit, niet `html` — een
`html`-template in een svg belandt in de HTML-namespace en tekent niets.
Dat is wat `SvgSlot` typeert. SVG-attributen worden precies geschreven zoals SVG ze
spelt — kebab-case voor `stroke-width`, `stroke-dasharray`, `text-anchor`,
`fill-opacity` en `font-weight`; camelCase voor `viewBox`, `patternUnits`,
`patternTransform`, `preserveAspectRatio` en `pathLength`.

## De demo

De categorie "Kerncijfers en grafieken" van de styleguide (`examples/styleguide/?category=charts`)
tekent elke soort en de drie grafiektoestanden in een `<lintje-chart>`; de categorie "Kaart"
(`?category=map`) tekent de kaartvarianten in een `<lintje-map>`. De specs worden gebouwd in
`examples/styleguide/specimens/charts.js` en `map.js` uit `examples/_data/*.json`, zodat de
pagina geen TypeScript laadt: `npm run build:elements`, dan `npm run dev` (of een willekeurige
statische server in de root van de repository) en open `/examples/styleguide/?category=charts`.
