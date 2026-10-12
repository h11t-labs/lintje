// The chat category (Chat met data): the specimens of its elements.
import { weekQuestion, converse, term, weekChart, weekKpis, weekLead, vocabulary, chatSources, weekStrip } from '../../_data/chat.js'
import { desks } from '../../_data/load.js'

const amsterdam = desks.filter((desk) => desk.name.startsWith('Loket Amsterdam'))

const regionQuestion = 'Hoe lang was de wachttijd in Zuid?'

/** One `<lintje-chat-answer>`; `current` marks the newest answer of a conversation. */
const answer = (turn, attributes = '') => `<lintje-chat-answer turn-id="demo-${turn}" ${attributes}></lintje-chat-answer>`

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
      title: 'Het antwoord op een vraag: tekst, blokken, keuzes en de staat ervan',
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
          html: answer('scope', 'state="out-of-scope" current'),
          setup(stage) {
            Object.assign(stage.querySelector('lintje-chat-answer'), {
              text: 'Deze vraag gaat over de bezetting van de loketten. Die bron staat nu uit.',
              choices: [{ label: 'Bron Bezetting toevoegen en opnieuw vragen', value: 'add-source:staffing' }],
            })
          },
        },
        {
          label: 'Verduidelijkingsvraag',
          html: answer('clarify', 'state="needs-clarification" current'),
          setup(stage) {
            Object.assign(stage.querySelector('lintje-chat-answer'), {
              text: `Amsterdam heeft ${amsterdam.length} loketten. Welke bedoel je?`,
              choices: [
                { label: 'Amsterdam als geheel', value: 'amsterdam' },
                ...amsterdam.map((desk) => ({ label: desk.name, value: desk.id })),
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
                // Half as wide, a tile has no room for the table switch beside its title.
                { kind: 'chart', data: { ...weekChart('ready'), span: 6, footnote: undefined, tableSwitch: false } },
                {
                  kind: 'chart',
                  data: {
                    ...weekChart('ready', true),
                    span: 6,
                    title: 'Tegen de week ervoor',
                    footnote: undefined,
                    tableSwitch: false,
                  },
                },
              ],
            })
          },
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
      title: 'Vervolgvragen en keuzes onder een antwoord',
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
        {
          label: 'Keuzes',
          note: 'Doorgetrokken is een echte keuze.',
          html: `<lintje-chat-suggestions
            turn-id="demo-choices"
            kind="choice"
            label="Kies je antwoord"
            hint="Of typ je eigen antwoord in het veld."
          ></lintje-chat-suggestions>`,
          setup(stage) {
            stage.querySelector('lintje-chat-suggestions').items = [
              { label: 'Amsterdam als geheel' },
              { label: 'Loket Amsterdam Centrum' },
              { label: 'Loket Amsterdam Zuidoost' },
            ]
          },
        },
      ],
    },
  ],
}
