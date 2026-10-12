<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCheckbox from '@/components/ui/AppCheckbox.vue'
import { ApiError } from '@/api'
import {
  managementError,
  projectManagement,
  type PermissionSource,
  type ManagedProject,
} from './api'
import type { Project } from '../types'
import './management.css'
const props = defineProps<{ project: Pick<Project, 'project_id' | 'name'> | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [project: ManagedProject, editing: boolean]; unavailable: [] }>()
const name = ref(''),
  selected = ref<string[]>([]),
  error = ref(''),
  filter = ref('')
const sources = ref<PermissionSource[]>([])
const loading = ref(false),
  submitting = ref(false),
  loaded = ref(false),
  conflict = ref(false)
const revision = ref(0)
let controller: AbortController | undefined
const editing = computed(() => !!props.project)
const options = computed(() => {
  const names = new Map<string, number>()
  for (const item of sources.value) names.set(item.name, (names.get(item.name) || 0) + 1)
  return sources.value
    .map((item) => ({
      ...item,
      label:
        (names.get(item.name) || 0) > 1
          ? `${item.name} · ${item.project_id.slice(0, 8)}`
          : item.name,
    }))
    .filter((item) =>
      item.label.toLocaleLowerCase().includes(filter.value.trim().toLocaleLowerCase()),
    )
})
const ready = computed(
  () =>
    !!name.value.trim() &&
    [...name.value.trim()].length <= 100 &&
    selected.value.length > 0 &&
    selected.value.length <= 100 &&
    selected.value.every((id) => sources.value.some((item) => item.project_id === id)) &&
    loaded.value &&
    !loading.value &&
    !submitting.value &&
    !conflict.value,
)
function toggleSource(id: string, value: boolean) {
  selected.value = value ? [...selected.value, id] : selected.value.filter((item) => item !== id)
}
async function load() {
  controller?.abort()
  const request = (controller = new AbortController())
  loading.value = true
  loaded.value = false
  error.value = ''
  try {
    const [available, project] = await Promise.all([
      projectManagement.sources(request.signal),
      props.project
        ? projectManagement.get(props.project.project_id, request.signal)
        : Promise.resolve(null),
    ])
    if (request.signal.aborted) return
    sources.value = available
    if (project) {
      name.value = project.name
      selected.value = project.permission_sources.map((item) => item.project_id)
      revision.value = project.revision
    }
    conflict.value = false
    loaded.value = true
  } catch (cause) {
    if (!request.signal.aborted) {
      error.value = managementError(cause)
      if (cause instanceof ApiError && cause.status === 404) emit('unavailable')
    }
  } finally {
    if (!request.signal.aborted) loading.value = false
  }
}
watch([open, () => props.project?.project_id], ([value]) => {
  controller?.abort()
  if (value) {
    name.value = ''
    selected.value = []
    sources.value = []
    filter.value = ''
    revision.value = 0
    conflict.value = false
    submitting.value = false
    void load()
  }
})
async function submit() {
  if (!ready.value) return
  const request = (controller = new AbortController())
  const wasEditing = editing.value
  submitting.value = true
  error.value = ''
  try {
    const project = props.project
      ? await projectManagement.edit(
          props.project.project_id,
          name.value.trim(),
          selected.value,
          revision.value,
          request.signal,
        )
      : await projectManagement.create(name.value.trim(), selected.value, request.signal)
    if (!request.signal.aborted) {
      emit('saved', project, wasEditing)
      open.value = false
    }
  } catch (cause) {
    if (!request.signal.aborted) {
      error.value = managementError(cause, wasEditing ? 'edit' : 'create')
      conflict.value = wasEditing && cause instanceof ApiError && cause.status === 409
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
    placement="right"
    :title="editing ? '编辑项目' : '创建项目'"
    :description="
      editing
        ? '修改名称与操作权限来源，保留项目内的资料和配置。'
        : '按实际业务独立管理接口，操作权限沿用绑定的禅道项目。'
    "
    :dismissible="!submitting"
  >
    <form
      class="project-management-form"
      :aria-busy="loading || submitting"
      @submit.prevent="submit"
    >
      <label for="managed-project-name">项目名称</label>
      <input
        id="managed-project-name"
        v-model="name"
        class="project-management-input"
        placeholder="例如：巴西售后"
        maxlength="100"
        autocomplete="off"
        :disabled="loading || submitting"
        required
      />
      <fieldset class="project-source-fieldset" :disabled="loading || submitting">
        <legend>
          绑定禅道项目 <span>已选 {{ selected.length }} 个</span>
        </legend>
        <input
          v-if="sources.length > 8"
          v-model="filter"
          class="project-management-input"
          type="search"
          aria-label="查找禅道项目"
          placeholder="按项目名称查找"
        />
        <div class="project-source-list" :aria-busy="loading">
          <div
            v-for="item in options"
            :key="item.project_id"
            class="project-source-option"
            :class="{ 'is-selected': selected.includes(item.project_id) }"
          >
            <AppCheckbox
              :model-value="selected.includes(item.project_id)"
              :label="item.label"
              :disabled="
                loading ||
                submitting ||
                (selected.length >= 100 && !selected.includes(item.project_id))
              "
              @update:model-value="(value) => toggleSource(item.project_id, value)"
            />
          </div>
          <p v-if="loading" class="project-management-help">正在加载禅道项目…</p>
          <p v-else-if="!options.length" class="project-management-help">
            {{
              sources.length
                ? '没有匹配的禅道项目。'
                : '暂无可绑定的禅道项目，请先通过普通禅道登录完成项目同步。'
            }}
          </p>
        </div>
      </fieldset>
      <p class="project-management-help">
        拥有任意一个绑定项目的禅道权限，即可操作本项目。接口资料和环境独立保存。
      </p>
      <p v-if="editing" class="project-management-help">
        变更绑定后，网页操作权限与 MCP 可访问范围会随之更新。
      </p>
      <p v-if="error" class="project-management-error" role="alert">{{ error }}</p>
      <div class="project-management-actions">
        <AppButton
          v-if="error && (!loaded || conflict)"
          :disabled="loading || submitting"
          @click="load"
          >{{ conflict ? '重新加载项目' : '重新加载' }}</AppButton
        >
        <AppButton :disabled="submitting" @click="open = false">取消</AppButton>
        <AppButton type="submit" variant="primary" :disabled="!ready">{{
          submitting ? (editing ? '正在保存…' : '正在创建…') : editing ? '保存修改' : '创建项目'
        }}</AppButton>
      </div>
    </form>
  </AppDialog>
</template>
