import { api } from '@/api'
import { changeCuration, readCuration } from '@/contracts/knowledge/curationReads'
import type { Candidate, CandidateSummary, CandidateOperations } from './types'
import type { DocumentIndex } from '@/features/documents/source'
import type { DocumentLifecycle } from '@/contracts/knowledge/lifecycle'
import type { EndpointSummary } from '@/contracts/knowledge/types'
const path = (project: string) => `v1/projects/${encodeURIComponent(project)}/curate/candidates`
export const candidates = (project: string, signal?: AbortSignal) =>
  readCuration<CandidateSummary[]>(project, path(project), signal)
/** Entry selection scans all proposal metadata; the history list remains bounded. */
export const entryCandidates = (project: string, signal?: AbortSignal) =>
  readCuration<CandidateSummary[]>(project, `${path(project)}?review_entry=true`, signal)
/** Preferred panel row first; an explicitly viewed row can be refreshed outside history paging. */
export const panelCandidates = (project: string, signal?: AbortSignal, selectedId = '') => {
  const query = new URLSearchParams({ panel_entry: 'true' })
  if (selectedId) query.set('selected_id', selectedId)
  return readCuration<CandidateSummary[]>(project, `${path(project)}?${query}`, signal)
}
export const candidate = (project: string, id: string, signal?: AbortSignal) =>
  readCuration<Candidate>(project, `${path(project)}/${encodeURIComponent(id)}`, signal)
export const candidateOperations = (project: string, id: string, signal?: AbortSignal) =>
  api.request<CandidateOperations>(`${path(project)}/${encodeURIComponent(id)}/operations`, {
    signal,
    cache: 'no-store',
  })
/** Preserve candidate content; only current identities and lifecycle overlay are read. */
export async function factsIndex(project: string, signal?: AbortSignal): Promise<DocumentIndex> {
  const [result, lifecycle] = await Promise.all([
    api.request<{ endpoints: EndpointSummary[] }>(
      `v1/projects/${encodeURIComponent(project)}/endpoints`,
      { signal },
    ),
    api.request<DocumentLifecycle>(
      `v1/projects/${encodeURIComponent(project)}/document-lifecycle`,
      { signal, cache: 'no-store' },
    ),
  ])
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
  return {
    catalog: { project_id: project, folders: [], unplaced: entries.length },
    entries,
    lifecycle,
  }
}
export const applyCandidate = (project: string, id: string, signal?: AbortSignal) =>
  changeCuration(project, () => api.request<{ status: 'applied'; rounds: string[] }>(
    `${path(project)}/${encodeURIComponent(id)}/apply`,
    { method: 'POST', signal },
  ))
export const discardCandidate = (project: string, id: string, signal?: AbortSignal) =>
  changeCuration(project, () => api.request<{ status: 'discarded' }>(`${path(project)}/${encodeURIComponent(id)}/discard`, {
    method: 'POST',
    signal,
  }))
