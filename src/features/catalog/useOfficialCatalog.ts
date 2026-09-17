import { projectRefreshLoading } from '@/app/projectRefreshLoading'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { ApiError } from '@/api/client'
import { previewError } from '@/features/catalog-preview/model'
import type { CatalogState, CatalogSource, CatalogInterfacePage } from './types'

export function useOfficialCatalog(
  projectId: () => string,
  source: CatalogSource,
  unauthorized: () => void,
) {
  const state = shallowRef<CatalogState | null>(null)
  const list = shallowRef<CatalogInterfacePage | null>(null)
  const directoryId = ref('')
  const selectedId = ref('')
  const busy = ref(false)
  const listBusy = ref(false)
  const error = ref('')
  const listError = ref('')
  const selected = computed(
    () => list.value?.items.find((item) => item.id === selectedId.value) ?? null,
  )
  let currentRequest: AbortController | undefined
  let listRequest: AbortController | undefined
  let disposed = false
  function message(cause: unknown) {
    if (cause instanceof ApiError && cause.status === 401) unauthorized()
    if (cause instanceof ApiError && cause.status === 409)
      return '接口目录已切换，请刷新后继续查看。'
    return previewError(cause)
  }
  async function loadInterfaces(number = 1, background = false) {
    const current = state.value
    if (!current || !directoryId.value) return
    listRequest?.abort()
    const controller = new AbortController()
    listRequest = controller
    const owner = projectId()
    const dir = directoryId.value
    const active = () =>
      !disposed &&
      !controller.signal.aborted &&
      listRequest === controller &&
      owner === projectId() &&
      current.generation === state.value?.generation &&
      dir === directoryId.value
    if (!background) {
      list.value = null
      selectedId.value = ''
    }
    listBusy.value = true
    listError.value = ''
    try {
      let result = await source.interfaces(
        owner,
        dir,
        number,
        current.generation,
        controller.signal,
      )
      if (!active()) return
      if (!result.items.length && number > 1)
        result = await source.interfaces(
          owner,
          dir,
          Math.max(1, Math.ceil(result.total / result.limit)),
          current.generation,
          controller.signal,
        )
      if (!active()) return
      list.value = result
      if (!result.items.some((item) => item.id === selectedId.value)) selectedId.value = ''
    } catch (cause) {
      if (active()) {
        listError.value = message(cause)
        if (cause instanceof ApiError && cause.status === 409) {
          list.value = null
          selectedId.value = ''
        }
      }
    } finally {
      if (active()) listBusy.value = false
    }
  }
  function applyState(value: CatalogState) {
    if (value.projectId !== projectId()) return
    if (state.value && value.generation < state.value.generation) return
    if (value.generation !== state.value?.generation) {
      listRequest?.abort()
      listBusy.value = false
      list.value = null
      selectedId.value = ''
    }
    state.value = value
    if (!value.nodes.some((node) => node.id === directoryId.value))
      directoryId.value = value.unclassifiedId
  }
  async function refresh(background = false) {
    if (background && (busy.value || listBusy.value)) return
    currentRequest?.abort()
    const controller = new AbortController()
    currentRequest = controller
    const owner = projectId()
    const active = () =>
      !disposed &&
      !controller.signal.aborted &&
      currentRequest === controller &&
      owner === projectId()
    busy.value = true
    error.value = ''
    try {
      const result = await source.current(owner, controller.signal)
      if (!active()) return
      applyState(result)
      await loadInterfaces(list.value?.page ?? 1, background)
    } catch (cause) {
      if (active()) error.value = message(cause)
    } finally {
      if (active()) busy.value = false
    }
  }
  function selectDirectory(id: string) {
    if (!state.value?.nodes.some((node) => node.id === id)) return
    directoryId.value = id
    void loadInterfaces()
  }
  async function updated(value: CatalogState) {
    applyState(value)
    await loadInterfaces()
  }
  watch(
    projectId,
    () => {
      currentRequest?.abort()
      listRequest?.abort()
      state.value = null
      list.value = null
      directoryId.value = ''
      selectedId.value = ''
      listBusy.value = false
      error.value = ''
      listError.value = ''
      void projectRefreshLoading.task(() => refresh())
    },
    { immediate: true },
  )
  onScopeDispose(() => {
    disposed = true
    currentRequest?.abort()
    listRequest?.abort()
  })
  return {
    state,
    list,
    directoryId,
    selectedId,
    selected,
    busy,
    listBusy,
    error,
    listError,
    refresh,
    loadInterfaces,
    selectDirectory,
    updated,
  }
}
