<script setup lang="ts">
import { computed } from 'vue'
import type { CurateProgress } from '@/contracts/knowledge/types'
import { liveness, preparationLabels } from './liveness'
import { elapsedLabel } from './progress'
const props = defineProps<{ progress: CurateProgress | null; now: number }>()
const health = computed(() => liveness(props.progress, props.now))
const preparation = computed(() => props.progress?.preparation)
</script>
<template>
  <div v-if="health" class="curation-liveness" :data-state="health.state">
    <template v-if="preparation">
      <div v-if="preparation.phase !== 'ready'" class="curation-preparation-phase">
        <strong>{{ preparationLabels[preparation.phase] }}</strong>
        <span>当前步骤 {{ elapsedLabel(preparation.phase_started_at, now) }}</span>
      </div>
      <div class="curation-preparation-counts">
        <span>已读接口 {{ preparation.endpoints_read }} / {{ preparation.endpoints_total }}</span>
        <span>真实样本 {{ preparation.samples_read }}</span>
        <span v-if="preparation.samples_unavailable"
          >未能读取 {{ preparation.samples_unavailable }}</span
        >
        <span>字段 {{ preparation.fields }}</span>
        <span>观测值 {{ preparation.values }}</span>
        <span v-if="preparation.relations">关联 {{ preparation.relations }}</span>
      </div>
    </template>
    <div class="curation-liveness-meta">
      <span>{{ health.progress }}</span>
      <span>{{ health.heartbeat }}</span>
      <span v-if="!progress?.model_calls">模型尚未开始处理</span>
    </div>
    <p v-if="health.warning" role="status">{{ health.warning }}</p>
  </div>
</template>
<style scoped>
.curation-liveness {
  margin-top: 12px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--muted);
}
.curation-preparation-phase,
.curation-preparation-counts,
.curation-liveness-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
}
.curation-preparation-phase strong {
  color: var(--text);
  font-weight: 500;
}
.curation-preparation-counts {
  margin-top: 4px;
}
.curation-liveness-meta {
  margin-top: 6px;
  font-size: 11px;
}
.curation-liveness p {
  margin: 8px 0 0;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
}
</style>
