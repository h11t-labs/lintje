/**
 * Types for `entries.mjs`. The implementation is plain JavaScript so the build and the tests
 * read the same file.
 */
export declare const CATEGORY_NAMES: string[]
export declare function tagModules(srcDir: string): Map<string, string>
export declare function tagEntryName(tag: string): string
export declare function importsOf(file: string): Set<string>
export declare function importClosure(file: string): Set<string>
