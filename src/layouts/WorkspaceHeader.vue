<script setup lang="ts">
import { RouterLink, useRoute, useRouter } from 'vue-router'
import WorkspaceNavigation from '@/features/navigation/WorkspaceNavigation.vue'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import { useIconInteraction } from '@/components/motion/useIconInteraction'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'

const auth = useAuthStore()
const preferences = usePreferencesStore()
const router = useRouter()
const route = useRoute()
const themeMotion = useIconInteraction()
const exitMotion = useIconInteraction()
function logout() {
  auth.signOut()
  void router.push('/')
}
</script>

<template>
  <header
    class="projects-topbar workspace-header"
    :class="{ 'workspace-header--fluid': !!route.params.projectId }"
  >
    <div class="workspace-header-inner">
      <RouterLink to="/" class="workspace-brand" aria-label="NexoFolio 首页"
        ><BrandLogo
      /></RouterLink>
      <WorkspaceNavigation />
      <div class="workspace-utilities">
        <button
          class="workspace-tool workspace-theme"
          type="button"
          :aria-label="preferences.resolvedTheme === 'light' ? '切换深色模式' : '切换浅色模式'"
          :title="preferences.resolvedTheme === 'light' ? '切换深色模式' : '切换浅色模式'"
          v-on="themeMotion.events"
          @click="preferences.toggleTheme"
        >
          <AppIcon
            :name="preferences.resolvedTheme === 'light' ? 'moon' : 'sun'"
            :active-name="preferences.resolvedTheme === 'light' ? 'moon-star' : 'sun-medium'"
            :active="themeMotion.active.value"
            :size="21"
          />
        </button>
        <span v-if="auth.user" class="workspace-utilities-divider" aria-hidden="true"></span>
        <div v-if="auth.user" class="workspace-identity" :title="auth.displayName">
          <span class="workspace-avatar">{{ auth.displayName.slice(0, 1) || 'N' }}</span>
          <span class="workspace-user-name">{{ auth.displayName }}</span>
        </div>
        <button
          v-if="auth.user"
          type="button"
          class="workspace-tool workspace-exit"
          aria-label="退出登录"
          title="退出登录"
          v-on="exitMotion.events"
          @click="logout"
        >
          <AppIcon
            name="log-out"
            active-name="door-open"
            :active="exitMotion.active.value"
            :size="19"
          />
          <span>退出</span>
        </button>
        <RouterLink v-else to="/projects" class="workspace-tool workspace-enter"
          >进入 NexoFolio</RouterLink
        >
      </div>
    </div>
  </header>
</template>

<style scoped>
.workspace-header {
  position: relative;
  z-index: 20;
  flex: none;
  height: 56px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  transition:
    background-color 160ms,
    border-color 160ms;
}
.workspace-header-inner {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 44px;
  width: 100%;
  max-width: 1440px;
  height: 100%;
  margin: 0 auto;
  padding-inline: var(--workspace-header-gutter, 40px);
}
.workspace-header--fluid {
  --workspace-header-gutter: 32px;
}
.workspace-header--fluid .workspace-header-inner {
  max-width: none;
}
.workspace-brand {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  min-height: 44px;
  border-radius: 8px;
}
.workspace-brand :deep(.brand-logo-icon) {
  width: 26px;
}
.workspace-brand :deep(.brand-logo-text) {
  width: 118px;
}
.workspace-utilities,
.workspace-identity {
  display: flex;
  align-items: center;
}
.workspace-utilities {
  gap: 10px;
  justify-self: end;
}
.workspace-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  flex: none;
  min-width: 40px;
  height: 40px;
  padding: 0 9px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: var(--muted);
  transition:
    color 160ms,
    background-color 160ms,
    border-color 160ms;
}
.workspace-tool:hover,
.workspace-tool:focus-visible {
  background: var(--surface-muted);
  color: var(--text);
}
.workspace-utilities-divider {
  width: 1px;
  height: 18px;
  background: var(--border);
  margin-inline: 2px;
}
.workspace-identity {
  gap: 8px;
}
.workspace-avatar {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: 50%;
  background: var(--text);
  color: var(--bg);
  font-size: 11px;
  font-weight: 500;
}
.workspace-user-name {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
}
.workspace-exit {
  font-size: 12px;
}
.workspace-enter {
  font-size: 12px;
  white-space: nowrap;
  color: var(--text);
}
.workspace-tool:focus-visible,
.workspace-brand:focus-visible {
  outline: 2px solid var(--input-focus-border);
  outline-offset: -2px;
}
@media (max-width: 1100px) {
  .workspace-header-inner {
    gap: 24px;
    padding-inline: 24px;
  }
  .workspace-user-name,
  .workspace-exit > span {
    display: none;
  }
  .workspace-utilities {
    gap: 6px;
  }
}
@media (max-width: 850px) {
  .workspace-header-inner {
    gap: 16px;
    padding-inline: 20px;
  }
  .workspace-brand :deep(.brand-logo-text) {
    width: 100px;
  }
}
@media (max-width: 1280px) {
  .workspace-header {
    height: auto;
  }
  .workspace-header-inner {
    grid-template-columns: 1fr auto;
    gap: 0 12px;
    padding: 4px 16px 0;
  }
  .workspace-brand {
    min-height: 36px;
  }
  .workspace-header :deep(.workspace-navigation-trigger) {
    min-height: 36px;
  }
  .workspace-header :deep(.workspace-navigation) {
    padding-bottom: 6px;
  }
  .workspace-utilities {
    grid-column: 2;
    grid-row: 1;
  }
  .workspace-utilities-divider {
    display: none;
  }
  .workspace-brand :deep(.brand-logo-text) {
    width: 110px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .workspace-header,
  .workspace-tool {
    transition: none;
  }
}
</style>
