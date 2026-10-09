import { createApiClient } from './client'
import { readCredential } from './session'
import { projectRefreshLoading } from '@/app/projectRefreshLoading'

/** Future feature API modules use this client; backend contracts are not guessed here. */
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
export const api = createApiClient({
  baseUrl: apiBaseUrl,
  getAccessToken: () => readCredential()?.token,
  onRequestStart: projectRefreshLoading.request,
})
export { ApiError } from './client'
