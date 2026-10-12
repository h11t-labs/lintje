// The example applications, as the front page lists them and the style guide finds its elements
// in them. `href` is relative to `examples/`.
export const APPS = [
  {
    href: 'dashboard/',
    icon: 'functioneel-tegelweergave',
    label: 'Dashboard',
    text: 'Een overzichtspagina met menu, filters met de “Je ziet”-zin, kerncijfers, grafieken, een kaart en een tabel.',
  },
  {
    href: 'chat/',
    icon: 'communicatie-tekstballonnen',
    label: 'Chat met data',
    text: 'Een vraag stellen over de cijfers van het dashboard. Het antwoord komt in tekst, kerncijfers, een grafiek of een tabel.',
  },
  {
    href: 'meldingen/',
    icon: 'op-kantoor-document-met-potlood',
    label: 'Meldingen',
    text: 'Een register als werkblad: filteren, cellen bewerken, acties op meerdere rijen en een detailpaneel opzij. Een nieuwe melding registreer je in stappen, met een concept dat bewaard blijft.',
  },
  {
    href: 'transcriptie/',
    icon: 'beeld-en-geluid-microfoon',
    label: 'Transcriptie',
    text: 'Live opnemen met één druk, hier of op je telefoon, en achteraf het transcript nalopen terwijl de audio meeloopt, met AI-bewerkingen die als zodanig gemarkeerd zijn.',
  },
  {
    href: 'vertalen/',
    icon: 'communicatie-tekstballonnen-met-internationaal-gesprek',
    label: 'Vertalen',
    text: 'Brontekst en vertaling naast elkaar, met een scheiding die je zelf verschuift, en het resultaat exporteren.',
  },
  {
    href: 'catalogus/',
    icon: 'op-kantoor-map-vol-documenten',
    label: 'Productcatalogus',
    action: 'Open de catalogus',
    text: 'Alle producten van een dataplatform op één plek, ook waar je nog geen toegang toe hebt: een startpagina met een vraag, de catalogus met filters en een productpagina.',
    tags: 'lintje-hero · lintje-card-list · lintje-card · lintje-filter-bar · lintje-description-list',
  },
]

/** The applications whose menu always stands above the page: `menu` and `layout` mean nothing there. */
export const APP_PAGES = ['meldingen/', 'transcriptie/', 'vertalen/', 'catalogus/']
