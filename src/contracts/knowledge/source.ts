import { api } from '@/api'
import { changeCuration, readCuration } from '@/contracts/knowledge/curationReads'
import type { Catalog, CurateProgress, EndpointPage, EndpointDetail } from './types'

export function path(projectId: string): string {
  return `v1/projects/${encodeURIComponent(projectId)}/catalog`
}

function curatePath(projectId: string): string {
  return `v1/projects/${encodeURIComponent(projectId)}/curate`
}


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

/** Generates a reviewable proposal for one endpoint in the background. */
export async function describeEndpoint(
  projectId: string,
  endpointId: string,
  signal?: AbortSignal,
): Promise<CurateProgress> {
  return changeCuration(projectId, () => api.request<CurateProgress>(
    `${curatePath(projectId)}/describe/${encodeURIComponent(endpointId)}`,
    { method: 'POST', signal, timeoutMs: 15_000 },
  ))
}

/** Starts or joins the background describe -> organize workflow. */
export async function startCurate(
  projectId: string,
  signal?: AbortSignal,
): Promise<CurateProgress> {
  return changeCuration(projectId, () => api.request<CurateProgress>(curatePath(projectId), {
    method: 'POST',
    signal,
    timeoutMs: 15_000,
  }))
}

export function curateProgress(projectId: string, signal?: AbortSignal, runKey = ''): Promise<CurateProgress> {
  return readCuration<CurateProgress>(projectId, curatePath(projectId), signal, runKey)
}

/** Resume this exact candidate. This never opens a new generation. */
export function resumeCandidate(projectId: string, candidateId: string, signal?: AbortSignal): Promise<CurateProgress> {
  return changeCuration(projectId, () => api.request<CurateProgress>(`${curatePath(projectId)}/candidates/${encodeURIComponent(candidateId)}/resume`, { method: 'POST', signal, timeoutMs: 120_000 }))
}
export function cancelCandidate(projectId: string, candidateId: string, signal?: AbortSignal): Promise<void> {
  return changeCuration(projectId, () => api.request<void>(`${curatePath(projectId)}/candidates/${encodeURIComponent(candidateId)}/cancel`, { method: 'POST', signal }))
}
