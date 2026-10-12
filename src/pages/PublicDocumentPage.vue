<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/icons/AppIcon.vue'
import { useAuthStore } from '@/stores/auth'
import InterfaceList from '@/features/documents/InterfaceList.vue'
import EnvironmentSelect from '@/features/documents/EnvironmentSelect.vue'
import DocumentFolderOverview from '@/features/documents/DocumentFolderOverview.vue'
import DocumentBreadcrumbs from '@/features/documents/DocumentBreadcrumbs.vue'
import DocumentShare from '@/features/documents/DocumentShare.vue'
import EndpointSummary from '@/features/documents/EndpointSummary.vue'
import PublicFieldStructure from '@/features/documents/public/PublicFieldStructure.vue'
import { usePublicDocument } from '@/features/documents/public/usePublicDocument'
import { provideDocumentPreview } from '@/features/documents/useDocumentPreview'
import { documentLocation } from '@/features/documents/documentRoutes'
import { groupFields } from '@/features/knowledge/fieldPresentation'
import { fieldKey } from '@/features/documents/fieldTree'
import { provideLifecycle } from '@/features/documents/lifecycle/context'
import LifecyclePanel from '@/features/documents/lifecycle/LifecyclePanel.vue'
import '@/features/documents/documents.css'
import '@/features/documents/document-navigation.css'

const route = useRoute(),
  router = useRouter(),
  auth = useAuthStore()
const showRetired = ref(false)
const view = usePublicDocument(route, router, () => showRetired.value)
const {
  projectId,
  index,
  detail,
  loading,
  detailLoading,
  error,
  detailError,
  query,
  target,
  environments,
  environmentId,
  environmentError,
  tree,
  folder,
  path,
} = view
const lifecycle = provideLifecycle(
  () => projectId.value,
  () => index.value,
  false,
)
watch(lifecycle.showRetired, (value) => (showRetired.value = value))
const preview = provideDocumentPreview()
watch(() => route.fullPath, preview.close)
watch(index, preview.close)
const folderError = computed(() =>
  !loading.value && index.value && target.value?.kind === 'folder' && !folder.value
    ? '此目录已失效或不存在，请从左侧重新选择。'
    : '',
)
const groups = computed(() => {
  const fields = detail.value?.fields ?? []
  const notes = new Map(fields.map((field) => [field.key, field]))
  return groupFields(fields.map((field) => field.structure)).map((group) => ({
    label: group.label,
    fields: group.fields.map((field) => notes.get(fieldKey(field))!),
  }))
})
const environmentName = computed(
  () => environments.value.find((e) => e.id === environmentId.value)?.name ?? '',
)
</script>
<template>
  <section class="document-workspace" :class="{ 'has-selection': !!target }">
    <header class="document-workspace-heading">
      <div class="document-project-context">
        <RouterLink
          :to="auth.user ? '/projects' : '/'"
          class="document-project-return"
          aria-label="返回"
          ><AppIcon name="arrow-left" :size="18"
        /></RouterLink>
        <div>
          <h1>{{ index?.project.name || '项目接口' }}</h1>
          <p class="document-project-summary">
            {{ index?.entries.length ?? 0 }} 个接口 ·
            {{ index?.catalog.folders.length ?? 0 }} 个目录
          </p>
        </div>
      </div>
      <div class="document-heading-actions">
        <EnvironmentSelect
          v-if="environments.length"
          :environments="environments"
          :model-value="environmentId"
          @update:model-value="view.selectEnvironment"
        />
        <button
          type="button"
          class="document-secondary-button"
          @click="lifecycle.panelOpen.value = true"
        >
          废弃内容（{{ lifecycle.count.value }}）
        </button>
        <span class="document-description-source">只读查看</span>
        <button
          v-if="!auth.user"
          type="button"
          class="document-secondary-button"
          @click="auth.requestLogin(route.fullPath)"
        >
          登录
        </button>
      </div>
    </header>
    <p v-if="lifecycle.pending.value" class="lifecycle-project-notice">
      存在废弃变更，当前整理尚未重新核对
    </p>
    <div class="documents-board">
      <InterfaceList
        :sections="tree"
        :loading="loading"
        :error="error"
        :selected-id="target?.kind === 'endpoint' ? target.id : ''"
        :selected-folder-id="target?.kind === 'folder' ? target.id : ''"
        :ancestors="path.map((f) => f.id)"
        :project-id="projectId"
        :environment-id="environmentId"
        :query="query"
        @query="query = $event"
        @retry="view.loadIndex"
      />
      <section
        id="document-detail"
        class="document-detail"
        aria-label="公开接口文档"
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
          :path="path"
          :project-id="projectId"
          :environment-id="environmentId"
          :environment-name="environmentName"
        />
        <div v-else-if="!target" class="document-large-state">
          <AppIcon name="code" :size="32" />
          <h2>{{ loading ? '正在读取文档' : '从目录或接口开始' }}</h2>
          <p>可浏览目录、接口说明和字段文档。真实样本及修改操作需要项目权限。</p>
        </div>
        <div v-else-if="detailLoading" class="document-large-state" role="status">
          正在读取接口…
        </div>
        <div v-else-if="detailError" class="document-large-state" role="alert">
          <p>{{ detailError }}</p>
          <button class="document-secondary-button" @click="view.loadDetail">重新读取</button>
        </div>
        <template v-else-if="detail">
          <header class="document-definition-heading">
            <RouterLink
              class="document-mobile-back"
              :to="documentLocation(projectId, null, environmentId)"
              >返回接口列表</RouterLink
            >
            <DocumentBreadcrumbs
              :path="path"
              :project-id="projectId"
              :environment-id="environmentId"
            />
            <div class="document-overview-title">
              <h2
                :class="{
                  'lifecycle-retired-name': !!lifecycle.get({
                    kind: 'endpoint',
                    id: detail.endpoint_id,
                  }),
                }"
              >
                {{ detail.name || detail.path }}
              </h2>
              <DocumentShare
                :to="
                  documentLocation(
                    projectId,
                    { kind: 'endpoint', id: detail.endpoint_id },
                    environmentId,
                  )
                "
              />
            </div>
            <EndpointSummary
              :endpoint-id="detail.endpoint_id"
              :method="detail.method"
              :path="detail.path"
              :purpose="detail.purpose || '用途说明尚未补充'"
              :retired-source-count="detail.retired_source_count"
            />
          </header>
          <div class="document-scroll" data-scroll-container>
            <p class="document-description-source">
              当前为只读查看，真实样本、观测值和修改操作需要项目权限。
            </p>
            <p v-if="detail.description" class="document-purpose">{{ detail.description }}</p>
            <p v-for="unknown in detail.unknowns" :key="unknown" class="document-purpose">
              待确认：{{ unknown }}
            </p>
            <section v-for="group in groups" :key="group.label">
              <h3>{{ group.label }}</h3>
              <PublicFieldStructure :fields="group.fields" :endpoint-id="detail.endpoint_id" />
            </section>
            <p v-if="!groups.length" class="document-small-state">暂无字段结构文档。</p>
          </div>
        </template>
      </section>
    </div>
    <LifecyclePanel :index="index" :project-id="projectId" :environment-id="environmentId" />
  </section>
</template>
