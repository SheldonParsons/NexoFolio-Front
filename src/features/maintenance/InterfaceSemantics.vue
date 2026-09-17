<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import SemanticFieldsPanel from './SemanticFieldsPanel.vue'
import EvidenceViewer from './EvidenceViewer.vue'
import { maintenanceSource } from './source'
import { semanticDocument } from './mapping'
import { maintenanceEvidenceReader } from './evidenceSource'
import type { InterfaceKnowledge } from '@/contracts/maintenance/2.0.0/types.generated'
import type { EvidenceRef } from './models'
import { ApiError } from '@/api/client'
const props = defineProps<{
  projectId: string
  interfaceId: string
  environmentId: string
  revisionId: string
}>()
const emit = defineEmits<{ unauthorized: [] }>()
const data = shallowRef<InterfaceKnowledge | null>(null)
const busy = ref(false)
const error = ref('')
const evidence = ref<EvidenceRef | null>(null)
const reader = maintenanceEvidenceReader(() => ({}))
const document = computed(() => (data.value ? semanticDocument(props.projectId, data.value) : null))
let request: AbortController | undefined
async function load() {
  request?.abort()
  evidence.value = null
  data.value = null
  error.value = ''
  busy.value = true
  const current = new AbortController()
  request = current
  try {
    const value = await maintenanceSource.knowledge(
      props.projectId,
      props.interfaceId,
      props.environmentId,
      current.signal,
    )
    if (!current.signal.aborted && request === current) data.value = value
  } catch (cause) {
    if (!current.signal.aborted && request === current) {
      error.value = cause instanceof Error ? cause.message : '语义资料读取失败。'
      if (cause instanceof ApiError && cause.status === 401) emit('unauthorized')
    }
  } finally {
    if (!current.signal.aborted && request === current) busy.value = false
  }
}
watch(
  () => [props.projectId, props.interfaceId, props.environmentId, props.revisionId],
  () => {
    void load()
  },
  { immediate: true },
)
onScopeDispose(() => request?.abort())
</script>
<template>
  <section aria-label="独立语义资料">
    <p v-if="busy" class="maintenance-panel" role="status">正在读取语义资料…</p>
    <div v-else-if="error" class="maintenance-panel" role="alert">
      <h2>语义资料暂不可用</h2>
      <p>{{ error }}</p>
      <button class="maintenance-action" type="button" @click="load">重新读取语义资料</button>
    </div>
    <template v-else-if="document"
      ><p v-if="data?.revision_id !== revisionId" class="maintenance-note">
        语义读取时的定义版本与当前展示版本不同，请刷新接口定义后核对。
      </p>
      <SemanticFieldsPanel :document="document" @evidence="evidence = $event" /></template
    ><EvidenceViewer
      :project-id="projectId"
      :reference="evidence"
      :reader="reader"
      @close="evidence = null"
      @navigate="evidence = $event"
      @unauthorized="emit('unauthorized')"
    />
  </section>
</template>
