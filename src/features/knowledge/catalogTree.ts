import type { Catalog, EndpointCard, Folder } from '@/contracts/knowledge/types'

/**
 * The catalogue is one tree and endpoints are leaves of it, so the page renders a
 * single flat list of rows and never a list beside a tree. 待分类 is a node like
 * any other: it just has no folder id behind it.
 */
export const UNPLACED = '\u0000unplaced'

export type NodeKey = string

export interface FolderRow {
  kind: 'folder'
  key: NodeKey
  /** `null` for 待分类, which is derived rather than stored. */
  id: string | null
  name: string
  summary: string | null
  /** Endpoints inside, sub-folders included. */
  count: number
  depth: number
  expanded: boolean
  loading: boolean
  /** Whether each ancestor level still has a sibling below, for the guide lines. */
  guides: boolean[]
  last: boolean
}

export interface EndpointRow {
  kind: 'endpoint'
  key: NodeKey
  parent: NodeKey
  card: EndpointCard
  depth: number
  guides: boolean[]
  last: boolean
}

export type CatalogRow = FolderRow | EndpointRow

export interface TreeInput {
  catalog: Catalog
  /** Endpoints already fetched, keyed by folder key. Absent means not loaded yet. */
  loaded: Map<NodeKey, EndpointCard[]>
  expanded: Set<NodeKey>
  loading: Set<NodeKey>
}

export function folderKey(id: string | null): NodeKey {
  return id ?? UNPLACED
}

/**
 * Depth-first, siblings by `position`, sub-folders before endpoints so a folder's
 * own leaves always sit closest to the next thing at its level.
 */
export function flatten({ catalog, loaded, expanded, loading }: TreeInput): CatalogRow[] {
  const children = new Map<string | null, Folder[]>()
  for (const folder of catalog.folders) {
    const bucket = children.get(folder.parent)
    if (bucket) bucket.push(folder)
    else children.set(folder.parent, [folder])
  }
  for (const bucket of children.values()) bucket.sort((a, b) => a.position - b.position)

  const rows: CatalogRow[] = []

  const walk = (folder: Folder, depth: number, guides: boolean[], last: boolean) => {
    const key = folderKey(folder.id)
    const open = expanded.has(key)
    rows.push({
      kind: 'folder',
      key,
      id: folder.id,
      name: folder.name,
      summary: folder.summary,
      count: folder.endpoints_deep,
      depth,
      expanded: open,
      loading: loading.has(key),
      guides,
      last,
    })
    if (!open) return
    const nested = children.get(folder.id) ?? []
    const leaves = loaded.get(key) ?? []
    const childGuides = [...guides, !last]
    nested.forEach((child, index) => {
      walk(child, depth + 1, childGuides, index === nested.length - 1 && leaves.length === 0)
    })
    leaves.forEach((card, index) => {
      rows.push({
        kind: 'endpoint',
        key: `${key}/${card.interface_id}`,
        parent: key,
        card,
        depth: depth + 1,
        guides: childGuides,
        last: index === leaves.length - 1,
      })
    })
  }

  const roots = children.get(null) ?? []
  const hasUnplaced = catalog.unplaced > 0
  roots.forEach((folder, index) => {
    walk(folder, 0, [], index === roots.length - 1 && !hasUnplaced)
  })

  if (hasUnplaced) {
    const key = UNPLACED
    const open = expanded.has(key)
    rows.push({
      kind: 'folder',
      key,
      id: null,
      name: '待分类',
      summary: '还没有目录收下的接口',
      count: catalog.unplaced,
      depth: 0,
      expanded: open,
      loading: loading.has(key),
      guides: [],
      last: true,
    })
    if (open) {
      const leaves = loaded.get(key) ?? []
      leaves.forEach((card, index) => {
        rows.push({
          kind: 'endpoint',
          key: `${key}/${card.interface_id}`,
          parent: key,
          card,
          depth: 1,
          guides: [false],
          last: index === leaves.length - 1,
        })
      })
    }
  }

  return rows
}
