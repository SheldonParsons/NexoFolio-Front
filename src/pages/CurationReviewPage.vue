<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { resumeCandidate } from '@/contracts/knowledge/source'
import { useAuthStore } from '@/stores/auth'
import { useActiveProject } from '@/features/projects/useActiveProject'
import AppIcon from '@/components/icons/AppIcon.vue'
import { useCurationReview } from '@/features/curation/useCurationReview'
import { sectionLabels, type ChangeSection } from '@/features/curation/changes'
import { candidateStateLabels } from '@/features/curation/types'
import {
  canReviewDecision,
  type ReviewDecision,
  type ReviewDecisionTarget,
} from '@/features/curation/reviewActions'
import CurationDecisionDialog from '@/features/curation/CurationDecisionDialog.vue'
import CurationChangeDetail from '@/features/curation/CurationChangeDetail.vue'
import CurationDeltaMark from '@/features/curation/CurationDeltaMark.vue'
import CandidateDocument from '@/features/curation/CandidateDocument.vue'
import CurationReviewFilters from '@/features/curation/CurationReviewFilters.vue'
import CurationRunPicker from '@/features/curation/CurationRunPicker.vue'
import CurationOperations from '@/features/curation/CurationOperations.vue'
import CurationBreadcrumbs from '@/features/curation/CurationBreadcrumbs.vue'
import CurationHistory from '@/features/curation/CurationHistory.vue'
import CurationReviewProgress from '@/features/curation/CurationReviewProgress.vue'
import CurationReviewToolbar from '@/features/curation/CurationReviewToolbar.vue'
import CurationReviewSummary from '@/features/curation/CurationReviewSummary.vue'
import CurationReviewMenu from '@/features/curation/CurationReviewMenu.vue'
import CurationReviewIssues from '@/features/curation/CurationReviewIssues.vue'
import { formatTime } from '@/features/documents/presentation'
import '@/features/documents/documents.css'
import '@/features/documents/document-navigation.css'
import '@/features/curation/review.css'
import '@/features/curation/candidate-tree.css'
const router = useRouter()
const resuming = ref(false)
const progressOpen = ref(false)
async function fillGaps() {
  if (
    !candidate.value ||
    resuming.value ||
    deciding.value ||
    !candidate.value.execution_input ||
    !['partial', 'interrupted'].includes(candidate.value.state)
  )
    return
  resuming.value = true
  try {
    await resumeCandidate(pid(), candidate.value.id)
    await router.push(documentTo.value)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '无法恢复本轮'
  } finally {
    resuming.value = false
  }
}
const route = useRoute(),
  auth = useAuthStore()
const activeProject = useActiveProject()
const pid = () => String(route.params.projectId)
const cid = () => (typeof route.params.candidateId === 'string' ? route.params.candidateId : '')
const decisionOpen = ref(false),
  decisionError = ref('')
const decision = shallowRef<{ action: ReviewDecision; candidate: ReviewDecisionTarget } | null>(
  null,
)
const {
  project,
  index,
  list,
  candidate,
  changes,
  loading,
  deciding,
  error,
  projectError,
  indexLoading,
  indexError,
  load,
  decide,
} = useCurationReview(pid, cid, () => {
  decisionOpen.value = false
  auth.requestLogin(route.fullPath, '登录已过期，请重新登录')
})
watch(
  [project, () => route.query.env],
  ([value, environment]) => {
    if (value?.project_id === pid())
      activeProject.remember(value, typeof environment === 'string' ? environment : undefined)
  },
  { immediate: true },
)
const lifecycleStale = computed(
  () =>
    !!candidate.value &&
    !!index.value?.lifecycle &&
    (candidate.value.base.lifecycle?.version ?? 0) !== index.value.lifecycle.version,
)
const tab = ref<'changes' | 'document' | 'issues'>('document')
type ReviewSection = Exclude<ChangeSection, 'placements' | 'folders'>
const section = ref<ReviewSection>('notes')
const summarySections: { kind: ChangeSection; label: string; description: string }[] = [
  { kind: 'folders', label: '目录', description: '目录结构变化' },
  { kind: 'notes', label: '接口', description: '接口变化' },
  { kind: 'fields', label: '字段', description: '字段变化' },
  { kind: 'links', label: '关系', description: '接口关系变化' },
]
const selectedId = ref(''),
  page = ref(1)
const filtered = computed(() => changes.value.filter((c) => c.section === section.value))
const displayed = computed(() => filtered.value.slice(0, page.value * 60))
const selected = computed(
  () => filtered.value.find((c) => c.id === selectedId.value) || filtered.value[0],
)
const decisionValid = computed(
  () =>
    !!decision.value &&
    candidate.value?.id === decision.value.candidate.id &&
    candidate.value.project_id === decision.value.candidate.project_id &&
    candidate.value.project_id === pid() &&
    canReviewDecision(candidate.value.state, decision.value.action) &&
    (decision.value.action !== 'apply' || !lifecycleStale.value),
)
function askDecision(action: ReviewDecision) {
  if (
    !candidate.value ||
    deciding.value ||
    (action === 'apply' && lifecycleStale.value) ||
    !canReviewDecision(candidate.value.state, action)
  )
    return
  const value = candidate.value
  decision.value = {
    action,
    candidate: {
      id: value.id,
      project_id: value.project_id,
      state: value.state,
      created_at: value.created_at,
    },
  }
  decisionError.value = ''
  decisionOpen.value = true
}
async function confirmDecision() {
  const request = decision.value
  if (!request || !decisionValid.value || deciding.value) return
  const accepted = await decide(request.action, request.candidate.id)
  if (decision.value !== request) return
  if (accepted) decisionOpen.value = false
  else decisionError.value = error.value || '本轮状态已有变化，请重新读取整理结果。'
}
watch([pid, cid], () => {
  progressOpen.value = false
  decisionOpen.value = false
  decision.value = null
})
watch([decisionValid, deciding], ([valid, pending]) => {
  if (decisionOpen.value && !valid && !pending)
    decisionError.value = '本轮状态已改变，请取消后重新查看整理结果。'
})
const documentTo = computed(() => ({
  name: 'project-interfaces',
  params: { projectId: pid() },
  query: route.query.env ? { env: route.query.env } : {},
}))
const issues = computed(() => candidate.value?.progress.issues ?? [])
function selectSection(kind: ReviewSection) {
  section.value = kind
  page.value = 1
}
const count = (kind: ChangeSection) => changes.value.filter((c) => c.section === kind).length
const summary = computed(() =>
  summarySections.map((item) => ({ ...item, count: count(item.kind) })),
)
</script>
<template>
  <section class="curation-review">
    <header class="curation-review-heading">
      <RouterLink :to="documentTo" class="document-project-return" aria-label="返回现行文档"
        ><AppIcon name="arrow-left" :size="18"
      /></RouterLink>
      <div class="curation-review-project">
        <div class="curation-review-project-title">
          <CurationBreadcrumbs
            :project-id="pid()"
            :name="project?.name || '当前项目'"
            :candidate-id="cid()"
            :environment-id="typeof route.query.env === 'string' ? route.query.env : ''"
          />
          <CurationRunPicker
            v-if="candidate"
            :candidate="candidate"
            :runs="list"
            :disabled="deciding"
          />
          <CurationOperations
            v-if="candidate"
            :project-id="pid()"
            :candidate-id="candidate.id"
            :revision="candidate.operations?.at(-1)?.id ?? candidate.state"
            @unauthorized="auth.requestLogin(route.fullPath, '登录已过期，请重新登录')"
          />
        </div>
        <div class="curation-review-meta">
          <p>
            <span v-if="candidate"
              >候选文档：{{ candidate.view.endpoints.length }} 个接口 ·
              {{ candidate.view.folders.length }} 个目录 ·
            </span>
            {{
              candidate
                ? formatTime(candidate.created_at)
                : '每轮生成的知识都保留在这里，由你决定是否应用。'
            }}
          </p>
          <CurationReviewSummary v-if="candidate" :items="summary" />
        </div>
      </div>
      <span v-if="candidate" class="curation-state-tag" :data-state="candidate.state">{{
        candidateStateLabels[candidate.state]
      }}</span>
      <p v-if="lifecycleStale" class="lifecycle-project-notice" role="status">
        废弃状态已变化：本轮基于旧版本，成果保留，不能应用或续跑。请开始新一轮整理。
      </p>
      <CurationReviewMenu
        :lifecycle-stale="lifecycleStale"
        v-if="candidate"
        :candidate="candidate"
        :official-to="documentTo"
        :pending="deciding"
        :resuming="resuming"
        :progress-open="progressOpen"
        @resume="fillGaps"
        @progress="progressOpen = !progressOpen"
        @apply="askDecision('apply')"
        @discard="askDecision('discard')"
      />
    </header>
    <p v-if="error || projectError" class="curation-review-error" role="alert">
      {{ error || projectError }} <button type="button" @click="load">重新读取</button>
    </p>
    <div v-if="loading && !candidate" class="curation-placeholder" role="status">
      正在读取整理结果…
    </div>
    <CurationHistory v-else-if="!cid()" :project-id="pid()" :runs="list" :error="error" />
    <template v-else-if="candidate">
      <CandidateDocument
        :candidate="candidate"
        :index="index"
        :changes="changes"
        :index-loading="indexLoading"
        :index-error="indexError"
      >
        <template #navigation>
          <CurationReviewToolbar v-model="tab" :issues="issues.length" />
        </template>
        <template v-if="tab !== 'document'" #tree>
          <div v-if="tab === 'issues'" class="candidate-tree-heading">
            <strong>本轮处理情况</strong><span>{{ issues.length }} 项</span>
          </div>
          <template v-else>
            <CurationReviewFilters
              :model-value="section"
              :changes="changes"
              :relations="candidate.view.links.length"
              @update:model-value="selectSection"
            />
            <div class="curation-change-list" data-scroll-container>
              <button
                v-for="change in displayed"
                :key="change.id"
                type="button"
                :aria-pressed="selected?.id === change.id"
                @click="selectedId = change.id"
              >
                <CurationDeltaMark :kind="change.status" /><span
                  ><strong>{{ change.title }}</strong
                  ><small>{{ change.subtitle || sectionLabels[change.section] }}</small></span
                >
              </button>
              <button
                v-if="displayed.length < filtered.length"
                type="button"
                class="curation-load-more"
                @click="page++"
              >
                继续显示 {{ filtered.length - displayed.length }} 项变化
              </button>
            </div>
          </template>
        </template>
        <template v-if="tab !== 'document'" #content>
          <CurationReviewIssues
            v-if="tab === 'issues'"
            :candidate="candidate"
            :index="index"
            :busy="resuming || deciding"
            @document="tab = 'document'"
            @progress="progressOpen = true"
            @resume="fillGaps"
          />
          <section v-else class="curation-review-scroll" data-scroll-container>
            <CurationChangeDetail v-if="selected" :change="selected" :candidate="candidate" />
            <div v-else class="curation-placeholder">
              <template v-if="section === 'links' && !count('links')">
                <h2>本轮接口关系没有变化</h2>
                <p>
                  候选文档中共有 {{ candidate.view.links.length }} 条关系，本轮未新增、修改或删除。
                </p>
              </template>
              <template v-else>
                <h2>
                  {{ candidate.state === 'running' ? '等待本轮生成内容' : '没有匹配的内容变化' }}
                </h2>
                <p>新证据带来新知识；没有相关变化时，已有内容会被复用。</p>
              </template>
            </div>
          </section>
        </template>
      </CandidateDocument>
    </template>
    <CurationReviewProgress
      v-if="progressOpen && candidate"
      :key="candidate.id"
      :candidate="candidate"
      :page-key="route.fullPath"
      :environment-id="typeof route.query.env === 'string' ? route.query.env : ''"
      @close="progressOpen = false"
      @unauthorized="auth.requestLogin(route.fullPath, '登录已过期，请重新登录')"
    />
    <CurationDecisionDialog
      v-model:open="decisionOpen"
      :action="decision?.action ?? 'apply'"
      :candidate="decision?.candidate ?? null"
      :project-name="project?.name ?? '当前项目'"
      :pending="deciding"
      :disabled="!decisionValid"
      :error="decisionError"
      @confirm="confirmDecision"
    />
  </section>
</template>
