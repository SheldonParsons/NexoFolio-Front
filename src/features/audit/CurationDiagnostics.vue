<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue'
import { ApiError } from '@/api'
import { useAuthStore } from '@/stores/auth'
import AppButton from '@/components/ui/AppButton.vue'
import AuditProjectFilter from './AuditProjectFilter.vue'
import DiagnosticDetail from './DiagnosticDetail.vue'
import {
  loadCurationList,
  loadDiagnostic,
  statusLabels,
  type DiagnosticSummary,
  type DiagnosticPackage,
} from './diagnostics'
import { auditTime } from './analysis'
const auth = useAuthStore(),
  project = ref(''),
  rows = ref<DiagnosticSummary[]>([]),
  selected = ref(''),
  data = ref<DiagnosticPackage | null>(null),
  busy = ref(false),
  loading = ref(false),
  error = ref(''),
  detailError = ref(''),
  exactId = ref('')
let listController: AbortController | undefined, detailController: AbortController | undefined
function fail(e: unknown) {
  if (e instanceof ApiError && [401, 403].includes(e.status || 0)) auth.revokeManagement()
  return e instanceof Error ? e.message : '整理诊断暂不可用'
}
async function load() {
  listController?.abort()
  detailController?.abort()
  rows.value = []
  data.value = null
  selected.value = ''
  error.value = ''
  if (!project.value) return
  const request = (listController = new AbortController())
  busy.value = true
  try {
    const result = await loadCurationList(project.value, request.signal)
    if (!request.signal.aborted) rows.value = result.items
  } catch (e) {
    if (!request.signal.aborted) error.value = fail(e)
  } finally {
    if (!request.signal.aborted) busy.value = false
  }
}
async function choose(id: string) {
  if (!project.value) return
  detailController?.abort()
  const request = (detailController = new AbortController())
  selected.value = id
  data.value = null
  detailError.value = ''
  loading.value = true
  try {
    const result = await loadDiagnostic(project.value, id, request.signal)
    if (!request.signal.aborted) data.value = result
  } catch (e) {
    if (!request.signal.aborted) detailError.value = fail(e)
  } finally {
    if (!request.signal.aborted) loading.value = false
  }
}
watch(project, () => void load())
onScopeDispose(() => {
  listController?.abort()
  detailController?.abort()
})
</script>
<template>
  <section aria-label="整理排查">
    <div class="audit-controls diagnostic-project">
      <AuditProjectFilter v-model="project" required /><AppButton
        :disabled="!project || busy"
        @click="load"
        >刷新轮次</AppButton
      >
    </div>
    <p class="audit-note">选择项目和具体一轮整理，检查持久化状态与执行证据，再复制排查资料。</p>
    <p v-if="!project" class="audit-empty">先选择需要排查的项目。</p>
    <p v-else-if="busy" role="status" class="audit-empty">正在读取持久化整理记录…</p>
    <p v-else-if="error" role="alert" class="audit-warning">
      {{ error }} <AppButton @click="load">重试</AppButton>
    </p>
    <template v-else
      ><div class="diagnostic-workspace">
        <div class="diagnostic-rounds">
          <p class="audit-note">最近 100 轮，不代表全部历史</p>
          <button
            v-for="row in rows"
            :key="row.id"
            type="button"
            class="diagnostic-round"
            :aria-pressed="selected === row.id"
            @click="choose(row.id)"
          >
            <strong>{{ statusLabels[row.status] || row.status }}</strong
            ><time>{{ auditTime(row.created_at) }}</time
            ><span
              >{{ row.target ? '单接口整理' : '项目整理' }} · {{ row.completed ?? '—' }} /
              {{ row.total ?? '—' }}</span
            ><small>候选 {{ row.id.slice(0, 8) }}</small>
          </button>
          <p v-if="!rows.length" class="audit-note">此项目暂无保留的整理轮次。</p>
          <details class="audit-coverage">
            <summary>按候选 ID 精确读取旧轮次</summary>
            <form @submit.prevent="choose(exactId)">
              <input
                v-model="exactId"
                class="project-management-input"
                aria-label="候选 ID"
                pattern="[0-9a-fA-F-]{36}"
                maxlength="36"
                placeholder="候选 UUID"
                required
              /><AppButton type="submit" :disabled="exactId.length !== 36">读取</AppButton>
            </form>
          </details>
        </div>
        <div class="diagnostic-content">
          <p v-if="loading" role="status" class="audit-empty">正在生成脱敏排查包…</p>
          <p v-else-if="detailError" role="alert" class="audit-warning">
            {{ detailError }} <AppButton @click="choose(selected)">重试</AppButton>
          </p>
          <DiagnosticDetail v-else-if="data" :value="data" />
          <p v-else class="audit-empty">选择一轮整理查看诊断。</p>
        </div>
      </div></template
    >
  </section>
</template>
