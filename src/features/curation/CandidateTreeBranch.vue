<script setup lang="ts">
import { useLifecycle } from '@/features/documents/lifecycle/context'
const lifecycle = useLifecycle()
import { computed } from 'vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import type { DocumentFolder } from '@/features/documents/documentTree'
import type { DocumentTarget } from '@/features/documents/documentRoutes'
import type { KnowledgeChange } from './changes'
const props = defineProps<{
  folder: DocumentFolder
  selected: DocumentTarget
  closed: Set<string>
  query: string
  changes: Map<string, KnowledgeChange['status']>
}>()
const emit = defineEmits<{ select: [target: DocumentTarget]; toggle: [id: string] }>()
const expanded = computed(() => !!props.query || !props.closed.has(props.folder.id))
const mark = computed(() => props.changes.get('folders:' + props.folder.id))
</script>
<template>
  <section class="document-folder">
    <div
      class="document-folder-heading"
      :class="{ 'is-current': selected?.kind === 'folder' && selected.id === folder.id }"
    >
      <button
        type="button"
        class="document-folder-arrow"
        :aria-label="(expanded ? '折叠' : '展开') + folder.name"
        :aria-expanded="expanded"
        :aria-controls="'candidate-folder-' + folder.id"
        @click="emit('toggle', folder.id)"
      >
        <AppIcon name="chevron-right" :size="13" />
      </button>
      <button
        type="button"
        class="document-folder-toggle candidate-folder-select"
        :aria-pressed="selected?.kind === 'folder' && selected.id === folder.id"
        @click="emit('select', { kind: 'folder', id: folder.id })"
      >
        <AppIcon :name="expanded ? 'folder-open' : 'folder'" :size="15" />
        <span
          :class="{ 'lifecycle-retired-name': !!lifecycle?.get({ kind: 'folder', id: folder.id }) }"
          >{{ folder.name }}</span
        ><small v-if="mark" class="candidate-tree-mark">{{
          mark === 'added' ? '新增' : '调整'
        }}</small
        ><small>{{ folder.count }}</small>
      </button>
    </div>
    <div
      :id="'candidate-folder-' + folder.id"
      class="document-folder-fold"
      :class="{ 'is-closed': !expanded }"
      :inert="!expanded"
      :aria-hidden="!expanded"
    >
      <div class="document-folder-items">
        <CandidateTreeBranch
          v-for="child in folder.children"
          :key="child.id"
          :folder="child"
          :selected="selected"
          :closed="closed"
          :query="query"
          :changes="changes"
          @select="emit('select', $event)"
          @toggle="emit('toggle', $event)"
        />
        <button
          v-for="entry in folder.entries"
          :key="entry.interface_id"
          type="button"
          class="interface-list-item candidate-endpoint-select"
          :class="{
            'is-current': selected?.kind === 'endpoint' && selected.id === entry.interface_id,
          }"
          :aria-pressed="selected?.kind === 'endpoint' && selected.id === entry.interface_id"
          :aria-label="entry.method + ' ' + (entry.name || entry.path)"
          :title="entry.method + ' ' + entry.path"
          @click="emit('select', { kind: 'endpoint', id: entry.interface_id })"
        >
          <span class="http-method" :data-method="entry.method" aria-hidden="true">{{
            entry.method
          }}</span>
          <span class="interface-item-content"
            ><strong
              :class="{
                'lifecycle-retired-name': !!lifecycle?.get({
                  kind: 'endpoint',
                  id: entry.interface_id,
                }),
              }"
              >{{ entry.name || entry.path }}</strong
            ></span
          >
          <small
            v-if="changes.has('placements:' + entry.interface_id)"
            class="candidate-tree-mark"
            >{{
              changes.get('placements:' + entry.interface_id) === 'added' ? '归类' : '移动'
            }}</small
          >
        </button>
      </div>
    </div>
  </section>
</template>
