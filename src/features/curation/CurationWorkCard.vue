<script setup lang="ts">
import { computed } from 'vue'
import NumberPop from '@/components/motion/NumberPop.vue'
import ThinkingState from '@/components/motion/ThinkingState.vue'
import ProcessingMark from './ProcessingMark.vue'
import { workLabel, workState, type ActiveWork } from './workPresentation'
import { elapsedLabel } from './progress'
const props = defineProps<{ item: ActiveWork; fieldsStage: boolean; now: number }>()
const state = computed(() => workState(props.item))
const shortStatus = computed(() =>
  state.value === 'saving' ? '保存中' : state.value === 'retrying' ? '重试中' : '等待回复',
)
</script>
<template>
  <article class="curation-work-card" :class="{ 'is-compact': fieldsStage }" :data-state="state">
    <ProcessingMark :state="state" />
    <div v-if="fieldsStage" class="curation-work-compact-content">
      <div class="curation-work-compact-title">
        <strong :title="item.path">{{ item.name || item.path }}</strong>
        <time>{{ elapsedLabel(item.started_at, now) }}</time>
      </div>
      <div class="curation-work-compact-meta">
        <span
          >{{ item.batch }}/{{ item.batches }} 批 · <NumberPop :value="item.completed" />/{{
            item.fields
          }}
          字段已保存</span
        >
        <span :title="workLabel(item)">{{ shortStatus }}</span>
      </div>
    </div>
    <div v-else>
      <strong :title="item.path">{{ item.name || item.path }}</strong>
      <div class="curation-work-status">
        <ThinkingState :text="workLabel(item)" :busy="false" />
        <time>{{ elapsedLabel(item.started_at, now) }}</time>
      </div>
    </div>
  </article>
</template>
