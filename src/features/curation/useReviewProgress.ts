import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import { ApiError } from '@/api'
import type { CurateProgress } from '@/contracts/knowledge/types'
import * as knowledge from '@/contracts/knowledge/source'
import { temporaryCurationReadFailure } from '@/features/documents/curationConnection'

/** Current-page observation reads progress only; mutations require explicit button actions. */
export function useReviewProgress(projectId: () => string, unauthorized: () => void) {
  const progress = shallowRef<CurateProgress | null>(null),
    error = ref(''),
    noticeCandidateId = ref(''),
    requestedRunKey = ref(''),
    watching = ref(false),
    pending = ref(false)
  let request: AbortController | undefined
  let disposed = false
  const blocked = ref(false)
  function report(cause: unknown) {
    blocked.value = true
    if (cause instanceof ApiError && cause.status === 401) unauthorized()
    else error.value = cause instanceof Error ? cause.message : '暂时无法读取本轮进度'
  }
  function delay(signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason)
        return
      }
      const cancel = () => {
        clearTimeout(timer)
        reject(signal.reason)
      }
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', cancel)
        resolve()
      }, 2000)
      signal.addEventListener('abort', cancel, { once: true })
    })
  }
  async function observe(initial: CurateProgress) {
    const previous = progress.value
    if (
      watching.value &&
      previous &&
      previous.candidate_id === initial.candidate_id &&
      previous.run_id === initial.run_id
    )
      return
    request?.abort()
    const pid = projectId(),
      current = new AbortController()
    request = current
    progress.value = initial
    watching.value = true
    blocked.value = false
    error.value = ''
    noticeCandidateId.value = initial.candidate_id ?? ''
    const owns = () =>
      !disposed && request === current && !current.signal.aborted && projectId() === pid
    try {
      while (owns()) {
        try {
          const job = await knowledge.curateProgress(pid, current.signal)
          if (!owns()) return
          progress.value = job
          noticeCandidateId.value = job.candidate_id ?? ''
          error.value = ''
          if (job.status !== 'running') break
        } catch (cause) {
          if (!owns()) return
          if (!temporaryCurationReadFailure(cause)) throw cause
          error.value = '暂时无法读取最新进度，正在重新连接后台任务'
        }
        await delay(current.signal)
      }
    } catch (cause) {
      if (owns()) report(cause)
    } finally {
      if (request === current) watching.value = false
    }
  }
  async function action(kind: 'resume' | 'cancel', id: string) {
    if (pending.value || !id) return
    const pid = projectId(),
      current = new AbortController()
    request?.abort()
    request = current
    watching.value = false
    pending.value = true
    blocked.value = false
    error.value = ''
    noticeCandidateId.value = id
    try {
      if (kind === 'resume') {
        const job = await knowledge.resumeCandidate(pid, id, current.signal)
        if (disposed || request !== current || current.signal.aborted || projectId() !== pid) return
        requestedRunKey.value = job.run_id ?? job.candidate_id ?? ''
        pending.value = false
        void observe(job)
      } else {
        await knowledge.cancelCandidate(pid, id, current.signal)
        if (disposed || request !== current || current.signal.aborted || projectId() !== pid) return
        const job = await knowledge.curateProgress(pid, current.signal)
        if (request === current && !current.signal.aborted) progress.value = job
      }
    } catch (cause) {
      if (!disposed && request === current && !current.signal.aborted) report(cause)
    } finally {
      pending.value = false
    }
  }
  onScopeDispose(() => {
    disposed = true
    request?.abort()
  })
  const busy = computed(
    () => pending.value || (watching.value && progress.value?.status === 'running'),
  )
  return {
    progress,
    error,
    busy,
    blocked,
    noticeCandidateId,
    requestedRunKey,
    observe,
    resume: (id: string) => action('resume', id),
    cancel: (id: string) => action('cancel', id),
  }
}
