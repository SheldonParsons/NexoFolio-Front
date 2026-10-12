import { api, ApiError } from '@/api'
import type { PermissionSource } from '@/features/projects/management/api'
export interface ManagementProject {
  project_id: string
  name: string
  status: string
  origin: 'local' | 'zentao'
  permission_sources: PermissionSource[]
}
export interface ManagementPage {
  items: ManagementProject[]
  total: number
  page: number
  limit: number
}
export async function listManagementProjects(
  query: { page: number; limit: number; q?: string; origin?: string },
  signal: AbortSignal,
  request = api.request,
): Promise<ManagementPage> {
  const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) })
  if (query.q?.trim()) params.set('q', query.q.trim())
  if (query.origin) params.set('origin', query.origin)
  const result = await request<ManagementPage>(`v1/project-management/projects?${params}`, {
    signal,
  })
  const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i
  if (
    !result ||
    !Array.isArray(result.items) ||
    !Number.isSafeInteger(result.total) ||
    result.total < 0 ||
    result.page !== query.page ||
    result.limit !== query.limit ||
    result.items.length > query.limit ||
    result.items.length > result.total ||
    new Set(result.items.map((row) => row.project_id)).size !== result.items.length ||
    result.items.some(
      (row) =>
        !uuid.test(row.project_id) ||
        typeof row.name !== 'string' ||
        !row.name.trim() ||
        typeof row.status !== 'string' ||
        !['local', 'zentao'].includes(row.origin) ||
        !Array.isArray(row.permission_sources) ||
        row.permission_sources.some(
          (source) =>
            !uuid.test(source.project_id) || typeof source.name !== 'string' || !source.name.trim(),
        ),
    )
  )
    throw new ApiError('项目管理列表不完整，请重新加载。', 'invalid-response')
  return result
}
