/**
 * What a page gives the elements, for every `*.browser.test.ts`: the fonts, the themes and the
 * tokens at document level — the order of `dist-elements/tokens.css` — and the house set as the
 * icon source.
 */
import '../tokens/fonts.css'
import '../tokens/themes.css'
import '../tokens/tokens.css'
import { setIconSource } from '../icons/loader'

setIconSource({ base: '/dist-icons/' })
