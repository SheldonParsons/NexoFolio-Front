<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError } from '@/api/client'
import { clearCredential } from '@/api/session'
import { useAuthStore } from '@/stores/auth'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import ProjectSearch from '@/features/projects/ProjectSearch.vue'
import ProjectIntro from '@/features/projects/ProjectIntro.vue'
import ProjectTable from '@/features/projects/ProjectTable.vue'
import ProjectPagination from '@/features/projects/ProjectPagination.vue'
import { projectSource, projectScope, supportsProjectQuery } from '@/features/projects/source'
import { useProjectBrowser } from '@/features/projects/useProjectBrowser'
import { useProjectEntry } from '@/features/projects/useProjectEntry'
import { accessLabels, type ProjectAccess } from '@/features/projects/types'
import '@/features/projects/projects.css'

const auth = useAuthStore()
const router = useRouter()
const watermarkUrl = `url("${import.meta.env.BASE_URL}brand/nexofolio-icon.svg")`
const scope = `${projectScope}:${auth.user?.id ?? 'anonymous'}`
const browser = useProjectBrowser(projectSource, scope, supportsProjectQuery)
const {
  query,
  access,
  page,
  items,
  total,
  recent,
  recentReady,
  hasResult,
  busy,
  showProgress,
  error,
  revision,
  scrollTop,
  restoreScroll,
  activeFilters,
  pages,
  limit,
} = browser
const { openingId, explanation, projectName, dialogOpen, open } = useProjectEntry(
  projectSource,
  scope,
  (id) => {
    recent.value = recent.value.filter((project) => project.project_id !== id)
  },
)
const accessOptions: { value: 'all' | ProjectAccess; label: string }[] = [
  { value: 'all', label: '全部权限' },
  ...Object.entries(accessLabels).map(([value, label]) => ({
    value: value as ProjectAccess,
    label,
  })),
]
function saveScroll(top: number) {
  scrollTop.value = top
  browser.persist()
}
watch(error, (cause) => {
  if (cause instanceof ApiError && cause.status === 401) {
    clearCredential()
    auth.user = null
    auth.requestLogin('/projects', '登录已过期，请重新登录。')
    void router.push('/')
  }
})
onMounted(() => {
  void browser.load()
})
</script>
<template>
  <section class="project-browser" :style="{ '--project-mark-image': watermarkUrl }">
    <ProjectIntro />
    <div class="project-collection">
      <div class="project-toolbar">
        <div class="project-collection-heading">
          <h2>{{ activeFilters ? '搜索结果' : '全部项目' }}</h2>
          <span v-if="hasResult && !error" class="project-total">{{ total }}</span>
        </div>
        <div class="project-tools">
          <ProjectSearch
            :model-value="query"
            :busy="showProgress"
            :disabled="!supportsProjectQuery"
            @update:model-value="browser.changeQuery"
            @submit="browser.submitQuery"
            @clear="browser.clearQuery"
            @composition-start="browser.compositionStart"
            @composition-end="browser.compositionEnd"
          />
          <div class="project-filter">
            <AppSelect
              :model-value="access"
              label="项目访问权限"
              :options="accessOptions"
              :disabled="!supportsProjectQuery"
              @update:model-value="browser.changeAccess"
            />
          </div>
        </div>
      </div>
      <p v-if="!supportsProjectQuery" class="project-service-note">
        当前服务仅支持项目列表，全项目搜索与权限筛选将在接口就绪后开放。
      </p>
      <ProjectTable
        :items="items"
        :recent="recent"
        :recent-ready="recentReady"
        :has-result="hasResult"
        :busy="busy"
        :show-progress="showProgress"
        :error="error instanceof Error ? error.message : error ? '项目暂时无法加载。' : ''"
        :filtered="activeFilters"
        :opening-id="openingId"
        :revision="revision"
        :scroll-top="scrollTop"
        :restore-scroll="restoreScroll"
        :limit="limit"
        @open="open"
        @retry="browser.load()"
        @clear="browser.resetFilters"
        @scroll="saveScroll"
        @restored="restoreScroll = false"
      />
      <ProjectPagination
        :has-result="hasResult"
        :show-progress="showProgress"
        :page="page"
        :pages="pages"
        :total="total"
        :limit="limit"
        :busy="busy"
        :filtered="activeFilters"
        :error="!!error"
        @page="browser.changePage"
      />
    </div>
    <AppDialog v-model:open="dialogOpen" :title="projectName" description="项目访问说明"
      ><p class="project-access-message" role="status">{{ explanation }}</p>
      <AppButton @click="dialogOpen = false">知道了</AppButton></AppDialog
    >
  </section>
</template>
