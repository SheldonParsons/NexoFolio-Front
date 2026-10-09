import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import { ApiError } from '@/api'
import { candidateOperations } from './source'
import type { CandidateOperation } from './types'
export function useCandidateOperations(
  project: () => string,
  candidate: () => string,
  isOpen: () => boolean,
  unauthorized: () => void,
) {
  const events = shallowRef<CandidateOperation[]>([]),
    loading = ref(false),
    error = ref(''),
    namesUnavailable = ref(false)
  let request: AbortController | undefined
  function cancel() {
    request?.abort()
    request = undefined
    loading.value = false
  }
  async function load() {
    cancel()
    if (!isOpen() || !project() || !candidate()) return
    const pid = project(),
      id = candidate(),
      current = new AbortController()
    request = current
    loading.value = true
    error.value = ''
    const owns = () =>
      request === current &&
      !current.signal.aborted &&
      isOpen() &&
      project() === pid &&
      candidate() === id
    try {
      const result = await candidateOperations(pid, id, current.signal)
      if (owns()) {
        events.value = result.events
        namesUnavailable.value = result.names_unavailable
      }
    } catch (cause) {
      if (!owns()) return
      if (cause instanceof ApiError && cause.status === 401) unauthorized()
      else
        error.value =
          cause instanceof ApiError && cause.status === 403
            ? '没有权限查看本轮操作记录。'
            : '暂时无法读取操作记录，请重试。'
    } finally {
      if (request === current) loading.value = false
    }
  }
  watch([project, candidate], () => {
    cancel()
    events.value = []
    error.value = ''
    namesUnavailable.value = false
  })
  watch(
    [isOpen, project, candidate],
    () => {
      if (isOpen()) void load()
      else cancel()
    },
    { immediate: true },
  )
  onScopeDispose(cancel)
  return { events, loading, error, namesUnavailable, load }
}
