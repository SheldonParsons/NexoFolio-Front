<script setup lang="ts">
import { useLifecycle } from './lifecycle/context'
import LifecycleMenu from './lifecycle/LifecycleMenu.vue'
const lifecycle = useLifecycle()
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from '@/components/icons/AppIcon.vue'
import { useMarqueeOverflow } from '@/features/knowledge/useMarqueeOverflow'
import DocumentPreview from './DocumentPreview.vue'
import DocumentEndpointRow from './DocumentEndpointRow.vue'
import type { DocumentFolder } from './documentTree'
import { documentLocation } from './documentRoutes'
const props = defineProps<{
  folder: DocumentFolder
  projectId: string
  environmentId: string
  selectedId: string
  selectedFolderId: string
  closed: Set<string>
  query: string
  parentPath?: string
}>()
const emit = defineEmits<{ toggle: [id: string] }>()
const label = computed(() => props.folder.name)
const labelElement = ref<HTMLElement>()
const marquee = useMarqueeOverflow(labelElement, label, 20)
const path = computed(() => [props.parentPath, props.folder.name].filter(Boolean).join(' / '))
const expanded = computed(() => !!props.query || !props.closed.has(props.folder.id))
const to = computed(() =>
  documentLocation(props.projectId, { kind: 'folder', id: props.folder.id }, props.environmentId),
)
</script>
<template>
  <section class="document-folder">
    <div class="document-folder-heading" :class="{ 'is-selected': selectedFolderId === folder.id }">
      <button
        type="button"
        class="document-folder-arrow"
        :aria-label="(expanded ? '折叠' : '展开') + folder.name"
        :aria-expanded="expanded"
        :aria-controls="'document-folder-' + folder.id"
        @click="emit('toggle', folder.id)"
      >
        <AppIcon name="chevron-right" :size="13" />
      </button>
      <DocumentPreview
        :to="to"
        :name="folder.name"
        :purpose="folder.summary"
        :context="path"
        :meta="folder.children.length + ' 个子目录 · 当前环境 ' + folder.count + ' 个接口'"
        v-slot="preview"
      >
        <RouterLink
          :to="to"
          class="document-folder-toggle"
          :aria-current="selectedFolderId === folder.id ? 'page' : undefined"
          :aria-describedby="preview.previewOpen ? preview.previewId : undefined"
          aria-keyshortcuts="Escape"
          :data-folder-id="folder.id"
          ><AppIcon :name="expanded ? 'folder-open' : 'folder'" :size="15" /><span
            ref="labelElement"
            class="document-folder-name"
            :class="{
              'is-overflowing': marquee.overflowing.value,
              'lifecycle-retired-name': !!lifecycle?.get({ kind: 'folder', id: folder.id }),
            }"
            :style="marquee.style()"
            ><b class="document-tree-marquee-track"
              ><span data-marquee-text>{{ folder.name }}</span
              ><span v-if="marquee.overflowing.value" aria-hidden="true">{{ folder.name }}</span></b
            ></span
          ><small>{{ folder.count }}</small></RouterLink
        >
      </DocumentPreview>
      <LifecycleMenu
        variant="tree"
        :target="{ kind: 'folder', id: folder.id }"
        :name="folder.name"
      />
    </div>
    <div
      :id="'document-folder-' + folder.id"
      class="document-folder-fold"
      :class="{ 'is-closed': !expanded }"
      :inert="!expanded"
      :aria-hidden="!expanded"
    >
      <div class="document-folder-items">
        <DocumentFolderBranch
          v-for="child in folder.children"
          :key="child.id"
          :folder="child"
          :project-id="projectId"
          :environment-id="environmentId"
          :selected-id="selectedId"
          :selected-folder-id="selectedFolderId"
          :closed="closed"
          :query="query"
          :parent-path="path"
          @toggle="emit('toggle', $event)"
        />
        <DocumentEndpointRow
          v-for="entry in folder.entries"
          :key="entry.interface_id"
          :entry="entry"
          :selected="selectedId === entry.interface_id"
          :project-id="projectId"
          :environment-id="environmentId"
          :context="path"
        />
      </div>
    </div>
  </section>
</template>
