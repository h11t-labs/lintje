/** The version of the build, from `package.json`; `dev` while the source runs unbuilt. */
declare const __LINTJE_VERSION__: string | undefined

export const LINTJE_VERSION: string =
  typeof __LINTJE_VERSION__ === 'string' ? __LINTJE_VERSION__ : 'dev'
