import { api } from '@/api'
import type { DocumentLifecycle } from './lifecycle/model'
import { readProject } from '@/contracts/knowledge/curationReads'
import type { Catalog, EndpointCard, EndpointSummary } from '@/contracts/knowledge/types'
import { contractResponse, requireBinding } from './contract'
import type { ProjectEnvironment } from './types'

const path = (id: string) => 'v1/projects/' + encodeURIComponent(id)
export interface DocumentEntry extends EndpointCard {
  folderId: string | null
  summary: EndpointSummary
}
export interface DocumentIndex {
  lifecycle?: DocumentLifecycle
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
  const index = await readProject<DocumentIndex>(pid, path(pid) + '/document', signal)
  requireBinding(
    index?.catalog?.project_id === pid &&
      Array.isArray(index.entries) &&
      index.entries.every((entry) => entry.summary?.project_id === pid),
  )
  return index
}

export function example(
  pid: string,
  endpoint: string,
  id: string,
  signal: AbortSignal,
  readOnly = false,
) {
  return api.request<{ observation: unknown }>(
    (readOnly ? `v1/public/projects/${encodeURIComponent(pid)}` : path(pid)) +
      '/endpoints/' +
      encodeURIComponent(endpoint) +
      '/examples/' +
      encodeURIComponent(id),
    { signal, cache: 'no-store' },
  )
}
