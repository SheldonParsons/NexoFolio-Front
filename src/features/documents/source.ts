import { api } from '@/api'
import * as knowledge from '@/contracts/knowledge/source'
import type { Catalog, EndpointCard, EndpointSummary } from '@/contracts/knowledge/types'
import { contractResponse } from './contract'
import type { ProjectEnvironment } from './types'

const path = (id: string) => 'v1/projects/' + encodeURIComponent(id)
export interface DocumentEntry extends EndpointCard {
  folderId: string | null
  summary: EndpointSummary
}
export interface DocumentIndex {
  catalog: Catalog
  entries: DocumentEntry[]
}

export async function environments(
  pid: string,
  signal: AbortSignal,
): Promise<ProjectEnvironment[]> {
  const items = new Map<string, ProjectEnvironment>()
  for (let page = 1; ; page++) {
    const result = contractResponse(
      'EnvironmentPage',
      await api.request(path(pid) + '/environments?page=' + page + '&limit=100', {
        signal,
        cache: 'no-store',
      }),
    )
    for (const item of result.items) items.set(item.id, item)
    if (page * result.limit >= result.total) return [...items.values()]
    if (!result.items.length) throw new Error('环境列表不完整，请重新读取。')
  }
}

/** Read the shared project document; environments filter observations, not storage. */
export async function documentIndex(pid: string, signal: AbortSignal): Promise<DocumentIndex> {
  const [catalog, result] = await Promise.all([
    knowledge.catalog(pid, signal),
    api.request<{ endpoints: EndpointSummary[] }>(path(pid) + '/endpoints', { signal }),
  ])
  const summaries = new Map(result.endpoints.map((item) => [item.id, item]))
  const folders: Array<string | null> = catalog.folders.map((folder) => folder.id)
  if (catalog.unplaced) folders.push(null)
  const pages = await Promise.all(
    folders.map(async (folderId) => {
      const entries: DocumentEntry[] = []
      for (let page = 1; ; page++) {
        const result = folderId
          ? await knowledge.interfaces(pid, folderId, page, 100, signal)
          : await knowledge.unclassified(pid, page, 100, signal)
        for (const card of result.items) {
          const summary = summaries.get(card.interface_id)
          if (summary) entries.push({ ...card, folderId, summary })
        }
        if (page * result.limit >= result.total) return entries
        if (!result.items.length) throw new Error('接口列表不完整，请重新读取。')
      }
    }),
  )
  return { catalog, entries: pages.flat() }
}

export function example(pid: string, endpoint: string, id: string, signal: AbortSignal) {
  return api.request<{ observation: unknown }>(
    path(pid) +
      '/endpoints/' +
      encodeURIComponent(endpoint) +
      '/examples/' +
      encodeURIComponent(id),
    { signal, cache: 'no-store' },
  )
}
