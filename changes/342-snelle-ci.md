### Gewijzigd

- De Firefox-job van de CI draait zijn testbestanden in vier shards naast elkaar, elk in een eigen
  browser, en een nieuwe push op een pull request stopt de run die hij opvolgt: de traagste job van
  de drie was Firefox met zes minuten, omdat Firefox zijn bestanden niet naast elkaar kan draaien.
  De hele check is nu in ongeveer drie minuten klaar. (#342)
