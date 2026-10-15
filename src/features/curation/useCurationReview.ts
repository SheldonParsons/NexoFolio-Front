import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { pageVisible, useVisiblePolling, waitForObservation } from './observation'
import { onCurationChanged } from '@/contracts/knowledge/curationReads'
import { api, ApiError } from '@/api'
import type { DocumentLifecycle } from '@/features/documents/lifecycle/model'
import { projectSource } from '@/features/projects/source'
import type { Project } from '@/features/projects/types'
import type { DocumentIndex } from '@/features/documents/source'
import * as source from './source'
import type { Candidate, CandidateSummary } from './types'
import { candidateChanges, type ChangeSection, type KnowledgeChange } from './changes'
import { applyMessage } from './applyProgress'
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
  let disposed = false
  let accessDenied = false
  let refreshVersion = 0
  const paths = computed(() => new Map(index.value?.entries.map((e) => [e.interface_id, e.path])))
  const changes = shallowRef<KnowledgeChange[]>([])
  const decisionStatus = ref('')
  let changeRequest: AbortController | undefined
  let decisionGeneration = 0
  async function loadChanges(section: ChangeSection, offset = 0) {
    changeRequest?.abort()
    const controller = new AbortController()
    changeRequest = controller
    const value = candidate.value
    if (!value || value.version === undefined) return
    const owns = () =>
      !controller.signal.aborted &&
      candidate.value?.id === value.id &&
      candidate.value?.version === value.version &&
      projectId() === value.project_id
    if (!offset) changes.value = []
    try {
      const page = await source.reviewChanges(
        value.project_id,
        value.id,
        value.version,
        section,
        offset,
        controller.signal,
      )
      if (!owns()) return
      const scope = {
        ...value,
        base: { ...value.base, [section]: page.items.flatMap((i) => (i.before ? [i.before] : [])) },
        view: { ...value.view, [section]: page.items.flatMap((i) => (i.after ? [i.after] : [])) },
      } as Candidate
      // The established rule still supplies identities, titles and before/after rendering.
      const rows = candidateChanges(scope, paths.value).filter((c) => c.section === section)
      changes.value = offset ? [...changes.value, ...rows] : rows
    } catch (cause) {
      if (owns()) report(cause)
    }
  }
  function report(cause: unknown) {
    if (cause instanceof ApiError && [401, 403].includes(cause.status ?? 0)) accessDenied = true
    if (cause instanceof ApiError && cause.status === 401) return onUnauthorized()
    error.value = cause instanceof Error ? cause.message : '暂时无法读取整理结果，请重试'
  }
  async function refresh(signal?: AbortSignal, explicit = false) {
    if (signal?.aborted || disposed || (!explicit && !pageVisible())) return
    const version = ++refreshVersion
    const pid = projectId(),
      id = candidateId()
    const current = () =>
      !disposed &&
      version === refreshVersion &&
      !signal?.aborted &&
      projectId() === pid &&
      candidateId() === id
    const [rows, lifecycle] = await Promise.all([
      source.candidates(pid, signal),
      api.request<DocumentLifecycle>(`v1/projects/${encodeURIComponent(pid)}/document-lifecycle`, {
        signal,
        cache: 'no-store',
      }),
    ])
    if (!current()) return
    list.value = rows
    if (index.value) index.value = { ...index.value, lifecycle }
    if (id) {
      const latest = await source.reviewStatus(pid, id, signal)
      if (!current()) return
      if (!latest.history_available)
        throw new Error('历史已精简，仅保留摘要；详情、对比与回滚已到期')
      if (
        !candidate.value ||
        candidate.value.id !== id ||
        candidate.value.version !== latest.version
      ) {
        const value = await source.reviewCandidate(pid, id, signal)
        if (current()) candidate.value = value
      } else candidate.value = { ...candidate.value, ...latest }
    }
    if (current()) error.value = ''
  }
  const polling = useVisiblePolling(
    () => void poll(),
    () =>
      candidate.value?.state === 'running' || list.value.some((c) => c.state === 'running')
        ? 2500
        : 30_000,
    () => !disposed && !accessDenied && !loading.value,
  )
  async function poll() {
    const signal = request?.signal
    if (!signal || signal.aborted) return
    try {
      await refresh(signal)
    } catch (cause) {
      if (!signal.aborted) report(cause)
    } finally {
      if (!signal.aborted) polling.schedule()
    }
  }
  const unlisten = onCurationChanged((pid) => {
    if (pid === projectId() && !deciding.value) {
      polling.clear()
      void poll()
    }
  })
  async function load() {
    request?.abort()
    changeRequest?.abort()
    decisionGeneration++
    deciding.value = false
    decisionStatus.value = ''
    changes.value = []
    refreshVersion++
    accessDenied = false
    polling.clear()
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
    if (!pageVisible()) {
      try {
        await waitForObservation(current.signal)
      } catch {
        return
      }
      if (!owns()) return
    }
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
      void api
        .request<DocumentLifecycle>(`v1/projects/${encodeURIComponent(pid)}/document-lifecycle`, {
          signal: current.signal,
          cache: 'no-store',
        })
        .then((lifecycle) => {
          if (owns())
            index.value = {
              catalog: { project_id: pid, folders: [], unplaced: 0 },
              entries: [],
              lifecycle,
            }
        })
        .catch((cause) => {
          if (owns())
            indexError.value = cause instanceof Error ? cause.message : '暂时无法读取废弃状态'
        })
        .finally(() => {
          if (owns()) indexLoading.value = false
        })
      void source
        .candidates(pid, current.signal)
        .then((rows) => {
          if (owns()) {
            list.value = rows
            polling.schedule()
          }
        })
        .catch((cause) => {
          if (owns()) report(cause)
        })
    }
    try {
      if (id) {
        const value = await source.reviewCandidate(pid, id, current.signal)
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
        polling.schedule()
      }
    }
  }
  async function decide(action: ReviewDecision, expectedId?: string): Promise<boolean> {
    const value = candidate.value
    if (
      !value ||
      deciding.value ||
      (expectedId && value.id !== expectedId) ||
      !canReviewDecision(value.state, action)
    )
      return false
    const generation = ++decisionGeneration,
      pid = projectId(),
      id = value.id,
      signal = request?.signal
    const current = () =>
      generation === decisionGeneration &&
      !disposed &&
      !signal?.aborted &&
      projectId() === pid &&
      candidateId() === id
    const accepted = action === 'apply' ? 'applied' : 'discarded'
    const operation = crypto.randomUUID()
    deciding.value = true
    decisionStatus.value = action === 'apply' ? '等待服务器确认应用阶段…' : '正在保存废弃决定…'
    error.value = ''
    let timer: ReturnType<typeof setTimeout> | undefined
    let observing = true
    const stopObserving = () => {
      observing = false
      if (timer) clearTimeout(timer)
    }
    let saved = false
    let confirmSaved: () => void = () => {}
    const committed = new Promise<void>((resolve) => {
      confirmSaved = resolve
    })
    let lastStage = ''
    const observe = async () => {
      if (!observing || !current() || saved) return
      try {
        if (pageVisible()) {
          const status = await source.applyStatus(pid, id, operation, signal)
          if (!observing || !current() || saved) return
          saved = status.candidate.state === accepted
          lastStage = status.progress?.stage ?? ''
          if (saved) {
            candidate.value = { ...candidate.value!, ...status.candidate }
            confirmSaved()
          }
          decisionStatus.value = saved
            ? '服务器已应用，正在刷新页面…'
            : applyMessage(status.progress)
        }
      } catch {
        /* A progress read cannot determine the transaction outcome. */
      }
      if (observing && current() && !saved) timer = setTimeout(() => void observe(), 600)
    }
    if (action === 'apply') void observe()
    try {
      try {
        const mutation =
          action === 'apply'
            ? source.applyCandidate(pid, id, signal, operation)
            : source.discardCandidate(pid, id, signal)
        await (action === 'apply' ? Promise.race([mutation, committed]) : mutation)
        if (!current()) return false
        saved = true
      } catch (cause) {
        // In-flight observation can outlive its timer; reconciliation owns reads now.
        stopObserving()
        if (!current()) return false
        // A single POST only. After an uncertain response, read persisted state and
        // this exact operation until it settles; never infer success from processed counts.
        const until = Date.now() + 185_000
        do {
          if (!pageVisible() && signal) await waitForObservation(signal)
          if (!current()) return false
          const status = await source.applyStatus(pid, id, operation, signal)
          if (!current()) return false
          saved = status.candidate.state === accepted
          lastStage = status.progress?.stage ?? ''
          if (saved) break
          decisionStatus.value = applyMessage(status.progress)
          if (!['waiting', 'validating', 'writing', 'committing'].includes(lastStage)) break
          await new Promise((resolve) => setTimeout(resolve, 600))
        } while (current() && Date.now() < until)
        if (!saved) {
          report(cause)
          decisionStatus.value =
            lastStage === 'failed'
              ? '服务器未应用此候选'
              : '应用结果尚未确认，请重新读取状态；不会自动重发应用请求。'
          return false
        }
      }
      if (!current()) return false
      candidate.value = { ...candidate.value!, state: accepted }
      decisionStatus.value =
        action === 'apply' ? '服务器已应用，正在刷新页面…' : '决定已保存，正在刷新页面…'
      try {
        await refresh(signal, true)
      } catch {
        if (current()) error.value = '决定已确认保存，页面刷新失败；请重新读取。'
      }
      polling.schedule()
      return current()
    } catch (cause) {
      if (current()) {
        report(cause)
        decisionStatus.value = '应用结果尚未确认，请重新读取状态；不会自动重发应用请求。'
      }
      return false
    } finally {
      stopObserving()
      if (current()) deciding.value = false
    }
  }
  watch([projectId, candidateId], () => void load(), { immediate: true })
  onScopeDispose(() => {
    disposed = true
    unlisten()
    request?.abort()
    changeRequest?.abort()
    decisionGeneration++
    polling.clear()
  })
  return {
    project,
    index,
    list,
    candidate,
    changes,
    loadChanges,
    decisionStatus,
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
