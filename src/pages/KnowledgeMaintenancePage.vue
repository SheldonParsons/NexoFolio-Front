<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/icons/AppIcon.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import DocumentPager from '@/features/documents/DocumentPager.vue'
import { formatTime, shortId } from '@/features/documents/presentation'
import TaskProgressPanel from '@/features/maintenance/TaskProgressPanel.vue'
import CheckpointPanel from '@/features/maintenance/CheckpointPanel.vue'
import CandidateChangesPanel from '@/features/maintenance/CandidateChangesPanel.vue'
import EvidenceViewer from '@/features/maintenance/EvidenceViewer.vue'
import RebuildControl from '@/features/maintenance/RebuildControl.vue'
import KnowledgeChange from '@/features/maintenance/KnowledgeChange.vue'
import KnowledgeHistory from '@/features/maintenance/KnowledgeHistory.vue'
import { useMaintenancePage } from '@/features/maintenance/useMaintenancePage'
import { candidateChanges, taskProgress } from '@/features/maintenance/mapping'
import { createRebuildStore } from '@/features/maintenance/rebuildStore'
import { rebuildPort, maintenanceSource } from '@/features/maintenance/source'
import { maintenanceEvidenceReader } from '@/features/maintenance/evidenceSource'
import type { EvidenceRef } from '@/features/maintenance/models'
import type { RebuildReceipt } from '@/features/maintenance/ports'
import { useAuthStore } from '@/stores/auth'
import { clearCredential } from '@/api/session'
import '@/features/documents/documents.css'
import '@/features/catalog-preview/catalog-preview.css'
import '@/features/catalog/catalog.css'
import '@/features/maintenance/maintenance.css'
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const projectId = computed(() => String(route.params.projectId))
let expired = false
function unauthorized() {
  if (expired) return
  expired = true
  clearCredential()
  auth.user = null
  auth.requestLogin(route.fullPath, '登录已过期，请重新登录。')
  void router.push('/')
}
const workspace = useMaintenancePage(
  () => projectId.value,
  unauthorized,
  maintenanceSource,
  () => (typeof route.query.run === 'string' ? route.query.run : undefined),
)
const { page, run, snapshot, comparison, selectedId, busy, errors } = workspace
const view = ref<'run' | 'history'>('run')
async function accepted(receipt: RebuildReceipt) {
  view.value = 'run'
  await workspace.loadList(1, receipt.taskId)
}
const evidence = ref<EvidenceRef | null>(null)
const reader = maintenanceEvidenceReader(() => ({ run: run.value, snapshot: snapshot.value }))
let storage: Storage | undefined
try {
  storage = window.sessionStorage
} catch {
  /* In-memory operation state. */
}
const store = computed(() =>
  createRebuildStore(
    `${new URL(import.meta.env.VITE_API_BASE_URL || '/api', window.location.origin).href}:${auth.user?.id}`,
    storage,
  ),
)
const progress = computed(() => (run.value ? taskProgress(run.value) : null))
const candidate = computed(() =>
  run.value?.candidate ? candidateChanges(run.value, snapshot.value, comparison.value) : null,
)
const pages = computed(() => Math.max(1, Math.ceil((page.value?.total ?? 0) / 20)))
const options = computed(() => {
  const items = page.value?.items ?? []
  const result = items.map((item) => ({
    value: item.id,
    label: `${formatTime(item.created_at)} · ${item.status} · ${shortId(item.id)}`,
  }))
  if (run.value && !items.some((item) => item.id === run.value?.id))
    result.unshift({
      value: run.value.id,
      label: `${formatTime(run.value.created_at)} · ${run.value.status}`,
    })
  return result
})
const canPublish = computed(
  () =>
    !!run.value &&
    run.value.status === 'ready' &&
    run.value.coverage.complete &&
    !!run.value.candidate?.review.structurally_valid &&
    !run.value.candidate.issues.length &&
    !run.value.currently_published &&
    (!comparison.value || comparison.value.generation === run.value.base_generation),
)
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    if (
      document.visibilityState === 'visible' &&
      view.value === 'run' &&
      run.value &&
      ['pending', 'running'].includes(run.value.status)
    )
      void workspace.loadRun(run.value.id, true)
  }, 5000)
})
watch(
  () => [projectId.value, selectedId.value],
  () => {
    evidence.value = null
  },
)
watch(projectId, () => {
  expired = false
  view.value = 'run'
})
onScopeDispose(() => clearInterval(timer))
</script>
<template>
  <section class="document-workspace">
    <header class="document-workspace-heading">
      <div class="document-project-context">
        <RouterLink
          :to="`/projects/${projectId}/catalog`"
          class="document-project-return"
          aria-label="返回接口目录"
          ><AppIcon name="arrow-left" :size="18"
        /></RouterLink>
        <div>
          <p class="document-eyebrow">项目知识维护</p>
          <h1>重构与候选审阅</h1>
        </div>
      </div>
      <RebuildControl
        :key="`${projectId}:${auth.user?.id}`"
        :project-id="projectId"
        :port="rebuildPort"
        :store="store"
        @accepted="accepted"
        @unauthorized="unauthorized"
      />
    </header>
    <div class="catalog-live-toolbar">
      <button
        type="button"
        class="maintenance-action"
        :aria-pressed="view === 'run'"
        @click="view = 'run'"
      >
        重构任务</button
      ><button
        type="button"
        class="maintenance-action"
        :aria-pressed="view === 'history'"
        @click="view = 'history'"
      >
        知识版本 / 回退</button
      ><RouterLink :to="`/projects/${projectId}/catalog-preview`" class="maintenance-action"
        >旧目录候选</RouterLink
      >
    </div>
    <div class="maintenance-page-scroll" data-scroll-container>
      <KnowledgeHistory
        v-if="view === 'history'"
        :key="projectId"
        :project-id="projectId"
        @unauthorized="unauthorized"
      />
      <template v-else
        ><div class="catalog-task-toolbar">
          <AppSelect
            :model-value="selectedId"
            :options="options"
            label="选择重构任务"
            placeholder="选择任务"
            :disabled="busy.list || !options.length"
            @update:model-value="workspace.loadRun($event)"
          /><button
            type="button"
            class="maintenance-action"
            :disabled="busy.list"
            @click="workspace.loadList(page?.page ?? 1)"
          >
            刷新任务</button
          ><DocumentPager
            v-if="page"
            :page="page.page"
            :pages="pages"
            :total="page.total"
            :loading="busy.list"
            label="重构任务分页"
            @change="workspace.loadList($event)"
          />
        </div>
        <div v-if="errors.list || errors.run" class="maintenance-panel" role="alert">
          {{ errors.list || errors.run }}
        </div>
        <p v-if="busy.run && !run" class="maintenance-panel" role="status">读取任务中…</p>
        <p v-else-if="!run && !busy.list" class="maintenance-panel">
          暂无重构任务。点击“重构”才会创建任务并启动模型维护。
        </p>
        <template v-if="run && progress"
          ><TaskProgressPanel :task="progress" @evidence="evidence = $event" />
          <CheckpointPanel
            :project-id="projectId"
            :run-id="run.id"
            @evidence="evidence = $event"
            @unauthorized="unauthorized"
          />
          <div class="maintenance-panel">
            <div class="maintenance-filters">
              <button
                type="button"
                class="maintenance-action"
                :disabled="busy.snapshot"
                @click="workspace.loadSnapshot"
              >
                读取完整快照与基线</button
              ><button
                type="button"
                class="maintenance-action"
                :disabled="busy.comparison || busy.snapshot"
                @click="workspace.loadComparison"
              >
                读取当前资料作比较</button
              ><KnowledgeChange
                :key="`${projectId}:${auth.user?.id}`"
                :project-id="projectId"
                :intent="{ kind: 'publish', task_id: run.id }"
                :base-generation="run.base_generation"
                label="统一发布目录与语义…"
                :disabled="!canPublish"
                @changed="workspace.loadRun(selectedId, true)"
                @unauthorized="unauthorized"
              />
            </div>
            <p v-if="run.currently_published">此任务是当前已生效的知识版本。</p>
            <p>
              {{
                comparison
                  ? `以下变更前来自当前资料（代次 ${comparison.generation}）`
                  : snapshot
                    ? `以下变更前来自本次快照（代次 ${snapshot.base_generation}），并非实时资料`
                    : '尚未读取比较基线，不将未知内容视为空值。'
              }}
            </p>
            <p v-if="snapshot">
              快照 {{ snapshot.id }} · 待处理观测
              {{ snapshot.pending_observations }} 条（不计作已审阅）
            </p>
            <p v-if="busy.comparison || busy.snapshot" role="status">正在读取比较资料…</p>
            <p v-if="errors.snapshot || errors.comparison" role="alert">
              {{ errors.snapshot || errors.comparison }}
            </p>
            <p v-if="comparison && comparison.generation !== run.base_generation" role="alert">
              当前知识代次已变化，此候选需要重新重构后审阅。
            </p>
          </div>
          <CandidateChangesPanel
            v-if="candidate"
            :candidate="candidate"
            @evidence="evidence = $event"
          />
          <p v-else class="maintenance-panel">候选尚未生成，现有目录与语义继续生效。</p></template
        >
      </template>
    </div>
    <EvidenceViewer
      :project-id="projectId"
      :reference="evidence"
      :reader="reader"
      @close="evidence = null"
      @navigate="evidence = $event"
      @unauthorized="unauthorized"
    />
  </section>
</template>
