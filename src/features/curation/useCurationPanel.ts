import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { pageVisible, useVisiblePolling } from './observation'
import { onCurationChanged } from '@/contracts/knowledge/curationReads'
import { ApiError } from '@/api'
import type { CurateProgress } from '@/contracts/knowledge/types'
import type { CandidateSummary } from './types'
import * as source from './source'
import { panelOptions, panelProgress, panelRank, preferredPanelRow } from './panelSelection'

/** Display selection is local to this page and never starts, resumes or cancels a worker. */
export function useCurationPanel(
  projectId: () => string,
  pageKey: () => string,
  live: () => CurateProgress | null,
  liveBusy: () => boolean,
  unauthorized: () => void,
  requestedRunKey: () => string = () => '',
) {
  const preferred = shallowRef<CandidateSummary | null>(null)
  const manual = shallowRef<CandidateSummary | null>(null)
  const rows = shallowRef<CandidateSummary[]>([])
  const error = ref(''),
    listError = ref(''),
    listLoading = ref(false)
  const accessDenied = ref(false)
  let read: AbortController | undefined, listRead: AbortController | undefined
  let disposed = false
  const selected = computed(() => manual.value ?? preferred.value)
  const options = computed(() => panelOptions(rows.value, preferred.value, selected.value))
  const progress = computed(() => {
    const job = live(),
      chosen = selected.value
    if ((liveBusy() || job?.task_id) && !manual.value) return job
    if (!chosen) return null
    if (
      chosen.id === job?.candidate_id &&
      ['running', 'waiting', 'needs_attention'].includes(job?.task_state ?? chosen.state)
    )
      return job
    return panelProgress(chosen)
  })
  const busy = computed(() => (!manual.value && liveBusy()) || progress.value?.status === 'running')
  const historicalOnly = computed(
    () => !liveBusy() && (!preferred.value || panelRank(preferred.value.state) >= 2),
  )
  const projectRunning = computed(
    () =>
      liveBusy() ||
      (preferred.value?.state === 'running' &&
        !(live()?.candidate_id === preferred.value.id && live()?.status !== 'running')),
  )
  function report(cause: unknown, target: typeof error) {
    if (cause instanceof ApiError && [401, 403].includes(cause.status ?? 0))
      accessDenied.value = true
    if (cause instanceof ApiError && cause.status === 401) unauthorized()
    else
      target.value =
        cause instanceof ApiError && cause.status === 403
          ? '没有权限查看当前项目的整理记录。'
          : '暂时无法读取整理记录，请重试。'
  }
  const polling = useVisiblePolling(
    () => void refresh(),
    () => (projectRunning.value ? 5000 : 30_000),
    () => !disposed && !accessDenied.value,
  )
  const unlisten = onCurationChanged((pid) => {
    if (pid === projectId()) void refresh()
  })
  async function refresh() {
    polling.clear()
    if (!pageVisible() || disposed) return
    read?.abort()
    const pid = projectId(),
      page = pageKey(),
      pinned = manual.value?.id ?? ''
    if (!pid) return
    const current = new AbortController()
    read = current
    const owns = () =>
      !disposed &&
      read === current &&
      !current.signal.aborted &&
      projectId() === pid &&
      pageKey() === page &&
      (manual.value?.id ?? '') === pinned
    try {
      const values = await source.panelCandidates(pid, current.signal, pinned)
      if (!owns()) return
      // The first row is the authoritative default; the second may be a pinned lower-priority row.
      preferred.value = preferredPanelRow(values, pid)
      if (pinned)
        manual.value = values.find((row) => row.project_id === pid && row.id === pinned) ?? null
      error.value = ''
      accessDenied.value = false
    } catch (cause) {
      if (owns()) report(cause, error)
    } finally {
      if (read === current && !disposed && !current.signal.aborted) polling.schedule()
    }
  }
  async function loadOptions() {
    listRead?.abort()
    const current = new AbortController(),
      pid = projectId(),
      page = pageKey()
    listRead = current
    listLoading.value = true
    listError.value = ''
    const owns = () =>
      !disposed &&
      listRead === current &&
      !current.signal.aborted &&
      projectId() === pid &&
      pageKey() === page
    try {
      const values = await source.candidates(pid, current.signal)
      if (owns()) rows.value = values.filter((row) => row.project_id === pid)
    } catch (cause) {
      if (owns()) report(cause, listError)
    } finally {
      if (listRead === current) listLoading.value = false
    }
  }
  function select(id: string) {
    const row = options.value.find((item) => item.id === id && item.project_id === projectId())
    if (!row) return
    manual.value = row
    void refresh()
  }
  function pin(row: CandidateSummary) {
    if (row.project_id !== projectId()) return
    manual.value = row
    void refresh()
  }
  function reset() {
    read?.abort()
    listRead?.abort()
    polling.clear()
    preferred.value = null
    manual.value = null
    rows.value = []
    error.value = ''
    listError.value = ''
    listLoading.value = false
    accessDenied.value = false
    void refresh()
  }
  watch([projectId, pageKey], reset, { immediate: true })
  watch(
    [liveBusy, requestedRunKey, () => live()?.candidate_id],
    ([active, key, id], [wasActive, oldKey, oldId]) => {
      if (key !== oldKey) manual.value = null
      if (active !== wasActive || key !== oldKey || (active && id !== oldId)) void refresh()
    },
  )
  onScopeDispose(() => {
    disposed = true
    unlisten()
    read?.abort()
    listRead?.abort()
    polling.clear()
  })
  return {
    preferred,
    selected,
    progress,
    busy,
    historicalOnly,
    projectRunning,
    accessDenied,
    options,
    error,
    listError,
    listLoading,
    manual,
    refresh,
    loadOptions,
    select,
    pin,
  }
}
