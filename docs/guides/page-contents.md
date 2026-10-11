# Een inhoudsopgave op de pagina

Een lange tekst krijgt "Op deze pagina": een lijst met de koppen, die laat zien waar de lezer is.
Dat is `lintje-sub-nav` met `expanded`, geen eigen element. Het submenu tekent alleen. Jij vult de
ankers, volgt het scrollen en plaatst de lijst. Het besluit staat in
[`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md), onder "Navigatie en shell".

## De lijst vullen

Elk item is een kop van de pagina, met een anker als `href`. Een kop van het tweede niveau staat in
`items` van zijn kop erboven. Met `expanded` staat elk niveau er, zodat de lijst niet verspringt
terwijl de lezer scrolt.

```html
<div class="artikel">
  <article>
    <h2 id="wie">Wie kan een vergunning aanvragen</h2>
    …
    <h2 id="aanvragen">Zo vraagt u aan</h2>
    <h3 id="online">Online aanvragen</h3>
    …
  </article>
  <lintje-sub-nav expanded label="Op deze pagina"></lintje-sub-nav>
</div>
```

Staan de koppen in `lintje-prose`, zoek ze dan in zijn `shadowRoot` in plaats van in `document`.

## De sectie in beeld volgen

De huidige sectie is de laatste kop die boven de balk van de shell is geschoven. Die balk houdt
zijn hoogte vrij als `scroll-padding-top`, dus die waarde is de lijn. Onderaan de pagina haalt een
korte laatste sectie die lijn nooit; daar is de laatste kop in beeld de huidige. Zet de sectie als
`active`; het submenu markeert haar en haar kop erboven.

```js
const nav = document.querySelector('.artikel lintje-sub-nav')
const sections = [
  { label: 'Wie kan een vergunning aanvragen', href: '#wie' },
  {
    label: 'Zo vraagt u aan',
    href: '#aanvragen',
    items: [{ label: 'Online aanvragen', href: '#online' }],
  },
]

const all = (items) => items.flatMap((item) => [item, ...all(item.items ?? [])])
const mark = (items, href) =>
  items.map((item) => ({
    ...item,
    active: item.href === href,
    ...(item.items ? { items: mark(item.items, href) } : {}),
  }))

let shown
function update() {
  const root = document.documentElement
  const end = scrollY + innerHeight >= root.scrollHeight - 1
  const line = end ? innerHeight : (parseFloat(getComputedStyle(root).scrollPaddingTop) || 0) + 1
  let href = null
  for (const item of all(sections)) {
    const heading = document.getElementById(item.href.slice(1))
    if (heading && heading.getBoundingClientRect().top <= line) href = item.href
  }
  if (href === shown) return
  shown = href
  nav.groups = [{ label: 'Op deze pagina', items: mark(sections, href) }]
}

let frame = 0
const schedule = () => {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(update)
}
addEventListener('scroll', schedule, { passive: true })
addEventListener('resize', schedule)
addEventListener('load', schedule)
schedule()
```

Een klik op een item is een gewone link: de browser springt naar de kop, en het submenu meldt de
klik als `lintje-navigate` ([events](events.md)). Scrolt je pagina een eigen container
(`setHostConfig({ scrollRoot })`), luister dan daar naar `scroll` en lees daar de scroll-padding.
De update na `load` en `resize` vangt een pagina die pas na het script haar hoogte kreeg.

## De lijst plaatsen

Vanaf 1024 px staat de lijst naast de tekst en plakt ze onder de balk van de shell. Smaller staat ze
boven de tekst, en onder 768 px is ze de knop van het submenu, die de lijst openklapt.

```css
.artikel {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--space-8) var(--space-10);
}
.artikel > article { flex: 999 1 560px; min-width: 0; max-width: var(--w-text); }
.artikel > lintje-sub-nav { flex: 1 1 240px; max-width: var(--w-nav); }

@media screen and (max-width: 1023px) {
  .artikel > lintje-sub-nav { order: -1; flex-basis: 100%; max-width: none; }
}
@media screen and (min-width: 1024px) {
  .artikel > lintje-sub-nav { position: sticky; top: calc(var(--h-topbar) + var(--space-6)); }
}
```

Laat een lijst die hoger is dan het scherm niet plakken: haar onderste koppen zou de lezer dan pas
aan het eind van de tekst bereiken.
