<script setup lang="ts">
import type { KnowledgeChange } from './changes'
defineProps<{ kind: KnowledgeChange['status'] }>()
const labels = { added: '新增', updated: '更新', removed: '移除' }
const paths = {
  added: 'M4 8h8M8 4v8',
  updated: 'M3 8c2-4 3-4 5 0s3 4 5 0',
  removed: 'M4 8h8',
}
</script>
<template>
  <span class="curation-delta-mark" :data-kind="kind" role="img" :aria-label="labels[kind]">
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <path :d="paths[kind]" />
    </svg>
  </span>
</template>
