/** Types for `manifest.mjs`: the part of the Custom Elements Manifest schema it writes. */
export interface ManifestType {
  text: string
}
export interface ManifestField {
  kind: 'field'
  name: string
  type?: ManifestType
  default?: string
  description?: string
  attribute?: string
  reflects?: boolean
  inheritedFrom?: { name: string }
}
export interface ManifestMethod {
  kind: 'method' | 'field'
  name: string
  description: string
  readonly?: boolean
  parameters?: string
  return?: ManifestType
}
export interface ManifestAttribute {
  name: string
  fieldName: string
  type?: ManifestType
  default?: string
  description?: string
}
export interface ManifestEvent {
  name: string
  type: ManifestType
  description?: string
}
export interface ManifestDeclaration {
  kind: 'class'
  name: string
  tagName: string
  customElement: true
  description?: string
  superclass?: { name: string }
  members: ManifestField[]
  methods: ManifestMethod[]
  attributes: ManifestAttribute[]
  events: ManifestEvent[]
  slots: { name: string }[]
}
export interface Manifest {
  schemaVersion: string
  readme: string
  modules: {
    kind: 'javascript-module'
    path: string
    declarations: ManifestDeclaration[]
    exports: { kind: string; name: string; declaration: { name: string; module: string } }[]
  }[]
}
export declare function buildManifest(srcDir: string): Manifest
export declare function declarationsByTag(manifest: Manifest): Map<string, ManifestDeclaration>
