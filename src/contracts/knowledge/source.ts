import { api } from '@/api'
import type { Catalog, CurateResult, EndpointPage, EndpointDetail } from './types'

export function path(projectId: string): string {
  return `v1/projects/${encodeURIComponent(projectId)}/catalog`
}

function curatePath(projectId: string): string {
  return `v1/projects/${encodeURIComponent(projectId)}/curate`
}

/** A model reply over dozens of endpoints outlasts the default request timeout. */
const CURATE_TIMEOUT_MS = 180_000

export async function catalog(projectId: string, signal?: AbortSignal): Promise<Catalog> {
  return api.request<Catalog>(`${path(projectId)}`, { signal })
}

export async function interfaces(
  projectId: string,
  directoryId: string,
  page: number = 1,
  limit: number = 100,
  signal?: AbortSignal,
): Promise<EndpointPage> {
  const query = new URLSearchParams({
    directory_id: directoryId,
    page: String(page),
    limit: String(limit),
  })
  return api.request<EndpointPage>(`${path(projectId)}/interfaces?${query}`, { signal })
}

export async function unclassified(
  projectId: string,
  page: number = 1,
  limit: number = 100,
  signal?: AbortSignal,
): Promise<EndpointPage> {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  return api.request<EndpointPage>(`${path(projectId)}/unclassified?${query}`, { signal })
}

export async function endpoint(
  projectId: string,
  endpointId: string,
  signal?: AbortSignal,
): Promise<EndpointDetail> {
  return api.request<EndpointDetail>(
    `v1/projects/${encodeURIComponent(projectId)}/endpoints/${encodeURIComponent(endpointId)}`,
    { signal }
  )
}

/** Names one endpoint from its traffic facts. Writes a round, so it is undoable. */
export async function describeEndpoint(
  projectId: string,
  endpointId: string,
  signal?: AbortSignal,
): Promise<CurateResult> {
  return api.request<CurateResult>(
    `${curatePath(projectId)}/describe/${encodeURIComponent(endpointId)}`,
    { method: 'POST', signal, timeoutMs: CURATE_TIMEOUT_MS },
  )
}

/** Proposes the whole folder layout at once and places every endpoint it matches. */
export async function organizeProject(
  projectId: string,
  signal?: AbortSignal,
): Promise<CurateResult> {
  return api.request<CurateResult>(`${curatePath(projectId)}/organize`, {
    method: 'POST',
    signal,
    timeoutMs: CURATE_TIMEOUT_MS,
  })
}
