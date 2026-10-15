import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { ApiError } from '@/api'
import * as source from './source'
import type { CandidateSummary } from './types'
import { activeCurationTasks } from '@/contracts/knowledge/source'
import type { CurationTaskSummary } from '@/contracts/knowledge/types'
import { canReviewDecision } from './reviewActions'

/** Read-only guidance. Opening a confirmation never starts or reviews a generation. */
export function usePendingCuration(
  isOpen: () => boolean,
  projectId: () => string,
  onUnauthorized: () => void,
  target: () => string | null = () => null,
) {
  const rows = shallowRef<CandidateSummary[]>([])
  const tasks = shallowRef<CurationTaskSummary[]>([])
  const key = () => JSON.stringify([projectId(), target()])
  const currentTask = computed(() => tasks.value.find((task) => task.target === target()))
  const otherActive = computed(() => tasks.value.some((task) => task.target !== target()))
  const resumable = computed(() =>
    awaiting.value.filter(
      (candidate) =>
        ['partial', 'interrupted'].includes(candidate.state) &&
        candidate.progress.resume_available !== false &&
        !tasks.value.some(
          (task) =>
            task.target === candidate.target &&
            !(task.state === 'needs_attention' && task.candidate_id === candidate.id),
        ),
    ),
  )
  const loading = ref(false),
    error = ref(''),
    readFor = ref('')
  let request: AbortController | undefined
  const awaiting = computed(() =>
    rows.value.filter((c) => canReviewDecision(c.state, 'apply') || c.state === 'interrupted'),
  )
  const running = computed(() => rows.value.find((c) => c.state === 'running'))
  const readyToStart = computed(
    () => isOpen() && readFor.value === key() && !loading.value && !error.value,
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
    const scope = key()
    const pid = projectId(),
      current = new AbortController()
    request = current
    rows.value = []
    tasks.value = []
    error.value = ''
    loading.value = true
    const owns = () => request === current && !current.signal.aborted && isOpen() && key() === scope
    try {
      const [values, active] = await Promise.all([
        source.candidates(pid, current.signal),
        activeCurationTasks(pid, current.signal),
      ])
      if (!owns()) return
      rows.value = values
        .filter((c) => c.project_id === pid)
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      tasks.value = active.filter(
        (task) =>
          task.project_id === pid &&
          ['queued', 'running', 'waiting', 'needs_attention'].includes(task.state),
      )
      readFor.value = scope
    } catch (cause) {
      if (!owns()) return
      if (cause instanceof ApiError && cause.status === 401) onUnauthorized()
      else error.value = '暂时无法读取整理结果，请重新读取后再开始。'
    } finally {
      if (request === current) loading.value = false
    }
  }
  watch(
    [isOpen, projectId, target],
    () => {
      if (isOpen()) void load()
      else cancel()
    },
    { immediate: true },
  )
  onScopeDispose(cancel)
  return {
    awaiting,
    running,
    currentTask,
    otherActive,
    resumable,
    loading,
    error,
    readyToStart,
    load,
  }
}
