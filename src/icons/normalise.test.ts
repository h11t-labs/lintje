/// <reference types="node" />
/**
 * The normalisation, run over every file in `dist-icons/` (RVO's set and the own files): what the
 * register was built with and what the loader applies are one implementation
 * (`normalise.mjs`), so an icon looks the same whichever way it arrived.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normaliseSvg } from './normalise.mjs'

// The runner's working directory is `` (`vitest.config.ts`).
const DIR = resolve('dist-icons')
const files = readdirSync(DIR).filter((name) => name.endsWith('.svg'))
const read = (file: string) => readFileSync(resolve(DIR, file), 'utf8')
const nameOf = (file: string) => file.slice(0, -'.svg'.length).toLowerCase()

describe('what the normalisation does', () => {
  const glyphs = new Map(
    files.map((file) => [nameOf(file), normaliseSvg(nameOf(file), read(file))]),
  )

  it('has a folder to check', () => {
    expect(files.length).toBeGreaterThan(1000)
  })

  it('leaves no style attribute, script or event handler anywhere', () => {
    const bad = [...glyphs].filter(([, g]) => /\sstyle=|<script|<style|\son[a-z]+=/i.test(g.body))
    expect(bad.map(([name]) => name)).toEqual([])
  })

  it('leaves no reference to anything outside the file', () => {
    // `url(#a)` is a clip path inside the drawing itself.
    const bad = [...glyphs].filter(([, g]) => /href="(?!#)|url\((?!#)/i.test(g.body))
    expect(bad.map(([name]) => name)).toEqual([])
  })

  it('turns a raw export into an icon that follows the text colour', () => {
    // A design tool's export: fill="none" on the root and every path filled black.
    const glyph = normaliseSvg(
      'raw',
      '<svg xmlns="http://www.w3.org/2000/svg" width="25" height="24" fill="none"><path fill="#000" d="M0 0h25v24H0z"/></svg>',
    )
    expect(glyph.attributes.fill).toBeUndefined()
    expect(glyph.body).toContain('fill="currentColor"')
    expect(glyph.body).not.toContain('fill="#000"')
  })

  it('draws a file without a viewBox in its own width and height', () => {
    expect(glyphs.get('functioneel-kruis')?.viewBox).toBe('0 0 48 48')
  })

  it('leaves the colours of an emblem alone', () => {
    const glyph = glyphs.get('embleem-marechaussee')
    expect(glyph?.body).toContain('fill="#E17000"')
    expect(glyph?.body).toContain('fill="#FFF"')
  })

  it('leaves the Rijksoverheid ribbon on its own viewBox, as it came', () => {
    const glyph = glyphs.get('embleem-rijksoverheid')
    expect(glyph?.viewBox).toBe('0 0 50 100')
    expect(glyph?.body).toContain('fill="#154273"')
    expect(glyph?.body).toContain('fill="#fff"')
  })

  it('keeps a black that is a decision of the drawing', () => {
    // A currentColor triangle with a black exclamation mark knocked into it.
    const glyph = normaliseSvg(
      'knocked-out',
      '<svg viewBox="0 0 24 24"><path d="M12 2 1 22h22z"/><path fill="#000" d="M11 9h2v6h-2z"/></svg>',
    )
    expect(glyph.body).toContain('fill="#000"')
  })
})
