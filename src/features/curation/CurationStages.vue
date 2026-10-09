<script setup lang="ts">
import ProcessingMark from './ProcessingMark.vue'
import type { CurateProgress } from '@/contracts/knowledge/types'
import type { ProcessingState } from './workPresentation'
const props = defineProps<{ progress: CurateProgress | null; busy: boolean }>()
const stages = ['describe', 'fields', 'organize'] as const
function state(stage: (typeof stages)[number], index: number): ProcessingState {
  const progress = props.progress
  if (progress?.preparation && progress.preparation.phase !== 'ready') return 'idle'
  if (stage === 'fields' && progress?.fields_failed) return 'gap'
  if (
    stage === 'organize'
      ? progress?.directory_completed
      : progress?.status === 'done' || index < stages.indexOf(progress?.stage ?? 'describe')
  )
    return 'saved'
  return props.busy && progress?.stage === stage ? 'working' : 'idle'
}
</script>
<template>
  <div class="curation-stage-track" aria-label="整理阶段">
    <span
      v-if="progress?.preparation"
      :data-state="progress.preparation.phase === 'ready' ? 'saved' : busy ? 'working' : 'gap'"
    >
      <ProcessingMark
        :state="progress.preparation.phase === 'ready' ? 'saved' : busy ? 'working' : 'gap'"
        :animate="busy"
      />
      整理准备
    </span>
    <span v-for="(stage, index) in stages" :key="stage" :data-state="state(stage, index)">
      <ProcessingMark :state="state(stage, index)" :animate="busy" />
      {{ ['接口说明', '字段知识', '目录构建'][index] }}
    </span>
  </div>
</template>
