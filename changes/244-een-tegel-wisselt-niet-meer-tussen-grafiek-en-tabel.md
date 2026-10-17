### Verwijderd

- Een grafiektegel wisselt niet meer tussen grafiek en tabel: `lintje-chart` tekent geen "Grafiek" / "Tabel" meer in zijn kop. De cijfers staan in de tooltip en de CSV; een tabel die de lezer nodig heeft, staat apart. Brekend: het veld `tableSwitch` is weg uit `ChartData`, dus een host die het nog meegeeft, krijgt een typefout. (#244)
