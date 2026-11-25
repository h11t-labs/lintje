### Gewijzigd

- De Firefox-job van de CI draait zijn testbestanden in vier shards naast elkaar, elk in een eigen
  browser, en een nieuwe push op een pull request stopt de run die hij opvolgt: de traagste job was
  Firefox met 6:13, omdat Firefox zijn bestanden niet naast elkaar kan draaien. Hij doet er nu 3:08
  over en de hele check zakt van ongeveer 7 naar 3 minuten. (#342)
