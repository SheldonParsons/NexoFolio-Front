import { api } from '@/api'
import type { ObservedValuePage } from '@/contracts/knowledge/types'
export interface ObservedValueScope {
  project: string
  endpoint: string
  archive: string
  field: string
  environment?: string
  publicRead?: boolean
}
function url(scope: ObservedValueScope, offset: number, valueId?: string) {
  const query = new URLSearchParams({
    archive: scope.archive,
    field: scope.field,
    offset: String(offset),
    limit: '12',
  })
  if (scope.environment) query.set('environment', scope.environment)
  if (valueId) query.set('value_id', valueId)
  return `v1/${scope.publicRead ? 'public/' : ''}projects/${encodeURIComponent(scope.project)}/endpoints/${encodeURIComponent(scope.endpoint)}/field-values?${query}`
}
export function observedValues(scope: ObservedValueScope, offset = 0, signal?: AbortSignal) {
  return api.request<ObservedValuePage>(url(scope, offset), { signal, cache: 'no-store' })
}
/** Keep the exact JSON text: parsing and re-stringifying in JS would round large numbers. */
export async function observedValueJson(
  scope: ObservedValueScope,
  valueId: string,
  signal?: AbortSignal,
): Promise<string> {
  const value = await api.request<{ json: string }>(url(scope, 0, valueId), {
    signal,
    cache: 'no-store',
  })
  if (typeof value.json !== 'string') throw new Error('未收到完整观测值文本')
  return value.json
}
