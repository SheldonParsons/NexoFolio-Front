import { nextTick } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { pinia } from './pinia'
import { useAuthStore } from '@/stores/auth'
import { authErrorMessage } from '@/api/auth'
import { useNavigationTransition } from '@/stores/navigationTransition'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
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
      component: () => import('@/pages/ProjectDocumentPage.vue'),
      meta: { title: '接口文档', requiresAuth: true, layout: 'projects' },
    },
    {
      path: '/projects/:projectId/catalog',
      name: 'official-catalog',
      component: () => import('@/pages/OfficialCatalogPage.vue'),
      meta: { title: '接口目录', requiresAuth: true, layout: 'projects' },
    },
    {
      path: '/projects/:projectId/maintenance',
      name: 'knowledge-maintenance',
      component: () => import('@/pages/KnowledgeMaintenancePage.vue'),
      meta: { title: '知识维护', requiresAuth: true, layout: 'projects' },
    },
    {
      path: '/projects/:projectId/catalog-preview',
      name: 'catalog-preview',
      component: () => import('@/pages/CatalogPreviewPage.vue'),
      meta: { title: '候选目录', requiresAuth: true, layout: 'projects' },
    },
    {
      path: '/interfaces',
      name: 'interfaces',
      component: () => import('@/pages/InterfacesPage.vue'),
      meta: { title: '接口目录', requiresAuth: true },
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
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const container = document.querySelector<HTMLElement>('[data-scroll-container]')
    if (!container || container.dataset.scrollRestoration === 'managed') return false
    if (to.hash) {
      const target = document.getElementById(decodeURIComponent(to.hash.slice(1)))
      if (target && container.contains(target)) {
        container.scrollTo({
          // A container anchor (such as #top) refers to its scroll origin.
          top: target === container
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
  if (!to.meta.requiresAuth) return true
  const auth = useAuthStore(pinia)
  const transition = useNavigationTransition(pinia)
  if (to.path !== from.path && !auth.arrival && !transition.current) {
    routeTransitionId = transition.start('正在进入 NexoFolio')
  }
  // The login API has just authenticated this user. Mount the destination under
  // the fixed transition instead of blocking it on a redundant /me round trip.
  if (auth.arrival && auth.user?.id === auth.arrival.userId) return true
  try {
    if (await auth.checkSession()) return true
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
  document.title = `${String(to.meta.title ?? '工作空间')} · NexoFolio`
  if (to.path === from.path) return
  await nextTick()
  if (useAuthStore(pinia).arrival || useNavigationTransition(pinia).current) return
  document.querySelector<HTMLElement>('#main-content')?.focus({ preventScroll: true })
})

router.onError(() => {
  if (routeTransitionId !== null) useNavigationTransition(pinia).finish(routeTransitionId)
  routeTransitionId = null
})
