import type { Candidate, KnowledgeLink } from './types'
export type ChangeSection = 'folders' | 'placements' | 'notes' | 'fields' | 'links'
export interface KnowledgeChange {
  id: string
  section: ChangeSection
  status: 'added' | 'updated' | 'removed'
  title: string
  subtitle: string
  endpoint?: string
  before: unknown
  after: unknown
}
export const sectionLabels: Record<ChangeSection, string> = {
  folders: '目录结构',
  placements: '接口归属',
  notes: '接口变化',
  fields: '字段变化',
  links: '接口关系',
}
function semantic(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(semantic)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !['at', 'input_hash', 'recipe'].includes(key))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => [key, semantic(v)]),
    )
  return value
}
function signature(value: unknown) {
  return JSON.stringify(semantic(value))
}
function linkKey(link: KnowledgeLink): string {
  return signature([
    link.from,
    link.from_field,
    link.context?.from_location,
    link.to,
    link.to_field,
    link.context?.to_location,
    link.relation,
    link.context?.environment,
  ])
}
export function candidateChanges(
  candidate: Candidate,
  paths: Map<string, string> = new Map(),
): KnowledgeChange[] {
  const names = new Map(
    candidate.view.notes.map((n) => [n.endpoint, n.name || paths.get(n.endpoint) || n.endpoint]),
  )
  const folderNames = new Map(candidate.view.folders.map((f) => [f.id, f.name]))
  const changes: KnowledgeChange[] = []
  for (const section of Object.keys(sectionLabels) as ChangeSection[]) {
    const key = (item: (typeof candidate.view)[typeof section][number]): string => {
      if ('relation' in item) return linkKey(item)
      if ('path' in item) return item.endpoint + ':' + item.path
      if ('endpoint' in item) return item.endpoint
      return item.id
    }
    const before = new Map(candidate.base[section].map((item) => [key(item), item]))
    const after = new Map(candidate.view[section].map((item) => [key(item), item]))
    for (const id of new Set([...before.keys(), ...after.keys()])) {
      const old = before.get(id),
        next = after.get(id)
      const compare = (item: unknown) =>
        section === 'links' && item && typeof item === 'object'
          ? signature(Object.fromEntries(Object.entries(item).filter(([k]) => k !== 'id')))
          : signature(item)
      if (compare(old) === compare(next)) continue
      const item = next ?? old!
      const endpoint = 'endpoint' in item ? item.endpoint : 'to' in item ? item.to : undefined
      const title =
        section === 'folders' && 'name' in item
          ? item.name
          : section === 'fields' && 'path' in item
            ? item.context?.display_name || item.context?.field_path || item.path
            : names.get(endpoint ?? '') || '接口知识'
      const subtitle =
        section === 'placements' && 'folder' in item
          ? folderNames.get(item.folder) || item.folder
          : section === 'fields' && 'path' in item
            ? `${names.get(item.endpoint) ?? ''} · ${item.context?.field_path || item.path}`
            : section === 'links' && 'from' in item
              ? `${names.get(item.from) || '来源接口'} → ${names.get(item.to) || '目标接口'}`
              : paths.get(endpoint ?? '') || ''
      changes.push({
        id: section + ':' + id,
        section,
        status: !old ? 'added' : !next ? 'removed' : 'updated',
        title: title || '目录',
        subtitle,
        endpoint,
        before: old,
        after: next,
      })
    }
  }
  return changes
}
