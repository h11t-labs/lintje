/** The text editor's markdown: both directions, the round trip, and the paste filter. */
import { describe, expect, it } from 'vitest'
import { domToMarkdown, inlineToHtml, markdownToHtml, reduceHtml, safeHref } from './markdown'

/** HTML → a detached node, the way the surface holds it. */
function dom(html: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = html
  return root
}

const roundTrip = (markdown: string): string => domToMarkdown(dom(markdownToHtml(markdown)))

describe('markdownToHtml()', () => {
  it('writes paragraphs, the heading, the list and the inline formats', () => {
    expect(
      markdownToHtml(
        '### Overdracht\n\nDe omgeving is **afgezet tot 15:00**.\n\n- eerste\n- tweede',
      ),
    ).toBe(
      '<h3>Overdracht</h3><p>De omgeving is <strong>afgezet tot 15:00</strong>.</p><ul><li>eerste</li><li>tweede</li></ul>',
    )
  })

  it('reads every heading level as the one level, and * as a list item', () => {
    expect(markdownToHtml('# Een\n## Twee')).toBe('<h3>Een</h3><h3>Twee</h3>')
    expect(markdownToHtml('* punt')).toBe('<ul><li>punt</li></ul>')
  })

  it('keeps a line break inside a paragraph', () => {
    expect(markdownToHtml('regel een\nregel twee')).toBe('<p>regel een<br>regel twee</p>')
  })

  it('escapes HTML: markdown text never becomes markup', () => {
    expect(markdownToHtml('<script>alert(1)</script> & "x"')).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;</p>',
    )
  })

  it('is empty for nothing', () => {
    expect(markdownToHtml('')).toBe('')
    expect(markdownToHtml(null)).toBe('')
    expect(markdownToHtml('\n\n  \n')).toBe('')
  })
})

describe('inlineToHtml()', () => {
  it('reads bold, both italics and their nesting', () => {
    expect(inlineToHtml('**vet** en *schuin* en _ook schuin_')).toBe(
      '<strong>vet</strong> en <em>schuin</em> en <em>ook schuin</em>',
    )
    expect(inlineToHtml('**_beide_**')).toBe('<strong><em>beide</em></strong>')
    expect(inlineToHtml('*a **b** c*')).toBe('<em>a <strong>b</strong> c</em>')
  })

  it('leaves an unclosed marker as it stands, and honours an escape', () => {
    expect(inlineToHtml('3 * 4 = 12')).toBe('3 * 4 = 12')
    expect(inlineToHtml('\\*\\*geen vet\\*\\*')).toBe('**geen vet**')
  })

  it('writes a safe link, and only the text of an unsafe one', () => {
    expect(inlineToHtml('[de melding](https://example.nl/m/12)')).toBe(
      '<a href="https://example.nl/m/12">de melding</a>',
    )
    expect(inlineToHtml('[klik](javascript:void0)')).toBe('klik')
    // An address with a raw parenthesis is no link at all: it stays text.
    expect(inlineToHtml('[klik](javascript:alert(1))')).toBe('[klik](javascript:alert(1))')
    expect(inlineToHtml('[**vet** link](/zaken)')).toBe(
      '<a href="/zaken"><strong>vet</strong> link</a>',
    )
  })
})

describe('safeHref()', () => {
  it('keeps web, mail, phone and relative addresses and drops other schemes', () => {
    expect(safeHref(' https://example.nl ')).toBe('https://example.nl')
    expect(safeHref('mailto:a@example.nl')).toBe('mailto:a@example.nl')
    expect(safeHref('/zaken/12')).toBe('/zaken/12')
    expect(safeHref('JavaScript:alert(1)')).toBeNull()
    expect(safeHref('data:text/html,x')).toBeNull()
    expect(safeHref('')).toBeNull()
  })

  it('drops a script scheme hidden behind control characters', () => {
    expect(safeHref('\u0001javascript:alert(1)')).toBeNull()
    expect(safeHref('java\tscript:alert(1)')).toBeNull()
    expect(safeHref('\u0000 \njavascript:alert(1)')).toBeNull()
    expect(safeHref('https://example.nl/\u0007pad')).toBe('https://example.nl/pad')
  })

  it('encodes what would end a markdown link', () => {
    expect(safeHref('https://example.nl/a b(c)')).toBe('https://example.nl/a%20b%28c%29')
  })
})

describe('domToMarkdown()', () => {
  it('reads the surface as the browser leaves it', () => {
    expect(
      domToMarkdown(
        dom(
          'Eerste regel<div><b>vet</b> en <i>schuin</i></div><div><br></div><h3>Kop</h3><ul><li>een</li><li>twee</li></ul>',
        ),
      ),
    ).toBe('Eerste regel\n\n**vet** en _schuin_\n\n### Kop\n\n- een\n- twee')
  })

  it('keeps the spaces outside the markers', () => {
    expect(domToMarkdown(dom('<p>de<strong> vette </strong>tekst</p>'))).toBe('de **vette** tekst')
  })

  it('escapes what markdown would read as a format', () => {
    expect(domToMarkdown(dom('<p>3 * 4 en [x] en a_b</p>'))).toBe('3 \\* 4 en \\[x\\] en a\\_b')
    expect(domToMarkdown(dom('<p># geen kop</p><p>- geen punt</p>'))).toBe(
      '\\# geen kop\n\n\\- geen punt',
    )
  })

  it('writes a link, and drops the address of an unsafe one', () => {
    expect(domToMarkdown(dom('<p><a href="https://example.nl">site</a></p>'))).toBe(
      '[site](https://example.nl)',
    )
    expect(domToMarkdown(dom('<p><a href="javascript:x()">site</a></p>'))).toBe('site')
  })
})

describe('the round trip', () => {
  it('gives back the markdown it was given', () => {
    for (const markdown of [
      'De omgeving is **afgezet tot 15:00**. Voor de overdracht:\n\n- eigenaar is omgeroepen, zonder reactie\n- beelden zijn opgevraagd',
      '### Verloop\n\nregel een\nregel twee',
      '**_beide_** en [de melding](https://example.nl/m?id=12&x=1)',
      'kosten: 3 \\* 4 en \\_niet schuin\\_',
      '\\# geen kop',
    ]) {
      expect(roundTrip(markdown)).toBe(markdown)
    }
  })

  it('normalises what it reads to what it writes', () => {
    expect(roundTrip('# Kop\n* punt\n\n*schuin*')).toBe('### Kop\n\n- punt\n\n_schuin_')
  })
})

describe('reduceHtml(): the paste filter', () => {
  it('keeps the five formats and drops everything else', () => {
    const pasted =
      '<meta charset="utf-8"><style>p{color:red}</style><h1 style="font-size:40px">Titel</h1>' +
      '<p><span style="color:#d52b1e;font-size:20px">rood</span> <u>onderstreept</u> <img src="x.png" alt="foto"></p>' +
      '<table><tr><td>cel</td></tr></table><script>alert(1)</script>' +
      '<ol><li>een</li><li>twee<ul><li>diep</li></ul></li></ol>'
    expect(reduceHtml(pasted)).toBe(
      '<h3>Titel</h3><p>rood onderstreept foto</p><p>cel</p><ul><li>een</li><li>twee</li><li>diep</li></ul>',
    )
  })

  it('reads a word processor’s weights from the style, not the tag', () => {
    const pasted =
      '<b style="font-weight:normal"><span style="font-weight:700">vet</span> en <span style="font-style:italic">schuin</span></b>'
    expect(reduceHtml(pasted)).toBe('<p><strong>vet</strong> en <em>schuin</em></p>')
  })
})
