### Toegevoegd

- `lintje-graph`: de lezer kiest een lijn met een `id` (`GraphEdge.id`), met muis, vinger of Tab
  vanaf haar knoop. Het woord van een kiesbare lijn staat in een kader; een gekozen lijn wordt
  dikker in de rand van een gekozen knoop met haar woord vet. De dichtstbijzijnde lijn binnen
  12 px wint de aanwijzer, op een knoop wint de knoop. De host houdt de keuze in
  `GraphData.selectedEdge` en hoort `lintje-edge-select` en `lintje-edge-open`. (#356)
