import { ApiError } from '@/api'
import type { Project, ProjectPage, ProjectSource } from './types'

type Request = <T>(path: string, options: { signal: AbortSignal }) => Promise<T>
export function parseProject(value: unknown): Project {
  const p = value as Partial<Project> | null
  if (
    !p ||
    typeof p.project_id !== 'string' ||
    typeof p.name !== 'string' ||
    typeof p.status !== 'string' ||
    (p.origin !== undefined && !['local', 'zentao'].includes(p.origin)) ||
    typeof p.can_access !== 'boolean' ||
    !['allowed', 'denied', 'unknown'].includes(p.access_state ?? '') ||
    !(p.reason_code === null || typeof p.reason_code === 'string')
  )
    throw new ApiError('项目数据格式不正确。', 'invalid-response')
  if (p.curation != null) {
    const c = p.curation
    if (
      typeof c.id !== 'string' ||
      !['queued', 'running', 'waiting', 'needs_attention', 'done', 'failed', 'stopped'].includes(
        c.state,
      ) ||
      !(
        c.started_at === null ||
        (typeof c.started_at === 'string' && Number.isFinite(Date.parse(c.started_at)))
      ) ||
      !(c.actor_name === null || typeof c.actor_name === 'string')
    )
      throw new ApiError('项目整理摘要格式不正确。', 'invalid-response')
  }
  return p as Project
}
export function createLiveProjectSource(request: Request): ProjectSource {
  return {
    async list(query, signal) {
      const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) })
      if (query.q?.trim()) params.set('q', query.q.trim())
      if (query.ids) params.set('ids', query.ids.join(','))
      const data = await request<ProjectPage>(`v1/projects?${params}`, { signal })
      if (
        !data ||
        !Array.isArray(data.items) ||
        !Number.isSafeInteger(data.total) ||
        data.total < 0 ||
        data.page !== query.page ||
        data.limit !== query.limit ||
        data.items.length > query.limit
      )
        throw new ApiError('项目列表格式不正确。', 'invalid-response')
      return { ...data, items: data.items.map(parseProject) }
    },
    async get(id, signal) {
      return parseProject(await request(`v1/projects/${encodeURIComponent(id)}`, { signal }))
    },
  }
}
