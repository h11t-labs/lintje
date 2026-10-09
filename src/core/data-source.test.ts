/** Data from the markup: a JSON script child becomes a property when the element connects. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PropertyDeclarations } from 'lit'
import { LintjeElement, define } from './element'

class DataProbe extends LintjeElement {
  static override properties: PropertyDeclarations = {
    data: { attribute: false },
    items: { attribute: false },
  }
  declare data?: unknown
  declare items?: unknown
}
define('lintje-data-probe', DataProbe)

async function mount(html: string): Promise<DataProbe> {
  document.body.innerHTML = `<lintje-data-probe>${html}</lintje-data-probe>`
  const element = document.querySelector('lintje-data-probe') as DataProbe
  await element.updateComplete
  return element
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

describe('a JSON script child', () => {
  it('becomes `data`, and leaves the element so no slot sees it', async () => {
    const element = await mount(
      '<script type="application/json">{"kpis":[{"label":"Aanvragen"}]}</script>',
    )
    expect(element.data).toEqual({ kpis: [{ label: 'Aanvragen' }] })
    expect(element.children).toHaveLength(0)
  })

  it('goes into the property `data-prop` names, one script per property', async () => {
    const element = await mount(
      `<script type="application/json" data-prop="items">[1,2]</script>
       <script type="application/json">{"a":1}</script><p>inhoud</p>`,
    )
    expect(element.items).toEqual([1, 2])
    expect(element.data).toEqual({ a: 1 })
    expect(element.querySelector('p')!.textContent).toBe('inhoud')
  })

  it('is read once: a property the host sets afterwards stays', async () => {
    const element = await mount('<script type="application/json">{"a":1}</script>')
    element.data = { a: 2 }
    element.remove()
    document.body.append(element)
    expect(element.data).toEqual({ a: 2 })
  })

  it('says so for a property the element does not have, and for JSON that does not parse', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const element = await mount(
      `<script type="application/json" data-prop="innerHTML">"<b>x</b>"</script>
       <script type="application/json">{not json}</script>`,
    )
    expect(warn).toHaveBeenCalledOnce()
    expect(error).toHaveBeenCalledOnce()
    expect(element.data).toBeUndefined()
    expect(element.innerHTML.includes('<b>')).toBe(false)
  })

  it('leaves another script, and a script deeper down, alone', async () => {
    const element = await mount(
      `<script type="text/plain">x</script><div><script type="application/json">{"a":1}</script></div>`,
    )
    expect(element.data).toBeUndefined()
    expect(element.querySelectorAll('script')).toHaveLength(2)
  })
})
