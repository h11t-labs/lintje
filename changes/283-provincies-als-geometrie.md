### Toegevoegd

- De kaart heeft de twaalf provincies als ingebouwde geometrie (`geo: 'provinces'`), elk met haar ISO 3166-2-code als id (`NL-UT`) en haar Nederlandse naam, uit CBS/PDOK *Gebiedsindelingen*; een choropleet per provincie heeft geen eigen vlakken van de host meer nodig. De bundel groeit met 33 kB (5,5 kB gzip). (#283)

### Opgelost

- De rand van een vlak op de kaart onder de aanwijzer of gekozen loopt aan elke kant heel door: een buurvlak dat later getekend is, bedekt hem niet meer half, ook op de wereldkaart en in donker. (#283)
