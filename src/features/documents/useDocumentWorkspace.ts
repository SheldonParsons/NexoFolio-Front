import { computed, onScopeDispose, watch } from 'vue'
import { ApiError } from '@/api'
import { projectRefreshLoading } from '@/app/projectRefreshLoading'
import { documentRequests } from './documentRequests'
import { useDocumentProject } from './useDocumentProject'
import { useDocumentSelection } from './useDocumentSelection'
import { useDocumentCuration } from './useDocumentCuration'

/** Page facade: composes controllers and coordinates project/environment changes. */
export function useDocumentWorkspace(
  projectId: () => string,
  onUnauthorized: () => void,
  onForbidden?: () => void,
) {
  const requests = documentRequests(projectId)
  function report(cause: unknown, target: { value: string }) {
    if (cause instanceof ApiError && cause.status === 401) return onUnauthorized()
    if (cause instanceof ApiError && cause.status === 403 && onForbidden) return onForbidden()
    target.value = cause instanceof Error ? cause.message : '暂时无法读取，请重试。'
  }
  const project = useDocumentProject(projectId, requests, report)
  const selection = useDocumentSelection(
    projectId,
    () => project.environmentId.value,
    requests,
    report,
    onForbidden,
  )
  const curation = useDocumentCuration(projectId, requests, report, {
    canStart: () =>
      !project.loading.value && !!project.project.value && !!project.projectEndpointCount.value,
    selectedId: () => selection.selectedId.value,
    setIndex: (index) => {
      project.index.value = index
    },
    refreshDetail: (id) => selection.selectInterface(id, true),
  })
  const selectedCard = computed(
    () =>
      project.index.value?.entries.find(
        (entry) => entry.interface_id === selection.selectedId.value,
      ) ?? null,
  )
  async function loadProject() {
    selection.deselectInterface()
    const running = await project.loadProject()
    if (running) void curation.viewProgress(running)
  }
  function selectEnvironment(id: string) {
    if (id === project.environmentId.value || !project.environments.value.some((e) => e.id === id))
      return
    selection.deselectInterface()
    project.environmentId.value = id
    project.query.value = ''
  }
  watch(
    projectId,
    () => {
      requests.cancelAll()
      selection.deselectInterface()
      curation.reset()
      project.reset()
      void projectRefreshLoading.task(loadProject)
    },
    { immediate: true },
  )
  onScopeDispose(() => {
    requests.cancelAll()
    selection.deselectInterface()
  })
  const { index: _index, reset: _resetProject, ...projectState } = project
  const { reset: _resetCuration, viewProgress: _viewProgress, ...curationState } = curation
  // Preserve the page-facing contract; callers do not know the internal controllers.
  return {
    ...projectState,
    documentIndex: project.index,
    ...selection,
    ...curationState,
    observeCuration: curation.viewProgress,
    selectedCard,
    loadProject,
    selectEnvironment,
  }
}
