<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { documentTree, folderPath } from '@/features/documents/documentTree'
import type { DocumentTarget } from '@/features/documents/documentRoutes'
import type { DocumentIndex } from '@/features/documents/source'
import type { KnowledgeChange } from './changes'
import CandidateTreeBranch from './CandidateTreeBranch.vue'
const props = defineProps<{
  index: DocumentIndex
  selected: DocumentTarget
  query: string
  changes: KnowledgeChange[]
}>()
defineEmits<{ select: [target: DocumentTarget] }>()
const closed = ref(new Set<string>())
const tree = computed(() => documentTree(props.index, null, props.query, props.selected))
const marks = computed(
  () =>
    new Map(
      props.changes
        .filter((c) => c.section === 'folders' || c.section === 'placements')
        .map((c) => [c.id, c.status]),
    ),
)
function toggle(id: string) {
  if (closed.value.has(id)) closed.value.delete(id)
  else closed.value.add(id)
}
watch(
  () => props.selected,
  (target) => {
    const folder =
      target?.kind === 'folder'
        ? target.id
        : props.index.entries.find((e) => e.interface_id === target?.id)?.folderId
    for (const item of folderPath(props.index.catalog.folders, folder ?? null))
      closed.value.delete(item.id)
  },
)
</script>
<template>
  <div class="candidate-tree-heading">
    <strong>目录与接口</strong><span>{{ index.entries.length }} 个接口</span>
  </div>
  <div class="candidate-tree-scroll" data-scroll-container>
    <CandidateTreeBranch
      v-for="folder in tree"
      :key="folder.id"
      :folder="folder"
      :selected="selected"
      :closed="closed"
      :query="query"
      :changes="marks"
      @select="$emit('select', $event)"
      @toggle="toggle"
    />
    <p v-if="!tree.length" class="document-small-state">
      {{ query ? '没有匹配的目录或接口' : '尚无候选目录与接口' }}
    </p>
  </div>
</template>
