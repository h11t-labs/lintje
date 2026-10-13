/**
 * Writes the tag reference next to the bundle: `dist-elements/custom-elements.json`, which the
 * style guide shows under each element, `data-types.json`, the types a `data` property takes, and
 * `tokens.json`, the tokens its Fundament pages show.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { buildDataTypes, buildManifest, declarationsByTag } from './manifest.mjs'
import { tokensOf } from './tokens.mjs'

const manifest = buildManifest('src')
mkdirSync('dist-elements', { recursive: true })
writeFileSync('dist-elements/custom-elements.json', `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`custom-elements.json: ${declarationsByTag(manifest).size} tags`)

const dataTypes = buildDataTypes('src')
writeFileSync('dist-elements/data-types.json', `${JSON.stringify(dataTypes, null, 2)}\n`)
console.log(`data-types.json: ${Object.keys(dataTypes.types).length} types`)

const tokens = tokensOf(readFileSync('src/tokens/tokens.css', 'utf8'))
writeFileSync('dist-elements/tokens.json', `${JSON.stringify({ tokens }, null, 2)}\n`)
console.log(`tokens.json: ${tokens.length} tokens`)
