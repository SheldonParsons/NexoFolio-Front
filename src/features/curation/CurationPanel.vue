<script setup lang="ts">
import { computed, watch } from 'vue'
import type { CurateProgress } from '@/contracts/knowledge/types'
import CurationProgress from './CurationProgress.vue'
import CurationTaskPicker from './CurationTaskPicker.vue'
import CurationPanelRunPicker from './CurationPanelRunPicker.vue'
import { useCurationPanel } from './useCurationPanel'
import { canObservePanelRun, panelProgress } from './panelSelection'
import { formatTime } from '@/features/documents/presentation'
import type { CandidateSummary } from './types'
import type { CurationPanelSize } from './panelSize'
const props = defineProps<{
  endpointLabels?: Record<string, string>
  projectId: string
  pageKey: string
  environmentId: string
  progress: CurateProgress | null
  busy: boolean
  submitting?: boolean
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
  cancel: [id: string, selection: CurateProgress | null]
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
    (!panel.manual.value || panel.selected.value?.id === props.noticeCandidateId
      ? props.error
      : ''),
)
watch([panel.preferred, () => props.busy, () => props.ready], ([row, busy, ready]) => {
  if (!panel.accessDenied.value && canObservePanelRun(row, props.progress, busy, ready) && row)
    emit('observe', panelProgress(row))
})
function selectTask(job: CurateProgress) {
  panel.manual.value = null
  emit('observe', job)
}
</script>
<template>
  <CurationProgress
    :key="pageKey"
    :progress="panel.progress.value"
    :busy="panel.busy.value"
    :review-to="reviewTo"
    :historical-only="initialSize ? false : panel.historicalOnly.value"
    :lock-close="panel.busy.value"
    :action-busy="submitting"
    :error="error"
    :dismissible="dismissible"
    :initial-size="initialSize"
    @retry="emit('retry', $event)"
    @cancel="(id, selection) => emit('cancel', id, selection)"
    @close="emit('close')"
    @view="emit('view')"
  >
    <template #switch>
      <CurationTaskPicker
        :project-id="projectId"
        :selected-id="panel.progress.value?.task_id"
        :selected-target="panel.progress.value?.target"
        :endpoint-labels="endpointLabels"
        @select="selectTask"
        @unauthorized="emit('unauthorized')"
      />
      <template
        v-if="
          panel.selected.value && panel.selected.value.id === panel.progress.value?.candidate_id
        "
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
    </template>
  </CurationProgress>
</template>
