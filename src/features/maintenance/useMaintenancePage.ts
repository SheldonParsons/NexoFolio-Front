import { projectRefreshLoading } from '@/app/projectRefreshLoading'
import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import { ApiError } from '@/api/client'
import { maintenanceSource, type MaintenanceSource } from './source'
import type {
  KnowledgeSnapshot,
  MaintenancePage,
  MaintenanceRun,
} from '@/contracts/maintenance/2.0.0/types.generated'
import type { ComparisonBasis } from './mapping'

export function useMaintenancePage(
  projectId: () => string,
  unauthorized: () => void,
  source: MaintenanceSource = maintenanceSource,
  requestedRun?: () => string | undefined,
) {
  const page = shallowRef<MaintenancePage | null>(null)
  const run = shallowRef<MaintenanceRun | null>(null)
  const snapshot = shallowRef<KnowledgeSnapshot | null>(null)
  const comparison = shallowRef<ComparisonBasis | null>(null)
  const selectedId = ref('')
  const busy = ref({ list: false, run: false, snapshot: false, comparison: false })
  const errors = ref({ list: '', run: '', snapshot: '', comparison: '' })
  type Channel = keyof typeof busy.value
  const requests = new Map<Channel, AbortController>()
  let disposed = false
  function begin(channel: Channel) {
    requests.get(channel)?.abort()
    const request = new AbortController()
    requests.set(channel, request)
    const owner = projectId()
    busy.value[channel] = true
    errors.value[channel] = ''
    return {
      owner,
      signal: request.signal,
      current: () =>
        !disposed &&
        !request.signal.aborted &&
        requests.get(channel) === request &&
        owner === projectId(),
    }
  }
  function report(channel: Channel, cause: unknown) {
    errors.value[channel] = cause instanceof Error ? cause.message : '维护资料暂不可用。'
    if (cause instanceof ApiError && cause.status === 401) unauthorized()
  }
  function clearDetail() {
    for (const channel of ['run', 'snapshot', 'comparison'] as const) {
      requests.get(channel)?.abort()
      busy.value[channel] = false
      errors.value[channel] = ''
    }
    run.value = null
    snapshot.value = null
    comparison.value = null
  }
  async function loadRun(id = selectedId.value, background = false) {
    if (!id || (background && busy.value.run)) return
    if (id !== selectedId.value || !background) clearDetail()
    selectedId.value = id
    const ticket = begin('run')
    try {
      const value = await source.run(ticket.owner, id, ticket.signal)
      if (ticket.current() && selectedId.value === id) run.value = value
    } catch (cause) {
      if (ticket.current()) report('run', cause)
    } finally {
      if (ticket.current()) busy.value.run = false
    }
  }
  async function loadList(number = 1, preferred?: string) {
    const ticket = begin('list')
    try {
      let value = await source.list(ticket.owner, number, ticket.signal)
      if (!ticket.current()) return
      if (!value.items.length && number > 1)
        value = await source.list(
          ticket.owner,
          Math.max(1, Math.ceil(value.total / value.limit)),
          ticket.signal,
        )
      if (!ticket.current()) return
      page.value = value
      const id = preferred ?? value.items[0]?.id
      if (id) await loadRun(id)
      else {
        clearDetail()
        selectedId.value = ''
      }
    } catch (cause) {
      if (ticket.current()) report('list', cause)
    } finally {
      if (ticket.current()) busy.value.list = false
    }
  }
  async function loadSnapshot() {
    const target = run.value
    if (!target) return
    const ticket = begin('snapshot')
    try {
      const value = await source.snapshot(
        ticket.owner,
        target.id,
        target.snapshot_id,
        ticket.signal,
      )
      if (ticket.current() && selectedId.value === target.id) snapshot.value = value
    } catch (cause) {
      if (ticket.current()) report('snapshot', cause)
    } finally {
      if (ticket.current()) busy.value.snapshot = false
    }
  }
  async function loadComparison() {
    const target = run.value
    if (!target) return
    const ticket = begin('comparison')
    comparison.value = null
    try {
      if (!snapshot.value) await loadSnapshot()
      if (!ticket.current() || !snapshot.value || selectedId.value !== target.id) return
      const value = await source.currentBasis(ticket.owner, snapshot.value, target, ticket.signal)
      if (ticket.current() && selectedId.value === target.id) comparison.value = value
    } catch (cause) {
      if (ticket.current()) report('comparison', cause)
    } finally {
      if (ticket.current()) busy.value.comparison = false
    }
  }
  watch(
    () => [projectId(), requestedRun?.()],
    () => {
      requests.forEach((request) => request.abort())
      clearDetail()
      selectedId.value = ''
      page.value = null
      void projectRefreshLoading.task(() => loadList(1, requestedRun?.()))
    },
    { immediate: true },
  )
  onScopeDispose(() => {
    disposed = true
    requests.forEach((request) => request.abort())
  })
  return {
    page,
    run,
    snapshot,
    comparison,
    selectedId,
    busy,
    errors,
    loadList,
    loadRun,
    loadSnapshot,
    loadComparison,
  }
}
