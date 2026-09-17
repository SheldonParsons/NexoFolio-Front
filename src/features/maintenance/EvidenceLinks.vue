<script setup lang="ts">
import type { EvidenceRef } from './models'
defineProps<{ evidence: EvidenceRef[] }>()
const emit = defineEmits<{ open: [evidence: EvidenceRef] }>()
</script>
<template>
  <div v-if="evidence.length" class="maintenance-evidence-links">
    <button v-for="item in evidence" :key="item.id" type="button" @click="emit('open', item)">
      {{ item.kind === 'screenshot' ? '截图' : '原始证据' }} · {{ item.label }}
    </button>
  </div>
  <span v-else class="maintenance-caption">未提供证据引用</span>
</template>
