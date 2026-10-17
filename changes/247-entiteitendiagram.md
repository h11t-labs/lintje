### Toegevoegd

- Entiteitendiagram `lintje-graph` in een eigen categorie, Netwerk: een host stuurt knopen, hun soorten en hun relaties, en het element deelt ze in (gelaagd, door kracht of radiaal), tekent ze als kaarten of uitgezoomd als merktekens, groepeert meer dan vijf bladeren van één soort, klapt takken in en uit met een teller in de kaart, haalt op aanvraag buren op, zoomt zoals de kaart, met een overzicht, en geeft de tekening als PNG. Boven honderd knopen wordt de indeling in een worker berekend (`dist-elements/workers/`). (#247)

### Gewijzigd

- `renderStatusDot()` tekent de statusstip ook in een root zonder het element, zoals `renderBadge()`; de legenda van een grafiek kan per item een icoon en een aantal tonen; `place()` kent `bottom-center`; het plaatje van `chartImage()` tekent ronde vakken, snijdt af wat het scherm afsnijdt, en laat een element eigen bedieningselementen weglaten en eigen knoppen tekenen. (#247)
