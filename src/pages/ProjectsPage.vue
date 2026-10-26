<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError } from '@/api'
import { clearCredential } from '@/api/session'
import { useAuthStore } from '@/stores/auth'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import ProjectSearch from '@/features/projects/ProjectSearch.vue'
import ProjectIntro from '@/features/projects/ProjectIntro.vue'
import ProjectTable from '@/features/projects/ProjectTable.vue'
import ProjectPagination from '@/features/projects/ProjectPagination.vue'
import { projectSource, projectScope } from '@/features/projects/source'
import { useProjectBrowser } from '@/features/projects/useProjectBrowser'
import { useProjectEntry } from '@/features/projects/useProjectEntry'
import '@/features/projects/projects.css'

const auth = useAuthStore()
const router = useRouter()
const watermarkUrl = `url("${import.meta.env.BASE_URL}brand/nexofolio-icon.svg")`
const scope = `${projectScope}:${auth.user?.id ?? 'anonymous'}`
const browser = useProjectBrowser(projectSource, scope)
const {
  query,
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
  <section
    class="project-browser"
    :style="{ '--project-mark-image': watermarkUrl }"
    aria-labelledby="project-page-title"
  >
    <div class="project-collection">
      <div class="project-toolbar">
        <ProjectIntro :filtered="activeFilters" :total="hasResult && !error ? total : undefined" />
        <div class="project-tools">
          <ProjectSearch
            :model-value="query"
            :busy="showProgress"
            @update:model-value="browser.changeQuery"
            @submit="browser.submitQuery"
            @clear="browser.clearQuery"
            @composition-start="browser.compositionStart"
            @composition-end="browser.compositionEnd"
          />
        </div>
      </div>
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
        @clear="browser.clearQuery"
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
