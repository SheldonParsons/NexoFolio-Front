<script setup lang="ts">
import { computed, ref } from 'vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useCatalogChange, type CatalogIntent } from '@/features/catalog/change'
import { createAttemptStore } from '@/features/catalog/attemptStore'
import { maintenanceSource } from './source'
import './maintenance.css'
const props = defineProps<{
  projectId: string
  intent: CatalogIntent
  label: string
  baseGeneration?: number
  disabled?: boolean
}>()
const emit = defineEmits<{ changed: []; unauthorized: [] }>()
const auth = useAuthStore()
const open = ref(false)
const prepared = ref<CatalogIntent>(props.intent)
let committed = false
const owner = props.projectId
let storage: Storage | undefined
try {
  storage = window.sessionStorage
} catch {
  /* Memory fallback. */
}
const scope = `nexofolio:knowledge-change:${new URL(import.meta.env.VITE_API_BASE_URL || '/api', window.location.origin).href}:${auth.user?.id}:${owner}`
const change = useCatalogChange(
  {
    read: async (signal) => {
      const value = await maintenanceSource.versions(owner, 1, signal)
      return value
    },
    generation: (state) => state.generation,
    send: async (attempt, signal) => {
      const value = await maintenanceSource.change(owner, attempt, signal)
      committed = true
      return value
    },
  },
  createAttemptStore(scope, storage),
  () => {
    if (committed) emit('changed')
  },
  () => emit('unauthorized'),
)
const { phase, error, receipt, attempt } = change
const target = computed(() => attempt.value ?? change.targetIntent.value ?? prepared.value)
async function start() {
  committed = false
  prepared.value = { ...props.intent }
  open.value = true
  await change.prepare(prepared.value)
}
</script>
<template>
  <button
    type="button"
    class="maintenance-action"
    :disabled="disabled || phase === 'sending'"
    @click="start"
  >
    {{ label }}</button
  ><AppDialog
    v-model:open="open"
    :title="target.kind === 'publish' ? '发布目录与语义资料' : '回退目录与语义资料'"
    description="这次操作同时切换目录和语义版本，保留原始观测、接口定义与固定待分类。"
    ><div class="maintenance-panel">
      <p>
        {{
          target.kind === 'publish'
            ? `重构任务 ${target.task_id}`
            : target.version_id
              ? `知识版本 ${target.version_id}`
              : '初始状态：全部待分类、无已发布语义'
        }}
      </p>
      <p v-if="phase === 'loading'" role="status">正在读取当前知识版本…</p>
      <p v-if="phase === 'confirm'">确认后才会提交。字段或目录已变更时，服务将拒绝过期候选。</p>
      <p v-if="phase === 'sending'" role="status">正在提交…</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="receipt" role="status">
        操作已成功{{ receipt.replayed ? '，已返回原请求结果' : '' }}。
      </p>
      <div class="maintenance-filters">
        <button v-if="phase === 'confirm'" type="button" @click="change.confirm">
          确认{{ target.kind === 'publish' ? '发布' : '回退' }}</button
        ><button v-if="phase === 'uncertain'" type="button" @click="change.retry">
          用原请求重试</button
        ><button
          v-if="phase === 'conflict' || phase === 'error'"
          type="button"
          @click="change.refreshForConfirmation"
        >
          刷新并重新确认</button
        ><button v-if="phase === 'refresh-error'" type="button" @click="change.refreshAfterSuccess">
          仅刷新当前版本</button
        ><button type="button" @click="open = false">关闭</button>
      </div>
    </div></AppDialog
  >
</template>
