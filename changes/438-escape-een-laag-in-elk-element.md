### Opgelost

- Escape sluit één laag per keer in elk element dat op Escape iets sluit of ongedaan maakt: een open tooltip neemt de eerste Escape, en van twee open zwevende lagen sluit de laatst geopende eerst. Een Escape die zo'n element beantwoordt, is daarna `defaultPrevented`: de eigen Escape-luisteraar van een host die daarop let, en een venster eromheen, doen bij die toets niets meer (#438)
