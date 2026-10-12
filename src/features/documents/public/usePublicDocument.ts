import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import { documentTarget, documentLocation } from '../documentRoutes'
import { documentTree, findFolder, folderPath } from '../documentTree'
import {
  publicIndex,
  publicEndpoint,
  type PublicDocumentIndex,
  type PublicEndpoint,
} from './source'

export function usePublicDocument(
  route: RouteLocationNormalizedLoaded,
  router: Router,
  showRetired: () => boolean = () => false,
) {
  const index = shallowRef<PublicDocumentIndex | null>(null)
  const detail = shallowRef<PublicEndpoint | null>(null)
  const loading = ref(false),
    detailLoading = ref(false),
    error = ref(''),
    detailError = ref(''),
    query = ref('')
  let indexRequest: AbortController | undefined, detailRequest: AbortController | undefined
  const projectId = computed(() => String(route.params.projectId))
  const target = computed(() => documentTarget(route))
  const environments = computed(() => index.value?.project.environments ?? [])
  const environmentId = computed(() =>
    typeof route.query.env === 'string' ? route.query.env : (environments.value[0]?.id ?? ''),
  )
  const environmentError = computed(() =>
    !loading.value &&
    route.query.env != null &&
    (typeof route.query.env !== 'string' ||
      !environments.value.some((e) => e.id === route.query.env))
      ? '链接中的环境已失效或不属于此项目，请选择可用环境。'
      : '',
  )
  const tree = computed(() =>
    documentTree(
      index.value,
      environmentId.value || null,
      query.value,
      target.value,
      showRetired(),
    ),
  )
  const overview = computed(() =>
    documentTree(index.value, environmentId.value || null, '', null, true),
  )
  const folder = computed(() =>
    target.value?.kind === 'folder' ? findFolder(overview.value, target.value.id) : undefined,
  )
  const selected = computed(() =>
    index.value?.entries.find(
      (e) => e.interface_id === (detail.value?.endpoint_id || target.value?.id),
    ),
  )
  const path = computed(() =>
    folderPath(
      index.value?.catalog.folders ?? [],
      target.value?.kind === 'folder' ? target.value.id : (selected.value?.folderId ?? null),
    ),
  )
  async function loadIndex() {
    indexRequest?.abort()
    detailRequest?.abort()
    const request = new AbortController()
    indexRequest = request
    index.value = null
    detail.value = null
    error.value = ''
    detailError.value = ''
    loading.value = true
    query.value = ''
    try {
      const value = await publicIndex(projectId.value, request.signal)
      if (!request.signal.aborted) index.value = value
    } catch (cause) {
      if (!request.signal.aborted)
        error.value = cause instanceof Error ? cause.message : '暂时无法读取文档。'
    } finally {
      if (indexRequest === request) loading.value = false
    }
  }
  async function loadDetail() {
    detailRequest?.abort()
    detail.value = null
    detailError.value = ''
    detailLoading.value = false
    if (!index.value || environmentError.value || target.value?.kind !== 'endpoint') return
    const request = new AbortController()
    detailRequest = request
    detailLoading.value = true
    const endpoint = target.value.id
    try {
      const value = await publicEndpoint(
        projectId.value,
        endpoint,
        environmentId.value,
        request.signal,
      )
      if (request.signal.aborted) return
      detail.value = value
      if (value.endpoint_id !== endpoint)
        void router.replace({
          ...documentLocation(projectId.value, { kind: 'endpoint', id: value.endpoint_id }),
          query: route.query,
          hash: route.hash,
        })
    } catch (cause) {
      if (!request.signal.aborted)
        detailError.value = cause instanceof Error ? cause.message : '暂时无法读取接口。'
    } finally {
      if (detailRequest === request) detailLoading.value = false
    }
  }
  function selectEnvironment(env: string) {
    void router.push({ path: route.path, query: { ...route.query, env } })
  }
  watch(projectId, loadIndex, { immediate: true, flush: 'sync' })
  watch([index, () => target.value?.kind, () => target.value?.id, environmentId], loadDetail, {
    immediate: true,
  })
  onScopeDispose(() => {
    indexRequest?.abort()
    detailRequest?.abort()
  })
  return {
    projectId,
    index,
    detail,
    loading,
    detailLoading,
    error,
    detailError,
    query,
    target,
    environments,
    environmentId,
    environmentError,
    tree,
    folder,
    path,
    loadIndex,
    loadDetail,
    selectEnvironment,
  }
}
