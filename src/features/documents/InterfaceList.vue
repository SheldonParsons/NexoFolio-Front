<script setup lang="ts">
import AppIcon from '@/components/icons/AppIcon.vue'
import { nextTick, ref, watch } from 'vue'
import DocumentFolderBranch from './DocumentFolderBranch.vue'
import type { DocumentFolder } from './documentTree'
const props = defineProps<{
  sections: DocumentFolder[]
  loading: boolean
  error: string
  selectedId: string
  selectedFolderId: string
  ancestors: string[]
  projectId: string
  environmentId: string
  query: string
}>()
const emit = defineEmits<{ query: [value: string]; retry: [] }>()
const closed = ref(new Set<string>()),
  list = ref<HTMLElement>()
function toggle(id: string) {
  if (closed.value.has(id)) closed.value.delete(id)
  else closed.value.add(id)
}
watch(
  [() => props.selectedId, () => props.selectedFolderId, () => props.sections],
  async () => {
    for (const id of props.ancestors) closed.value.delete(id)
    if (props.selectedFolderId) closed.value.delete(props.selectedFolderId)
    await nextTick()
    const container = list.value
    const selected = container?.querySelector<HTMLElement>('a[aria-current="page"]')
    if (!container || !selected) return
    const item = selected.getBoundingClientRect(),
      bounds = container.getBoundingClientRect()
    if (item.top < bounds.top || item.bottom > bounds.bottom)
      container.scrollTop += item.top - bounds.top - 16
  },
  { immediate: true, flush: 'post' },
)
</script>
<template>
  <aside class="interface-sidebar" aria-label="当前环境的接口目录">
    <div class="interface-search">
      <AppIcon name="search" :size="16" /><input
        type="search"
        :value="query"
        :disabled="!environmentId"
        aria-label="搜索接口名称、用途或路径"
        placeholder="搜索目录或接口"
        @input="emit('query', ($event.target as HTMLInputElement).value)"
      />
    </div>
    <div
      ref="list"
      class="interface-list-scroll"
      data-scroll-container
      data-scroll-restoration="managed"
    >
      <div v-if="loading" class="document-small-state" role="status">正在读取接口…</div>
      <div v-else-if="error" class="document-small-state" role="alert">
        <p>{{ error }}</p>
        <button class="document-secondary-button" @click="emit('retry')">重新读取列表</button>
      </div>
      <div v-else-if="!sections.length" class="document-small-state">
        <AppIcon name="code" :size="24" />
        <p>{{ query ? '没有匹配的目录或接口' : '项目尚无目录与接口' }}</p>
        <button v-if="!query" class="document-secondary-button" @click="emit('retry')">
          重新读取列表
        </button>
      </div>
      <DocumentFolderBranch
        v-else
        v-for="section in sections"
        :key="section.id"
        :folder="section"
        :project-id="projectId"
        :environment-id="environmentId"
        :selected-id="selectedId"
        :selected-folder-id="selectedFolderId"
        :closed="closed"
        :query="query"
        @toggle="toggle"
      />
    </div>
  </aside>
</template>
