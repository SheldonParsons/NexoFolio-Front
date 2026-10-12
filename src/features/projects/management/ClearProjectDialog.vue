<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { ApiError } from '@/api'
import type { Project } from '../types'
import { managementError, projectManagement, type ContentCounts } from './api'
import './management.css'
const props = defineProps<{ project: Pick<Project, 'project_id' | 'name'> | null }>()
const emit = defineEmits<{
  close: []
  cleared: [project: Pick<Project, 'project_id' | 'name'>]
  unavailable: []
}>()
const submitting = ref(false),
  loading = ref(false)
const counts = ref<ContentCounts | null>(null)
const confirmation = ref(''),
  error = ref('')
const open = computed({
  get: () => !!props.project,
  set: (value) => {
    if (!value && !submitting.value) emit('close')
  },
})
const ready = computed(
  () =>
    !!props.project &&
    !!counts.value &&
    counts.value.running_curations === 0 &&
    confirmation.value === props.project.name &&
    !loading.value &&
    !submitting.value,
)
let controller: AbortController | undefined
async function load() {
  const project = props.project
  if (!project || submitting.value) return
  controller?.abort()
  const request = (controller = new AbortController())
  loading.value = true
  counts.value = null
  error.value = ''
  try {
    const data = await projectManagement.contents(project.project_id, request.signal)
    if (!request.signal.aborted) counts.value = data
  } catch (cause) {
    if (!request.signal.aborted) {
      error.value = managementError(cause)
      if (cause instanceof ApiError && cause.status === 404) emit('unavailable')
    }
  } finally {
    if (!request.signal.aborted) loading.value = false
  }
}
watch(
  () => props.project,
  (project) => {
    controller?.abort()
    confirmation.value = ''
    error.value = ''
    counts.value = null
    submitting.value = false
    if (project) void load()
  },
)
async function submit() {
  if (!ready.value || !props.project) return
  const project = props.project,
    request = (controller = new AbortController())
  submitting.value = true
  error.value = ''
  try {
    await projectManagement.clear(project.project_id, confirmation.value, request.signal)
    if (!request.signal.aborted) {
      emit('cleared', project)
      emit('close')
    }
  } catch (cause) {
    if (!request.signal.aborted) {
      error.value = managementError(cause)
      if (cause instanceof ApiError && cause.status === 404) emit('unavailable')
    }
  } finally {
    if (!request.signal.aborted) submitting.value = false
  }
}
onBeforeUnmount(() => controller?.abort())
</script>
<template>
  <AppDialog
    v-model:open="open"
    title="清空项目内容"
    :description="project?.name || '项目内容'"
    :dismissible="!submitting"
  >
    <form
      class="project-management-form"
      :aria-busy="loading || submitting"
      @submit.prevent="submit"
    >
      <p class="project-management-scope">
        清空所有环境的接口、原始请求响应、字段、目录、说明、关联和全部整理结果。项目、环境、站点绑定和权限配置保留。
      </p>
      <div v-if="counts" class="project-management-counts">
        <span
          ><strong>{{ counts.interfaces }}</strong> 个接口</span
        ><span
          ><strong>{{ counts.folders }}</strong> 个目录</span
        ><span
          ><strong>{{ counts.curation_results }}</strong> 轮整理结果</span
        >
      </div>
      <p v-else-if="loading" class="project-management-help" role="status">正在核对项目内容…</p>
      <p class="project-management-help">
        请先暂停 Fetcher 采集。清空不可撤销；后续新采集仍会产生接口。
      </p>
      <p
        v-if="counts && counts.running_curations > 0"
        class="project-management-error"
        role="alert"
      >
        本项目有正在运行的整理，请先停止整理，再刷新内容数量。
      </p>
      <label for="clear-project-confirmation">输入“{{ project?.name }}”确认清空</label>
      <input
        id="clear-project-confirmation"
        v-model="confirmation"
        class="project-management-input"
        :placeholder="project?.name"
        autocomplete="off"
        :disabled="submitting"
      />
      <p v-if="error" class="project-management-error" role="alert">{{ error }}</p>
      <div class="project-management-actions">
        <AppButton variant="ghost" :disabled="loading || submitting" @click="load"
          >刷新数量</AppButton
        ><AppButton :disabled="submitting" @click="open = false">取消</AppButton
        ><AppButton type="submit" variant="primary" :disabled="!ready">{{
          submitting ? '正在清空…' : '确认清空项目内容'
        }}</AppButton>
      </div>
    </form>
  </AppDialog>
</template>
