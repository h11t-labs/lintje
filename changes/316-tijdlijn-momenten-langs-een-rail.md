### Toegevoegd

- Een tijdlijn: momenten langs een rail, staand of liggend, aan één kant, om en om of per kant, met vandaag op de rail en eerst de momenten het dichtst bij nu. Een moment kan zeggen wie het deed: een persoon met zijn rondje, of wat geen persoon is ("Systeem") met een icoon in het rondje. (#316)

### Verwijderd

- **Brekend:** `lintje-activity-log` vervalt; een logboek is nu een `lintje-timeline`. Geef `entries` als `moments`, elk `{ who, title: what, when, at }`, het nieuwste eerst zoals voorheen, `limit="10" step="10"` voor tien per keer, en `dates="below"` voor de tijd onder de regel. Het type `ActivityEntry` vervalt met het element. (#316)
