import { api } from '@/api'
import type { Candidate, CandidateSummary, CandidateOperations } from './types'
import type { DocumentIndex } from '@/features/documents/source'
import type { EndpointSummary } from '@/contracts/knowledge/types'
const path = (project: string) => `v1/projects/${encodeURIComponent(project)}/curate/candidates`
export const candidates = (project: string, signal?: AbortSignal) =>
  api.request<CandidateSummary[]>(path(project), { signal, cache: 'no-store' })
/** Entry selection scans all proposal metadata; the history list remains bounded. */
export const entryCandidates = (project: string, signal?: AbortSignal) =>
  api.request<CandidateSummary[]>(`${path(project)}?review_entry=true`, {
    signal,
    cache: 'no-store',
  })
/** Preferred panel row first; an explicitly viewed row can be refreshed outside history paging. */
export const panelCandidates = (project: string, signal?: AbortSignal, selectedId = '') => {
  const query = new URLSearchParams({ panel_entry: 'true' })
  if (selectedId) query.set('selected_id', selectedId)
  return api.request<CandidateSummary[]>(`${path(project)}?${query}`, { signal, cache: 'no-store' })
}
export const candidate = (project: string, id: string, signal?: AbortSignal) =>
  api.request<Candidate>(`${path(project)}/${encodeURIComponent(id)}`, {
    signal,
    cache: 'no-store',
  })
export const candidateOperations = (project: string, id: string, signal?: AbortSignal) =>
  api.request<CandidateOperations>(`${path(project)}/${encodeURIComponent(id)}/operations`, {
    signal,
    cache: 'no-store',
  })
/** A candidate owns its folders, names and placement; only observed endpoint facts are needed. */
export async function factsIndex(project: string, signal?: AbortSignal): Promise<DocumentIndex> {
  const result = await api.request<{ endpoints: EndpointSummary[] }>(
    `v1/projects/${encodeURIComponent(project)}/endpoints`,
    { signal },
  )
  const entries = result.endpoints
    .filter((summary) => summary.project_id === project)
    .map((summary) => ({
      interface_id: summary.id,
      method: summary.method,
      path: summary.path_template,
      name: null,
      purpose: null,
      folderId: null,
      summary,
    }))
  return { catalog: { project_id: project, folders: [], unplaced: entries.length }, entries }
}
export const applyCandidate = (project: string, id: string, signal?: AbortSignal) =>
  api.request<{ status: 'applied'; rounds: string[] }>(
    `${path(project)}/${encodeURIComponent(id)}/apply`,
    { method: 'POST', signal },
  )
export const discardCandidate = (project: string, id: string, signal?: AbortSignal) =>
  api.request<{ status: 'discarded' }>(`${path(project)}/${encodeURIComponent(id)}/discard`, {
    method: 'POST',
    signal,
  })
