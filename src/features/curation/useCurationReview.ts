import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { ApiError } from '@/api'
import { projectSource } from '@/features/projects/source'
import type { Project } from '@/features/projects/types'
import type { DocumentIndex } from '@/features/documents/source'
import * as source from './source'
import type { Candidate, CandidateSummary } from './types'
import { candidateChanges } from './changes'
import { canReviewDecision, type ReviewDecision } from './reviewActions'

export function useCurationReview(
  projectId: () => string,
  candidateId: () => string,
  onUnauthorized: () => void,
) {
  const project = shallowRef<Project | null>(null)
  const index = shallowRef<DocumentIndex | null>(null)
  const list = shallowRef<CandidateSummary[]>([])
  const candidate = shallowRef<Candidate | null>(null)
  const loading = ref(false),
    deciding = ref(false),
    error = ref(''),
    projectError = ref(''),
    indexLoading = ref(false),
    indexError = ref('')
  let request: AbortController | undefined
  let poll: ReturnType<typeof setTimeout> | undefined
  const paths = computed(() => new Map(index.value?.entries.map((e) => [e.interface_id, e.path])))
  const changes = computed(() =>
    candidate.value ? candidateChanges(candidate.value, paths.value) : [],
  )
  function report(cause: unknown) {
    if (cause instanceof ApiError && cause.status === 401) return onUnauthorized()
    error.value = cause instanceof Error ? cause.message : '暂时无法读取整理结果，请重试'
  }
  async function refresh(signal?: AbortSignal) {
    if (signal?.aborted) return
    const pid = projectId(),
      id = candidateId()
    const current = () => !signal?.aborted && projectId() === pid && candidateId() === id
    const rows = await source.candidates(pid, signal)
    if (!current()) return
    list.value = rows
    if (id) {
      const latest = rows.find((c) => c.id === id)
      if (
        !candidate.value ||
        candidate.value.id !== id ||
        candidate.value.updated_at !== latest?.updated_at
      ) {
        const value = await source.candidate(pid, id, signal)
        if (current()) candidate.value = value
      }
    }
  }
  function schedule(signal: AbortSignal) {
    clearTimeout(poll)
    if (signal.aborted || loading.value || (candidateId() && !candidate.value)) return
    if (candidate.value?.state !== 'running' && !list.value.some((c) => c.state === 'running'))
      return
    const pid = projectId(),
      id = candidateId()
    poll = setTimeout(async () => {
      if (signal.aborted || projectId() !== pid || candidateId() !== id) return
      try {
        await refresh(signal)
      } catch (cause) {
        if (!signal.aborted) report(cause)
      }
      if (!signal.aborted) schedule(signal)
    }, 2500)
  }
  async function load() {
    request?.abort()
    clearTimeout(poll)
    const current = new AbortController()
    request = current
    const pid = projectId(),
      id = candidateId()
    const owns = () =>
      request === current && !current.signal.aborted && projectId() === pid && candidateId() === id
    loading.value = true
    error.value = ''
    projectError.value = ''
    indexError.value = ''
    candidate.value = null
    list.value = []
    index.value = null
    indexLoading.value = !!id
    if (project.value?.project_id !== pid) project.value = null
    // Supplemental reads publish independently and never gate the result list/detail.
    void projectSource
      .get(pid, current.signal)
      .then((value) => {
        if (owns()) project.value = value
      })
      .catch((cause) => {
        if (!owns()) return
        if (cause instanceof ApiError && cause.status === 401) onUnauthorized()
        else projectError.value = '项目名称暂时无法读取，整理结果仍可查看。'
      })
    if (id) {
      void source
        .factsIndex(pid, current.signal)
        .then((value) => {
          if (owns()) index.value = value
        })
        .catch((cause) => {
          if (!owns()) return
          if (cause instanceof ApiError && cause.status === 401) onUnauthorized()
          else indexError.value = '暂时无法读取接口索引，请重新读取整理结果。'
        })
        .finally(() => {
          if (owns()) indexLoading.value = false
        })
      void source
        .candidates(pid, current.signal)
        .then((rows) => {
          if (owns()) {
            list.value = rows
            schedule(current.signal)
          }
        })
        .catch((cause) => {
          if (owns()) report(cause)
        })
    }
    try {
      if (id) {
        const value = await source.candidate(pid, id, current.signal)
        if (owns()) candidate.value = value
      } else {
        const rows = await source.candidates(pid, current.signal)
        if (owns()) list.value = rows
      }
    } catch (cause) {
      if (owns()) report(cause)
    } finally {
      if (owns()) {
        loading.value = false
        schedule(current.signal)
      }
    }
  }
  async function decide(action: ReviewDecision, expectedId?: string): Promise<boolean> {
    const value = candidate.value
    if (!value || deciding.value || (expectedId && value.id !== expectedId)) return false
    if (!canReviewDecision(value.state, action)) return false
    deciding.value = true
    error.value = ''
    const pid = projectId(),
      id = value.id,
      signal = request?.signal
    const current = () => !signal?.aborted && projectId() === pid && candidateId() === id
    const accepted = action === 'apply' ? 'applied' : 'discarded'
    try {
      await (action === 'apply' ? source.applyCandidate : source.discardCandidate)(pid, id, signal)
      if (!current()) return false
      await refresh(signal)
      return current() && candidate.value?.state === accepted
    } catch (cause) {
      if (current()) {
        // A timed out write is uncertain. Reconcile its saved decision, never replay POST.
        try {
          const saved = await source.candidate(pid, id, signal)
          if (!current()) return false
          candidate.value = saved
          if (saved.state === accepted) {
            // The decision is proven saved even if its history refresh is unavailable.
            try {
              await refresh(signal)
            } catch {
              /* Retain the verified decision. */
            }
            return true
          }
        } catch {
          /* Preserve the original actionable error. */
        }
        report(cause)
      }
      return false
    } finally {
      deciding.value = false
    }
  }
  watch([projectId, candidateId], () => void load(), { immediate: true })
  onScopeDispose(() => {
    request?.abort()
    clearTimeout(poll)
  })
  return {
    project,
    index,
    list,
    candidate,
    changes,
    loading,
    deciding,
    error,
    projectError,
    indexLoading,
    indexError,
    load,
    decide,
  }
}
