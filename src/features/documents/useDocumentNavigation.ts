import { computed, ref, watch } from 'vue'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import type { useDocumentWorkspace } from './useDocumentWorkspace'
import { documentLocation, documentTarget } from './documentRoutes'
import { documentTree, findFolder, folderPath } from './documentTree'
export function useDocumentNavigation(
  workspace: ReturnType<typeof useDocumentWorkspace>,
  route: RouteLocationNormalizedLoaded,
  router: Router,
) {
  const target = computed(() => documentTarget(route))
  const environmentError = computed(() => {
    const env = route.query.env
    return env != null &&
      (typeof env !== 'string' || !workspace.environments.value.some((e) => e.id === env)) &&
      !workspace.loading.value
      ? '链接中的环境已失效或不属于此项目，请选择可用环境。'
      : ''
  })
  const tree = computed(() =>
    documentTree(
      workspace.documentIndex.value,
      workspace.environmentId.value,
      workspace.query.value,
      target.value,
    ),
  )
  const overviewTree = computed(() =>
    documentTree(workspace.documentIndex.value, workspace.environmentId.value),
  )
  const folder = computed(() =>
    target.value?.kind === 'folder' ? findFolder(overviewTree.value, target.value.id) : undefined,
  )
  const folderError = computed(() =>
    target.value?.kind === 'folder' &&
    !workspace.loading.value &&
    !workspace.error.value &&
    !folder.value
      ? '此目录已失效或不存在；请通过目录列表重新选择。'
      : '',
  )
  const path = computed(() =>
    folderPath(
      workspace.documentIndex.value?.catalog.folders ?? [],
      target.value?.kind === 'folder'
        ? target.value.id
        : (workspace.selectedCard.value?.folderId ?? null),
    ),
  )
  function location(value = target.value) {
    return documentLocation(String(route.params.projectId), value, workspace.environmentId.value)
  }
  function selectInterface(id: string) {
    void router.push(location({ kind: 'endpoint', id }))
  }
  function deselect() {
    void router.push(location(null))
  }
  function selectEnvironment(env: string) {
    void router.push({ path: route.path, query: { ...route.query, env } })
  }
  const activeTab = computed({
    get: () => (route.query.tab === 'examples' ? 'examples' : 'fields'),
    set: (tab: string) => {
      workspace.activeTab.value = tab
      void router.replace({
        path: route.path,
        query: { ...route.query, tab: tab === 'examples' ? tab : undefined },
      })
    },
  })
  watch(
    [() => route.fullPath, workspace.loading, workspace.documentIndex],
    () => {
      if (workspace.loading.value || workspace.error.value) return
      if (environmentError.value) {
        workspace.deselectInterface()
        return
      }
      const env =
        typeof route.query.env === 'string'
          ? route.query.env
          : (workspace.environments.value[0]?.id ?? '')
      if (env !== workspace.environmentId.value) workspace.selectEnvironment(env)
      if (target.value?.kind === 'endpoint') void workspace.selectInterface(target.value.id)
      else workspace.deselectInterface()
      workspace.activeTab.value = activeTab.value
    },
    { immediate: true },
  )
  // The backend resolves only established aliases. Canonicalize explicitly, never by name.
  const aliasNotice = ref('')
  let aliasTarget = ''
  watch(
    () => target.value?.id,
    (id) => {
      if (id !== aliasTarget) aliasNotice.value = ''
    },
  )
  watch(workspace.detail, (detail) => {
    if (
      detail &&
      target.value?.kind === 'endpoint' &&
      detail.facts.summary.id !== target.value.id
    ) {
      aliasTarget = detail.facts.summary.id
      aliasNotice.value = '此接口已合并，已打开其稳定资源地址。'
      void router.replace({
        ...documentLocation(String(route.params.projectId), {
          kind: 'endpoint',
          id: detail.facts.summary.id,
        }),
        query: route.query,
      })
    }
  })
  return {
    target,
    tree,
    folder,
    path,
    folderError,
    environmentError,
    aliasNotice,
    location,
    selectInterface,
    deselect,
    selectEnvironment,
    activeTab,
  }
}
