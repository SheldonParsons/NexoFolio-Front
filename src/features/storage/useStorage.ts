import { onMounted, onScopeDispose, ref, watch } from 'vue'
import { api, ApiError } from '@/api'
import { useAuthStore } from '@/stores/auth'
import type { MaintenanceResult, StorageState } from './types'
export function useStorage() {
  const auth = useAuthStore(),
    project = ref(''),
    data = ref<StorageState | null>(null)
  const error = ref(''),
    loading = ref(false),
    busy = ref(false),
    confirm = ref(false)
  const result = ref<MaintenanceResult | null>(null),
    now = ref(Date.now()),
    online = ref(navigator.onLine)
  const after = ref<string | null>(null)
  let read: AbortController | undefined, action: AbortController | undefined
  let timer: ReturnType<typeof setInterval> | undefined,
    disposed = false,
    sampled = 0
  const identity = () => `${auth.user?.id}:${project.value}`
  const allowed = () =>
    !disposed && auth.canManageProjects && !!project.value && !document.hidden && navigator.onLine
  function failure(cause: unknown, fallback: string) {
    if (cause instanceof ApiError && [401, 403, 404].includes(cause.status ?? 0))
      auth.revokeManagement()
    else error.value = cause instanceof ApiError && cause.kind === 'http' ? cause.message : fallback
  }
  async function load(refresh = false) {
    if (!allowed() || read) return
    const controller = (read = new AbortController()),
      key = identity()
    const current = () => !controller.signal.aborted && identity() === key && allowed()
    loading.value = true
    try {
      if (refresh || Date.now() - sampled > 30000) {
        await api.request(`v1/projects/${project.value}/storage/refresh`, {
          method: 'POST',
          signal: controller.signal,
        })
        if (!current()) return
        sampled = Date.now()
      }
      const value = await api.request<StorageState>(`v1/projects/${project.value}/storage`, {
        signal: controller.signal,
      })
      if (current()) {
        if (value.snapshot.project !== project.value) throw new Error('project mismatch')
        data.value = value
        error.value = ''
      }
    } catch (cause) {
      if (current()) failure(cause, '统计读取失败，保留值仍属于原采样时间。')
    } finally {
      if (read === controller) {
        read = undefined
        loading.value = false
      }
    }
  }
  async function run(kind: 'preview' | 'enable' | 'execute') {
    if (!allowed() || busy.value) return
    const controller = (action = new AbortController()),
      key = identity(),
      selected = project.value
    busy.value = true
    error.value = ''
    result.value = null
    try {
      const value = await api.request<MaintenanceResult>(
        `v1/projects/${selected}/storage/maintenance`,
        {
          method: 'POST',
          json: { action: kind, after: after.value },
          signal: controller.signal,
          timeoutMs: 8000,
        },
      )
      if (!controller.signal.aborted && identity() === key && auth.canManageProjects) {
        if (value.project !== selected) throw new Error('project mismatch')
        result.value = value
        confirm.value = false
        sampled = 0
        void load(true)
      }
    } catch (cause) {
      if (!controller.signal.aborted && identity() === key && auth.canManageProjects) {
        failure(
          cause,
          kind === 'preview'
            ? '预览失败，请重试。'
            : '提交结果未知。请重新预览同一批核对；不要直接进入下一批。',
        )
        if (auth.canManageProjects && kind !== 'preview')
          result.value = {
            project: selected,
            outcome: 'unknown',
            report: null,
            at: new Date().toISOString(),
          }
        confirm.value = false
      }
    } finally {
      if (action === controller) {
        action = undefined
        busy.value = false
      }
    }
  }
  function restart() {
    after.value = null
    void run('preview')
  }
  function next() {
    after.value = result.value?.report?.next ?? null
    void run('preview')
  }
  function reset() {
    read?.abort()
    action?.abort()
    read = undefined
    action = undefined
    data.value = null
    result.value = null
    error.value = ''
    after.value = null
    confirm.value = false
    busy.value = false
    loading.value = false
    sampled = 0
  }
  function wake() {
    online.value = navigator.onLine
    now.value = Date.now()
    if (allowed()) void load()
    else {
      read?.abort()
      read = undefined
      loading.value = false
    }
  }
  watch(
    [project, () => auth.user?.id, () => auth.canManageProjects],
    () => {
      reset()
      wake()
    },
    { flush: 'sync' },
  )
  onMounted(() => {
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('online', wake)
    window.addEventListener('offline', wake)
    timer = setInterval(wake, 5000)
    wake()
  })
  onScopeDispose(() => {
    disposed = true
    reset()
    clearInterval(timer)
    document.removeEventListener('visibilitychange', wake)
    window.removeEventListener('online', wake)
    window.removeEventListener('offline', wake)
  })
  return {
    project,
    data,
    result,
    error,
    loading,
    busy,
    confirm,
    now,
    online,
    after,
    load,
    run,
    next,
    restart,
  }
}
