### Gewijzigd

- De build minificeert de modules en de ingesloten CSS: `lintje.js` gaat van 1,9 naar 1,5 MB (gzip van 468 naar 389 kB), `tag/map.js` van 624 naar 438 kB. De CSS wordt niet omlaag vertaald: `color-mix()` en `oklch()` blijven zoals ze geschreven zijn. (#221)
- De unittests delen één happy-dom-venster per worker en `npm run test:unit` draait daardoor bijna drie keer zo snel; `src/bundle/unit-setup.ts` zet vóór elk bestand de pagina terug, en een test die een lege registry nodig heeft of een module mockt, draait in het project `unit-window`. (#221)
