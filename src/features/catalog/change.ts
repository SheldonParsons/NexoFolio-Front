import { onScopeDispose, ref, shallowRef } from 'vue'
import { ApiError } from '@/api/client'

export type CatalogIntent =
  | { kind: 'publish'; task_id: string }
  | { kind: 'restore'; version_id: string | null }
export type CatalogAttempt = CatalogIntent & { request_id: string; expected_generation: number }
export interface CatalogReceipt {
  request_id: string
  generation: number
  version_id?: string | null
  replayed: boolean
}
export interface ChangeAdapter<State> {
  read(signal: AbortSignal): Promise<State>
  generation(state: State): number
  send(attempt: CatalogAttempt, signal: AbortSignal): Promise<CatalogReceipt>
}
export interface AttemptStore {
  read(): CatalogAttempt | null
  save(attempt: CatalogAttempt): void
  clear(): void
}

/** Explicit prepare/confirm/retry only. No watcher, timer or refresh is allowed to send writes. */
export function useCatalogChange<State>(
  adapter: ChangeAdapter<State>,
  store: AttemptStore,
  onState: (state: State) => void,
  onUnauthorized: () => void,
) {
  const phase = ref<
    | 'idle'
    | 'loading'
    | 'confirm'
    | 'sending'
    | 'uncertain'
    | 'conflict'
    | 'error'
    | 'success'
    | 'refresh-error'
  >('idle')
  const error = ref('')
  const attempt = shallowRef<CatalogAttempt | null>(null)
  const receipt = shallowRef<CatalogReceipt | null>(null)
  const targetIntent = shallowRef<CatalogIntent | null>(null)
  let intent: CatalogIntent | null = null
  let generation: number | null = null
  let request: AbortController | undefined
  let disposed = false
  function begin() {
    request?.abort()
    request = new AbortController()
    const own = request
    return {
      signal: own.signal,
      current: () => !disposed && request === own && !own.signal.aborted,
    }
  }
  function message(value: unknown) {
    if (value instanceof ApiError && value.status === 401) onUnauthorized()
    if (value instanceof ApiError && value.status === 403) return '没有此项目的操作权限。'
    if (value instanceof ApiError && value.status === 404)
      return '项目、候选或历史版本已不存在，请重新选择。'
    return value instanceof Error ? value.message : '操作暂时无法完成。'
  }
  async function prepare(nextIntent: CatalogIntent) {
    if (phase.value === 'sending') return
    const saved = store.read()
    if (saved) {
      request?.abort()
      attempt.value = saved
      intent =
        saved.kind === 'publish'
          ? { kind: 'publish', task_id: saved.task_id }
          : { kind: 'restore', version_id: saved.version_id }
      targetIntent.value = intent
      phase.value = 'uncertain'
      error.value = '存在尚未确认结果的目录操作。请先核对下方目标，再用原请求查询处理结果。'
      return
    }
    intent = nextIntent
    targetIntent.value = intent
    attempt.value = null
    receipt.value = null
    error.value = ''
    generation = null
    const ticket = begin()
    phase.value = 'loading'
    try {
      const current = await adapter.read(ticket.signal)
      if (!ticket.current()) return
      generation = adapter.generation(current)
      onState(current)
      phase.value = 'confirm'
    } catch (value) {
      if (ticket.current()) {
        error.value = message(value)
        phase.value = 'error'
      }
    }
  }
  async function refreshAfterSuccess() {
    if (!receipt.value) return
    const ticket = begin()
    phase.value = 'loading'
    try {
      const current = await adapter.read(ticket.signal)
      if (!ticket.current()) return
      onState(current)
      error.value = ''
      phase.value = 'success'
    } catch (value) {
      if (ticket.current()) {
        error.value = `操作已成功，但目录刷新失败。${message(value)}`
        phase.value = 'refresh-error'
      }
    }
  }
  async function send() {
    if (!attempt.value || phase.value === 'sending') return
    const value = attempt.value
    const ticket = begin()
    phase.value = 'sending'
    error.value = ''
    try {
      // Persist before the POST so a reload can reuse exactly the same idempotency key/body.
      store.save(value)
      const result = await adapter.send(value, ticket.signal)
      if (!ticket.current()) return
      receipt.value = result
      store.clear()
      await refreshAfterSuccess()
    } catch (value) {
      if (!ticket.current()) return
      error.value = message(value)
      if (value instanceof ApiError && value.status === 409) {
        store.clear()
        attempt.value = null
        generation = null
        phase.value = 'conflict'
        error.value =
          '目录已发生变化，或请求与当前状态冲突。请刷新当前目录后重新确认，系统不会自动覆盖。'
      } else if (
        value instanceof ApiError &&
        value.status &&
        [400, 401, 403, 404, 422].includes(value.status)
      ) {
        store.clear()
        attempt.value = null
        generation = null
        phase.value = 'error'
      } else {
        phase.value = 'uncertain'
        error.value = `结果尚未确认。${error.value} 重试会沿用原请求，不会创建第二次操作。`
      }
    }
  }
  async function confirm() {
    if (phase.value !== 'confirm' || generation === null || !intent) return
    attempt.value = { ...intent, expected_generation: generation, request_id: crypto.randomUUID() }
    await send()
  }
  async function retry() {
    if (phase.value === 'uncertain' && attempt.value) await send()
  }
  async function refreshForConfirmation() {
    if (intent && phase.value !== 'sending' && phase.value !== 'uncertain') await prepare(intent)
  }
  onScopeDispose(() => {
    disposed = true
    request?.abort()
  })
  return {
    phase,
    error,
    attempt,
    receipt,
    targetIntent,
    prepare,
    confirm,
    retry,
    refreshForConfirmation,
    refreshAfterSuccess,
  }
}
