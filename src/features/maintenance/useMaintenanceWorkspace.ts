import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import { ApiError } from '@/api/client'
import type { MaintenanceCandidate, SemanticDocument, TaskProgress } from './models'
import type { MaintenanceReads } from './ports'

export function useMaintenanceWorkspace(
  projectId: () => string,
  port: MaintenanceReads,
  unauthorized: () => void,
) {
  const task = shallowRef<TaskProgress | null>(null)
  const candidate = shallowRef<MaintenanceCandidate | null>(null)
  const semantics = shallowRef<SemanticDocument | null>(null)
  const busy = ref({ task: false, candidate: false, semantics: false })
  const errors = ref({ task: '', candidate: '', semantics: '' })
  type Channel = keyof typeof busy.value
  const requests = new Map<Channel, AbortController>()
  let disposed = false
  function cancel() {
    requests.forEach((request) => request.abort())
    requests.clear()
    task.value = null
    candidate.value = null
    semantics.value = null
    busy.value = { task: false, candidate: false, semantics: false }
    errors.value = { task: '', candidate: '', semantics: '' }
  }
  async function read<T>(
    channel: Channel,
    loader: (owner: string, signal: AbortSignal) => Promise<T>,
    valid: (value: T, owner: string) => boolean,
    commit: (value: T) => void,
  ) {
    requests.get(channel)?.abort()
    const request = new AbortController()
    requests.set(channel, request)
    const owner = projectId()
    const current = () =>
      !disposed &&
      !request.signal.aborted &&
      requests.get(channel) === request &&
      owner === projectId()
    busy.value[channel] = true
    errors.value[channel] = ''
    try {
      const value = await loader(owner, request.signal)
      if (!current()) return
      if (!valid(value, owner))
        throw new ApiError('维护资料与当前项目或目标不匹配。', 'invalid-response')
      commit(value)
    } catch (cause) {
      if (!current()) return
      errors.value[channel] = cause instanceof Error ? cause.message : '维护资料读取失败。'
      if (cause instanceof ApiError && cause.status === 401) unauthorized()
    } finally {
      if (current()) busy.value[channel] = false
    }
  }
  function loadTask(id: string) {
    task.value = null
    // A candidate from another task must not survive task selection.
    requests.get('candidate')?.abort()
    candidate.value = null
    busy.value.candidate = false
    errors.value.candidate = ''
    return read(
      'task',
      (owner, signal) => port.task(owner, id, signal),
      (value, owner) => value.projectId === owner && value.id === id,
      (value) => {
        task.value = value
      },
    )
  }
  function loadCandidate(id: string, taskId: string) {
    candidate.value = null
    return read(
      'candidate',
      (owner, signal) => port.candidate(owner, id, signal),
      (value, owner) => value.projectId === owner && value.id === id && value.taskId === taskId,
      (value) => {
        candidate.value = value
      },
    )
  }
  function loadSemantics(interfaceId: string, environmentId: string) {
    semantics.value = null
    return read(
      'semantics',
      (owner, signal) => port.semantics(owner, interfaceId, environmentId, signal),
      (value, owner) =>
        value.projectId === owner &&
        value.interfaceId === interfaceId &&
        value.environmentId === environmentId,
      (value) => {
        semantics.value = value
      },
    )
  }
  watch(projectId, cancel)
  onScopeDispose(() => {
    disposed = true
    cancel()
  })
  return {
    task,
    candidate,
    semantics,
    busy,
    errors,
    loadTask,
    loadCandidate,
    loadSemantics,
    clear: cancel,
  }
}
