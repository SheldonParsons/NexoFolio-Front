import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import { ApiError } from '@/api/client'
import type { RebuildAttemptStore, RebuildPort, RebuildReceipt, RebuildRequest } from './ports'

export function useRebuildRequest(
  projectId: () => string,
  port: RebuildPort,
  store: RebuildAttemptStore,
  accepted: (receipt: RebuildReceipt) => void,
  unauthorized: () => void,
) {
  const busy = ref(false)
  const error = ref('')
  const pending = shallowRef<RebuildRequest | null>(null)
  const receipt = shallowRef<RebuildReceipt | null>(null)
  let controller: AbortController | undefined
  let disposed = false
  function restorePending() {
    controller?.abort()
    busy.value = false
    receipt.value = null
    pending.value = store.read(projectId())
    error.value = pending.value ? '上次重构请求结果尚未确认，请用原请求重试。' : ''
  }
  async function submit(request: RebuildRequest) {
    if (busy.value || request.projectId !== projectId()) return
    const own = new AbortController()
    controller = own
    const current = () =>
      !disposed && !own.signal.aborted && controller === own && request.projectId === projectId()
    busy.value = true
    error.value = ''
    try {
      store.save(request)
      pending.value = request
      const value = await port.start({ ...request }, own.signal)
      if (!current()) return
      if (value.projectId !== request.projectId || !value.taskId)
        throw new ApiError('重构响应与当前项目不匹配，结果尚未确认。', 'invalid-response')
      store.clear(request.projectId)
      pending.value = null
      receipt.value = value
      accepted(value)
    } catch (cause) {
      if (!current()) return
      error.value = cause instanceof Error ? cause.message : '重构请求失败。'
      if (
        cause instanceof ApiError &&
        cause.status &&
        [400, 401, 403, 404, 409, 422].includes(cause.status)
      ) {
        store.clear(request.projectId)
        pending.value = null
        if (cause.status === 401) unauthorized()
        if (cause.status === 409) error.value = '当前状态不允许发起此请求，请刷新任务后再操作。'
      } else error.value = `请求结果尚未确认。${error.value} 不会自动再次发起重构。`
    } finally {
      if (current()) busy.value = false
    }
  }
  async function requestRebuild() {
    if (busy.value) return
    const saved = store.read(projectId())
    if (saved) {
      pending.value = saved
      error.value = '存在未确认的请求，请点击“用原请求重试”。'
      return
    }
    receipt.value = null
    await submit({ projectId: projectId(), requestKey: crypto.randomUUID() })
  }
  async function retry() {
    if (pending.value && !busy.value) await submit(pending.value)
  }
  watch(projectId, restorePending, { immediate: true })
  onScopeDispose(() => {
    disposed = true
    controller?.abort()
  })
  return { busy, error, pending, receipt, requestRebuild, retry }
}
