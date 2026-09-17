<script setup lang="ts">
import { computed, ref } from 'vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useCatalogChange, type CatalogIntent } from './change'
import { createAttemptStore } from './attemptStore'
import type { CatalogSource, CatalogState } from './types'

const props = defineProps<{
  projectId: string
  intent: CatalogIntent
  label: string
  disabled?: boolean
  source: CatalogSource
}>()
const emit = defineEmits<{ updated: [state: CatalogState]; unauthorized: [] }>()
const auth = useAuthStore()
const open = ref(false)
const preparedIntent = ref<CatalogIntent>(props.intent)
// Parent keys this component by project/user; the operation never changes owners in flight.
const owner = props.projectId
let storage: Storage | undefined
try {
  storage = window.sessionStorage
} catch {
  /* Memory-only idempotent retry remains available. */
}
const scope = `nexofolio:catalog-attempt:${new URL(import.meta.env.VITE_API_BASE_URL || '/api', window.location.origin).href}:${auth.user?.id ?? 'anonymous'}:${owner}`
const change = useCatalogChange(
  {
    read: (signal) => props.source.current(owner, signal),
    generation: (state: CatalogState) => state.generation,
    send: (attempt, signal) => props.source.change(owner, attempt, signal),
  },
  createAttemptStore(scope, storage),
  (state) => emit('updated', state),
  () => emit('unauthorized'),
)
const { phase, error, attempt, receipt } = change
const target = computed(() => attempt.value ?? change.targetIntent.value ?? preparedIntent.value)
const targetName = computed(() =>
  target.value.kind === 'publish'
    ? `候选任务 ${target.value.task_id}`
    : target.value.version_id
      ? `历史版本 ${target.value.version_id}`
      : '初始状态：全部接口待分类',
)
async function start() {
  preparedIntent.value = { ...props.intent }
  open.value = true
  await change.prepare(preparedIntent.value)
}
</script>
<template>
  <button
    type="button"
    class="document-secondary-button"
    :disabled="disabled || phase === 'sending'"
    @click="start"
  >
    {{ label }}
  </button>
  <AppDialog
    v-model:open="open"
    :title="target.kind === 'publish' ? '发布接口目录' : '回退接口目录'"
    description="只切换接口的目录归属与聚合展示，不删除或合并任何原始接口资料。"
  >
    <div class="catalog-change-dialog">
      <p class="catalog-change-target">{{ targetName }}</p>
      <p>固定“待分类”系统目录会保留；目标版本未覆盖的接口继续显示在待分类中。</p>
      <p v-if="phase === 'loading'" role="status">正在读取当前目录…</p>
      <p v-if="phase === 'confirm'">已读取当前目录。确认后才会提交这次变更。</p>
      <p v-if="phase === 'sending'" role="status">正在提交，请勿重复操作…</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="attempt" class="catalog-caption">请求 ID：{{ attempt.request_id }}</p>
      <p v-if="receipt" role="status">
        操作已确认成功{{ receipt.replayed ? '（返回同一请求的处理结果）' : '' }}。
      </p>
      <div class="catalog-change-actions">
        <button
          v-if="phase === 'confirm'"
          type="button"
          class="document-catalog-entry"
          @click="change.confirm"
        >
          确认{{ target.kind === 'publish' ? '发布' : '回退' }}
        </button>
        <button
          v-if="phase === 'uncertain'"
          type="button"
          class="document-secondary-button"
          @click="change.retry"
        >
          用原请求重试
        </button>
        <button
          v-if="phase === 'conflict' || phase === 'error'"
          type="button"
          class="document-secondary-button"
          @click="change.refreshForConfirmation"
        >
          刷新目录并重新确认
        </button>
        <button
          v-if="phase === 'refresh-error'"
          type="button"
          class="document-secondary-button"
          @click="change.refreshAfterSuccess"
        >
          仅刷新目录
        </button>
        <button type="button" class="document-secondary-button" @click="open = false">
          {{ phase === 'success' ? '完成' : '关闭' }}
        </button>
      </div>
    </div>
  </AppDialog>
</template>
