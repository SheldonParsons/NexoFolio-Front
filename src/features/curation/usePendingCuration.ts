import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { ApiError } from '@/api'
import * as source from './source'
import type { CandidateSummary } from './types'
import { canReviewDecision } from './reviewActions'

/** Read-only guidance. Opening a confirmation never starts or reviews a generation. */
export function usePendingCuration(
  isOpen: () => boolean,
  projectId: () => string,
  onUnauthorized: () => void,
) {
  const rows = shallowRef<CandidateSummary[]>([])
  const loading = ref(false),
    error = ref(''),
    readFor = ref('')
  let request: AbortController | undefined
  const awaiting = computed(() =>
    rows.value.filter((c) => canReviewDecision(c.state, 'apply') || c.state === 'interrupted'),
  )
  const running = computed(() => rows.value.find((c) => c.state === 'running'))
  const readyToStart = computed(
    () =>
      isOpen() && readFor.value === projectId() && !loading.value && !error.value && !running.value,
  )
  function cancel() {
    request?.abort()
    request = undefined
    loading.value = false
    readFor.value = ''
  }
  async function load() {
    cancel()
    if (!isOpen() || !projectId()) return
    const pid = projectId(),
      current = new AbortController()
    request = current
    rows.value = []
    error.value = ''
    loading.value = true
    const owns = () =>
      request === current && !current.signal.aborted && isOpen() && projectId() === pid
    try {
      const values = await source.candidates(pid, current.signal)
      if (!owns()) return
      rows.value = values
        .filter((c) => c.project_id === pid)
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      readFor.value = pid
    } catch (cause) {
      if (!owns()) return
      if (cause instanceof ApiError && cause.status === 401) onUnauthorized()
      else error.value = '暂时无法读取整理结果，请重新读取后再开始。'
    } finally {
      if (request === current) loading.value = false
    }
  }
  watch(
    [isOpen, projectId],
    () => {
      if (isOpen()) void load()
      else cancel()
    },
    { immediate: true },
  )
  onScopeDispose(cancel)
  return { awaiting, running, loading, error, readyToStart, load }
}
