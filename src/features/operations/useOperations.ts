import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { api, ApiError } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { loadDiagnostic, type DiagnosticPackage } from '@/features/audit/diagnostics'
import type { Cursor, OperationsTask, Summary, TaskPage } from './types'
export function useOperations() {
  const auth = useAuthStore(),
    project = ref(''),
    state = ref('all'),
    page = ref(1)
  const summary = ref<Summary | null>(null),
    tasks = ref<TaskPage | null>(null)
  const summaryError = ref(''),
    tasksError = ref(''),
    summaryLoading = ref(false),
    tasksLoading = ref(false),
    now = ref(Date.now()),
    online = ref(navigator.onLine)
  const detail = ref<DiagnosticPackage | null>(null),
    selected = ref<OperationsTask | null>(null),
    detailOpen = ref(false),
    detailError = ref(''),
    detailLoading = ref(false)
  const loading = computed(() => summaryLoading.value || tasksLoading.value)
  let cursors: (Cursor | null)[] = [null],
    detailController: AbortController | undefined
  let timer: ReturnType<typeof setInterval> | undefined,
    clock: ReturnType<typeof setInterval> | undefined,
    disposed = false
  // Independent request owners share one polling clock. A slow/failing channel never blocks the other.
  type Read = { key: string; controller: AbortController; promise: Promise<void> }
  let summaryRead: Read | undefined, tasksRead: Read | undefined
  let refresh: { summary: Promise<void>; tasks: Promise<void>; promise: Promise<void> } | undefined
  const canRead = () => !disposed && auth.canManageProjects && !document.hidden && navigator.onLine
  function failure(cause: unknown, message: string, revoke = true) {
    if (
      revoke &&
      auth.canManageProjects &&
      cause instanceof ApiError &&
      [401, 403, 404].includes(cause.status ?? 0)
    ) {
      auth.revokeManagement()
      return ''
    }
    return message
  }
  function cancelTasks() {
    tasksRead?.controller.abort()
    tasksRead = undefined
    tasksLoading.value = false
  }
  function stop() {
    clearInterval(timer)
    timer = undefined
    summaryRead?.controller.abort()
    summaryRead = undefined
    summaryLoading.value = false
    cancelTasks()
    refresh = undefined
  }
  function loadSummary(): Promise<void> {
    const key = auth.user?.id ?? ''
    if (summaryRead?.key === key) return summaryRead.promise
    summaryRead?.controller.abort()
    const controller = new AbortController()
    const current = () =>
      summaryRead?.controller === controller && !controller.signal.aborted && canRead()
    summaryLoading.value = true
    const promise = (async () => {
      try {
        const head = await api.request<{ snapshot: Summary }>('v1/operations/summary', {
          signal: controller.signal,
        })
        if (!current()) return
        if (!head.snapshot?.instance_id) throw new ApiError('运行摘要不完整', 'invalid-response')
        summary.value = head.snapshot
        summaryError.value = ''
        now.value = Date.now()
      } catch (cause) {
        if (current())
          summaryError.value = failure(
            cause,
            '运行摘要读取失败，任务列表仍可独立更新。保留值以原采样时间为准。',
          )
      } finally {
        if (summaryRead?.controller === controller) {
          summaryRead = undefined
          summaryLoading.value = false
        }
      }
    })()
    summaryRead = { key, controller, promise }
    return promise
  }
  function loadTasks(): Promise<void> {
    const projectId = project.value,
      taskState = state.value,
      cursor = cursors[page.value - 1]
    const params = new URLSearchParams({ limit: '20' })
    if (projectId) params.set('project', projectId)
    if (taskState !== 'all') params.set('state', taskState)
    if (cursor) {
      params.set('before_at', cursor.created_at)
      params.set('before_id', cursor.id)
    }
    const key = `${auth.user?.id}:${params}`
    if (tasksRead?.key === key) return tasksRead.promise
    cancelTasks()
    const controller = new AbortController()
    const current = () =>
      tasksRead?.controller === controller && !controller.signal.aborted && canRead()
    tasksLoading.value = true
    const promise = (async () => {
      try {
        const rows = await api.request<TaskPage>(`v1/operations/tasks?${params}`, {
          signal: controller.signal,
        })
        if (!current()) return
        if (
          !Array.isArray(rows.page?.items) ||
          rows.page.items.some(
            (t) =>
              (projectId && t.project_id !== projectId) ||
              (taskState !== 'all' && t.state !== taskState),
          )
        )
          throw new ApiError('任务列表不完整', 'invalid-response')
        tasks.value = rows
        tasksError.value = ''
        now.value = Date.now()
      } catch (cause) {
        if (current())
          tasksError.value = failure(
            cause,
            '任务列表读取失败，运行摘要仍可独立更新。已显示的列表可能过期。',
          )
      } finally {
        if (tasksRead?.controller === controller) {
          tasksRead = undefined
          tasksLoading.value = false
        }
      }
    })()
    tasksRead = { key, controller, promise }
    return promise
  }
  function load(): Promise<void> {
    if (!canRead()) return Promise.resolve()
    const summary = loadSummary(),
      tasks = loadTasks()
    if (refresh?.summary === summary && refresh.tasks === tasks) return refresh.promise
    const promise = Promise.allSettled([summary, tasks]).then(() => {})
    refresh = { summary, tasks, promise }
    return promise
  }
  function changePage(direction: -1 | 1) {
    if (direction === 1) {
      if (!tasks.value?.page.next) return
      cursors[page.value] = tasks.value.page.next
    }
    if (page.value + direction < 1) return
    page.value += direction
    tasks.value = null
    void load()
  }
  async function choose(task: OperationsTask) {
    detailController?.abort()
    selected.value = task
    detail.value = null
    detailOpen.value = true
    detailError.value = ''
    if (!canRead()) {
      detailError.value = '连接恢复后可重新读取诊断。'
      return
    }
    const request = (detailController = new AbortController())
    detailLoading.value = true
    try {
      const value = await loadDiagnostic(task.project_id, task.id, request.signal, 'task')
      if (!request.signal.aborted && auth.canManageProjects && selected.value?.id === task.id)
        detail.value = value
    } catch (cause) {
      if (!request.signal.aborted)
        detailError.value = failure(cause, '诊断读取失败，请重试或核对项目访问权限。', false)
    } finally {
      if (detailController === request) detailLoading.value = false
    }
  }
  function wake() {
    online.value = navigator.onLine
    now.value = Date.now()
    if (canRead()) {
      if (!timer) timer = setInterval(() => void load(), 5000)
      void load()
      if (detailOpen.value && selected.value && !detail.value) void choose(selected.value)
    } else {
      stop()
      detailController?.abort()
      detailLoading.value = false
    }
  }
  watch([project, state], () => {
    cancelTasks()
    tasksError.value = ''
    cursors = [null]
    page.value = 1
    tasks.value = null
    detailOpen.value = false
    void load()
  })
  watch(detailOpen, (open) => {
    if (!open) {
      detailController?.abort()
      selected.value = null
      detail.value = null
    }
  })
  watch(
    () => auth.canManageProjects,
    (allowed) => {
      if (!allowed) {
        stop()
        detailController?.abort()
        summary.value = null
        tasks.value = null
        summaryError.value = ''
        tasksError.value = ''
        detail.value = null
        detailOpen.value = false
      }
    },
    { flush: 'sync' },
  )
  onMounted(() => {
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('online', wake)
    window.addEventListener('offline', wake)
    clock = setInterval(() => {
      now.value = Date.now()
    }, 1000)
    wake()
  })
  onScopeDispose(() => {
    disposed = true
    stop()
    detailController?.abort()
    clearInterval(clock)
    document.removeEventListener('visibilitychange', wake)
    window.removeEventListener('online', wake)
    window.removeEventListener('offline', wake)
  })
  return {
    project,
    state,
    page,
    summary,
    tasks,
    summaryError,
    tasksError,
    summaryLoading,
    tasksLoading,
    loading,
    now,
    online,
    load,
    changePage,
    choose,
    detail,
    selected,
    detailOpen,
    detailError,
    detailLoading,
  }
}
