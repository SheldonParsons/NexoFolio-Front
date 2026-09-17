import { api } from '@/api'
import { projectsAreMock } from '@/features/projects/source'
import { contractResponse, requireBinding } from './contract'
import { DOCUMENT_PAGE_SIZE, ENVIRONMENT_PAGE_SIZE, type DocumentSource } from './types'

export const documentsAreMock =
  import.meta.env.VITE_DOCUMENTS_SOURCE === 'mock' ||
  (import.meta.env.VITE_DOCUMENTS_SOURCE !== 'live' && projectsAreMock)
const projectPath = (id: string) => `v1/projects/${encodeURIComponent(id)}`
const documentPath = (projectId: string, interfaceId: string) =>
  `${projectPath(projectId)}/interfaces/${encodeURIComponent(interfaceId)}`
const environmentQuery = (id: string) => new URLSearchParams({ environment_id: id })
export const liveDocumentSource: DocumentSource = {
  async environments(projectId, page, signal) {
    const query = new URLSearchParams({ page: String(page), limit: String(ENVIRONMENT_PAGE_SIZE) })
    const result = contractResponse(
      'EnvironmentPage',
      await api.request(`${projectPath(projectId)}/environments?${query}`, {
        signal,
        cache: 'no-store',
      }),
    )
    requireBinding(
      result.page === page &&
        result.limit === ENVIRONMENT_PAGE_SIZE &&
        result.items.length <= result.limit,
    )
    return result
  },
  async interfaces(projectId, environmentId, page, search, signal) {
    const query = environmentQuery(environmentId)
    query.set('page', String(page))
    query.set('limit', String(DOCUMENT_PAGE_SIZE))
    if (search) query.set('query', search)
    const result = contractResponse(
      'InterfacePage',
      await api.request(`${projectPath(projectId)}/interfaces?${query}`, {
        signal,
        cache: 'no-store',
      }),
    )
    requireBinding(
      result.environment_id === environmentId &&
        result.page === page &&
        result.limit === DOCUMENT_PAGE_SIZE &&
        result.items.length <= result.limit &&
        result.items.every((item) => item.environment_id === environmentId),
    )
    return result
  },
  async definition(projectId, environmentId, interfaceId, signal) {
    const result = contractResponse(
      'InterfaceDetail',
      await api.request(
        `${documentPath(projectId, interfaceId)}?${environmentQuery(environmentId)}`,
        { signal, cache: 'no-store' },
      ),
    )
    requireBinding(
      result.project_id === projectId &&
        result.environment.id === environmentId &&
        result.interface_id === interfaceId &&
        result.method === result.definition.method &&
        result.path === result.definition.path,
    )
    return result
  },
  async observations(projectId, environmentId, interfaceId, page, signal) {
    const query = environmentQuery(environmentId)
    query.set('page', String(page))
    query.set('limit', String(DOCUMENT_PAGE_SIZE))
    const result = contractResponse(
      'ObservationPage',
      await api.request(`${documentPath(projectId, interfaceId)}/observations?${query}`, {
        signal,
        cache: 'no-store',
      }),
    )
    requireBinding(
      result.page === page &&
        result.limit === DOCUMENT_PAGE_SIZE &&
        result.items.length <= result.limit,
    )
    return result
  },
  async observation(projectId, environmentId, interfaceId, ingestionId, signal) {
    const result = contractResponse(
      'ObservationDetail',
      await api.request(
        `${projectPath(projectId)}/observations/${encodeURIComponent(ingestionId)}`,
        { signal, cache: 'no-store' },
      ),
    )
    requireBinding(
      result.project_id === projectId &&
        result.environment_id === environmentId &&
        result.ingestion_id === ingestionId &&
        (result.interface_id === null || result.interface_id === interfaceId),
    )
    return result
  },
}

// Explicit fixture mode is isolated; live failures never become sample data.
export async function getDocumentSource(): Promise<DocumentSource> {
  return documentsAreMock ? (await import('./fixtures')).fixtureSource : liveDocumentSource
}
