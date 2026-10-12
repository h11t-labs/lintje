/**
 * Writes the tag reference next to the bundle: `dist-elements/custom-elements.json`, which the
 * style guide shows under each element, and `data-types.json`, the types a `data` property takes.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { buildDataTypes, buildManifest, declarationsByTag } from './manifest.mjs'

const manifest = buildManifest('src')
mkdirSync('dist-elements', { recursive: true })
writeFileSync('dist-elements/custom-elements.json', `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`custom-elements.json: ${declarationsByTag(manifest).size} tags`)

const dataTypes = buildDataTypes('src')
writeFileSync('dist-elements/data-types.json', `${JSON.stringify(dataTypes, null, 2)}\n`)
console.log(`data-types.json: ${Object.keys(dataTypes.types).length} types`)
