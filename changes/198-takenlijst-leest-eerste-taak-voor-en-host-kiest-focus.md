### Opgelost

- `lintje-job-list` leest ook de eerste taak in een lijst die leeg laadde voor: `jobs` is
  `undefined` tot de host hem zet, en alleen die eerste waarde geldt als laden. Gaat de laatste
  taak met de focus erin, dan stuurt de lijst `lintje-jobs-empty`; annuleert de host het, dan zet
  hij de focus zelf op een zichtbaar doel, anders gaat ze naar de statusregel. (#198)
