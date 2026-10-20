import { computed, ref, shallowRef } from 'vue'
import { ApiError } from '@/api'
import * as knowledge from '@/contracts/knowledge/source'
import type { EndpointDetail } from '@/contracts/knowledge/types'
import { useDocumentSamples } from './useDocumentSamples'
import { publicEndpoint } from './public/source'
import type { DocumentRequests, DocumentErrorReporter } from './documentRequests'

/** Selection, field/example tabs and sample reads. */
export function useDocumentSelection(
  projectId: () => string,
  environmentId: () => string,
  requests: DocumentRequests,
  report: DocumentErrorReporter,
  onForbidden?: () => void,
  readOnly = false,
) {
  const selectedId = ref('')
  const detail = shallowRef<EndpointDetail | null>(null)
  const detailLoading = ref(false),
    detailError = ref(''),
    activeTab = ref('fields')
  const samples = useDocumentSamples(
    projectId,
    () => selectedId.value,
    environmentId,
    report,
    readOnly,
  )
  const examples = computed(() =>
    (detail.value?.facts.examples ?? []).filter((e) => e.environment_id === environmentId()),
  )
  function deselectInterface() {
    requests.cancel('detail')
    selectedId.value = ''
    detail.value = null
    detailError.value = ''
    detailLoading.value = false
    activeTab.value = 'fields'
    samples.resetSamples()
  }
  async function selectInterface(id: string, refresh = false) {
    if (!refresh && selectedId.value === id && (detail.value || detailLoading.value)) return
    if (!refresh) {
      deselectInterface()
      selectedId.value = id
    } else requests.cancel('detail')
    const request = requests.begin('detail')
    detailLoading.value = true
    detailError.value = ''
    try {
      const value = readOnly
        ? await publicEndpoint(projectId(), id, environmentId(), request.signal)
        : await knowledge.endpoint(projectId(), id, request.signal)
      if (request.current()) detail.value = value
    } catch (cause) {
      if (request.current()) {
        if (cause instanceof ApiError && cause.status === 404)
          detailError.value = '此接口已失效或不存在；不会替换为其他同名接口。'
        else if (cause instanceof ApiError && cause.status === 403) {
          detailError.value = '暂无此接口的访问权限。'
          onForbidden?.()
        } else if (cause instanceof ApiError && cause.status === 400)
          detailError.value = '链接中的接口 ID 无效。'
        else report(cause, detailError)
      }
    } finally {
      if (request.current()) detailLoading.value = false
    }
  }
  return {
    selectedId,
    detail,
    detailLoading,
    detailError,
    activeTab,
    examples,
    ...samples,
    selectInterface,
    deselectInterface,
  }
}
