<script setup lang="ts">
import { computed, watch } from 'vue'
import type { CurateProgress } from '@/contracts/knowledge/types'
import CurationProgress from './CurationProgress.vue'
import CurationPanelRunPicker from './CurationPanelRunPicker.vue'
import { useCurationPanel } from './useCurationPanel'
import { canObservePanelRun, panelProgress } from './panelSelection'
import { formatTime } from '@/features/documents/presentation'
import type { CandidateSummary } from './types'
import type { CurationPanelSize } from './panelSize'
const props = defineProps<{
  projectId: string
  pageKey: string
  environmentId: string
  progress: CurateProgress | null
  busy: boolean
  ready: boolean
  error: string
  noticeCandidateId: string
  requestedRunKey: string
  focusCandidate?: CandidateSummary | null
  dismissible?: boolean
  initialSize?: CurationPanelSize
}>()
const emit = defineEmits<{
  retry: [id: string]
  cancel: [id: string]
  observe: [job: CurateProgress]
  unauthorized: []
  close: []
  view: []
}>()
const panel = useCurationPanel(
  () => props.projectId,
  () => props.pageKey,
  () => props.progress,
  () => props.busy,
  () => emit('unauthorized'),
  () => props.requestedRunKey,
)
watch(
  () => props.focusCandidate?.id,
  () => {
    if (props.focusCandidate) panel.pin(props.focusCandidate)
  },
  { immediate: true },
)
const reviewTo = computed(() => ({
  name: 'curation-review',
  params: {
    projectId: props.projectId,
    ...(panel.progress.value?.candidate_id
      ? { candidateId: panel.progress.value.candidate_id }
      : {}),
  },
  query: props.environmentId ? { env: props.environmentId } : {},
}))
const error = computed(
  () =>
    panel.error.value ||
    ((!panel.manual.value && !panel.selected.value) ||
    panel.selected.value?.id === props.noticeCandidateId
      ? props.error
      : ''),
)
watch([panel.preferred, () => props.busy, () => props.ready], ([row, busy, ready]) => {
  if (!panel.accessDenied.value && canObservePanelRun(row, props.progress, busy, ready) && row)
    emit('observe', panelProgress(row))
})
</script>
<template>
  <CurationProgress
    :key="pageKey"
    :progress="panel.progress.value"
    :busy="panel.busy.value"
    :review-to="reviewTo"
    :historical-only="initialSize ? false : panel.historicalOnly.value"
    :lock-close="panel.projectRunning.value"
    :action-busy="busy || panel.projectRunning.value"
    :error="error"
    :dismissible="dismissible"
    :initial-size="initialSize"
    @retry="emit('retry', $event)"
    @cancel="emit('cancel', $event)"
    @close="emit('close')"
    @view="emit('view')"
  >
    <template
      v-if="panel.selected.value && panel.selected.value.id === panel.progress.value?.candidate_id"
      #switch
    >
      <span class="curation-panel-round-label">{{
        formatTime(panel.selected.value.created_at)
      }}</span>
      <CurationPanelRunPicker
        :selected="panel.selected.value"
        :options="panel.options.value"
        :loading="panel.listLoading.value"
        :error="panel.listError.value"
        :environment-id="environmentId"
        @open="panel.loadOptions"
        @retry="panel.loadOptions"
        @select="panel.select"
      />
    </template>
  </CurationProgress>
</template>
