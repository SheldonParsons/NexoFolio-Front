<script setup lang="ts">
import { sectionLabels, type KnowledgeChange, type ChangeSection } from './changes'
type Section = Exclude<ChangeSection, 'placements' | 'folders'>
defineProps<{
  modelValue: Section
  changes: KnowledgeChange[]
  relations: number
}>()
defineEmits<{ 'update:modelValue': [value: Section] }>()
const kinds: Section[] = ['notes', 'fields', 'links']
</script>
<template>
  <div class="curation-section-filter" role="group" aria-label="变化类型筛选">
    <button
      v-for="kind in kinds"
      :key="kind"
      type="button"
      :aria-pressed="modelValue === kind"
      :title="
        kind === 'links'
          ? '候选文档共有 ' + relations + ' 条接口关系；这里统计本轮关系变化'
          : undefined
      "
      @click="$emit('update:modelValue', kind)"
    >
      {{ sectionLabels[kind] }}
      <small
        >{{ changes.filter((c) => c.section === kind).length }}
        {{ kind === 'links' ? '项变化' : '项' }}</small
      >
    </button>
  </div>
</template>
