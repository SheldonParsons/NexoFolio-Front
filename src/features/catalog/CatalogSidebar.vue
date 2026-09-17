<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import { liveDocumentSource } from '@/features/documents/source'
import type { ProjectEnvironment } from '@/features/documents/types'
import { ApiError } from '@/api/client'
import CatalogMenuBranch from './CatalogMenuBranch.vue'
import type { LiveCatalogInterface, MenuBranch } from './types'
import { catalogRows } from './directoryRows'
import { useCatalogMenu } from './useCatalogMenu'
import type { ReportSelection } from '@/features/documents/interfaceReport'
import './catalog-menu.css'
const props = defineProps<{ projectId: string }>()
const emit = defineEmits<{
  unauthorized: []
  select: [selection: ReportSelection]
  clear: []
}>()
const environmentId = ref('')
const environments = ref<ProjectEnvironment[]>([])
const environmentsLoading = ref(false)
const environmentError = ref('')
let environmentRequest: AbortController | undefined
const environmentOptions = computed(() => [
  { value: '__all__', label: '全部环境' },
  ...environments.value.map((environment) => ({ value: environment.id, label: environment.name })),
])
const menu = useCatalogMenu(
  () => props.projectId,
  () => emit('unauthorized'),
  () => environmentId.value,
)
const { catalog, loading, error, pages, expanded, selectedId } = menu
const query = ref('')
const input = ref<HTMLInputElement | null>(null)
const tree = computed(() => {
  if (!catalog.value) return []
  const nodes = catalog.value.nodes
  const invalid = catalogRows(nodes, catalog.value.unclassifiedId).invalid
  const branches = new Map(
    nodes.map((directory) => [directory.id, { directory, children: [] } as MenuBranch]),
  )
  const roots: MenuBranch[] = []
  for (const directory of nodes) {
    const branch = branches.get(directory.id)!
    const parent =
      !invalid && !directory.system && directory.parent ? branches.get(directory.parent) : undefined
    if (parent && parent !== branch) parent.children.push(branch)
    else roots.push(branch)
  }
  return roots.sort((a, b) => Number(b.directory.system) - Number(a.directory.system))
})
const filterIds = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase()
  if (!needle) return null
  const nodes = catalog.value?.nodes ?? []
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const ids = new Set<string>()
  for (const node of nodes) {
    if (!node.name.toLocaleLowerCase().includes(needle)) continue
    let current: typeof node | undefined = node
    const seen = new Set<string>()
    while (current && !seen.has(current.id)) {
      seen.add(current.id)
      ids.add(current.id)
      current = current.parent ? byId.get(current.parent) : undefined
    }
  }
  return ids
})
const visibleRoots = computed(() =>
  tree.value.filter((branch) => !filterIds.value || filterIds.value.has(branch.directory.id)),
)
function clearSearch() {
  query.value = ''
  input.value?.focus()
}
function selectInterface(directoryId: string, item: LiveCatalogInterface) {
  menu.select(directoryId, item)
  if (catalog.value) emit('select', { item, directoryId, environmentId: environmentId.value, catalog: catalog.value })
}
function selectEnvironment(value: string) {
  emit('clear')
  query.value = ''
  environmentId.value = value === '__all__' ? '' : value
}
async function loadEnvironments() {
  environmentRequest?.abort()
  const request = new AbortController()
  environmentRequest = request
  environmentsLoading.value = true
  environmentError.value = ''
  const owner = props.projectId
  const active = () =>
    !request.signal.aborted && environmentRequest === request && props.projectId === owner
  try {
    const items = new Map<string, ProjectEnvironment>()
    let page = 1
    while (true) {
      const value = await liveDocumentSource.environments(owner, page, request.signal)
      if (!active()) return
      if (!value.items.length && (page - 1) * value.limit < value.total)
        throw new Error('环境列表不完整，请重新读取。')
      for (const environment of value.items) items.set(environment.id, environment)
      if (page * value.limit >= value.total) break
      page++
    }
    environments.value = [...items.values()]
  } catch (cause) {
    if (!active()) return
    environmentError.value = '环境加载失败，请重试。'
    if (cause instanceof ApiError && cause.status === 401) emit('unauthorized')
  } finally {
    if (active()) environmentsLoading.value = false
  }
}
watch(
  () => props.projectId,
  () => {
    environmentId.value = ''
    environments.value = []
    void loadEnvironments()
  },
  { immediate: true },
)
onScopeDispose(() => environmentRequest?.abort())
</script>
<template>
  <aside class="doc-menu" aria-label="接口目录菜单">
    <div class="doc-menu-environment">
      <AppSelect
        :model-value="environmentId || '__all__'"
        :options="environmentOptions"
        label="切换目录环境"
        :disabled="environmentsLoading"
        @update:model-value="selectEnvironment"
      />
      <p v-if="environmentError" role="alert">
        {{ environmentError }} <button type="button" @click="loadEnvironments">重试</button>
      </p>
    </div>
    <div class="doc-menu-search">
      <AppIcon name="search" :size="16" /><input
        ref="input"
        v-model="query"
        type="search"
        placeholder="查找目录"
        aria-label="查找目录"
        autocomplete="off"
        @keydown.esc="clearSearch"
      /><button
        v-if="query"
        type="button"
        aria-label="清除查找"
        @mousedown.prevent
        @click="clearSearch"
      >
        <AppIcon name="x" :size="14" />
      </button>
    </div>
    <nav class="doc-menu-scroll" aria-label="目录和接口" data-scroll-container>
      <div v-if="loading && !catalog" class="doc-menu-state" role="status">
        <span class="doc-menu-loading-dot" />正在加载目录…
      </div>
      <div v-else-if="error" class="doc-menu-state" role="alert">
        <p>{{ error }}</p>
        <button type="button" @click="menu.load">重新加载</button>
      </div>
      <template v-else
        ><ul class="doc-menu-tree">
          <CatalogMenuBranch
            v-for="branch in visibleRoots"
            :key="branch.directory.id"
            :branch="branch"
            :depth="0"
            :expanded="expanded"
            :pages="pages"
            :selected-id="selectedId"
            :filter-ids="filterIds"
            @toggle="menu.toggle"
            @more="menu.loadItems($event, true)"
            @retry="menu.loadItems($event)"
            @select="selectInterface"
          />
        </ul>
        <div v-if="filterIds && !visibleRoots.length" class="doc-menu-state">
          <p>没有匹配的目录</p>
          <button type="button" @click="clearSearch">清除查找</button>
        </div></template
      >
    </nav>
  </aside>
</template>
