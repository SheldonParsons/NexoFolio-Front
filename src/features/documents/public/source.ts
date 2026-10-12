import { api, ApiError } from '@/api'
import type { FieldFacts } from '@/contracts/knowledge/types'
import type { DocumentIndex } from '../source'
import type { ProjectEnvironment } from '../types'

export interface PublicDocumentIndex extends DocumentIndex {
  project: { project_id: string; name: string; status: string; environments: ProjectEnvironment[] }
}
export interface PublicField {
  retired_sources?: boolean
  key: string
  structure: FieldFacts
  name: string | null
  description: string | null
  details: string[]
  unknowns: string[]
  confirmation: string | null
}
export interface PublicEndpoint {
  retired_source_count?: number
  project_id: string
  endpoint_id: string
  environment_id: string | null
  name: string | null
  purpose: string | null
  description: string | null
  unknowns: string[]
  method: string
  path: string
  fields: PublicField[]
}
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
    value?.project_id !== project ||
    value.environment_id !== (environment || null) ||
    !value.endpoint_id ||
    !Array.isArray(value.fields)
  )
    throw new ApiError('公开文档与当前项目或环境不匹配。', 'invalid-response')
  return value
}
