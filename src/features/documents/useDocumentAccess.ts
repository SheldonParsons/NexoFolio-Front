import { onScopeDispose, ref, watch } from 'vue'
import { api } from '@/api'
import type { Project } from '@/features/projects/types'

/** Member capabilities are checked separately; public viewing never grants them. */
export function useDocumentAccess(projectId: () => string, userId: () => string | undefined) {
  const mode = ref<'checking' | 'member' | 'public'>('checking')
  let pending: AbortController | undefined
  function readOnly() {
    pending?.abort()
    mode.value = 'public'
  }
  async function check() {
    pending?.abort()
    const request = new AbortController()
    pending = request
    mode.value = 'checking'
    if (!userId()) return readOnly()
    try {
      const project = await api.request<Project>(`v1/projects/${encodeURIComponent(projectId())}`, {
        signal: request.signal,
        cache: 'no-store',
      })
      if (!request.signal.aborted)
        mode.value = project.can_access && project.access_state === 'allowed' ? 'member' : 'public'
    } catch {
      if (!request.signal.aborted) mode.value = 'public'
    }
  }
  watch([projectId, userId], check, { immediate: true, flush: 'sync' })
  onScopeDispose(() => pending?.abort())
  return { mode, check, readOnly }
}
