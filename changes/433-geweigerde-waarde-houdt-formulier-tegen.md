### Toegevoegd

- `refusal` op elk invoerelement: de melding over getypte tekst die het veld niet kan vastleggen, leeg als er niets geweigerd is (#433)

### Gewijzigd

- Een getal-, datum- of tijdveld met getypte tekst die het weigert, houdt het formulier tegen, ook bij een druk op de verzendknop of Enter meteen na het typen: een gewoon `<form>` via de geldigheid van het element, `lintje-form` door de focus op het veld te zetten en het in de foutsamenvatting te noemen. Voorheen verstuurde de verzendknop de vorige waarde. De melding verschijnt of verdwijnt na het loslaten van een druk, zodat de knop onder de aanwijzer niet verschuift. (#433)
