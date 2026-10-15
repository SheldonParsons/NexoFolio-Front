<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref } from 'vue'
import { ApiError } from '@/api'
import { useAuthStore } from '@/stores/auth'
import AppSearchSelect from '@/components/ui/AppSearchSelect.vue'
import { listManagementProjects, type ManagementProject } from '@/features/management/projects'
const props = withDefaults(defineProps<{ required?: boolean; disabled?: boolean }>(), {
  required: false,
})
const auth = useAuthStore()
const project = defineModel<string>({ required: true })
const model = computed({
  get: () => project.value || 'all',
  set: (value: string) => {
    project.value = value === 'all' ? '' : value
  },
})
const search = ref(''),
  items = ref<ManagementProject[]>([]),
  total = ref(0),
  loading = ref(false),
  error = ref(''),
  known = ref<Record<string, string>>({})
const options = computed(() => [
  ...(!props.required && !search.value.trim() ? [{ value: 'all', label: '全部项目' }] : []),
  ...items.value.map((item) => ({ value: item.project_id, label: item.name })),
])
const selectedLabel = computed(() =>
  project.value ? known.value[project.value] || '已选项目' : props.required ? '' : '全部项目',
)
let controller: AbortController | undefined, timer: ReturnType<typeof setTimeout> | undefined
async function load() {
  controller?.abort()
  const request = (controller = new AbortController())
  loading.value = true
  error.value = ''
  items.value = []
  try {
    const data = await listManagementProjects(
      { page: 1, limit: 20, q: search.value },
      request.signal,
    )
    if (request.signal.aborted) return
    items.value = data.items
    total.value = data.total
    for (const item of data.items) known.value[item.project_id] = item.name
  } catch (cause) {
    if (
      !request.signal.aborted &&
      cause instanceof ApiError &&
      [401, 403, 404].includes(cause.status ?? 0)
    )
      auth.revokeManagement()
    if (!request.signal.aborted) error.value = '项目读取失败，请重试。'
  } finally {
    if (!request.signal.aborted) loading.value = false
  }
}
function query(value: string) {
  if (search.value === value) return
  search.value = value
  controller?.abort()
  clearTimeout(timer)
  loading.value = true
  timer = setTimeout(() => void load(), 200)
}
onMounted(load)
onScopeDispose(() => {
  clearTimeout(timer)
  controller?.abort()
})
</script>
<template>
  <div class="audit-project-picker">
    <span class="audit-label">项目</span
    ><AppSearchSelect
      v-model="model"
      :disabled="disabled"
      label="项目"
      placeholder="按项目名称查找"
      :options="options"
      :selected-label="selectedLabel"
      :loading="loading"
      :error="error"
      :empty-message="search.trim() ? '没有匹配的项目，试试其他名称。' : '暂无可选择的项目。'"
      :hint="
        total > 20 && !loading && !error
          ? `显示 ${items.length} / ${total} 个匹配项目，输入名称可搜索全部项目。`
          : ''
      "
      @search="query"
      @retry="load"
    />
  </div>
</template>
<style scoped>
.audit-project-picker {
  display: grid;
  gap: 7px;
  min-width: 0;
}
</style>
