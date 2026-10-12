<script setup lang="ts">
import { watch } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import WorkspaceHeader from './WorkspaceHeader.vue'
import { useAuthStore } from '@/stores/auth'
const auth = useAuthStore()
const router = useRouter()
watch(
  () => auth.canManageProjects,
  (allowed) => {
    if (!allowed) void router.replace(auth.user ? '/projects' : '/')
  },
  { immediate: true },
)
</script>
<template>
  <div v-if="auth.canManageProjects" class="management-layout">
    <WorkspaceHeader />
    <div class="management-shell">
      <aside class="management-sidebar">
        <p class="management-label">管理中心</p>
        <nav aria-label="管理中心">
          <RouterLink to="/management/projects">项目管理</RouterLink>
          <RouterLink to="/management/users">用户管理</RouterLink>
          <RouterLink to="/management/audit">内容审计</RouterLink>
        </nav>
        <RouterLink to="/projects" class="management-back">← 返回工作区</RouterLink>
        <div class="management-identity">
          <strong>{{ auth.displayName }}</strong
          ><span>私人管理空间</span>
        </div>
      </aside>
      <main id="main-content" class="management-main" tabindex="-1">
        <RouterView :key="auth.user?.id" />
      </main>
    </div>
  </div>
</template>
<style scoped>
.management-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg);
}
.management-shell {
  display: grid;
  grid-template-columns: 208px minmax(0, 1fr);
  min-height: 0;
  flex: 1;
}
.management-sidebar {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 32px 16px 24px;
  border-right: 1px solid var(--border);
}
.management-label {
  margin: 0 12px;
  font-size: 12px;
  color: var(--muted);
}
.management-sidebar nav {
  display: grid;
  gap: 6px;
}
.management-sidebar nav a {
  padding: 11px 14px;
  border-radius: 7px;
  font-size: 13px;
  color: var(--text);
}
.management-sidebar nav a:hover {
  background: var(--surface-muted);
}
.management-sidebar nav a.router-link-active {
  background: var(--text);
  color: var(--bg);
}
.management-back {
  border-top: 1px solid var(--border);
  padding: 16px 12px;
  color: var(--muted);
  font-size: 12px;
}
.management-identity {
  display: grid;
  gap: 4px;
  margin-top: auto;
  padding: 0 12px;
  font-size: 12px;
}
.management-identity strong {
  font-weight: 500;
}
.management-identity span {
  color: var(--muted);
}
.management-main {
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.management-sidebar a:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
@media (max-width: 760px) {
  .management-shell {
    display: flex;
    flex-direction: column;
  }
  .management-sidebar {
    flex: none;
    padding: 12px 16px;
    border-right: 0;
    border-bottom: 1px solid var(--border);
    gap: 10px;
  }
  .management-label,
  .management-identity {
    display: none;
  }
  .management-sidebar nav {
    display: flex;
  }
  .management-sidebar nav a {
    flex: 1;
    text-align: center;
  }
  .management-back {
    border: 0;
    padding: 3px 0;
  }
  .management-main {
    flex: 1;
  }
}
</style>
