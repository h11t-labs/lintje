### Gewijzigd

- De unittests delen één happy-dom-venster per worker en `npm run test:unit` draait daardoor bijna drie keer zo snel; `src/bundle/unit-setup.ts` zet vóór elk bestand de pagina terug, en een test die een lege registry nodig heeft of een module mockt, draait in het project `unit-window`. (#221)
