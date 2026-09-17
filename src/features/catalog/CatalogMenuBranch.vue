<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import type { LiveCatalogInterface, MenuBranch } from './types'
import type { MenuPage } from './useCatalogMenu'
const props = defineProps<{
  branch: MenuBranch
  depth: number
  expanded: Set<string>
  pages: Record<string, MenuPage>
  selectedId: string
  filterIds: Set<string> | null
}>()
const emit = defineEmits<{
  toggle: [id: string]
  more: [id: string]
  retry: [id: string]
  select: [directoryId: string, item: LiveCatalogInterface]
}>()
const open = computed(() => props.expanded.has(props.branch.directory.id) || !!props.filterIds)
const page = computed(() => props.pages[props.branch.directory.id])
const children = computed(() =>
  props.branch.children.filter(
    (child) => !props.filterIds || props.filterIds.has(child.directory.id),
  ),
)
function compactPath(path: string) {
  if (path.length <= 36) return path
  const segments = path.split('/').filter(Boolean)
  return segments.length > 2 ? `/…/${segments.slice(-2).join('/')}` : path
}
</script>
<template>
  <li class="doc-menu-branch" :style="{ '--menu-depth': Math.min(depth, 6) }">
    <button
      type="button"
      class="doc-menu-directory"
      :aria-expanded="open"
      :title="branch.directory.name"
      @click="emit('toggle', branch.directory.id)"
    >
      <AppIcon name="chevron-right" active-name="chevron-down" :active="open" :size="13" />
      <AppIcon name="folder" active-name="folder-open" :active="open" :size="17" />
      <span class="doc-menu-name">{{ branch.directory.name }}</span
      ><span class="doc-menu-count">{{ branch.directory.count }}</span>
    </button>
    <div class="doc-menu-collapse" :class="{ 'is-open': open }" :inert="!open" :aria-hidden="!open">
      <div class="doc-menu-collapse-inner">
        <ul class="doc-menu-children">
          <CatalogMenuBranch
            v-for="child in children"
            :key="child.directory.id"
            :branch="child"
            :depth="depth + 1"
            :expanded="expanded"
            :pages="pages"
            :selected-id="selectedId"
            :filter-ids="filterIds"
            @toggle="emit('toggle', $event)"
            @more="emit('more', $event)"
            @retry="emit('retry', $event)"
            @select="(id, item) => emit('select', id, item)"
          />
          <li v-for="item in page?.items" :key="item.id">
            <button
              type="button"
              class="doc-menu-interface"
              :class="{ 'is-selected': selectedId === item.id }"
              :aria-current="selectedId === item.id ? 'true' : undefined"
              :aria-label="`${item.method} ${item.path}`"
              :title="`${item.method} ${item.path}`"
              @click="emit('select', branch.directory.id, item)"
            >
              <span class="doc-menu-method">{{ item.method }}</span
              ><span class="doc-menu-path">{{ compactPath(item.path) }}</span>
            </button>
          </li>
          <li v-if="page?.busy" class="doc-menu-inline-state" role="status">
            <span class="doc-menu-loading-dot" />加载接口中…
          </li>
          <li v-else-if="page?.error" class="doc-menu-inline-state" role="alert">
            <span>{{ page.error }}</span
            ><button type="button" @click="emit('retry', branch.directory.id)">重试</button>
          </li>
          <li v-else-if="page && page.items.length < page.total" class="doc-menu-inline-state">
            <button type="button" @click="emit('more', branch.directory.id)">
              加载更多 <span>{{ page.items.length }} / {{ page.total }}</span>
            </button>
          </li>
          <li
            v-else-if="page && !page.items.length && !children.length"
            class="doc-menu-inline-state"
          >
            暂无接口
          </li>
          <li v-else-if="!page && !children.length && filterIds" class="doc-menu-inline-state">
            <button type="button" @click="emit('retry', branch.directory.id)">展开接口</button>
          </li>
        </ul>
      </div>
    </div>
  </li>
</template>
