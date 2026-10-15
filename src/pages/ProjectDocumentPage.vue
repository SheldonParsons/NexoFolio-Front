<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from 'reka-ui'
import AppIcon from '@/components/icons/AppIcon.vue'
import { useAuthStore } from '@/stores/auth'
import { useActiveProject } from '@/features/projects/useActiveProject'
import { clearCredential } from '@/api/session'
import { useDocumentWorkspace } from '@/features/documents/useDocumentWorkspace'
import { useDocumentNavigation } from '@/features/documents/useDocumentNavigation'
import { provideDocumentPreview } from '@/features/documents/useDocumentPreview'
import DocumentHeading from '@/features/documents/DocumentHeading.vue'
import CurationPanel from '@/features/curation/CurationPanel.vue'
import CurationStartDialog from '@/features/curation/CurationStartDialog.vue'
import DocumentFolderOverview from '@/features/documents/DocumentFolderOverview.vue'
import DocumentBreadcrumbs from '@/features/documents/DocumentBreadcrumbs.vue'
import DocumentShare from '@/features/documents/DocumentShare.vue'
import EndpointSummary from '@/features/documents/EndpointSummary.vue'
import InterfaceList from '@/features/documents/InterfaceList.vue'
import DocumentSamples from '@/features/documents/samples/DocumentSamples.vue'
import FieldStructure from '@/features/documents/FieldStructure.vue'
import { groupFields } from '@/features/knowledge/fieldPresentation'
import { formatTime } from '@/features/documents/presentation'
import { useMarqueeOverflow } from '@/features/knowledge/useMarqueeOverflow'
import { provideLifecycle } from '@/features/documents/lifecycle/context'
import LifecycleMenu from '@/features/documents/lifecycle/LifecycleMenu.vue'
import LifecyclePanel from '@/features/documents/lifecycle/LifecyclePanel.vue'
import '@/features/documents/documents.css'
import '@/features/documents/document-navigation.css'
const route = useRoute()
const emit = defineEmits<{ readOnly: [] }>()
const auth = useAuthStore()
const activeProject = useActiveProject()
const startConfirmationOpen = ref(false)
const workspace = useDocumentWorkspace(
  () => String(route.params.projectId),
  () => {
    clearCredential()
    auth.user = null
    emit('readOnly')
  },
  () => emit('readOnly'),
)
const {
  project,
  environments,
  environmentId,
  loading,
  error,
  query,
  visibleEntries,
  selectedId,
  selectedCard,
  detail,
  detailLoading,
  detailError,
  examples,
  sample,
  sampleId,
  sampleLoading,
  sampleError,
  displayedSampleId,
  comparisonIds,
  baselineId,
  samplePayloads,
  sampleErrors,
  samplesPending,
  comparisonReady,
  progress,
  busy,
  notice,
  noticeError,
  projectEndpointCount,
  folderCount,
} = workspace
watch(
  [project, environmentId],
  ([value, environment]) => {
    if (value?.project_id === String(route.params.projectId))
      activeProject.remember(value, environment)
  },
  { immediate: true },
)
const lifecycle = provideLifecycle(
  () => String(route.params.projectId),
  () => workspace.documentIndex.value,
  true,
  (state) => {
    if (workspace.documentIndex.value)
      workspace.documentIndex.value = { ...workspace.documentIndex.value, lifecycle: state }
  },
  () => emit('readOnly'),
)
const navigation = useDocumentNavigation(
  workspace,
  route,
  useRouter(),
  () => lifecycle.showRetired.value,
)
const {
  target,
  tree: sections,
  folder,
  path: folderPath,
  folderError,
  environmentError,
  activeTab,
} = navigation
const preview = provideDocumentPreview()
watch(() => route.fullPath, preview.close)
watch(workspace.documentIndex, preview.close)
const note = computed(() => detail.value?.knowledge?.note)
const endpointName = computed(
  () => note.value?.name || selectedCard.value?.name || selectedCard.value?.path || '',
)
const endpointPath = computed(() => detail.value?.facts.summary.path_template || '')
const nameElement = ref<HTMLElement>()
const nameMarquee = useMarqueeOverflow(nameElement, endpointName)
const usage = computed(() =>
  detail.value?.facts.summary.environments.find((e) => e.environment_id === environmentId.value),
)
const groups = computed(() =>
  groupFields(
    (detail.value?.facts.fields ?? []).filter(
      (field) =>
        field.location.in === 'path' ||
        field.labels.some(
          (l) => l.environment_id === environmentId.value && l.label.label !== 'absent',
        ),
    ),
  ),
)
const fieldCount = computed(() => groups.value.reduce((n, group) => n + group.fields.length, 0))
const recentObservation = computed(() => {
  const value = usage.value?.last_seen
  if (!value) return ''
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date)
    : value
})
watch([detail, () => route.query.sample], ([current, sample]) => {
  if (
    current &&
    current.facts.summary.id === selectedId.value &&
    typeof sample === 'string' &&
    sample &&
    sample !== sampleId.value
  ) {
    activeTab.value = 'examples'
    void workspace.selectExample(sample)
  }
})
function showExample(id: string) {
  activeTab.value = 'examples'
  void workspace.selectExample(id)
}
function askToOrganize() {
  if (!workspace.submitting.value && !loading.value && projectEndpointCount.value)
    startConfirmationOpen.value = true
}
watch(
  () => route.fullPath,
  () => {
    startConfirmationOpen.value = false
  },
)
function confirmationUnauthorized() {
  startConfirmationOpen.value = false
  clearCredential()
  auth.user = null
  auth.requestLogin(route.fullPath, '登录已过期，请重新登录。')
}
</script>
<template>
  <section class="document-workspace" :class="{ 'has-selection': !!target }">
    <DocumentHeading
      :project-id="String(route.params.projectId)"
      :name="project?.name || '项目接口'"
      :endpoint-count="projectEndpointCount"
      :folder-count="folderCount"
      :environments="environments"
      :environment-id="environmentId"
      :submitting="workspace.submitting.value"
      :loading="loading"
      @environment="navigation.selectEnvironment"
      @organize="askToOrganize"
    />
    <div class="documents-board">
      <InterfaceList
        :sections="sections"
        :loading="loading"
        :error="error"
        :selected-id="selectedId"
        :environment-id="environmentId"
        :query="query"
        :project-id="String(route.params.projectId)"
        :selected-folder-id="target?.kind === 'folder' ? target.id : ''"
        :ancestors="folderPath.map((folder) => folder.id)"
        @query="query = $event"
        @retry="workspace.loadProject"
      />
      <section
        id="document-detail"
        class="document-detail"
        aria-label="接口文档详情"
        :aria-busy="detailLoading"
      >
        <div
          v-if="error || environmentError || folderError"
          class="document-large-state"
          role="alert"
        >
          <p>{{ error || environmentError || folderError }}</p>
        </div>
        <DocumentFolderOverview
          v-else-if="folder && target?.kind === 'folder'"
          :folder="folder"
          :path="folderPath"
          :project-id="String(route.params.projectId)"
          :environment-id="environmentId"
          :environment-name="workspace.currentEnvironment.value?.name ?? ''"
        />
        <div v-else-if="!selectedId" class="document-large-state">
          <AppIcon name="code" :size="32" />
          <h2>{{ loading ? '正在读取项目文档' : '从目录或接口开始' }}</h2>
          <p>左侧选择目录查看概览，或选择接口查看用途、字段和真实调用样本。</p>
        </div>
        <div v-else-if="detailLoading && !detail" class="document-large-state" role="status">
          正在读取接口…
        </div>
        <div v-else-if="detailError" class="document-large-state" role="alert">
          <p>{{ detailError }}</p>
        </div>
        <template v-else-if="detail">
          <header class="document-definition-heading">
            <button type="button" class="document-mobile-back" @click="navigation.deselect">
              <AppIcon name="arrow-left" :size="16" />返回接口列表
            </button>
            <DocumentBreadcrumbs
              :path="folderPath"
              :project-id="String(route.params.projectId)"
              :environment-id="environmentId"
            />
            <p v-if="!usage" class="document-scope-notice" role="status">
              此接口在当前环境尚无观测，以下说明为项目共享知识。
            </p>
            <div class="document-definition-title">
              <h2
                ref="nameElement"
                :title="endpointName"
                :class="{
                  'is-overflowing': nameMarquee.overflowing.value,
                  'lifecycle-retired-name': !!lifecycle.get({ kind: 'endpoint', id: selectedId }),
                }"
                :style="nameMarquee.style()"
              >
                <b>{{ endpointName }}</b>
              </h2>
              <span v-if="detail.facts.summary.external" class="document-chip">外部服务</span>
              <div class="document-description-action">
                <LifecycleMenu
                  :target="{ kind: 'endpoint', id: selectedId }"
                  :name="endpointName"
                />
                <DocumentShare
                  :to="{ path: route.path, query: { ...route.query, env: environmentId } }"
                />
                <button
                  type="button"
                  class="document-describe"
                  :disabled="workspace.submitting.value"
                  :aria-busy="
                    workspace.submitting.value && workspace.submittingTarget.value === selectedId
                  "
                  :title="
                    note?.author.by === 'curate'
                      ? '根据当前证据重新整理接口与字段说明'
                      : '重新整理这个接口的名称、用途和字段说明'
                  "
                  @click="workspace.describe(selectedId)"
                >
                  <AppIcon name="scan-search" :size="15" />
                  {{
                    workspace.submitting.value && workspace.submittingTarget.value === selectedId
                      ? '正在提交'
                      : note
                        ? '重新整理接口'
                        : '整理接口'
                  }}
                </button>
              </div>
            </div>
            <EndpointSummary
              :endpoint-id="selectedId"
              :method="detail.facts.summary.method"
              :path="endpointPath"
              :purpose="note?.purpose"
              :retired-source-count="detail.retired_source_count"
            />
          </header>
          <TabsRoot class="document-content-tabs" v-model="activeTab">
            <TabsList class="document-tabs" aria-label="接口内容">
              <TabsTrigger value="fields" class="document-tab"
                >字段 <span>{{ fieldCount }}</span></TabsTrigger
              >
              <TabsTrigger value="examples" class="document-tab"
                >真实样本 <span>{{ examples.length }}</span></TabsTrigger
              >
              <span v-if="usage" class="document-tab-meta">
                <span>调用 {{ usage.calls }} 次</span>
                <time :datetime="usage.last_seen" :title="formatTime(usage.last_seen)"
                  >最近 {{ recentObservation }}</time
                >
              </span>
            </TabsList>
            <TabsContent
              value="fields"
              class="document-scroll document-tab-panel"
              data-scroll-container
            >
              <section v-for="group in groups" :key="group.label" class="document-field-group">
                <h3>
                  {{ group.label }} <small>{{ group.fields.length }}</small>
                </h3>
                <FieldStructure
                  :fields="group.fields"
                  :notes="detail.knowledge?.fields ?? []"
                  :environment-id="environmentId"
                  :endpoint-id="selectedId"
                  :entries="visibleEntries"
                  @related="navigation.selectInterface"
                  @example="showExample"
                />
              </section>
              <p v-if="!groups.length" class="document-small-state">此环境尚未观测到字段结构。</p>
            </TabsContent>
            <TabsContent
              value="examples"
              class="document-samples-panel document-tab-panel"
              data-scroll-container
            >
              <DocumentSamples
                :examples="examples"
                :sample="sample"
                :sample-id="sampleId"
                :displayed-id="displayedSampleId"
                :loading="sampleLoading"
                :error="sampleError"
                :comparison-ids="comparisonIds"
                :baseline-id="baselineId"
                :payloads="samplePayloads"
                :errors="sampleErrors"
                :pending="samplesPending"
                :comparison-ready="comparisonReady"
                @select="workspace.selectExample"
                @compare="workspace.toggleComparison"
                @baseline="baselineId = $event"
                @clear="workspace.clearComparison"
                @retry="workspace.retrySample"
              />
            </TabsContent>
          </TabsRoot>
        </template>
      </section>
    </div>
    <CurationPanel
      :endpoint-labels="
        Object.fromEntries(
          (workspace.documentIndex.value?.entries ?? []).map((e) => [
            e.interface_id,
            e.name || e.path,
          ]),
        )
      "
      :project-id="String(route.params.projectId)"
      :page-key="route.fullPath"
      :environment-id="environmentId"
      :ready="!loading && !!project"
      :submitting="workspace.submitting.value"
      :progress="progress"
      :busy="busy"
      :error="noticeError ? notice : ''"
      :notice-candidate-id="workspace.noticeCandidateId.value"
      :requested-run-key="workspace.requestedRunKey.value"
      @retry="workspace.fillGaps($event)"
      @cancel="workspace.cancel"
      @observe="workspace.observeCuration"
      @unauthorized="confirmationUnauthorized"
    />
    <CurationStartDialog
      v-model:open="startConfirmationOpen"
      :project-id="String(route.params.projectId)"
      :project-name="project?.name ?? '当前项目'"
      :environment-id="environmentId"
      :busy="workspace.submitting.value || loading || !projectEndpointCount"
      @confirm="workspace.organize"
      @resume="workspace.fillGaps($event)"
      @progress="workspace.observeCuration($event)"
      @unauthorized="confirmationUnauthorized"
    />
    <LifecyclePanel
      :index="workspace.documentIndex.value"
      :project-id="String(route.params.projectId)"
      :environment-id="environmentId"
    />
  </section>
</template>

<style scoped>
.document-samples-panel {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
