import { projectRefreshLoading } from '@/app/projectRefreshLoading'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { PreviewTask } from '@/contracts/catalog-preview/1.4.0/types.generated'
import type { PreviewSource, PreviewPage } from './source'
import { ALL, previewError } from './model'

export function useCatalogPreview(
  projectId: () => string,
  source: PreviewSource,
  onUnauthorized: () => void,
  requestedTask?: () => string | undefined,
) {
  const page = shallowRef<PreviewPage | null>(null)
  const task = shallowRef<PreviewTask | null>(null)
  const published = ref(false)
  const selectedTaskId = ref('')
  const defaultItem = shallowRef<PreviewPage['items'][number] | null>(null)
  const selectedDirectory = ref(ALL)
  const selectedInterface = ref('')
  const expanded = ref(new Set<string>())
  const listBusy = ref(false)
  const detailBusy = ref(false)
  const listError = ref('')
  const detailError = ref('')
  const pages = computed(() =>
    Math.max(1, Math.ceil((page.value?.total ?? 0) / (page.value?.limit ?? 20))),
  )
  let listRequest: AbortController | undefined
  let detailRequest: AbortController | undefined
  let disposed = false

  function report(error: unknown, target: typeof listError) {
    target.value = previewError(error)
    if (typeof error === 'object' && error !== null && 'status' in error && error.status === 401)
      onUnauthorized()
  }
  function clearDetail() {
    detailRequest?.abort()
    task.value = null
    published.value = false
    detailBusy.value = false
    detailError.value = ''
    selectedDirectory.value = ALL
    selectedInterface.value = ''
    expanded.value = new Set()
  }
  async function selectTask(id: string) {
    // A manual selection supersedes an in-flight default selection or pagination request.
    listRequest?.abort()
    listBusy.value = false
    clearDetail()
    selectedTaskId.value = id
    if (!id) return
    const controller = new AbortController()
    detailRequest = controller
    const owner = projectId()
    const current = () =>
      !disposed &&
      !controller.signal.aborted &&
      detailRequest === controller &&
      owner === projectId()
    detailBusy.value = true
    try {
      const result = await source.detail(owner, id, controller.signal)
      if (!current()) return
      task.value = result.task
      published.value = result.published
      expanded.value = new Set(
        result.task.candidate?.nodes.filter((node) => !node.parent).map((node) => node.id),
      )
    } catch (error) {
      if (current()) report(error, detailError)
    } finally {
      if (current()) detailBusy.value = false
    }
  }
  async function loadPage(number = 1, chooseDefault = false) {
    listRequest?.abort()
    clearDetail()
    selectedTaskId.value = ''
    defaultItem.value = null
    const controller = new AbortController()
    listRequest = controller
    const owner = projectId()
    const current = () =>
      !disposed && !controller.signal.aborted && listRequest === controller && owner === projectId()
    listBusy.value = true
    listError.value = ''
    try {
      let result = await source.list(owner, number, controller.signal)
      if (!current()) return
      if (
        result.page > 1 &&
        !result.items.length &&
        result.total < (result.page - 1) * result.limit + 1
      ) {
        result = await source.list(
          owner,
          Math.max(1, Math.ceil(result.total / result.limit)),
          controller.signal,
        )
        if (!current()) return
      }
      let preferred: PreviewPage['items'][number] | undefined
      if (chooseDefault && !requestedTask?.()) {
        // A dedicated filtered request finds the newest ready task across all pages.
        const ready = await source.list(owner, 1, controller.signal, { status: 'ready', limit: 1 })
        if (!current()) return
        preferred = ready.items[0]
        defaultItem.value = preferred ?? null
      }
      if (!current()) return
      page.value = result
      listBusy.value = false
      const chosen = preferred ?? result.items[0]
      const requested = chooseDefault ? requestedTask?.() : undefined
      if (requested || chosen) await selectTask(requested ?? chosen!.task_id)
    } catch (error) {
      if (current()) report(error, listError)
    } finally {
      if (current()) listBusy.value = false
    }
  }
  function selectDirectory(id: string) {
    selectedDirectory.value = id
    selectedInterface.value = ''
  }
  function toggleDirectory(id: string) {
    const next = new Set(expanded.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    expanded.value = next
  }
  watch(
    () => [projectId(), requestedTask?.()],
    () => {
      page.value = null
      void projectRefreshLoading.task(() => loadPage(1, true))
    },
    { immediate: true },
  )
  onScopeDispose(() => {
    disposed = true
    listRequest?.abort()
    detailRequest?.abort()
  })
  return {
    page,
    task,
    published,
    selectedTaskId,
    defaultItem,
    selectedDirectory,
    selectedInterface,
    expanded,
    listBusy,
    detailBusy,
    listError,
    detailError,
    pages,
    loadPage,
    selectTask,
    selectDirectory,
    toggleDirectory,
  }
}
