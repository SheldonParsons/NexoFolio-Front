import { ApiError, createApiClient } from './client'
import { clearCredential, readCredential } from './session'
import { projectRefreshLoading } from '@/app/projectRefreshLoading'

export interface UserProfile {
  id: string
  account: string
  display_name: string
  enabled: boolean
}
export interface LoginResponse {
  user: UserProfile
  token: string
  token_type: 'Bearer'
  expires_at: string
  project_sync: { status: string }
}
const client = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  timeoutMs: 60_000,
  onRequestStart: projectRefreshLoading.request,
})
function userProfile(value: unknown): UserProfile {
  const user = value as Partial<UserProfile> | null
  if (
    !user ||
    typeof user.id !== 'string' ||
    typeof user.account !== 'string' ||
    typeof user.display_name !== 'string' ||
    user.enabled !== true
  )
    throw new ApiError('登录信息无效，请重新登录。', 'invalid-response')
  return user as UserProfile
}
export async function getCurrentUser(signal?: AbortSignal): Promise<UserProfile | null> {
  const credential = readCredential()
  if (!credential) return null
  try {
    const data = await client.request<{ user: unknown }>('v1/auth/me', {
      headers: { Authorization: `Bearer ${credential.token}` },
      signal,
    })
    if (readCredential()?.token !== credential.token) return null
    return userProfile(data?.user)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearCredential(credential.token)
      return null
    }
    throw error
  }
}
export async function login(
  account: string,
  password: string,
  signal: AbortSignal,
): Promise<LoginResponse> {
  const result = await client.request<LoginResponse>('v1/auth/login', {
    method: 'POST',
    json: { account, password },
    signal,
  })
  userProfile(result?.user)
  if (
    !result ||
    typeof result.token !== 'string' ||
    !result.token ||
    result.token_type !== 'Bearer' ||
    !Number.isFinite(Date.parse(result.expires_at)) ||
    Date.parse(result.expires_at) <= Date.now()
  )
    throw new ApiError('登录服务返回了无效的会话信息。', 'invalid-response')
  return result
}
export function authErrorMessage(error: unknown, signingIn = false): string {
  if (!(error instanceof ApiError)) return '暂时无法完成登录，请稍后重试。'
  if (error.status === 401 && signingIn) return '账号或密码不正确，请重新输入。'
  if (error.status === 429) return '登录请求较多，请稍后重试。'
  if (error.status === 404 || error.status === 503 || error.status === 502)
    return '登录服务暂时不可用，请稍后重试。'
  return error.message
}
