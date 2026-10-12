import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { api, ApiError } from '@/api'
import { useAuthStore } from '@/stores/auth'
import type { Report } from './types'
export function useAuditReport() {
  const auth = useAuthStore()
  const allowed = computed(() => auth.canManageProjects)
  const report = ref<Report | null>(null)
  let controller: AbortController | undefined
  const actorOptions = ref<Record<string, string>>({})
  const loading = ref(false)
  const error = ref('')
  const actor = ref('')
  const requestId = ref('')
  const project = ref('')
  const kind = ref('operation')
  const days = ref(7)
  const routeFilter = ref('')
  const updated = ref('')
  const loss = computed(
    () =>
      (report.value?.health?.dropped_access ?? 0) + (report.value?.health?.dropped_important ?? 0),
  )
  const count = (value: number) => new Intl.NumberFormat('zh-CN').format(value)
  const time = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false })
  async function load() {
    if (!allowed.value) return
    controller?.abort()
    const request = (controller = new AbortController())
    loading.value = true
    error.value = ''
    report.value = null
    const query = new URLSearchParams({
      since: new Date(Date.now() - days.value * 86400000).toISOString(),
    })
    if (routeFilter.value.trim()) query.set('route', routeFilter.value.trim())
    for (const [key, value] of Object.entries({
      actor: actor.value,
      request_id: requestId.value,
      project: project.value,
      kind: kind.value,
    }))
      if (value.trim()) query.set(key, value.trim())
    try {
      const result = await api.request<Report>(`/v1/audit?${query}`, { signal: request.signal })
      if (allowed.value && !request.signal.aborted) {
        actorOptions.value = { ...actorOptions.value, ...result.actors }
        report.value = result
        updated.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
      }
    } catch (e) {
      if (request.signal.aborted) return
      if (e instanceof ApiError && [401, 403, 404].includes(e.status ?? 0)) auth.revokeManagement()
      error.value = e instanceof Error ? e.message : '审计记录读取失败'
    } finally {
      if (!request.signal.aborted) loading.value = false
    }
  }
  function chooseRoute(route: string) {
    routeFilter.value = route
    void load()
  }
  function trace(id: string) {
    requestId.value = id
    kind.value = ''
    void load()
  }
  watch(allowed, (value) => {
    if (!value) {
      controller?.abort()
      report.value = null
      actorOptions.value = {}
    }
  })
  onMounted(load)

  onScopeDispose(() => controller?.abort())
  return {
    allowed,
    report,
    loading,
    error,
    actor,
    requestId,
    project,
    kind,
    days,
    routeFilter,
    updated,
    loss,
    count,
    time,
    load,
    chooseRoute,
    trace,
    actorOptions,
  }
}
