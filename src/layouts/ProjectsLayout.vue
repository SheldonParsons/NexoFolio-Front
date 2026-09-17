<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import WorkspaceHeader from './WorkspaceHeader.vue'
import { useAuthStore } from '@/stores/auth'
const auth = useAuthStore()
const route = useRoute()
const watermarkUrl = `url("${import.meta.env.BASE_URL}brand/nexofolio-icon.svg")`
</script>
<template>
  <div class="projects-layout">
    <WorkspaceHeader />
    <main id="main-content" class="projects-main" tabindex="-1">
      <div
        v-if="route.name !== 'projects'"
        class="projects-watermark"
        :style="{ maskImage: watermarkUrl, WebkitMaskImage: watermarkUrl }"
        aria-hidden="true"
      ></div>
      <p v-if="auth.notice" class="projects-notice" role="status">{{ auth.notice }}</p>
      <RouterView />
    </main>
  </div>
</template>
<style scoped>
.projects-layout {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}
.projects-main {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: clip;
}
.projects-watermark {
  position: absolute;
  right: -90px;
  bottom: -90px;
  width: clamp(380px, 48vw, 780px);
  aspect-ratio: 522 / 483;
  background: var(--text);
  opacity: var(--project-watermark-opacity);
  mask-size: contain;
  mask-position: center;
  mask-repeat: no-repeat;
  pointer-events: none;
  user-select: none;
  z-index: -1;
}
.projects-notice {
  font-size: 12px;
  padding: 10px 32px;
  color: var(--muted);
  border-bottom: var(--line-width) solid var(--border);
}
</style>
