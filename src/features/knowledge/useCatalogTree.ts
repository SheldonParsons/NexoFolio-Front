import { computed, reactive, ref, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'
import * as source from '@/contracts/knowledge/source'
import type { Catalog, EndpointCard, EndpointDetail } from '@/contracts/knowledge/types'
import { UNPLACED, flatten, folderKey, type CatalogRow, type NodeKey } from './catalogTree'

/** One page of endpoints per folder: a folder past this earns sub-folders anyway. */
const PER_FOLDER = 200

export function useCatalogTree(projectId: Ref<string>) {
  const catalog = shallowRef<Catalog | null>(null)
  const catalogLoading = ref(false)
  const catalogError = ref<string>('')

  const loaded = reactive(new Map<NodeKey, EndpointCard[]>())
  const expanded = reactive(new Set<NodeKey>())
  const loadingNodes = reactive(new Set<NodeKey>())

  const selected = ref<string | null>(null)
  const detail = shallowRef<EndpointDetail | null>(null)
  const detailLoading = ref(false)
  const detailError = ref<string>('')

  /** Endpoint id while its describe pass runs, so only that row shows progress. */
  const describing = ref<string | null>(null)
  const organizing = ref(false)
  const notice = ref<string>('')

  let catalogRequest: AbortController | undefined
  let detailRequest: AbortController | undefined

  const rows = computed<CatalogRow[]>(() =>
    catalog.value
      ? flatten({
          catalog: catalog.value,
          loaded: loaded as Map<NodeKey, EndpointCard[]>,
          expanded: expanded as Set<NodeKey>,
          loading: loadingNodes as Set<NodeKey>,
        })
      : [],
  )

  const total = computed(() => {
    const value = catalog.value
    if (!value) return 0
    return value.unplaced + value.folders.reduce((sum, f) => sum + f.endpoints, 0)
  })

  const selectedCard = computed<EndpointCard | null>(() => {
    if (!selected.value) return null
    for (const cards of loaded.values()) {
      const hit = cards.find((card) => card.interface_id === selected.value)
      if (hit) return hit
    }
    return null
  })

  async function loadCatalog() {
    catalogRequest?.abort()
    const request = new AbortController()
    catalogRequest = request
    catalogLoading.value = true
    catalogError.value = ''
    try {
      const data = await source.catalog(projectId.value, request.signal)
      if (request.signal.aborted) return
      catalog.value = data
      // Nothing placed yet means the tree is only 待分类, so open it: an empty
      // page with one closed node reads as a failure.
      if (!data.folders.length && data.unplaced > 0) await expand(UNPLACED)
    } catch (error) {
      if (request.signal.aborted) return
      catalogError.value = message(error)
    } finally {
      if (!request.signal.aborted) catalogLoading.value = false
    }
  }

  async function fetchEndpoints(key: NodeKey, folderId: string | null) {
    loadingNodes.add(key)
    try {
      const page = folderId
        ? await source.interfaces(projectId.value, folderId, 1, PER_FOLDER)
        : await source.unclassified(projectId.value, 1, PER_FOLDER)
      loaded.set(key, page.items)
    } catch (error) {
      expanded.delete(key)
      notice.value = message(error)
    } finally {
      loadingNodes.delete(key)
    }
  }

  async function expand(key: NodeKey) {
    expanded.add(key)
    if (!loaded.has(key)) {
      await fetchEndpoints(key, key === UNPLACED ? null : key)
    }
  }

  function toggle(key: NodeKey) {
    if (expanded.has(key)) expanded.delete(key)
    else void expand(key)
  }

  async function select(endpointId: string) {
    selected.value = endpointId
    detailRequest?.abort()
    const request = new AbortController()
    detailRequest = request
    detailLoading.value = true
    detailError.value = ''
    detail.value = null
    try {
      const data = await source.endpoint(projectId.value, endpointId, request.signal)
      if (request.signal.aborted) return
      detail.value = data
    } catch (error) {
      if (request.signal.aborted) return
      detailError.value = message(error)
    } finally {
      if (!request.signal.aborted) detailLoading.value = false
    }
  }

  function close() {
    selected.value = null
    detail.value = null
    detailError.value = ''
  }

  /** Refreshes only the rows the write could have touched, so the tree does not flash. */
  async function refreshLoadedFolders() {
    const keys = [...loaded.keys()]
    await Promise.all(keys.map((key) => fetchEndpoints(key, key === UNPLACED ? null : key)))
  }

  async function describe(endpointId: string) {
    if (describing.value || organizing.value) return
    describing.value = endpointId
    notice.value = ''
    try {
      const result = await source.describeEndpoint(projectId.value, endpointId)
      notice.value = result.status === 'ok' ? '已写入接口说明' : '模型没有给出可用的说明'
      await refreshLoadedFolders()
      if (selected.value === endpointId) await select(endpointId)
    } catch (error) {
      notice.value = message(error)
    } finally {
      describing.value = null
    }
  }

  async function organize() {
    if (organizing.value) return
    organizing.value = true
    notice.value = ''
    try {
      const result = await source.organizeProject(projectId.value)
      notice.value =
        result.status === 'ok'
          ? `已重排目录，写入 ${result.commands ?? 0} 条变更`
          : '没有可整理的接口'
      loaded.clear()
      expanded.clear()
      await loadCatalog()
    } catch (error) {
      notice.value = message(error)
    } finally {
      organizing.value = false
    }
  }

  watch(
    () => projectId.value,
    () => {
      loaded.clear()
      expanded.clear()
      close()
      void loadCatalog()
    },
    { immediate: true },
  )

  return {
    catalog,
    catalogLoading,
    catalogError,
    rows,
    total,
    expanded,
    toggle,
    selected,
    selectedCard,
    detail,
    detailLoading,
    detailError,
    select,
    close,
    describing,
    organizing,
    notice,
    describe,
    organize,
    loadCatalog,
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export { folderKey, UNPLACED }
