### Toegevoegd

- Een tabelkolom en een veld in het detail van een rij kunnen `format: 'date'` of
  `format: 'datetime'` krijgen. De host geeft ISO 8601; de tabel toont `05-01-2026` of
  `05-01-2026 14:30` in de tijdzone van de lezer, in een `<time>`, en sorteert op de dag of het
  moment. Een ontbrekende of ongeldige waarde sorteert het laagst, en de CSV houdt de ISO-waarde.
  (#352)

### Gewijzigd

- Een tekstkolom sorteert een getal in de tekst op zijn waarde: "Item 9" komt nu vóór "Item 10".
  Een tabel met zulke tekst kan daardoor in een andere volgorde staan. (#352)
