### Toegevoegd

- Tabs onderaan op een telefoon: met `mobile-tabs` op `lintje-shell` staan onder 768 px de losse pagina's als tabs onder de duim, ten hoogste vijf, met Menu als laatste en het paneel van Menu als blad erboven. Met `tab-parts` kiest de host welke delen van de shell (Menu, Zoeken) een tab zijn; elk deel staat op één plek. Een ingang met `action` opent iets van de host in plaats van een pagina en stuurt `lintje-action` met die naam, ook in de rail en de navigatiebalk. Wat onderaan plakt, leest de hoogte van de tabs uit `--lintje-shell-bottom`; het vraagvak van het gesprek en een toast doen dat al. (#325)

### Verwijderd

- **Brekend:** `mobile-bar` op `lintje-shell`, met `top` en `bottom`. De balk bovenaan is er op een telefoon altijd; wie Menu onder de duim wil, zet `mobile-tabs`. (#325)
