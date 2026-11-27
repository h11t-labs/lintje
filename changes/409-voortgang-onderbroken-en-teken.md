### Opgelost

- `lintje-progress-bar` tekent onderbroken in de toon van let op, zoals de badge van die staat, en toont het teken van klaar, fout en onderbroken ook zonder label, vóór de balk en zonder dat de balk hoger wordt (#409)
- De balk van `lintje-stepper` op een telefoon is op de laatste stap vol maar nog niet klaar, zolang die stap open is (#409)

### Gewijzigd

- Een `state` die de host op `lintje-progress-bar` zet, wint ook bij 100%; zonder `state` wordt de balk bij 100% vanzelf klaar, zoals voorheen (#409)
