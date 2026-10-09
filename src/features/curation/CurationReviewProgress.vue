<script setup lang="ts">
import { computed } from 'vue'
import CurationPanel from './CurationPanel.vue'
import { useReviewProgress } from './useReviewProgress'
import type { Candidate, CandidateSummary } from './types'
const props = defineProps<{ candidate: Candidate; pageKey: string; environmentId: string }>()
const emit = defineEmits<{ close: []; unauthorized: [] }>()
const monitor = useReviewProgress(
  () => props.candidate.project_id,
  () => emit('unauthorized'),
)
const focused = computed<CandidateSummary>(() => ({
  id: props.candidate.id,
  project_id: props.candidate.project_id,
  state: props.candidate.state,
  target: props.candidate.target,
  created_at: props.candidate.created_at,
  updated_at: props.candidate.updated_at,
  progress: props.candidate.progress,
  commands: props.candidate.batches.reduce((n, batch) => n + batch.commands.length, 0),
}))
</script>
<template>
  <CurationPanel
    :project-id="candidate.project_id"
    :page-key="pageKey"
    :environment-id="environmentId"
    :focus-candidate="focused"
    :progress="monitor.progress.value"
    :busy="monitor.busy.value"
    :ready="!monitor.blocked.value"
    :error="monitor.error.value"
    :notice-candidate-id="monitor.noticeCandidateId.value"
    :requested-run-key="monitor.requestedRunKey.value"
    :dismissible="true"
    initial-size="full"
    @observe="monitor.observe"
    @retry="monitor.resume"
    @cancel="monitor.cancel"
    @close="emit('close')"
    @view="emit('close')"
    @unauthorized="emit('unauthorized')"
  />
</template>
