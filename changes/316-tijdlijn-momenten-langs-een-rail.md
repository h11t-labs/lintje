### Toegevoegd

- Een tijdlijn: momenten langs een rail, staand of liggend, aan één kant, om en om of per kant, met vandaag op de rail en eerst de momenten het dichtst bij nu. Een moment heeft drie regels: de datum en een label boven de kop, de kop, en eronder een zin, een link en een eigen slot. Een moment kan zeggen wie het deed: een persoon met zijn rondje, of wat geen persoon is ("Systeem") met een icoon in het rondje. (#316)

### Verwijderd

- **Brekend:** `lintje-activity-log` vervalt; een logboek is nu een `lintje-timeline`. Geef `entries` als `moments`, elk `{ who, title: what, when, at }`, het nieuwste eerst zoals voorheen en `limit="10" step="10"` voor tien per keer. De tijd staat boven de regel, of aan één kant in een kolom vóór de rail. Een naam als tekst is nu geen persoon meer en krijgt het rondje met tandwielen: geef een persoon als `Person`. Het type `ActivityEntry` vervalt met het element. (#316)
