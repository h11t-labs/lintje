// The chat category (Chat met data): the specimens of its elements.
import { weekQuestion, converse, term, weekChart, weekKpis, weekLead, vocabulary, chatSources, weekStrip, weekAnswer, askingTurn, askedQuestions } from '../../_data/chat.js'
import { desks } from '../../_data/load.js'

const amsterdam = desks.filter((desk) => desk.name.startsWith('Loket Amsterdam'))

const regionQuestion = 'Hoe lang was de wachttijd in Zuid?'

const KB = 1024
const MB = 1024 * KB
const policy = { id: 'beleid', name: 'beleidsregel-2026.pdf', size: 1.2 * MB, state: 'done' }
const export3 = { id: 'export', name: 'aanvragen-q3.xlsx', size: 48 * KB, state: 'done' }

/** What the assistant did for an answer about objections per month: fictitious. */
const STEPS = [
  { label: 'Vraag gelezen', detail: 'periode: de afgelopen 12 maanden' },
  { label: '3 bronnen doorzocht', detail: 'Bezwaren, Besluiten, Termijnen' },
  { label: 'Tabel opgehaald', detail: 'Bezwaren, stand 1 oktober 2026', href: '#', linkText: 'Bezwaren' },
  { label: 'Opgeteld', detail: '4.812 bezwaren in 12 maanden' },
  { label: 'Grafiek getekend' },
]

/** One `<lintje-chat-steps>` with its steps; `open` draws it unfolded. */
const steps = (items, { duration, open = false } = {}) => ({
  html: `<lintje-chat-steps${open ? ' open' : ''}${duration ? ` duration="${duration}"` : ''}></lintje-chat-steps>`,
  setup(stage) {
    stage.querySelector('lintje-chat-steps').items = items
  },
})

/** One `<lintje-chat-answer>`; `current` marks the newest answer of a conversation. */
const answer = (turn, attributes = '') => `<lintje-chat-answer turn-id="demo-${turn}" ${attributes}></lintje-chat-answer>`

/** An answer that asks, with its questions in the short form under it, as the chat stacks them. */
const asks = (turn, state) => `<div class="guide__stack">
  ${answer(turn, `state="${state}" current`)}
  <lintje-chat-questions turn-id="demo-${turn}"></lintje-chat-questions>
</div>`

/** What the assistant asks, in steps; `change` puts the box in a state. */
const questions = (change = () => ({})) => ({
  html: '<lintje-chat-questions turn-id="demo-questions"></lintje-chat-questions>',
  setup(stage) {
    const box = stage.querySelector('lintje-chat-questions')
    const data = askedQuestions()
    box.data = data
    // New questions start over: the state goes on once they are drawn.
    void box.updateComplete.then(() => Object.assign(box, change(data)))
  },
})

/** The short form: one question with short choices; `change` puts the box in a state. */
const PERIOD = {
  id: 'periode', label: 'Periode', text: 'Welke periode bedoel je?', kind: 'one',
  options: [
    { value: '12m', label: 'Afgelopen 12 maanden' },
    { value: '2025', label: 'Heel 2025' },
    { value: 'q3', label: 'Derde kwartaal 2026' },
  ],
}
const short = (change = () => ({})) => ({
  html: '<lintje-chat-questions turn-id="demo-short"></lintje-chat-questions>',
  setup(stage) {
    const box = stage.querySelector('lintje-chat-questions')
    const data = { questions: [PERIOD] }
    box.data = data
    void box.updateComplete.then(() => Object.assign(box, change(data)))
  },
})

const AMSTERDAM = {
  id: 'loket', label: 'Loket', text: 'Welk loket bedoel je?', kind: 'one',
  options: [{ label: 'Amsterdam als geheel', value: 'amsterdam' }, ...amsterdam.map((desk) => ({ label: desk.name, value: desk.id }))],
}

export default {
  elements: [
{
      tag: 'lintje-chat',
      wide: true,
      title: 'Een gesprek met de data: vragen, antwoorden als bestaande blokken, bronnen',
      specimens: [
        {
          label: 'Gesprek',
          note: 'Stel een vraag, of speel een antwoord af met de knop.',
          html: `<div class="guide__stack">
              <div class="guide__row"><lintje-button variant="secondary">Speel een antwoord af</lintje-button></div>
              <div class="guide__chat"><lintje-chat></lintje-chat></div>
            </div>`,
          setup(stage) {
            const { ask } = converse(stage.querySelector('lintje-chat'))
            stage.querySelector('lintje-button').addEventListener('click', () => ask(weekQuestion))
          },
        },
        {
          label: 'Scheidslijnen',
          note: 'Een dag, een nieuw onderwerp en een ingekort gesprek, elk boven de vraag van zijn beurt.',
          html: '<div class="guide__chat"><lintje-chat></lintje-chat></div>',
          setup(stage) {
            stage.querySelector('lintje-chat').data = {
              sources: chatSources(),
              turns: [
                {
                  id: 'd1',
                  divider: { label: 'Gisteren' },
                  message: { text: 'Hoeveel bezwaren kwamen er in september binnen?', time: '16:40' },
                  answer: { lead: 'In september kwamen 412 bezwaren binnen.' },
                },
                {
                  id: 'd2',
                  divider: { kind: 'topic', label: 'Nieuw onderwerp' },
                  message: { text: 'Hoe lang duurde een besluit gemiddeld?', time: '09:05' },
                  answer: { lead: 'Een besluit duurde gemiddeld 41 dagen.' },
                },
                {
                  id: 'd3',
                  divider: { kind: 'context', label: 'Gesprek ingekort' },
                  message: { text: 'En in augustus?', time: '09:12' },
                  answer: { lead: 'In augustus duurde een besluit gemiddeld 44 dagen.' },
                },
              ],
            }
          },
        },
        {
          label: 'Door de vragen',
          note: 'De assistent vraagt door voordat hij telt. Beantwoord de vragen in de box boven het tikveld.',
          html: '<div class="guide__chat"><lintje-chat></lintje-chat></div>',
          setup(stage) {
            converse(stage.querySelector('lintje-chat'), { asking: true })
          },
        },
        {
          label: 'Vragen overgeslagen',
          note: 'Een nieuwe vraag uit het tikveld slaat de open vragen over: de box is weg en de assistent zegt in de strip wat hij aannam.',
          html: '<div class="guide__chat"><lintje-chat></lintje-chat></div>',
          setup(stage) {
            const state = { period: 'week', desks: 'all', compare: false }
            stage.querySelector('lintje-chat').data = {
              sources: chatSources(),
              turns: [
                askingTurn('s1'),
                { id: 's2', message: { text: weekQuestion, time: '08:25' }, answer: weekAnswer(state) },
              ],
            }
          },
        },
        {
          label: 'Beginscherm',
          note: 'Het gesprek is nog leeg.',
          html: '<div class="guide__chat guide__chat--start"><lintje-chat></lintje-chat></div>',
          setup(stage) {
            converse(stage.querySelector('lintje-chat'), { turns: false })
          },
        },
      ],
    },
    {
      tag: 'lintje-chat-message',
      title: 'Een vraag van de lezer, met de herkende termen',
      specimens: [
        {
          label: 'Verstuurd',
          note: 'De vraag heeft een zekere en een onzekere term.',
          html: '<lintje-chat-message turn-id="demo-message" time="08:24" editable></lintje-chat-message>',
          setup(stage) {
            Object.assign(stage.querySelector('lintje-chat-message'), {
              text: regionQuestion,
              terms: [term(regionQuestion, 'wachttijd', 'Definitie'), term(regionQuestion, 'Zuid', 'Regio of loket?', false)],
            })
          },
        },
        {
          label: 'Met bijlagen',
          note: 'De bestanden die met de vraag meegingen, staan erboven.',
          html: '<lintje-chat-message turn-id="demo-attached" time="08:26" editable></lintje-chat-message>',
          setup(stage) {
            Object.assign(stage.querySelector('lintje-chat-message'), {
              text: 'Toets de aanvragen van het derde kwartaal aan deze beleidsregel.',
              attachments: [policy, export3],
            })
          },
        },
        {
          label: 'Alleen een bijlage',
          note: 'Een bericht zonder tekst bestaat alleen uit de chips, zonder bel.',
          html: '<lintje-chat-message turn-id="demo-only-file" time="08:27"></lintje-chat-message>',
          setup(stage) {
            Object.assign(stage.querySelector('lintje-chat-message'), { text: '', attachments: [export3] })
          },
        },
        {
          label: 'Bewerken',
          html: '<lintje-chat-message turn-id="demo-editing" time="08:20" editable editing></lintje-chat-message>',
          setup(stage) {
            Object.assign(stage.querySelector('lintje-chat-message'), { text: weekQuestion })
          },
        },
      ],
    },
    {
      tag: 'lintje-chat-answer',
      title: 'Het antwoord op een vraag: tekst, blokken en de staat ervan',
      specimens: [
        {
          label: 'Komt binnen',
          note: 'Een blok dat nog komt, staat er al als skelet op zijn eigen maat.',
          html: answer('streaming', 'state="streaming"'),
          setup(stage) {
            Object.assign(stage.querySelector('lintje-chat-answer'), {
              lead: weekLead,
              text: 'Dat is',
              status: 'Cijfers berekenen · stap 2 van 3',
              // A block still to come is the same block, loading: the skeleton at its final size.
              blocks: [
                { kind: 'kpi-row', data: weekKpis('loading') },
                { kind: 'chart', data: weekChart('loading') },
              ],
            })
          },
        },
        {
          label: 'Gestopt',
          html: answer('stopped', 'state="stopped"'),
          setup(stage) {
            Object.assign(stage.querySelector('lintje-chat-answer'), { lead: weekLead, text: 'Dat is' })
          },
        },
        {
          label: 'Fout of time-out',
          html: answer('error', 'state="error" current'),
          setup(stage) {
            Object.assign(stage.querySelector('lintje-chat-answer'), {
              error: {
                text: 'Het antwoord kwam niet op tijd binnen. Je vraag staat er nog: probeer het opnieuw, of stel een kortere vraag.',
              },
            })
          },
        },
        {
          label: 'Geen gegevens',
          html: answer('empty'),
          setup(stage) {
            Object.assign(stage.querySelector('lintje-chat-answer'), {
              text: 'Voor Loket Middelburg zijn er op 8 september nog geen gemeten uren. De eerstvolgende aanlevering vult ze aan.',
              blocks: [
                {
                  kind: 'chart',
                  data: {
                    ...weekChart('empty'),
                    title: 'Aanvragen per uur',
                    subtitle: '8 sep · Loket Middelburg',
                    message: 'Nog geen gemeten uren voor 8 sep bij Loket Middelburg.',
                  },
                },
              ],
            })
          },
        },
        {
          label: 'Bron staat uit',
          note: 'De acties staan als vraag van de host in de korte vorm, boven het tikveld.',
          html: asks('scope', 'out-of-scope'),
          setup(stage) {
            stage.querySelector('lintje-chat-answer').text =
              'Deze vraag gaat over de bezetting van de loketten. Die bron staat nu uit.'
            stage.querySelector('lintje-chat-questions').data = {
              questions: [
                {
                  id: 'actie', label: 'Actie', text: 'Wat wil je doen?', kind: 'one',
                  options: [
                    { label: 'Bron Bezetting toevoegen en opnieuw vragen', value: 'add-source:staffing' },
                    { label: 'Zoek in alle bronnen', value: 'all-sources' },
                  ],
                },
              ],
            }
          },
        },
        {
          label: 'Verduidelijkingsvraag',
          html: asks('clarify', 'needs-clarification'),
          setup(stage) {
            stage.querySelector('lintje-chat-answer').text = `Amsterdam heeft ${amsterdam.length} loketten.`
            stage.querySelector('lintje-chat-questions').data = { questions: [AMSTERDAM] }
          },
        },
        {
          label: 'Met een bestand en een bron',
          note: 'Een bijlage is een blok, bij de zin die haar noemt.',
          html: answer('files'),
          setup(stage) {
            Object.assign(stage.querySelector('lintje-chat-answer'), {
              lead: 'In het derde kwartaal kwamen 1.284 aanvragen binnen.',
              blocks: [
                { kind: 'prose', text: 'Hier is de tabel als CSV, per maand en per soort aanvraag.' },
                {
                  kind: 'attachments',
                  items: [
                    { id: 'csv', name: 'aanvragen-per-maand.csv', size: 6 * KB, state: 'done', href: '#', download: true },
                  ],
                },
                { kind: 'prose', text: 'De termijn komt uit de beleidsregel van dit jaar.' },
                { kind: 'attachments', items: [{ id: 'bron', name: 'beleidsregel-2026.pdf', detail: 'blz. 4', state: 'done' }] },
              ],
            })
          },
        },
        {
          label: 'Twee grafieken naast elkaar',
          html: answer('two'),
          setup(stage) {
            Object.assign(stage.querySelector('lintje-chat-answer'), {
              lead: 'Zaterdag was de drukste dag in beide weken.',
              text: 'Links de afgelopen week, rechts dezelfde week tegen de week ervoor.',
              blocks: [
                { kind: 'chart', data: { ...weekChart('ready'), span: 6, footnote: undefined } },
                {
                  kind: 'chart',
                  data: {
                    ...weekChart('ready', true),
                    span: 6,
                    title: 'Tegen de week ervoor',
                    footnote: undefined,
                  },
                },
              ],
            })
          },
        },
      ],
    },
    {
      tag: 'lintje-chat-steps',
      title: 'Wat de assistent deed voor een antwoord: een reeks stappen die inklapt tot één regel',
      specimens: [
        {
          label: 'Eerste stap bezig',
          note: 'Eén stap zonder detail heeft geen knop.',
          ...steps([{ label: 'Vraag lezen', state: 'busy' }]),
        },
        {
          label: 'Latere stap bezig',
          ...steps([...STEPS.slice(0, 2), { label: 'Bezwaren per maand optellen', state: 'busy' }]),
        },
        {
          label: 'Latere stap bezig en open',
          note: 'De lopende stap zegt in verborgen woorden dat hij bezig is.',
          ...steps([...STEPS.slice(0, 2), { label: 'Bezwaren per maand optellen', state: 'busy' }], { open: true }),
        },
        {
          label: 'Klaar',
          ...steps(STEPS, { duration: '12 s' }),
        },
        {
          label: 'Open met details',
          note: 'Elke stap staat op één regel; de bron is een link.',
          ...steps(STEPS, { duration: '12 s', open: true }),
        },
        {
          label: 'Een stap mislukt',
          note: 'De dichte regel toont de mislukte stap; open staat de reden erachter.',
          ...steps(
            [
              ...STEPS.slice(0, 2),
              {
                label: 'Tabel behandeltermijnen ophalen mislukt',
                state: 'error',
                detail: 'De bron Termijnen gaf binnen 30 s geen antwoord.',
              },
              ...STEPS.slice(3),
            ],
            { duration: '41 s' },
          ),
        },
        {
          label: 'Een stap mislukt en open',
          note: 'Een label zonder het woord krijgt een verborgen "mislukt".',
          ...steps(
            [
              ...STEPS.slice(0, 2),
              { label: 'Tabel behandeltermijnen ophalen', state: 'error', detail: 'De bron Termijnen gaf binnen 30 s geen antwoord.' },
              ...STEPS.slice(3),
            ],
            { duration: '41 s', open: true },
          ),
        },
        {
          label: 'Gestopt',
          ...steps([...STEPS.slice(0, 3), { label: 'Grafiek tekenen gestopt', state: 'cancelled' }], {
            open: true,
          }),
        },
      ],
    },
    {
      tag: 'lintje-chat-composer',
      title: 'De vraagbox: tekst met herkende termen, de bronnen en het versturen',
      specimens: [
        {
          label: 'Herkende termen',
          note: 'Een term is zeker of dubbelzinnig, of hoort bij een bron die uit staat.',
          html: '<lintje-chat-composer></lintje-chat-composer>',
          setup(stage) {
            Object.assign(stage.querySelector('lintje-chat-composer'), {
              sources: chatSources(),
              vocabulary,
              text: 'Hoe verhoudt de wachttijd in Amsterdam zich tot de bezetting?',
            })
          },
        },
        {
          label: 'Antwoord komt binnen',
          html: '<lintje-chat-composer busy></lintje-chat-composer>',
          setup(stage) {
            Object.assign(stage.querySelector('lintje-chat-composer'), { sources: chatSources(), vocabulary })
          },
        },
        {
          label: 'Eenvoudig',
          note: 'Met `plain` is er alleen Versturen, voor een vraag die geen gesprek is.',
          html: '<lintje-chat-composer plain placeholder="Bijvoorbeeld: kan ik audio naar tekst omzetten?"></lintje-chat-composer>',
        },
        {
          label: 'Met bijlagen',
          note: 'Eén is klaar, één is bezig en één is mislukt; zolang er een bezig is, wacht Versturen.',
          html: '<lintje-chat-composer accept=".pdf,.xlsx,.csv" max-size="20971520"></lintje-chat-composer>',
          setup(stage) {
            const box = stage.querySelector('lintje-chat-composer')
            Object.assign(box, {
              sources: chatSources(),
              vocabulary,
              text: 'Toets de aanvragen aan deze beleidsregel.',
              files: [
                policy,
                { id: 'busy', name: 'aanvragen-q3.xlsx', size: 48 * KB, state: 'busy', progress: 64 },
                { id: 'failed', name: 'verklaring.pdf', size: 482 * KB, state: 'error', message: 'Uploaden mislukt', retry: true },
              ],
            })
            box.addEventListener('lintje-file-remove', (event) => {
              box.files = box.files.filter((file) => file.id !== event.detail.id)
            })
          },
        },
        {
          label: 'Zes bijlagen',
          note: 'Ze lopen door naar een volgende regel en blijven alle zichtbaar.',
          html: '<lintje-chat-composer></lintje-chat-composer>',
          setup(stage) {
            Object.assign(stage.querySelector('lintje-chat-composer'), {
              sources: chatSources(),
              files: [
                policy,
                export3,
                { id: 'csv', name: 'bezwaren-per-maand.csv', size: 4 * KB, state: 'done' },
                { id: 'notitie', name: 'notitie-overleg.docx', size: 92 * KB, state: 'done' },
                { id: 'foto', name: 'formulier.jpg', size: 2.4 * MB, state: 'done', thumbnail: 'media/afbeelding.svg' },
                { id: 'kader', name: 'kader-uitvoering-2026-definitief.pdf', size: 640 * KB, state: 'done' },
              ],
            })
          },
        },
        {
          label: 'Ingeklapt met bijlagen',
          note: 'Op een telefoon klapt het tikveld in tot één regel zolang de assistent vragen stelt; de regel telt de bijlagen.',
          html: '<lintje-chat-composer collapsed placeholder="Stel een nieuwe vraag"></lintje-chat-composer>',
          setup(stage) {
            Object.assign(stage.querySelector('lintje-chat-composer'), { sources: chatSources(), files: [policy, export3] })
          },
        },
        {
          label: 'Geen bron gekozen',
          html: '<lintje-chat-composer></lintje-chat-composer>',
          setup(stage) {
            Object.assign(stage.querySelector('lintje-chat-composer'), {
              sources: chatSources().map((source) => ({ ...source, selected: false })),
              vocabulary,
              text: 'Hoeveel aanvragen waren er vorige week?',
            })
          },
        },
      ],
    },
    {
      tag: 'lintje-chat-questions',
      title: 'Wat de assistent vraagt voordat hij antwoordt, boven het tikveld',
      specimens: [
        {
          label: 'Korte vorm',
          note: 'Eén vraag met korte keuzes: een tik verstuurt. "Iets anders…" opent een eigen veld.',
          ...short(),
        },
        {
          label: 'Korte vorm met Iets anders open',
          note: 'Het eigen veld staat onder de keuzes, met Versturen ernaast.',
          ...short(() => ({ otherOpen: true, drafts: { periode: { values: ['other'], other: '', text: '' } } })),
        },
        {
          label: 'Korte vorm met fout bij Iets anders',
          note: 'Versturen zonder tekst: de melding staat onder het eigen veld.',
          ...short(() => ({
            otherOpen: true,
            drafts: { periode: { values: ['other'], other: '', text: '' } },
            problems: { periode: { otherError: 'Vul in wat je bedoelt.' } },
          })),
        },
        {
          label: 'Korte vorm bezig met versturen',
          ...short((data) => ({
            data: { ...data, state: 'sending' },
            otherOpen: true,
            drafts: { periode: { values: ['other'], other: 'Het eerste halfjaar van 2026', text: '' } },
          })),
        },
        {
          label: 'Buiten de bronnen',
          note: 'De host zet de acties als één vraag, met zijn eigen vraagtekst.',
          html: '<lintje-chat-questions turn-id="demo-scope"></lintje-chat-questions>',
          setup(stage) {
            stage.querySelector('lintje-chat-questions').data = {
              questions: [
                {
                  id: 'actie', label: 'Actie', text: 'Wat wil je doen?', kind: 'one',
                  options: [
                    { value: 'add-source', label: 'Bron Klachten toevoegen en opnieuw vragen' },
                    { value: 'all', label: 'Zoek in alle bronnen' },
                  ],
                },
              ],
            }
          },
        },
        {
          label: 'Eén keuze met omschrijvingen',
          note: 'Een keuze met een omschrijving maakt er stappen van, ook bij één vraag.',
          ...questions(),
        },
        {
          label: 'Meer keuzes in een lange lijst',
          note: 'De lijst scrolt binnen de box; de vraag en de knoppen blijven staan.',
          ...questions(() => ({ step: 1 })),
        },
        {
          label: 'Vrije tekst',
          ...questions(() => ({ step: 2 })),
        },
        {
          label: 'Iets anders gekozen',
          ...questions(() => ({ drafts: { periode: { values: ['other'], other: 'Het eerste halfjaar van 2026', text: '' } } })),
        },
        {
          label: 'Fout',
          note: 'Volgende bij een verplichte vraag zonder antwoord.',
          ...questions((data) => ({ problems: { periode: { error: data.questions[0].error } } })),
        },
        {
          label: 'Verplichte lange lijst met fout',
          note: 'De fout staat boven de lijst die scrolt, zodat hij in beeld blijft met de focus op de eerste keuze.',
          ...questions((data) => ({
            data: {
              ...data,
              questions: data.questions.map((question) =>
                question.id === 'provincies' ? { ...question, optional: false, hint: 'Je kunt er meer kiezen.' } : question),
            },
            step: 1,
            problems: { provincies: { error: 'Kies minstens één provincie.' } },
          })),
        },
        {
          label: 'Fout bij Iets anders',
          ...questions(() => ({
            drafts: { periode: { values: ['other'], other: '', text: '' } },
            problems: { periode: { otherError: 'Vul in wat je bedoelt.' } },
          })),
        },
        {
          label: 'Bezig met versturen',
          ...questions((data) => ({
            data: { ...data, state: 'sending' },
            step: 2,
            drafts: { periode: { values: ['2025'], other: '', text: '' } },
          })),
        },
      ],
    },
    {
      tag: 'lintje-chat-strip',
      wide: true,
      title: 'Wat het antwoord berekende, en wat de lezer mag wijzigen',
      specimens: [
        {
          label: 'Open met vergelijking',
          note: 'De berekening staat open en de vergelijking aan.',
          html: '<lintje-chat-strip turn-id="demo-strip" open></lintje-chat-strip>',
          setup(stage) {
            Object.assign(stage.querySelector('lintje-chat-strip'), weekStrip({ period: 'week', desks: 'all', compare: true }))
          },
        },
        {
          label: 'Van een eerder antwoord',
          note: 'Er valt niets meer te wijzigen.',
          html: '<lintje-chat-strip turn-id="demo-strip-disabled" disabled></lintje-chat-strip>',
          setup(stage) {
            Object.assign(stage.querySelector('lintje-chat-strip'), weekStrip({ period: 'week', desks: 'all', compare: false }))
          },
        },
      ],
    },
    {
      tag: 'lintje-chat-suggestions',
      title: 'Vervolgvragen onder een antwoord',
      specimens: [
        {
          label: 'Links uitgelijnd',
          note: 'Met `align="start"` staan voorbeeldvragen onder een vraagbox, buiten een gesprek.',
          html: '<lintje-chat-suggestions align="start" label="Je kunt bijvoorbeeld vragen"></lintje-chat-suggestions>',
          setup(stage) {
            stage.querySelector('lintje-chat-suggestions').items = [
              { label: 'Welke dashboards zijn er voor toezicht?' },
              { label: 'Kan ik audio naar tekst omzetten?' },
              { label: 'Kan ik een document vertalen?' },
            ]
          },
        },
        {
          label: 'Suggesties',
          note: 'Gestippeld is een voorstel.',
          html: '<lintje-chat-suggestions turn-id="demo-suggestions" label="Jij, als vervolgvraag"></lintje-chat-suggestions>',
          setup(stage) {
            stage.querySelector('lintje-chat-suggestions').items = [
              { label: 'Hoe is dit verdeeld over de loketten?' },
              { label: 'Hoe verhoudt dit zich tot de week ervoor?' },
            ]
          },
        },
      ],
    },
  ],
}
