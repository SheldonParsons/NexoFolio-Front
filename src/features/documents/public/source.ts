import { api, ApiError } from '@/api'
import type { EndpointDetail } from '@/contracts/knowledge/types'
import type { DocumentIndex } from '../source'
import type { ProjectEnvironment } from '../types'
import type { InjectionKey } from 'vue'

/** Selects a web read transport only; the server remains the permission authority. */
export const publicDocumentReads: InjectionKey<boolean> = Symbol('public-document-reads')

export interface PublicDocumentIndex extends DocumentIndex {
  project: { project_id: string; name: string; status: string; environments: ProjectEnvironment[] }
}
export type PublicEndpoint = EndpointDetail
const base = (project: string) => `v1/public/projects/${encodeURIComponent(project)}`
export async function publicIndex(project: string, signal: AbortSignal) {
  const value = await api.request<PublicDocumentIndex>(base(project) + '/document', {
    signal,
    cache: 'no-store',
  })
  if (
    value?.project?.project_id !== project ||
    value.catalog?.project_id !== project ||
    !Array.isArray(value.entries) ||
    !Array.isArray(value.project.environments)
  )
    throw new ApiError('公开文档与当前项目不匹配。', 'invalid-response')
  return value
}
export async function publicEndpoint(
  project: string,
  endpoint: string,
  environment: string,
  signal: AbortSignal,
) {
  const query = environment ? `?environment_id=${encodeURIComponent(environment)}` : ''
  const value = await api.request<PublicEndpoint>(
    `${base(project)}/endpoints/${encodeURIComponent(endpoint)}${query}`,
    { signal, cache: 'no-store' },
  )
  if (
    value?.facts?.summary?.project_id !== project ||
    !value.facts.summary.id ||
    !Array.isArray(value.facts.fields) ||
    !Array.isArray(value.facts.examples)
  )
    throw new ApiError('公开文档与当前项目或环境不匹配。', 'invalid-response')
  return value
}
