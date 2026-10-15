import { nextTick } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { pinia } from './pinia'
import { useAuthStore } from '@/stores/auth'
import { authErrorMessage } from '@/api/auth'
import { useNavigationTransition } from '@/stores/navigationTransition'
import { workspaceEnabled } from './deployment'
import { sameDocumentProject } from '@/features/documents/documentRoutes'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/settings/audit',
      name: 'audit',
      redirect: (to) => ({ name: 'management-audit', query: to.query, hash: to.hash }),
    },
    {
      path: '/management',
      meta: {
        title: '管理中心',
        requiresAuth: true,
        requiresManagement: true,
        layout: 'management',
      },
      children: [
        { path: '', redirect: { name: 'management-projects' } },
        {
          path: 'projects',
          name: 'management-projects',
          component: () => import('@/pages/ManagementProjectsPage.vue'),
          meta: { title: '项目管理' },
        },
        {
          path: 'users',
          name: 'management-users',
          component: () => import('@/pages/ManagementUsersPage.vue'),
          meta: { title: '用户管理' },
        },
        {
          path: 'operations',
          name: 'management-operations',
          component: () => import('@/pages/ManagementOperationsPage.vue'),
          meta: { title: '运行状态' },
        },
        {
          path: 'storage',
          name: 'management-storage',
          component: () => import('@/pages/ManagementStoragePage.vue'),
          meta: { title: '存储与清理' },
        },
        {
          path: 'audit',
          name: 'management-audit',
          component: () => import('@/pages/AuditPage.vue'),
          meta: { title: '内容审计' },
        },
      ],
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/HomePage.vue'),
      meta: { title: '让接口成为知识', layout: 'landing' },
    },
    {
      path: '/projects',
      name: 'projects',
      component: () => import('@/pages/ProjectsPage.vue'),
      meta: { title: '项目空间', requiresAuth: true, layout: 'projects' },
    },
    {
      path: '/projects/:projectId/interfaces',
      name: 'project-interfaces',
      component: () => import('@/pages/ProjectDocumentRoute.vue'),
      meta: { title: '接口文档', publicDocument: true, layout: 'projects' },
    },
    ...(['folder', 'endpoint'] as const).map((kind) => ({
      path: `/projects/:projectId/interfaces/${kind}s/:${kind}Id`,
      name: `document-${kind}`,
      component: () => import('@/pages/ProjectDocumentRoute.vue'),
      meta: { title: '接口文档', publicDocument: true, layout: 'projects' },
    })),
    {
      path: '/projects/:projectId/interfaces/curation/:candidateId?',
      name: 'curation-review',
      component: () => import('@/pages/CurationReviewPage.vue'),
      meta: { title: '整理结果', requiresAuth: true, layout: 'projects' },
    },
    {
      path: '/projects/:projectId/catalog',
      name: 'knowledge-catalog',
      redirect: (to) => ({
        name: 'project-interfaces',
        params: to.params,
        query: to.query,
        hash: to.hash,
      }),
    },
    {
      path: '/interfaces',
      name: 'interfaces',
      redirect: '/projects',
    },
    {
      path: '/docs/:docSlug?',
      name: 'product-docs',
      component: () => import('@/pages/ProductDocsPage.vue'),
      meta: { title: '产品文档', layout: 'docs' },
    },
    {
      path: '/changelog/:entry?',
      name: 'product-changelog',
      component: () => import('@/pages/ProductChangelogPage.vue'),
      meta: { title: '更新日志', layout: 'docs' },
    },
    {
      path: '/settings/mcp',
      name: 'mcp-credentials',
      component: () => import('@/pages/McpCredentialsPage.vue'),
      meta: { title: 'MCP 凭证', requiresAuth: true, layout: 'projects' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/pages/SettingsPage.vue'),
      meta: { title: '偏好设置', requiresAuth: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/NotFoundPage.vue'),
      meta: { title: '页面未找到' },
    },
  ],
  scrollBehavior: async (to, from): Promise<false> => {
    if (sameDocumentProject(to, from)) return false
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const container = document.querySelector<HTMLElement>('[data-scroll-container]')
    if (!container || container.dataset.scrollRestoration === 'managed') return false
    if (to.hash) {
      const target = document.getElementById(decodeURIComponent(to.hash.slice(1)))
      if (target && container.contains(target)) {
        container.scrollTo({
          // A container anchor (such as #top) refers to its scroll origin.
          top:
            target === container
              ? 0
              : Math.max(
                  0,
                  container.scrollTop +
                    target.getBoundingClientRect().top -
                    container.getBoundingClientRect().top -
                    24,
                ),
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'instant'
            : 'smooth',
        })
      }
    } else if (to.path !== from.path) container.scrollTo({ top: 0, behavior: 'instant' })
    // The document is locked; route navigation only scrolls an internal container.
    return false
  },
})

let routeTransitionId: number | null = null
router.beforeEach(async (to, from) => {
  if (to.meta.publicDocument) {
    const auth = useAuthStore(pinia)
    try {
      await auth.checkSession()
    } catch {
      auth.user = null
    }
    return true
  }
  if (!to.meta.requiresAuth) return true
  const auth = useAuthStore(pinia)
  if (!workspaceEnabled) {
    auth.requestLogin(to.fullPath)
    return from.matched.length ? false : { name: 'home' }
  }
  const transition = useNavigationTransition(pinia)
  if (
    !sameDocumentProject(to, from) &&
    to.path !== from.path &&
    !auth.arrival &&
    !transition.current
  ) {
    routeTransitionId = transition.start('正在进入 NexoFolio')
  }
  // The login API has just authenticated this user. Mount the destination under
  // the fixed transition instead of blocking it on a redundant /me round trip.
  const managementAllowed = () => !to.meta.requiresManagement || auth.canManageProjects
  if (auth.arrival && auth.user?.id === auth.arrival.userId)
    return managementAllowed() ? true : { name: 'projects' }
  try {
    if (await auth.checkSession()) return managementAllowed() ? true : { name: 'projects' }
  } catch (error) {
    auth.requestLogin(to.fullPath, authErrorMessage(error))
    return { name: 'home' }
  }
  auth.requestLogin(to.fullPath)
  return { name: 'home' }
})

router.afterEach(async (to, from, failure) => {
  if (routeTransitionId !== null) {
    const transition = useNavigationTransition(pinia)
    if (failure || to.name === 'home') transition.finish(routeTransitionId)
    else transition.settle(routeTransitionId)
    routeTransitionId = null
  }
  if (failure) return
  document.title = `${String(to.meta.title ?? '工作空间')} · NexoFolio`
  if (to.path === from.path || sameDocumentProject(to, from)) return
  await nextTick()
  if (useAuthStore(pinia).arrival || useNavigationTransition(pinia).current) return
  document.querySelector<HTMLElement>('#main-content')?.focus({ preventScroll: true })
})

router.onError(() => {
  if (routeTransitionId !== null) useNavigationTransition(pinia).finish(routeTransitionId)
  routeTransitionId = null
})
