<script setup lang="ts">
import { computed, ref, watch, onScopeDispose } from 'vue'
import { ApiError } from '@/api'
import { curateProgress } from '@/contracts/knowledge/source'
import type { CurateProgress } from '@/contracts/knowledge/types'
import { startIntent } from './startIntent'
import { RouterLink } from 'vue-router'
import AppConfirmDialog from '@/components/ui/AppConfirmDialog.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import { formatTime } from '@/features/documents/presentation'
import { candidateStateLabels } from './types'
import { usePendingCuration } from './usePendingCuration'
import './confirmation.css'
const props = defineProps<{
  projectId: string
  projectName: string
  environmentId: string
  busy: boolean
  target?: string | null
}>()
const emit = defineEmits<{
  confirm: []
  unauthorized: []
  resume: [id: string]
  progress: [job: CurateProgress]
}>()
const open = defineModel<boolean>('open', { default: false })
const { awaiting, currentTask, otherActive, resumable, loading, error, readyToStart, load } =
  usePendingCuration(
    () => open.value,
    () => props.projectId,
    () => {
      open.value = false
      emit('unauthorized')
    },
    () => props.target ?? null,
  )
const suggested = computed(() => {
  const current = awaiting.value.find(
    (candidate) => candidate.id === currentTask.value?.candidate_id,
  )
  return (
    current
      ? [current, ...awaiting.value.filter((candidate) => candidate.id !== current.id)]
      : awaiting.value
  ).slice(0, 3)
})
const shownResumable = computed(() =>
  resumable.value.filter((candidate) => suggested.value.some((shown) => shown.id === candidate.id)),
)
const intent = computed(() => startIntent(currentTask.value, otherActive.value))
const viewing = ref(false),
  viewError = ref('')
let request: AbortController | undefined
function cancelRead() {
  request?.abort()
  request = undefined
  viewing.value = false
  viewError.value = ''
}
watch([open, () => props.projectId, () => props.target], cancelRead)
onScopeDispose(cancelRead)
function submit() {
  if (!readyToStart.value || props.busy || viewing.value) return
  open.value = false
  emit('confirm')
}
function confirm() {
  if (intent.value.observe) void viewProgress()
  else submit()
}
async function viewProgress() {
  const task = currentTask.value
  if (!task || props.busy || viewing.value) return
  const current = new AbortController(),
    project = props.projectId
  request = current
  viewing.value = true
  viewError.value = ''
  const owns = () =>
    request === current &&
    !current.signal.aborted &&
    open.value &&
    props.projectId === project &&
    currentTask.value?.id === task.id
  try {
    const job = await curateProgress(project, current.signal, `task:${task.id}`)
    if (owns()) {
      open.value = false
      emit('progress', job)
    }
  } catch (cause) {
    if (owns()) {
      if (cause instanceof ApiError && cause.status === 401) {
        open.value = false
        emit('unauthorized')
      } else viewError.value = '暂时无法读取任务，请重试。'
    }
  } finally {
    if (request === current) viewing.value = false
  }
}
function resume(id: string) {
  if (props.busy || viewing.value || !readyToStart.value) return
  open.value = false
  emit('resume', id)
}
</script>
<template>
  <AppConfirmDialog
    v-model:open="open"
    :title="intent.title"
    :description="`「${projectName}」${intent.description}`"
    :confirm-label="intent.label"
    :disabled="!readyToStart || busy || viewing"
    :error="error || viewError"
    @confirm="confirm"
  >
    <p v-if="loading" class="confirm-context" role="status">正在核对当前范围的任务与候选…</p>
    <section v-if="!loading && currentTask" class="curation-confirm-guidance">
      <h3>当前范围的已接受任务</h3>
      <p>
        任务 {{ currentTask.id.slice(0, 8) }} ·
        {{ currentTask.candidate_id ? '已有候选成果可查看' : '尚未生成候选' }}
      </p>
      <button
        v-if="!intent.observe"
        type="button"
        class="curation-confirm-retry"
        :disabled="viewing || busy"
        @click="viewProgress"
      >
        查看当前任务
      </button>
      <button
        v-if="currentTask.state === 'needs_attention' && !currentTask.candidate_id"
        type="button"
        class="curation-confirm-retry"
        :disabled="busy || viewing"
        @click="submit"
      >
        修复后重新提交
      </button>
    </section>
    <section v-if="!loading && suggested.length" class="curation-confirm-guidance">
      <h3>保留的候选结果</h3>
      <p>旧轮结果会保留。可查看成果；没有同范围活动任务占用时，也可明确选择续跑原候选。</p>
      <RouterLink
        v-for="item in suggested"
        :key="item.id"
        :to="{
          name: 'curation-review',
          params: { projectId, candidateId: item.id },
          query: environmentId ? { env: environmentId } : {},
        }"
        class="curation-confirm-result"
        @click="open = false"
      >
        <div>
          <strong>查看候选结果</strong
          ><small
            >{{ formatTime(item.created_at) }} · {{ item.target ? '单接口整理' : '项目整体整理' }} ·
            {{ candidateStateLabels[item.state] }}</small
          >
        </div>
        <AppIcon name="arrow-right" :size="15" />
      </RouterLink>
      <div class="curation-confirm-resume-actions">
        <button
          v-for="item in shownResumable"
          :key="'resume-' + item.id"
          type="button"
          class="curation-confirm-retry"
          :disabled="busy"
          @click="resume(item.id)"
          title="沿用该轮冻结资料和已生成内容，只补齐缺口"
        >
          续跑本轮 · {{ formatTime(item.created_at) }}
        </button>
      </div>
    </section>
    <button v-if="error" type="button" class="curation-confirm-retry" @click="load">
      重新读取
    </button>
  </AppConfirmDialog>
</template>
