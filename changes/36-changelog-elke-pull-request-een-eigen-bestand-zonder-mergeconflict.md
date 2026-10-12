### Gewijzigd

- De changelogregel van een pull request staat in een eigen bestand,
  `changes/<nummer>-<titel>.md`, niet meer onder `[Unreleased]` in `CHANGELOG.md`; twee pull
  requests botsen zo niet meer. `npm run release` zet de bestanden per kop bij elkaar, de nieuwste
  bovenaan, en haalt ze weg. (#36)
