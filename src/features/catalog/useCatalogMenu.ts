import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import { ApiError } from '@/api/client'
import { projectRefreshLoading } from '@/app/projectRefreshLoading'
import { catalogSource, readCatalogForEnvironment } from './source'
import type { CatalogState, LiveCatalogInterface } from './types'

export interface MenuPage {
  items: LiveCatalogInterface[]
  page: number
  total: number
  busy: boolean
  error: string
}

export function useCatalogMenu(
  projectId: () => string,
  unauthorized: () => void,
  environmentId: () => string = () => '',
) {
  const catalog = shallowRef<CatalogState | null>(null)
  const loading = ref(false)
  const error = ref('')
  const expanded = ref(new Set<string>())
  const pages = ref<Record<string, MenuPage>>({})
  const selectedId = ref('')
  const selectedDirectory = ref('')
  let rootRequest: AbortController | undefined
  const requests = new Map<string, AbortController>()
  let disposed = false

  function message(cause: unknown) {
    if (cause instanceof ApiError) {
      if (cause.status === 401) unauthorized()
      if (cause.status === 403) return '暂无此项目的访问权限。'
      if (cause.status === 409) return '目录已更新，请重新加载目录。'
      if (cause.status === 503) return '目录暂时不可用，请稍后重试。'
    }
    return cause instanceof Error ? cause.message : '加载失败，请重试。'
  }
  async function loadItems(directoryId: string, more = false) {
    const current = catalog.value
    if (!current || pages.value[directoryId]?.busy) return
    const previous = pages.value[directoryId]
    const number = more ? (previous?.page ?? 0) + 1 : 1
    if (more && previous && previous.items.length >= previous.total) return
    requests.get(directoryId)?.abort()
    const request = new AbortController()
    requests.set(directoryId, request)
    const owner = projectId()
    const active = () =>
      !disposed &&
      !request.signal.aborted &&
      requests.get(directoryId) === request &&
      catalog.value === current &&
      owner === projectId()
    pages.value[directoryId] = {
      items: more ? (previous?.items ?? []) : [],
      page: more ? (previous?.page ?? 0) : 0,
      total: previous?.total ?? 0,
      busy: true,
      error: '',
    }
    try {
      const value = await catalogSource.interfaces(
        owner,
        directoryId,
        number,
        current.generation,
        request.signal,
      )
      if (!active()) return
      const items = [...(more ? (previous?.items ?? []) : []), ...value.items]
      pages.value[directoryId] = {
        items: [...new Map(items.map((item) => [item.id, item])).values()],
        page: value.page,
        total: value.total,
        busy: false,
        error: '',
      }
    } catch (cause) {
      if (active()) {
        pages.value[directoryId]!.busy = false
        pages.value[directoryId]!.error = message(cause)
      }
    }
  }
  async function load() {
    rootRequest?.abort()
    requests.forEach((request) => request.abort())
    requests.clear()
    const request = new AbortController()
    rootRequest = request
    const owner = projectId()
    const environment = environmentId()
    catalog.value = null
    pages.value = {}
    expanded.value = new Set()
    selectedId.value = ''
    selectedDirectory.value = ''
    loading.value = true
    error.value = ''
    const active = () =>
      !disposed && !request.signal.aborted && rootRequest === request && owner === projectId()
    try {
      const value = await catalogSource.current(owner, request.signal)
      if (!active()) return
      if (environment) {
        const filtered = await readCatalogForEnvironment(owner, environment, value, request.signal)
        if (!active()) return
        catalog.value = filtered.catalog
        pages.value = Object.fromEntries(
          filtered.catalog.nodes.map((node) => {
            const items = filtered.itemsByDirectory[node.id] ?? []
            return [node.id, { items, page: 1, total: items.length, busy: false, error: '' }]
          }),
        )
        expanded.value = new Set([value.unclassifiedId])
        return
      }
      catalog.value = value
      // Keep the initial collection visible inside the menu, without opening a document.
      expanded.value = new Set([value.unclassifiedId])
      await loadItems(value.unclassifiedId)
    } catch (cause) {
      if (active()) error.value = message(cause)
    } finally {
      if (active()) loading.value = false
    }
  }
  function toggle(id: string) {
    const next = new Set(expanded.value)
    if (next.has(id)) next.delete(id)
    else {
      next.add(id)
      if (!pages.value[id]) void loadItems(id)
    }
    expanded.value = next
  }
  function select(directoryId: string, item: LiveCatalogInterface) {
    selectedDirectory.value = directoryId
    selectedId.value = item.id
  }
  function collapse() {
    expanded.value = new Set()
  }
  watch(
    () => [projectId(), environmentId()],
    () => {
      void projectRefreshLoading.task(load)
    },
    { immediate: true },
  )
  onScopeDispose(() => {
    disposed = true
    rootRequest?.abort()
    requests.forEach((request) => request.abort())
  })
  return {
    catalog,
    loading,
    error,
    pages,
    expanded,
    selectedId,
    selectedDirectory,
    load,
    loadItems,
    toggle,
    select,
    collapse,
  }
}
