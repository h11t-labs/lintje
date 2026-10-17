### Toegevoegd

- `lintje-chat-questions`: de vragen van de assistent in een box boven het tikveld, in de korte
  vorm (knopjes, één tik verstuurt) of in stappen met Vorige, Volgende en Versturen, met "Iets
  anders…" in elke keuzevraag en het event `lintje-questions-answer`. `lintje-chat` tekent de box
  bij `questions` op het laatste antwoord en klapt het tikveld op de telefoon in tot één regel, met
  het aantal bijlagen. (#212)

### Verwijderd

- **Brekend:** `ChatAnswerData.choices` en de property `choices` van `lintje-chat-answer`, `kind`
  en `hint` van `lintje-chat-suggestions` en `kind` in `lintje-suggestion-select`. Een host die
  `choices` zette, zet op hetzelfde antwoord `questions` met één vraag van het soort `one` en zijn
  eigen vraagtekst, en luistert naar `lintje-questions-answer`. (#212)
