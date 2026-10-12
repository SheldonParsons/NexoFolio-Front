import {
  computed,
  inject,
  onScopeDispose,
  provide,
  ref,
  shallowRef,
  watch,
  type InjectionKey,
} from 'vue'
import { api, ApiError } from '@/api'
import { changeCuration } from '@/contracts/knowledge/curationReads'
import type { DocumentIndex } from '../source'
import { emptyLifecycle, retirement, type DocumentLifecycle, type LifecycleTarget } from './model'
export function provideLifecycle(
  project: () => string,
  index: () => DocumentIndex | null,
  writable: boolean,
  update?: (state: DocumentLifecycle) => void,
  onDenied?: () => void,
) {
  const allowed = ref(writable)
  const state = shallowRef(emptyLifecycle()),
    showRetired = ref(false),
    panelOpen = ref(false),
    editing = shallowRef<{
      target: LifecycleTarget
      name: string
      retired: boolean
      version: number
    } | null>(null),
    busy = ref(false),
    error = ref('')
  let epoch = 0
  watch(
    project,
    () => {
      epoch++
      allowed.value = writable
      state.value = emptyLifecycle()
      editing.value = null
      error.value = ''
      showRetired.value = false
      panelOpen.value = false
    },
    { immediate: true },
  )
  watch(
    () => index()?.lifecycle,
    (value) => {
      if (value) state.value = value
    },
    { immediate: true },
  )
  function handleDenied(cause: unknown, current: number): boolean {
    if (
      current !== epoch ||
      !(cause instanceof ApiError) ||
      ![401, 403].includes(cause.status ?? 0)
    )
      return false
    allowed.value = false
    editing.value = null
    onDenied?.()
    return true
  }
  async function save(reason: string) {
    if (!allowed.value || !editing.value || busy.value) return
    const target = editing.value.target,
      version = editing.value.version,
      retired = editing.value.retired,
      pid = project(),
      current = epoch
    busy.value = true
    error.value = ''
    try {
      const value = await changeCuration(pid, () =>
        api.request<DocumentLifecycle>(
          `v1/projects/${encodeURIComponent(pid)}/document-lifecycle`,
          { method: 'POST', json: { target, reason, retired, expected_version: version } },
        ),
      )
      if (current !== epoch || project() !== pid) return
      state.value = value
      editing.value = null
      update?.(value)
    } catch (cause) {
      if (handleDenied(cause, current)) return
      if (current === epoch)
        error.value = cause instanceof Error ? cause.message : '保存失败，请重试。'
      // A concurrent decision is never overwritten: refresh the authoritative version.
      try {
        const value = await api.request<DocumentLifecycle>(
          `v1/projects/${encodeURIComponent(pid)}/document-lifecycle`,
        )
        if (current === epoch) {
          state.value = value
          update?.(value)
        }
      } catch (refreshCause) {
        handleDenied(refreshCause, current)
        // Other read failures retain the original write error.
      }
    } finally {
      busy.value = false
    }
  }
  const context = {
    state,
    showRetired,
    panelOpen,
    editing,
    busy,
    error,
    get writable() {
      return allowed.value
    },
    count: computed(() => state.value.decisions.filter((d) => d.retired).length),
    pending: computed(() => state.value.version !== state.value.reconciled_version),
    get: (target: LifecycleTarget) => retirement(state.value, target),
    edit: (target: LifecycleTarget, name: string) => {
      error.value = ''
      editing.value = {
        target,
        name,
        retired: !retirement(state.value, target),
        version: state.value.version,
      }
    },
    save,
  }
  provide(key, context)
  onScopeDispose(() => {
    epoch++
  })
  return context
}
type Context = ReturnType<typeof provideLifecycle>
const key: InjectionKey<Context> = Symbol('document-lifecycle')
export const useLifecycle = () => inject(key, null)
