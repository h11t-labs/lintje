/**
 * Writes the tag reference next to the bundle: `dist-elements/custom-elements.json`, which the
 * style guide shows under each element.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { buildManifest, declarationsByTag } from './manifest.mjs'

const manifest = buildManifest('src')
mkdirSync('dist-elements', { recursive: true })
writeFileSync('dist-elements/custom-elements.json', `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`custom-elements.json: ${declarationsByTag(manifest).size} tags`)
