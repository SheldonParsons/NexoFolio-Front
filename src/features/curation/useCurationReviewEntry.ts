import { onScopeDispose, ref, watch } from 'vue'
import type { RouteLocationNamedRaw } from 'vue-router'
import { ApiError } from '@/api/client'
import { entryCandidates } from './source'
import { canReviewDecision } from './reviewActions'

/** Shared, read-only entry for the navigation menu and document heading. */
export function useCurationReviewEntry(
  projectId: () => string,
  environmentId: () => string,
  navigate: (to: RouteLocationNamedRaw) => unknown,
  routeKey: () => string,
) {
  const loading = ref(false)
  const message = ref('')
  const retryable = ref(false)
  let request: AbortController | undefined

  function cancel() {
    request?.abort()
    request = undefined
    loading.value = false
    message.value = ''
    retryable.value = false
  }

  async function open() {
    if (loading.value) return
    message.value = ''
    retryable.value = false
    const pid = projectId(),
      env = environmentId()
    if (!pid) {
      message.value = '请先进入一个项目，再查看整理结果。'
      return
    }
    const current = new AbortController()
    request = current
    loading.value = true
    const owns = () => request === current && !current.signal.aborted && projectId() === pid
    try {
      const rows = await entryCandidates(pid, current.signal)
      if (!owns()) return
      const projectRows = rows.filter((row) => row.project_id === pid)
      if (!projectRows.length) {
        message.value = '暂无整理结果，请先进行整理文档'
        return
      }
      const latestPending = projectRows
        .filter((row) => canReviewDecision(row.state, 'apply'))
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
      await navigate({
        name: 'curation-review',
        params: latestPending
          ? { projectId: pid, candidateId: latestPending.id }
          : { projectId: pid },
        query: env ? { env } : {},
      })
    } catch (cause) {
      if (!owns()) return
      message.value =
        cause instanceof ApiError && cause.status === 401
          ? '登录已过期，请重新登录。'
          : cause instanceof ApiError && cause.status === 403
            ? '没有权限查看当前项目的整理结果。'
            : '暂时无法读取整理结果，请稍后重试。'
      retryable.value = !(cause instanceof ApiError && [401, 403].includes(cause.status ?? 0))
    } finally {
      if (request === current) {
        request = undefined
        loading.value = false
      }
    }
  }

  watch([projectId, environmentId, routeKey], cancel, { flush: 'sync' })
  onScopeDispose(cancel)
  return { loading, message, retryable, open }
}
