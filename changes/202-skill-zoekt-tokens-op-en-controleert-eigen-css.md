### Toegevoegd

- De skill voor een host zoekt ook de tokens op (`reference.mjs` op `tokens.json`, per groep en te
  filteren) en controleert de eigen CSS en HTML van een applicatie met `check.mjs`: een literal
  kleur, een primitief, een token dat niet bestaat, ruimte buiten de 4 px-schaal, en als hint een
  element waar een tag voor is. `tokens.json` draagt daarvoor de groep van elk token. (#202)
