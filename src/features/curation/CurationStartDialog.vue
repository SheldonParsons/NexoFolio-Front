<script setup lang="ts">
import { computed } from 'vue'
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
}>()
const emit = defineEmits<{ confirm: []; unauthorized: []; resume: [id: string]; progress: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { awaiting, running, loading, error, readyToStart, load } = usePendingCuration(
  () => open.value,
  () => props.projectId,
  () => {
    open.value = false
    emit('unauthorized')
  },
)
const suggested = computed(() => (running.value ? [running.value] : awaiting.value.slice(0, 3)))
function confirm() {
  if (!readyToStart.value || props.busy) return
  open.value = false
  emit('confirm')
}
function viewProgress() {
  open.value = false
  emit('progress')
}
function resume(id: string) {
  if (props.busy) return
  open.value = false
  emit('resume', id)
}
</script>
<template>
  <AppConfirmDialog
    v-model:open="open"
    title="开始新一轮整理？"
    :description="
      '根据「' +
      projectName +
      '」最新采集资料和正式文档生成新候选，不继承未应用的候选结果。完成后仍由你审阅并决定是否应用。'
    "
    :confirm-label="running ? '整理进行中' : '开始新一轮整理'"
    :disabled="!readyToStart || busy"
    :error="error"
    @confirm="confirm"
  >
    <p v-if="loading" class="confirm-context" role="status">正在查找待审阅的整理结果…</p>
    <section v-else-if="suggested.length" class="curation-confirm-guidance">
      <h3>{{ running ? '项目正在整理' : '有待审阅的整理结果' }}</h3>
      <p>
        {{
          running
            ? '可以先查看已生成内容，当前任务结束后再开始新一轮。'
            : '旧轮结果会保留。选择续跑会沿用该轮资料和已生成内容；开始新一轮则独立整理。'
        }}
      </p>
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
          <strong>{{ running ? '查看已生成内容' : '查看待审阅结果' }}</strong
          ><small
            >{{ formatTime(item.created_at) }} · {{ item.target ? '单接口整理' : '项目整体整理' }} ·
            {{ candidateStateLabels[item.state] }}</small
          >
        </div>
        <AppIcon name="arrow-right" :size="15" />
      </RouterLink>
      <button v-if="running" type="button" class="curation-confirm-retry" @click="viewProgress">
        查看本轮进度
      </button>
      <button
        v-for="item in suggested.filter(
          (i) =>
            (i.state === 'partial' || i.state === 'interrupted') &&
            i.progress.resume_available !== false,
        )"
        :key="'resume-' + item.id"
        type="button"
        class="curation-confirm-retry"
        :disabled="busy"
        @click="resume(item.id)"
        title="沿用该轮冻结资料和已生成内容，只补齐缺口"
      >
        续跑本轮 · {{ formatTime(item.created_at) }}
      </button>
    </section>
    <button v-if="error" type="button" class="curation-confirm-retry" @click="load">
      重新读取
    </button>
  </AppConfirmDialog>
</template>
