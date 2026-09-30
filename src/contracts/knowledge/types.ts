export interface Folder {
  id: string
  parent: string | null
  name: string
  summary: string | null
  position: number
  endpoints: number
  endpoints_deep: number
}

export interface Catalog {
  project_id: string
  folders: Folder[]
  unplaced: number
}

/** Who wrote the words on an endpoint, or `null` before anything did. */
export type DescribedBy = 'person' | 'curate' | null

export interface EndpointCard {
  interface_id: string
  method: string
  path: string
  /** From the describe pass, or a person. `null` until one of them runs. */
  name: string | null
  purpose: string | null
  described_by?: DescribedBy
}

export interface EndpointPage {
  items: EndpointCard[]
  total: number
  page: number
  limit: number
}

/** `skipped` means the pass ran and decided there was nothing worth writing. */
export interface CurateResult {
  status: 'ok' | 'skipped'
  commands?: number
}

export interface EnvironmentUsage {
  environment_id: string
  calls: number
  first_seen: string
  last_seen: string
}

export interface EndpointSummary {
  id: string
  project_id: string
  method: string
  path_template: string
  declared: boolean
  external: boolean
  environments: EnvironmentUsage[]
}

/** `in` discriminates; a response body also carries the status it was seen on. */
export type FieldLocation =
  | { in: 'path' }
  | { in: 'query' }
  | { in: 'request_body' }
  | { in: 'response_body'; status: number }

export interface FieldFacts {
  location: FieldLocation
  /** Segments; a string is a key, `"items"` is every element of an array. */
  path: Array<string | 'items' | { key: string }>
  types: string[]
  labels: Array<{ environment_id: string; label: { label: string; since?: string } }>
  differs_between_environments: boolean
  declared: { required: boolean; types: string[] } | null
  conflict: { type: string } | null
}

export interface ExampleSummary {
  id: string
  environment_id: string
  address: unknown
  status: number | null
  calls: number
  first_seen: string
  last_seen: string
}

export interface EndpointFacts {
  summary: EndpointSummary
  aliases: string[]
  addresses: Array<{ environment_id: string; address: unknown; base_path: string }>
  fields: FieldFacts[]
  examples: ExampleSummary[]
}

export interface EndpointNote {
  endpoint: string
  name: string | null
  purpose: string | null
  author: { by: 'person'; user: string } | { by: 'curate'; pass: string; model: string | null }
  at: string
}

export interface EndpointKnowledge {
  note: EndpointNote | null
  placement: { endpoint: string; folder: string; at: string } | null
  path?: Folder[]
  fields?: Array<{ endpoint: string; path: string; text: string; values: string[] }>
  links?: unknown[]
}

export interface EndpointDetail {
  facts: EndpointFacts
  knowledge: EndpointKnowledge | null
}
