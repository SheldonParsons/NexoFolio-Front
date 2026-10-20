<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import WorkspaceLayout from '@/layouts/WorkspaceLayout.vue'
import ProjectsLayout from '@/layouts/ProjectsLayout.vue'
import ProductDocsLayout from '@/layouts/ProductDocsLayout.vue'
import ManagementLayout from '@/layouts/ManagementLayout.vue'
import ManagementEntry from '@/features/management/ManagementEntry.vue'
import { useSessionLifecycle } from '@/features/auth/useSessionLifecycle'
import { usePreferencesStore } from '@/stores/preferences'
import LoginDialog from '@/features/auth/LoginDialog.vue'
import LoginSuccessTransition from '@/features/auth/LoginSuccessTransition.vue'
import { useAuthStore } from '@/stores/auth'
import { clearBrowserViews } from '@/features/projects/browserState'
import BrandTransition from '@/components/brand/BrandTransition.vue'
import { useNavigationTransition } from '@/stores/navigationTransition'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { routeLoadFailure } from './routeLoadFailure'
const routeLoadFailureOpen = computed({
  get: () => routeLoadFailure.value !== null,
  set: (open) => {
    if (!open) routeLoadFailure.value = null
  },
})
const route = useRoute()
const auth = useAuthStore()
useSessionLifecycle()
const navigationTransition = useNavigationTransition()
async function finishNavigation(runId: number) {
  if (navigationTransition.current?.runId !== runId) return
  navigationTransition.finish(runId)
  await nextTick()
  const target =
    document.querySelector<HTMLElement>('[role="dialog"]') ||
    document.querySelector<HTMLElement>('#main-content')
  target?.focus({ preventScroll: true })
}
watch(
  () => auth.user?.id,
  (userId) => {
    if (auth.arrival && auth.arrival.userId !== userId) auth.finishArrival(auth.arrival.runId)
    if (!userId) clearBrowserViews()
    if (!userId && navigationTransition.current)
      navigationTransition.finish(navigationTransition.current.runId)
  },
)
async function finishArrival(runId: number) {
  if (auth.arrival?.runId !== runId) return
  auth.finishArrival(runId)
  await nextTick()
  document.querySelector<HTMLElement>('#main-content')?.focus({ preventScroll: true })
}
usePreferencesStore()
watch(
  () => route.meta.layout,
  (layout) => {
    document.documentElement.dataset.page = layout === 'landing' ? 'home' : 'workspace'
  },
  { immediate: true },
)
</script>
<template>
  <div
    v-if="route.matched.length"
    class="app-viewport"
    :inert="!!auth.arrival || !!navigationTransition.current"
    :aria-hidden="auth.arrival || navigationTransition.current ? true : undefined"
  >
    <a href="#main-content" class="skip-link">跳转到主要内容</a>
    <RouterView v-if="route.meta.layout === 'landing'" />
    <ProjectsLayout v-else-if="route.meta.layout === 'projects'" />
    <ProductDocsLayout v-else-if="route.meta.layout === 'docs'" />
    <ManagementLayout v-else-if="route.meta.layout === 'management'" />
    <WorkspaceLayout v-else />
    <ManagementEntry />
    <LoginDialog />
  </div>
  <LoginSuccessTransition
    v-if="auth.arrival"
    :key="auth.arrival.runId"
    :run-id="auth.arrival.runId"
    @complete="finishArrival"
  />
  <BrandTransition
    v-if="navigationTransition.current && !auth.arrival"
    :key="navigationTransition.current.runId"
    :run-id="navigationTransition.current.runId"
    :duration-ms="navigationTransition.current.durationMs"
    :minimum-duration-ms="navigationTransition.current.minimumDurationMs"
    :pending="navigationTransition.current.pending"
    :label="navigationTransition.current.label"
    @complete="finishNavigation"
  />
  <AppDialog
    v-model:open="routeLoadFailureOpen"
    title="页面暂时未能打开"
    description="页面资源加载失败，可能是版本已更新或网络暂时中断。请确认未保存的内容，再重新加载目标页面。"
  >
    <div class="route-load-actions">
      <AppButton @click="routeLoadFailureOpen = false">留在当前页面</AppButton>
      <a :href="routeLoadFailure?.href" class="button button--primary">重新加载页面</a>
    </div>
  </AppDialog>
</template>

<style scoped>
.route-load-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
}
</style>
