import { api, ApiError } from '@/api'

export interface PermissionSource {
  project_id: string
  name: string
  status: string
}
export interface ManagedProject {
  project_id: string
  name: string
  permission_source: PermissionSource
  permission_sources: PermissionSource[]
  revision: number
}
export interface ContentCounts {
  interfaces: number
  structures: number
  folders: number
  curation_results: number
  running_curations: number
}
type Request = typeof api.request
const invalid = () => new ApiError('项目管理数据不完整，请重新加载。', 'invalid-response')
const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i
function source(value: PermissionSource) {
  if (
    !value ||
    !uuid.test(value.project_id) ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    typeof value.status !== 'string'
  )
    throw invalid()
  return value
}
function validateIds(ids: string[]) {
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 100 ||
    ids.some((id) => !uuid.test(id)) ||
    new Set(ids).size !== ids.length
  )
    throw invalid()
}
function sameIds(sources: PermissionSource[], ids: string[]) {
  return sources.length === ids.length && sources.every((item) => ids.includes(item.project_id))
}
function managed(data: ManagedProject) {
  if (
    !data ||
    !uuid.test(data.project_id) ||
    typeof data.name !== 'string' ||
    !data.name.trim() ||
    !Number.isSafeInteger(data.revision) ||
    data.revision < 1 ||
    !Array.isArray(data.permission_sources)
  )
    throw invalid()
  data.permission_sources.forEach(source)
  validateIds(data.permission_sources.map((item) => item.project_id))
  return data
}
export function createProjectManagement(request: Request = api.request) {
  return {
    async sources(signal: AbortSignal): Promise<PermissionSource[]> {
      const items: PermissionSource[] = []
      let total: number | undefined
      for (let page = 1; page <= 100; page++) {
        const data = await request<{
          items: PermissionSource[]
          total: number
          page: number
          limit: number
        }>(`v1/project-management/permission-sources?page=${page}&limit=100`, { signal })
        if (
          !data ||
          !Array.isArray(data.items) ||
          !Number.isSafeInteger(data.total) ||
          data.total < 0 ||
          data.total > 10000 ||
          data.page !== page ||
          data.limit !== 100 ||
          (total !== undefined && total !== data.total)
        )
          throw invalid()
        total = data.total
        items.push(...data.items.map(source))
        if (
          new Set(items.map((item) => item.project_id)).size !== items.length ||
          items.length > total
        )
          throw invalid()
        if (items.length === total) return items
        if (!data.items.length) throw invalid()
      }
      throw invalid()
    },
    async get(project: string, signal: AbortSignal): Promise<ManagedProject> {
      if (!uuid.test(project)) throw invalid()
      const data = managed(
        await request<ManagedProject>(`v1/project-management/projects/${project}`, { signal }),
      )
      if (data.project_id !== project) throw invalid()
      return data
    },
    async create(name: string, ids: string[], signal: AbortSignal): Promise<ManagedProject> {
      validateIds(ids)
      const data = managed(
        await request<ManagedProject>('v1/project-management/projects', {
          method: 'POST',
          json: { name, permission_source_project_ids: ids },
          signal,
        }),
      )
      if (data.name !== name || !sameIds(data.permission_sources, ids)) throw invalid()
      return data
    },
    async edit(
      project: string,
      name: string,
      ids: string[],
      revision: number,
      signal: AbortSignal,
    ): Promise<ManagedProject> {
      validateIds(ids)
      if (!uuid.test(project) || !Number.isSafeInteger(revision) || revision < 1) throw invalid()
      const data = managed(
        await request<ManagedProject>(`v1/project-management/projects/${project}`, {
          method: 'PATCH',
          json: { name, permission_source_project_ids: ids, revision },
          signal,
        }),
      )
      if (
        data.project_id !== project ||
        data.name !== name ||
        data.revision !== revision + 1 ||
        !sameIds(data.permission_sources, ids)
      )
        throw invalid()
      return data
    },
    async contents(project: string, signal: AbortSignal): Promise<ContentCounts> {
      if (!uuid.test(project)) throw invalid()
      const data = await request<ContentCounts>(
        `v1/project-management/projects/${project}/content`,
        { signal },
      )
      if (
        !data ||
        !['interfaces', 'structures', 'folders', 'curation_results', 'running_curations'].every(
          (key) =>
            Number.isSafeInteger(data[key as keyof ContentCounts]) &&
            data[key as keyof ContentCounts] >= 0,
        )
      )
        throw invalid()
      return data
    },
    async clear(project: string, confirmation: string, signal: AbortSignal): Promise<void> {
      if (!uuid.test(project)) throw invalid()
      const data = await request<{ cleared: ContentCounts }>(
        `v1/project-management/projects/${project}/clear`,
        { method: 'POST', json: { confirmation }, signal, timeoutMs: 60000 },
      )
      if (!data?.cleared || !Number.isSafeInteger(data.cleared.interfaces)) throw invalid()
    },
  }
}
export const projectManagement = createProjectManagement()
export function managementError(error: unknown, action?: 'create' | 'edit') {
  if (error instanceof ApiError && error.status === 404)
    return '项目管理权限已失效或项目不存在，请刷新页面。'
  if (error instanceof ApiError && error.status === 409)
    return action === 'create'
      ? '已经有同名的独立项目，请换一个名称。'
      : action === 'edit'
        ? '项目已被修改、正在处理其他操作，或名称已被占用。请重新加载后再试。'
        : '项目正在处理其他操作，请暂停采集或停止整理后重试。'
  return error instanceof Error ? error.message : '暂时无法完成操作，请稍后重试。'
}
