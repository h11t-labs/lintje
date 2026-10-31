### Toegevoegd

- Tabs onderaan op een telefoon: met `mobile-tabs` op `lintje-shell` staan onder 768 px de losse pagina's als tabs onder de duim, ten hoogste vijf, met Menu als laatste en het paneel van Menu als blad erboven. Met `tab-parts` kiest de host welke delen van de shell (Zoeken, Meldingen, Jij, Menu) een tab zijn; elk deel staat op één plek. Een ingang met `action` opent iets van de host in plaats van een pagina en stuurt `lintje-action` met die naam, ook in de rail en de navigatiebalk. Wat onderaan plakt, leest de hoogte van de tabs uit `--lintje-shell-bottom`; het vraagvak van het gesprek en een toast doen dat al. (#325)

### Gewijzigd

- De balk op een telefoon is in beide indelingen dezelfde: de logobalk scrolt weg en een balk van 56 px blijft plakken, met de naam (en zodra de paginakop uit beeld is de titel van de pagina), zoeken, de bel, de avatar en Menu. De header van 72 px in de indeling met het menu naast de pagina vervalt. Een pagina dieper draagt Terug voor de titel (`back` in de data van de shell). Jouw menu opent op een telefoon als blad van onderen; het paneel van Menu draagt geen gebruiker meer en loopt van kort naar lang: de omgeving, Weergave, Delen en het `end`-slot, de pagina's, dan feedback en de versie. (#325)

### Verwijderd

- **Brekend:** `mobile-bar` op `lintje-shell`, met `top` en `bottom`. De balk bovenaan is er op een telefoon altijd; wie Menu onder de duim wil, zet `mobile-tabs`. (#325)
