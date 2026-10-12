import { api, ApiError } from '@/api'

export interface ManagementUser {
  id: string
  account: string
  display_name: string
  avatar_url: string | null
  enabled: boolean
  created_at: string
  last_login_at: string
}
export interface ManagementUsers {
  items: ManagementUser[]
  total: number
  page: number
  limit: number
}

export async function listManagementUsers(
  query: { page: number; limit: number; q?: string },
  signal: AbortSignal,
  request = api.request,
): Promise<ManagementUsers> {
  const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) })
  if (query.q?.trim()) params.set('q', query.q.trim())
  const result = await request<ManagementUsers>(`v1/user-management/users?${params}`, { signal })
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
    result.items.some(
      (row) =>
        !row ||
        !uuid.test(row.id) ||
        typeof row.account !== 'string' ||
        !row.account.trim() ||
        typeof row.display_name !== 'string' ||
        typeof row.enabled !== 'boolean' ||
        !(row.avatar_url === null || typeof row.avatar_url === 'string') ||
        typeof row.created_at !== 'string' ||
        typeof row.last_login_at !== 'string' ||
        !Number.isFinite(Date.parse(row.created_at)) ||
        !Number.isFinite(Date.parse(row.last_login_at)),
    ) ||
    new Set(result.items.map((row) => row.id)).size !== result.items.length
  )
    throw new ApiError('用户列表不完整，请重新加载。', 'invalid-response')
  return result
}
