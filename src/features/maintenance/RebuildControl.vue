<script setup lang="ts">
import type { RebuildAttemptStore, RebuildPort, RebuildReceipt } from './ports'
import { useRebuildRequest } from './useRebuildRequest'
import './maintenance.css'
const props = defineProps<{
  projectId: string
  port: RebuildPort
  store: RebuildAttemptStore
  disabled?: boolean
}>()
const emit = defineEmits<{ accepted: [receipt: RebuildReceipt]; unauthorized: [] }>()
const { busy, pending, receipt, error, requestRebuild, retry } = useRebuildRequest(
  () => props.projectId,
  props.port,
  props.store,
  (value) => emit('accepted', value),
  () => emit('unauthorized'),
)
</script>
<template>
  <div class="maintenance-rebuild-control">
    <button
      type="button"
      class="maintenance-action"
      :disabled="disabled || busy || !!pending"
      @click="requestRebuild"
    >
      {{ busy ? '正在提交重构…' : '重构' }}</button
    ><button
      v-if="pending && !busy"
      type="button"
      class="maintenance-action"
      :disabled="disabled"
      @click="retry"
    >
      用原请求重试
    </button>
    <p v-if="receipt" role="status">已创建重构任务，策略将在任务中展示。</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <p class="maintenance-caption">只在点击后发起，页面不会控制录制；不需要选择全量或局部。</p>
  </div>
</template>
