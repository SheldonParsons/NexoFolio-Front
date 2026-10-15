<script setup lang="ts">
import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
} from 'reka-ui'
import AppIcon from '@/components/icons/AppIcon.vue'
import { ApiError } from '@/api'
import { activeCurationTasks, curateProgress } from '@/contracts/knowledge/source'
import type { CurateProgress, CurationTaskSummary } from '@/contracts/knowledge/types'
import { formatTime } from '@/features/documents/presentation'
import './run-picker.css'
const props = defineProps<{
  projectId: string
  selectedId?: string | null
  selectedTarget?: string | null
  endpointLabels?: Record<string, string>
}>()
const emit = defineEmits<{ select: [job: CurateProgress]; unauthorized: [] }>()
const open = ref(false),
  loading = ref(false),
  error = ref('')
const tasks = shallowRef<CurationTaskSummary[]>([])
let request: AbortController | undefined, selection: AbortController | undefined
function report(cause: unknown) {
  if (cause instanceof ApiError && cause.status === 401) emit('unauthorized')
  else error.value = '暂时无法读取活动任务，请重试。'
}
async function load() {
  request?.abort()
  const current = new AbortController(),
    pid = props.projectId
  request = current
  loading.value = true
  error.value = ''
  try {
    const rows = await activeCurationTasks(pid, current.signal)
    if (request === current && !current.signal.aborted && props.projectId === pid)
      tasks.value = rows.filter((t) => t.project_id === pid)
  } catch (cause) {
    if (request === current && !current.signal.aborted) report(cause)
  } finally {
    if (request === current) loading.value = false
  }
}
function opened(value: boolean) {
  open.value = value
  if (value) void load()
  else request?.abort()
}
async function select(task: CurationTaskSummary) {
  selection?.abort()
  const current = new AbortController(),
    pid = props.projectId
  selection = current
  error.value = ''
  try {
    const job = await curateProgress(pid, current.signal, `task:${task.id}`)
    if (selection === current && !current.signal.aborted && props.projectId === pid) {
      emit('select', job)
      open.value = false
    }
  } catch (cause) {
    if (selection === current && !current.signal.aborted) report(cause)
  }
}
function reset() {
  request?.abort()
  selection?.abort()
  tasks.value = []
  error.value = ''
  open.value = false
}
watch(() => props.projectId, reset)
onScopeDispose(reset)
</script>
<template>
  <DropdownMenuRoot :open="open" @update:open="opened">
    <DropdownMenuTrigger class="curation-run-trigger" aria-label="切换活动任务"
      >{{
        selectedTarget === undefined
          ? '活动任务'
          : selectedTarget
            ? endpointLabels?.[selectedTarget] || '单接口整理'
            : '项目整体整理'
      }}<AppIcon name="chevron-down" :size="12"
    /></DropdownMenuTrigger>
    <DropdownMenuPortal
      ><DropdownMenuContent
        class="curation-run-menu"
        align="end"
        :side-offset="7"
        :collision-padding="12"
      >
        <p class="curation-run-caption">
          {{ loading ? '正在读取活动任务…' : '选择要查看和停止的任务' }}
        </p>
        <p v-if="error" class="curation-run-caption" role="alert">
          {{ error }} <button type="button" @click="load">重试</button>
        </p>
        <p v-else-if="!loading && !tasks.length" class="curation-run-caption">当前没有活动任务</p>
        <DropdownMenuItem v-for="task in tasks" :key="task.id" as-child @select.prevent>
          <button
            type="button"
            class="curation-run-item curation-task-option"
            :aria-current="task.id === selectedId ? 'true' : undefined"
            @click="select(task)"
          >
            <span
              ><strong>{{
                task.target ? endpointLabels?.[task.target] || '单接口整理' : '项目整体整理'
              }}</strong
              ><small
                >{{
                  {
                    queued: '排队中',
                    running: '执行中',
                    waiting: '等待恢复',
                    needs_attention: '需要处理',
                    done: '已完成',
                    stopped: '已停止',
                    failed: '已中断',
                  }[task.state]
                }}
                · {{ formatTime(task.created_at) }}</small
              ></span
            >
            <AppIcon v-if="task.id === selectedId" name="check" :size="14" />
          </button>
        </DropdownMenuItem> </DropdownMenuContent
    ></DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
<style scoped>
.curation-task-option {
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
}
.curation-task-option[aria-current='true'] {
  background: var(--surface-muted);
}
.curation-task-option span {
  min-width: 0;
}
.curation-task-option strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
