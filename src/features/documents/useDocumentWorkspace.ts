import { projectRefreshLoading } from '@/app/projectRefreshLoading'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { ApiError } from '@/api/client'
import { projectSource } from '@/features/projects/source'
import type { Project } from '@/features/projects/types'
import { getDocumentSource } from './source'
import {
  DOCUMENT_PAGE_SIZE,
  type InterfaceCard,
  type InterfaceDetail,
  type InterfacePage,
  type ObservationDetail,
  type ObservationPage,
  type ProjectEnvironment,
} from './types'

type Channel = 'project' | 'environments' | 'list' | 'definition' | 'observations' | 'sample'
const documentChannels: Channel[] = ['list', 'definition', 'observations', 'sample']
function message(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403) return '暂无此项目的访问权限，请联系项目负责人。'
    if (error.status === 503) return '服务或项目权限信息暂不可用，请稍后重新读取。'
    if (error.status === 404) return '未找到当前项目、环境或接口对应的记录，请返回列表重新选择。'
  }
  return error instanceof Error ? error.message : '暂时无法读取，请稍后再试。'
}

export function useDocumentWorkspace(projectId: () => string, onUnauthorized: () => void) {
  const project = shallowRef<Project | null>(null)
  const projectLoading = ref(false)
  const projectError = ref('')
  const environments = shallowRef<ProjectEnvironment[]>([])
  const environmentId = ref('')
  const environmentLoading = ref(false)
  const environmentError = ref('')
  const environmentPage = ref(0)
  const environmentTotal = ref(0)
  const draftQuery = ref('')
  const queryError = ref('')
  const queryPending = ref(false)
  const list = shallowRef<InterfacePage | null>(null)
  const listLoading = ref(false)
  const listError = ref('')
  const selectedId = ref('')
  const definition = shallowRef<InterfaceDetail | null>(null)
  const definitionLoading = ref(false)
  const definitionError = ref('')
  const activeTab = ref<'definition' | 'observations'>('definition')
  const observations = shallowRef<ObservationPage | null>(null)
  const observationsLoading = ref(false)
  const observationsError = ref('')
  const selectedObservationId = ref('')
  const observation = shallowRef<ObservationDetail | null>(null)
  const observationLoading = ref(false)
  const observationError = ref('')
  const observationTab = ref<'raw' | 'difference'>('raw')
  let search = ''
  let composing = false
  let debounce: ReturnType<typeof setTimeout> | undefined
  let scope = 0
  let disposed = false
  const requests = new Map<Channel, AbortController>()
  const currentEnvironment = computed(() =>
    environments.value.find((item) => item.id === environmentId.value),
  )
  const listBusy = computed(() => listLoading.value || queryPending.value)
  const listPages = computed(() =>
    Math.max(1, Math.ceil((list.value?.total ?? 0) / DOCUMENT_PAGE_SIZE)),
  )
  const observationPages = computed(() =>
    Math.max(1, Math.ceil((observations.value?.total ?? 0) / DOCUMENT_PAGE_SIZE)),
  )

  function cancel(channels: Channel[]) {
    for (const channel of channels) {
      requests.get(channel)?.abort()
      requests.delete(channel)
    }
  }
  function begin(channel: Channel) {
    cancel([channel])
    const controller = new AbortController()
    const owner = scope
    requests.set(channel, controller)
    return {
      signal: controller.signal,
      current: () =>
        !disposed &&
        scope === owner &&
        requests.get(channel) === controller &&
        !controller.signal.aborted,
    }
  }
  function report(error: unknown, target: { value: string }) {
    if (error instanceof ApiError && error.status === 401) {
      onUnauthorized()
      return
    }
    target.value = message(error)
  }
  function closeObservation() {
    cancel(['sample'])
    selectedObservationId.value = ''
    observation.value = null
    observationError.value = ''
    observationLoading.value = false
    observationTab.value = 'raw'
  }
  function deselectInterface() {
    cancel(['definition', 'observations'])
    selectedId.value = ''
    definition.value = null
    definitionError.value = ''
    definitionLoading.value = false
    observations.value = null
    observationsError.value = ''
    observationsLoading.value = false
    activeTab.value = 'definition'
    closeObservation()
  }
  async function loadEnvironments(page = 1) {
    if (!project.value || environmentLoading.value) return
    const ticket = begin('environments')
    const ownerId = projectId()
    environmentLoading.value = true
    environmentError.value = ''
    try {
      const result = await (await getDocumentSource()).environments(ownerId, page, ticket.signal)
      if (!ticket.current()) return
      if (result.items.length === 0 && (page - 1) * result.limit < result.total)
        throw new ApiError('环境分页响应不完整，请重新读取。', 'invalid-response')
      const previous = page === 1 ? [] : environments.value
      environments.value = [
        ...new Map([...previous, ...result.items].map((item) => [item.id, item])).values(),
      ]
      environmentPage.value = page
      environmentTotal.value = result.total
    } catch (error) {
      if (ticket.current()) report(error, environmentError)
    } finally {
      if (ticket.current()) environmentLoading.value = false
    }
  }
  async function loadProject() {
    ++scope
    cancel(['project', 'environments', ...documentChannels])
    clearTimeout(debounce)
    deselectInterface()
    project.value = null
    projectError.value = ''
    environments.value = []
    environmentId.value = ''
    environmentPage.value = 0
    environmentTotal.value = 0
    environmentError.value = ''
    environmentLoading.value = false
    list.value = null
    listError.value = ''
    listLoading.value = false
    draftQuery.value = ''
    search = ''
    queryError.value = ''
    queryPending.value = false
    composing = false
    const ticket = begin('project')
    projectLoading.value = true
    try {
      const value = await projectSource.get(projectId(), ticket.signal)
      if (!ticket.current()) return
      if (!value.can_access || value.access_state !== 'allowed')
        throw new ApiError('项目暂不可访问。', 'http', value.access_state === 'denied' ? 403 : 503)
      project.value = value
      await loadEnvironments()
    } catch (error) {
      if (ticket.current()) report(error, projectError)
    } finally {
      if (ticket.current()) projectLoading.value = false
    }
  }
  async function loadList(page = 1) {
    if (!environmentId.value || !project.value) return
    clearTimeout(debounce)
    queryPending.value = false
    deselectInterface()
    const ticket = begin('list')
    const pid = projectId(),
      env = environmentId.value
    listLoading.value = true
    listError.value = ''
    try {
      const value = await (
        await getDocumentSource()
      ).interfaces(pid, env, page, search, ticket.signal)
      if (!ticket.current()) return
      const last = Math.max(1, Math.ceil(value.total / DOCUMENT_PAGE_SIZE))
      if (page > last) {
        await loadList(last)
        return
      }
      list.value = value
    } catch (error) {
      if (ticket.current()) report(error, listError)
    } finally {
      if (ticket.current()) listLoading.value = false
    }
  }
  function selectEnvironment(id: string) {
    if (environmentId.value === id || !environments.value.some((item) => item.id === id)) return
    cancel(documentChannels)
    clearTimeout(debounce)
    deselectInterface()
    environmentId.value = id
    draftQuery.value = ''
    search = ''
    queryError.value = ''
    queryPending.value = false
    composing = false
    list.value = null
    listLoading.value = false
    listError.value = ''
    void loadList()
  }
  function invalidateQuery() {
    clearTimeout(debounce)
    cancel(['list'])
    deselectInterface()
    listLoading.value = false
    listError.value = ''
    queryPending.value = true
  }
  function submitQuery() {
    if (composing || !environmentId.value) return
    clearTimeout(debounce)
    if (new TextEncoder().encode(draftQuery.value.trim()).length > 500) {
      queryError.value = '搜索内容过长，最多支持 500 字节。'
      queryPending.value = false
      return
    }
    search = draftQuery.value.trim()
    queryError.value = ''
    void loadList()
  }
  function changeQuery(value: string) {
    draftQuery.value = value
    queryError.value = ''
    invalidateQuery()
    if (!composing) debounce = setTimeout(submitQuery, 250)
  }
  function clearQuery() {
    composing = false
    changeQuery('')
    submitQuery()
  }
  function compositionStart() {
    composing = true
    invalidateQuery()
  }
  function compositionEnd(value: string) {
    composing = false
    changeQuery(value)
  }
  async function selectInterface(item: InterfaceCard) {
    if (listBusy.value || queryError.value || item.environment_id !== environmentId.value) return
    if (selectedId.value === item.interface_id && (definition.value || definitionLoading.value))
      return
    deselectInterface()
    selectedId.value = item.interface_id
    await loadDefinition()
  }
  async function loadDefinition() {
    if (!selectedId.value || !environmentId.value) return
    cancel(['observations'])
    closeObservation()
    observations.value = null
    observationsError.value = ''
    observationsLoading.value = false
    definition.value = null
    definitionError.value = ''
    definitionLoading.value = true
    activeTab.value = 'definition'
    const ticket = begin('definition')
    const pid = projectId(),
      env = environmentId.value,
      iid = selectedId.value
    try {
      const value = await (await getDocumentSource()).definition(pid, env, iid, ticket.signal)
      if (ticket.current()) definition.value = value
    } catch (error) {
      if (ticket.current()) report(error, definitionError)
    } finally {
      if (ticket.current()) definitionLoading.value = false
    }
  }
  async function loadObservations(page = 1) {
    if (!definition.value) return
    closeObservation()
    const ticket = begin('observations')
    const pid = projectId(),
      env = environmentId.value,
      iid = selectedId.value
    observationsLoading.value = true
    observationsError.value = ''
    try {
      const value = await (
        await getDocumentSource()
      ).observations(pid, env, iid, page, ticket.signal)
      if (!ticket.current()) return
      const last = Math.max(1, Math.ceil(value.total / DOCUMENT_PAGE_SIZE))
      if (page > last) {
        await loadObservations(last)
        return
      }
      observations.value = value
    } catch (error) {
      if (ticket.current()) report(error, observationsError)
    } finally {
      if (ticket.current()) observationsLoading.value = false
    }
  }
  function setTab(value: unknown) {
    if (value !== 'definition' && value !== 'observations') return
    activeTab.value = value
    if (value === 'observations' && !observations.value && !observationsLoading.value)
      void loadObservations()
  }
  async function selectObservation(id: string, showDifference = false) {
    if (!definition.value) return
    if (selectedObservationId.value === id && observationLoading.value) return
    closeObservation()
    selectedObservationId.value = id
    observationTab.value = showDifference ? 'difference' : 'raw'
    observationLoading.value = true
    const ticket = begin('sample')
    const pid = projectId(),
      env = environmentId.value,
      iid = selectedId.value
    try {
      const value = await (await getDocumentSource()).observation(pid, env, iid, id, ticket.signal)
      if (ticket.current()) observation.value = value
    } catch (error) {
      if (ticket.current()) report(error, observationError)
    } finally {
      if (ticket.current()) observationLoading.value = false
    }
  }
  function readOrigin() {
    const id = definition.value?.origin_ingestion_id
    if (!id) return
    setTab('observations')
    void selectObservation(id)
  }
  function refreshObservation() {
    const id = selectedObservationId.value
    if (id) void selectObservation(id, observationTab.value === 'difference')
  }
  watch(
    projectId,
    () => {
      void projectRefreshLoading.task(() => loadProject())
    },
    { immediate: true },
  )
  onScopeDispose(() => {
    disposed = true
    ++scope
    clearTimeout(debounce)
    cancel(['project', 'environments', ...documentChannels])
    definition.value = null
    observation.value = null
  })
  return {
    project,
    projectLoading,
    projectError,
    environments,
    environmentId,
    currentEnvironment,
    environmentLoading,
    environmentError,
    environmentPage,
    environmentTotal,
    draftQuery,
    queryError,
    list,
    listBusy,
    listError,
    listPages,
    selectedId,
    definition,
    definitionLoading,
    definitionError,
    activeTab,
    observations,
    observationsLoading,
    observationsError,
    observationPages,
    selectedObservationId,
    observation,
    observationLoading,
    observationError,
    observationTab,
    loadProject,
    loadEnvironments,
    selectEnvironment,
    loadList,
    changeQuery,
    submitQuery,
    clearQuery,
    compositionStart,
    compositionEnd,
    selectInterface,
    deselectInterface,
    loadDefinition,
    setTab,
    loadObservations,
    selectObservation,
    closeObservation,
    readOrigin,
    refreshObservation,
  }
}
