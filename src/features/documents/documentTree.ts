import { hiddenRetirement } from './lifecycle/model'
import type { Folder } from '@/contracts/knowledge/types'
import type { DocumentEntry, DocumentIndex } from './source'
import type { DocumentTarget } from './documentRoutes'
export interface DocumentFolder extends Folder {
  children: DocumentFolder[]
  entries: DocumentEntry[]
  count: number
}
export function folderPath(folders: Folder[], id: string | null): Folder[] {
  const path: Folder[] = [],
    seen = new Set<string>()
  while (id && !seen.has(id)) {
    seen.add(id)
    const folder = folders.find((f) => f.id === id)
    if (!folder) break
    path.unshift(folder)
    id = folder.parent
  }
  return path
}
export function inEnvironment(entry: DocumentEntry, env: string) {
  return entry.summary.environments.some((usage) => usage.environment_id === env)
}
/** Null environment previews all project knowledge; formal documents pass a specific environment. */
export function documentTree(
  index: DocumentIndex | null,
  env: string | null,
  query = '',
  target: DocumentTarget = null,
  showRetired = false,
): DocumentFolder[] {
  if (!index) return []
  if (!showRetired)
    index = {
      ...index,
      catalog: {
        ...index.catalog,
        folders: index.catalog.folders.filter(
          (f) => !hiddenRetirement(index?.lifecycle, { kind: 'folder', id: f.id }),
        ),
      },
      entries: index.entries.filter(
        (e) => !hiddenRetirement(index?.lifecycle, { kind: 'endpoint', id: e.interface_id }),
      ),
    }
  const inScope = (entry: DocumentEntry) => env === null || inEnvironment(entry, env)
  const needle = query.trim().toLowerCase()
  const selectedFolder =
    target?.kind === 'folder'
      ? target.id
      : index.entries.find((e) => e.interface_id === target?.id)?.folderId
  const pinned = new Set(folderPath(index.catalog.folders, selectedFolder ?? null).map((f) => f.id))
  if (selectedFolder) pinned.add(selectedFolder)
  const matches = (entry: DocumentEntry) =>
    !needle ||
    [entry.name, entry.purpose, entry.path, entry.method].some((v) =>
      v?.toLowerCase().includes(needle),
    )
  const folders = [...index.catalog.folders]
  if (index.entries.some((e) => !e.folderId) || selectedFolder === 'unplaced')
    folders.push({
      id: 'unplaced',
      parent: null,
      name: '待分类',
      summary: null,
      position: Infinity,
      endpoints: 0,
      endpoints_deep: 0,
    })
  const build = (folder: Folder, ancestors: Set<string>): DocumentFolder => {
    const seen = new Set([...ancestors, folder.id])
    const children = folders
      .filter((f) => f.parent === folder.id && !seen.has(f.id))
      .sort((a, b) => a.position - b.position)
      .map((f) => build(f, seen))
    const direct = index.entries.filter((e) => (e.folderId ?? 'unplaced') === folder.id)
    const nameMatches = !!needle && folder.name.toLowerCase().includes(needle)
    return {
      ...folder,
      count: direct.filter(inScope).length + children.reduce((n, f) => n + f.count, 0),
      entries: direct.filter(
        (e) =>
          (inScope(e) && (nameMatches || matches(e))) ||
          (target?.kind === 'endpoint' && e.interface_id === target.id),
      ),
      children: children.filter(
        (f) => !needle || nameMatches || f.entries.length || f.children.length || pinned.has(f.id),
      ),
    }
  }
  // A malformed parent/cycle stays visible as a root, without recursive loops.
  return folders
    .filter(
      (f) =>
        !f.parent ||
        !folders.some((p) => p.id === f.parent) ||
        folderPath(folders, f.id).some((p) => p.parent === f.id),
    )
    .sort((a, b) => a.position - b.position)
    .map((f) => build(f, new Set()))
    .filter(
      (f) =>
        !needle ||
        f.entries.length ||
        f.children.length ||
        pinned.has(f.id) ||
        f.name.toLowerCase().includes(needle),
    )
}
export function findFolder(tree: DocumentFolder[], id: string): DocumentFolder | undefined {
  for (const folder of tree) {
    if (folder.id === id) return folder
    const nested = findFolder(folder.children, id)
    if (nested) return nested
  }
}
