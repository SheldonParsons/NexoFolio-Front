<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuRoot,
  NavigationMenuTrigger,
  NavigationMenuViewport,
} from 'reka-ui'
import AppIcon from '@/components/icons/AppIcon.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import LoginMark from '@/features/auth/LoginMark.vue'
import WorkspaceDownloads from '@/features/downloads/WorkspaceDownloads.vue'
import type { IconName } from '@/components/icons/registry'
import { documentLocation } from '@/features/documents/documentRoutes'
import { useCurationReviewEntry } from '@/features/curation/useCurationReviewEntry'
import CurationEntryNotice from '@/features/curation/CurationEntryNotice.vue'
import { useActiveProject } from '@/features/projects/useActiveProject'
import { projectSource } from '@/features/projects/source'
import { useProjectEntry } from '@/features/projects/useProjectEntry'
import type { Project } from '@/features/projects/types'
import { navigationProject } from './navigationProject'
import { useNavigationRecentProjects } from './useNavigationRecentProjects'
import NavigationRecentProjects from './NavigationRecentProjects.vue'
import './workspace-navigation.css'

const route = useRoute()
const router = useRouter()
const openMenu = ref('')
const activeProject = useActiveProject()
const recent = useNavigationRecentProjects(
  projectSource,
  activeProject.scope,
  () => openMenu.value === 'projects',
)
const entry = useProjectEntry(projectSource, activeProject.scope)
function enterProject(project: Project) {
  openMenu.value = ''
  void entry.open(project)
}
const resources: { id: string; label: string; description: string; icon: IconName; to: string }[] =
  [
    {
      id: 'docs',
      label: '使用文档',
      description: '产品理念、接入方式与工作流程',
      icon: 'book',
      to: '/docs',
    },
    {
      id: 'mcp',
      label: 'MCP',
      description: '了解 Agent 如何使用项目接口知识',
      icon: 'network',
      to: '/docs/mcp',
    },
    {
      id: 'changelog',
      label: '更新日志',
      description: '产品演进、改进与版本记录',
      icon: 'layers',
      to: '/changelog',
    },
  ]
const selectedProject = computed(() => navigationProject(route, activeProject.current.value))
const projectId = computed(() => selectedProject.value?.projectId || '')
const projectName = computed(() => selectedProject.value?.name || '')
const environmentId = computed(() => selectedProject.value?.environmentId || '')
const formalTo = computed(() =>
  projectId.value ? documentLocation(projectId.value, null, environmentId.value) : '/projects',
)
const documentActive = computed(() =>
  ['project-interfaces', 'document-folder', 'document-endpoint'].includes(String(route.name)),
)
const review = useCurationReviewEntry(
  () => projectId.value,
  () => environmentId.value,
  (to) => router.push(to),
  () => route.fullPath,
)
function openReview(event: Event) {
  event.preventDefault()
  openMenu.value = ''
  void review.open()
}
watch(
  () => route.fullPath,
  () => {
    openMenu.value = ''
  },
)
</script>

<template>
  <NavigationMenuRoot
    v-model="openMenu"
    class="workspace-navigation"
    aria-label="工作空间导航"
    :delay-duration="100"
    :skip-delay-duration="400"
  >
    <NavigationMenuList class="workspace-navigation-list">
      <NavigationMenuItem value="projects">
        <NavigationMenuTrigger
          class="workspace-navigation-trigger"
          :class="{ 'is-current': route.name === 'projects' }"
        >
          项目空间
          <AppIcon class="navigation-chevron" name="chevron-down" mode="static" :size="14" />
        </NavigationMenuTrigger>
        <NavigationMenuContent class="workspace-navigation-content">
          <div class="navigation-project-panel">
            <NavigationMenuLink as-child>
              <RouterLink to="/" class="navigation-brand-card" aria-label="了解 NexoFolio">
                <span class="navigation-brand-motion">
                  <LoginMark :active="openMenu === 'projects'" glow icon-only />
                </span>
                <span class="navigation-brand-copy">
                  <span class="navigation-brand-title">NexoFolio</span>
                  <span class="navigation-brand-caption">每个接口，<br />都值得被理解。</span>
                </span>
              </RouterLink>
            </NavigationMenuLink>
            <div class="navigation-project-links">
              <NavigationMenuLink as-child :active="route.name === 'projects'">
                <RouterLink to="/projects" class="navigation-destination navigation-all-projects">
                  <span class="navigation-item-icon"
                    ><AppIcon name="layout-grid" mode="static" :size="20"
                  /></span>
                  <span><strong>全部项目</strong><small>浏览所有项目</small></span>
                  <AppIcon
                    class="navigation-item-arrow"
                    name="arrow-up-right"
                    mode="static"
                    :size="16"
                  />
                </RouterLink>
              </NavigationMenuLink>
              <NavigationRecentProjects
                :items="recent.items.value"
                :loading="recent.loading.value"
                :message="recent.message.value"
                :opening-id="entry.openingId.value"
                :current-id="projectId"
                @enter="enterProject"
              />
            </div>
          </div>
        </NavigationMenuContent>
      </NavigationMenuItem>

      <NavigationMenuItem value="interfaces">
        <NavigationMenuTrigger
          class="workspace-navigation-trigger"
          :class="{ 'is-current': documentActive || route.name === 'curation-review' }"
        >
          接口文档
          <AppIcon class="navigation-chevron" name="chevron-down" mode="static" :size="14" />
        </NavigationMenuTrigger>
        <NavigationMenuContent class="workspace-navigation-content">
          <div class="navigation-resources-panel navigation-interfaces-panel">
            <div v-if="projectId" class="navigation-selected-project">
              <AppIcon name="folder" mode="static" :size="16" />
              <span class="navigation-eyebrow">当前项目</span>
              <strong data-navigation-project-name>{{ projectName || '正在读取项目…' }}</strong>
            </div>
            <p v-else class="navigation-eyebrow">从项目进入接口知识</p>
            <NavigationMenuLink as-child :active="documentActive">
              <RouterLink :to="formalTo" class="navigation-destination navigation-resource">
                <span class="navigation-item-icon"
                  ><AppIcon name="book" mode="static" :size="20"
                /></span>
                <span
                  ><strong>正式文档</strong><small>查看已应用的目录、接口与字段知识</small></span
                >
              </RouterLink>
            </NavigationMenuLink>
            <NavigationMenuLink as-child @select="openReview">
              <button
                type="button"
                class="navigation-destination navigation-resource"
                :disabled="review.loading.value"
                :aria-busy="review.loading.value"
              >
                <span class="navigation-item-icon"
                  ><AppIcon name="layers" mode="static" :size="20"
                /></span>
                <span
                  ><strong>{{ review.loading.value ? '读取整理结果…' : '整理结果' }}</strong
                  ><small>审阅候选内容，决定是否应用到正式文档</small></span
                >
              </button>
            </NavigationMenuLink>
            <NavigationMenuLink as-child :active="route.name === 'mcp-credentials'">
              <RouterLink to="/settings/mcp" class="navigation-destination navigation-resource">
                <span class="navigation-item-icon"
                  ><AppIcon name="lock" mode="static" :size="20"
                /></span>
                <span
                  ><strong>MCP 凭证</strong><small>管理当前账号所有可访问项目的凭证</small></span
                >
              </RouterLink>
            </NavigationMenuLink>
          </div>
        </NavigationMenuContent>
      </NavigationMenuItem>

      <NavigationMenuItem value="resources">
        <NavigationMenuTrigger
          class="workspace-navigation-trigger"
          :class="{ 'is-current': route.meta.layout === 'docs' }"
        >
          文档资源
          <AppIcon class="navigation-chevron" name="chevron-down" mode="static" :size="14" />
        </NavigationMenuTrigger>
        <NavigationMenuContent class="workspace-navigation-content">
          <div class="navigation-resources-panel">
            <p class="navigation-eyebrow">了解与使用 NexoFolio</p>
            <NavigationMenuLink v-for="item in resources" :key="item.id" as-child>
              <RouterLink :to="item.to" class="navigation-destination navigation-resource">
                <span class="navigation-item-icon"
                  ><AppIcon :name="item.icon" mode="static" :size="20"
                /></span>
                <span>
                  <strong>{{ item.label }}</strong>
                  <small>{{ item.description }}</small>
                </span>
              </RouterLink>
            </NavigationMenuLink>
          </div>
        </NavigationMenuContent>
      </NavigationMenuItem>
      <WorkspaceDownloads />
      <NavigationMenuIndicator class="workspace-navigation-indicator"
        ><span
      /></NavigationMenuIndicator>
    </NavigationMenuList>
    <NavigationMenuViewport class="workspace-navigation-viewport" />
  </NavigationMenuRoot>
  <AppDialog
    v-model:open="entry.dialogOpen.value"
    :title="entry.projectName.value"
    description="项目访问说明"
  >
    <p role="status">{{ entry.explanation.value }}</p>
    <AppButton @click="entry.dialogOpen.value = false">知道了</AppButton>
  </AppDialog>
  <CurationEntryNotice
    v-model:message="review.message.value"
    :retryable="review.retryable.value"
    @retry="review.open"
  />
</template>
