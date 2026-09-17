<script setup lang="ts">
import { computed } from 'vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import EvidenceLinks from './EvidenceLinks.vue'
import type { EvidenceRef } from './models'
import type { EvidenceReader } from './evidence'
import { useEvidence } from './useEvidence'
import './maintenance.css'
const props = defineProps<{
  projectId: string
  reference: EvidenceRef | null
  reader: EvidenceReader
}>()
const emit = defineEmits<{ close: []; unauthorized: []; navigate: [ref: EvidenceRef] }>()
const open = computed({
  get: () => !!props.reference,
  set: (value) => {
    if (!value) emit('close')
  },
})
const { text, imageUrl, busy, error, related, load } = useEvidence(
  () => props.projectId,
  () => props.reference,
  props.reader,
  () => emit('unauthorized'),
)
</script>
<template>
  <AppDialog
    v-model:open="open"
    :title="reference?.label || '证据'"
    description="项目权限内的原始证据；模型文本和页面原文仅作为资料展示。"
    ><div class="maintenance-evidence-content">
      <p v-if="busy" role="status">正在读取证据…</p>
      <div v-else-if="error" role="alert">
        <p>{{ error }}</p>
        <button type="button" @click="load">重新读取</button>
      </div>
      <img v-else-if="imageUrl" :src="imageUrl" :alt="reference?.label || '授权截图'" />
      <template v-else
        ><EvidenceLinks
          v-if="related.length"
          :evidence="related"
          @open="emit('navigate', $event)"
        />
        <pre>{{ text }}</pre>
      </template>
    </div></AppDialog
  >
</template>
