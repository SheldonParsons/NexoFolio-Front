<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
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
import LoginMark from '@/features/auth/LoginMark.vue'
import WorkspaceDownloads from '@/features/downloads/WorkspaceDownloads.vue'
import type { IconName } from '@/components/icons/registry'
import './workspace-navigation.css'

const route = useRoute()
const openMenu = ref('')
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
const projectId = computed(() =>
  typeof route.params.projectId === 'string' ? route.params.projectId : '',
)
const sections: { label: string; description: string; path: string; icon: IconName }[] = [
  {
    label: '接口文档',
    description: '查看各环境的接口定义与原始样例',
    path: 'interfaces',
    icon: 'code',
  },
  {
    label: '接口目录',
    description: '沿业务目录查找项目中的接口',
    path: 'catalog',
    icon: 'folder-open',
  },
  {
    label: '候选目录',
    description: '审阅新的分类方案与目录变化',
    path: 'catalog-preview',
    icon: 'layers',
  },
  {
    label: '知识维护',
    description: '查看重构任务，审阅与发布知识',
    path: 'maintenance',
    icon: 'network',
  },
]
const projectPath = (path: string) => `/projects/${encodeURIComponent(projectId.value)}/${path}`
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
              <p class="navigation-eyebrow">从项目开始</p>
              <NavigationMenuLink as-child :active="route.name === 'projects'">
                <RouterLink to="/projects" class="navigation-destination">
                  <span class="navigation-item-icon"
                    ><AppIcon name="layout-grid" mode="static" :size="20"
                  /></span>
                  <span><strong>全部项目</strong><small>浏览项目，进入你的知识空间</small></span>
                  <AppIcon
                    class="navigation-item-arrow"
                    name="arrow-up-right"
                    mode="static"
                    :size="16"
                  />
                </RouterLink>
              </NavigationMenuLink>
              <NavigationMenuLink v-if="projectId" as-child>
                <RouterLink :to="projectPath('catalog')" class="navigation-destination">
                  <span class="navigation-item-icon"
                    ><AppIcon name="folder-open" mode="static" :size="20"
                  /></span>
                  <span><strong>当前项目知识</strong><small>回到当前项目的接口目录</small></span>
                  <AppIcon
                    class="navigation-item-arrow"
                    name="arrow-up-right"
                    mode="static"
                    :size="16"
                  />
                </RouterLink>
              </NavigationMenuLink>
              <p class="navigation-project-note">以项目组织接口，让采集、文档与知识保持关联。</p>
            </div>
          </div>
        </NavigationMenuContent>
      </NavigationMenuItem>

      <NavigationMenuItem value="interfaces">
        <NavigationMenuTrigger
          class="workspace-navigation-trigger"
          :class="{ 'is-current': !!projectId }"
        >
          接口文档
          <AppIcon class="navigation-chevron" name="chevron-down" mode="static" :size="14" />
        </NavigationMenuTrigger>
        <NavigationMenuContent class="workspace-navigation-content">
          <div class="navigation-knowledge-panel">
            <div class="navigation-panel-heading">
              <p class="navigation-eyebrow">
                {{ projectId ? '当前项目 · 接口知识' : '项目中的接口知识' }}
              </p>
              <span v-if="projectId" class="navigation-context-dot">已选择项目</span>
            </div>
            <div class="navigation-knowledge-grid">
              <template v-for="section in sections" :key="section.path">
                <NavigationMenuLink
                  v-if="projectId"
                  as-child
                  :active="route.path === projectPath(section.path)"
                >
                  <RouterLink :to="projectPath(section.path)" class="navigation-destination">
                    <span class="navigation-item-icon"
                      ><AppIcon :name="section.icon" mode="static" :size="20"
                    /></span>
                    <span
                      ><strong>{{ section.label }}</strong
                      ><small>{{ section.description }}</small></span
                    >
                  </RouterLink>
                </NavigationMenuLink>
                <div v-else class="navigation-destination navigation-destination--preview">
                  <span class="navigation-item-icon"
                    ><AppIcon :name="section.icon" mode="static" :size="20"
                  /></span>
                  <span
                    ><strong>{{ section.label }}</strong
                    ><small>{{ section.description }}</small></span
                  >
                </div>
              </template>
            </div>
            <div v-if="!projectId" class="navigation-select-project">
              <span>先选择一个项目，再查看它的接口知识。</span>
              <NavigationMenuLink as-child>
                <RouterLink to="/projects"
                  >选择项目 <AppIcon name="arrow-right" mode="static" :size="15"
                /></RouterLink>
              </NavigationMenuLink>
            </div>
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
</template>
