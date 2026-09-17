<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { navigation } from '@/app/navigation'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import { usePreferencesStore } from '@/stores/preferences'
import AppIcon from '@/components/icons/AppIcon.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import CommandMenu from '@/features/navigation/CommandMenu.vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
function signOut() {
  auth.signOut()
  void router.push('/')
}
const preferences = usePreferencesStore()
const mobileOpen = ref(false)
watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false
  },
)
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar" aria-label="主导航">
      <RouterLink to="/" class="brand" aria-label="NexoFolio 首页"><BrandLogo /></RouterLink>
      <div class="workspace-label">
        <span class="workspace-avatar"><AppIcon name="layers" :size="18" /></span>
        <div><strong>知识工作空间</strong><small>让接口知识有迹可循</small></div>
      </div>
      <div class="nav-heading">工作空间</div>
      <nav class="nav-links">
        <RouterLink
          v-for="item in navigation.slice(0, 2)"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          ><AppIcon :name="item.icon" :size="19" />{{ item.label
          }}<span class="nav-active-dot"></span
        ></RouterLink>
      </nav>
      <div class="sidebar-note">
        <span class="note-symbol">✳</span>
        <p>让每一次调用，<br />成为下一次的知识。</p>
        <span class="note-line"></span>
      </div>
      <div class="sidebar-bottom">
        <RouterLink to="/settings" class="nav-link"
          ><AppIcon name="settings" :size="19" />偏好设置</RouterLink
        >
        <div class="sidebar-footer">
          <span class="status-dot"></span><span>个人偏好保存在此浏览器</span>
        </div>
      </div>
    </aside>

    <div class="workspace-body">
      <header class="topbar">
        <div class="breadcrumb">
          <div class="mobile-menu">
            <AppDialog v-model:open="mobileOpen" title="工作空间" description="选择要访问的页面。">
              <template #trigger
                ><button class="icon-button" type="button" aria-label="打开导航菜单">
                  <AppIcon name="menu" /></button
              ></template>
              <nav class="mobile-nav">
                <RouterLink v-for="item in navigation" :key="item.to" :to="item.to" class="nav-link"
                  ><AppIcon :name="item.icon" />{{ item.label }}</RouterLink
                >
              </nav>
            </AppDialog>
          </div>
          <span class="breadcrumb-root">工作空间</span
          ><AppIcon name="chevron-right" :size="14" /><span>{{ route.meta.title }}</span>
        </div>
        <div class="topbar-actions">
          <CommandMenu /><span class="toolbar-divider"></span
          ><button
            class="icon-button"
            type="button"
            :aria-label="preferences.resolvedTheme === 'light' ? '切换深色模式' : '切换浅色模式'"
            @click="preferences.toggleTheme"
          >
            <AppIcon
              :name="preferences.resolvedTheme === 'light' ? 'moon' : 'sun'"
              :size="19"
            /></button
          ><span
            class="profile-placeholder"
            :aria-label="auth.displayName"
            :title="auth.displayName"
            >{{ auth.displayName.slice(0, 1) || 'N' }}</span
          >
          <button type="button" class="button button--ghost" @click="signOut">退出登录</button>
        </div>
      </header>
      <div class="workspace-scroll" data-scroll-container>
        <main id="main-content" tabindex="-1">
          <p v-if="auth.notice" class="inline-notice" role="status">{{ auth.notice }}</p>
          <RouterView />
        </main>
        <footer class="page-footer">
          <span>NexoFolio</span><span>Knowledge, connected.</span>
        </footer>
      </div>
    </div>
  </div>
</template>
