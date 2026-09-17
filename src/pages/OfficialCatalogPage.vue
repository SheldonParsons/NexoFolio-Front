<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CatalogSidebar from '@/features/catalog/CatalogSidebar.vue'
import { useAuthStore } from '@/stores/auth'
import { clearCredential } from '@/api/session'
import InterfaceMarkdown from '@/features/documents/InterfaceMarkdown.vue'
import type { ReportSelection } from '@/features/documents/interfaceReport'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const projectId = computed(() => String(route.params.projectId))
const selected = shallowRef<ReportSelection | null>(null)
let expired = false
function unauthorized() {
  if (expired) return
  expired = true
  selected.value = null
  clearCredential()
  auth.user = null
  auth.requestLogin(route.fullPath, '登录已过期，请重新登录。')
  void router.push('/')
}
watch(() => [projectId.value, auth.user?.id], () => {
  expired = false
  selected.value = null
})
</script>

<template>
  <section class="document-reader-shell" aria-label="接口文档">
    <CatalogSidebar
      :key="`${projectId}:${auth.user?.id}`"
      :project-id="projectId"
      @unauthorized="unauthorized"
      @select="selected = $event"
      @clear="selected = null"
    />
    <InterfaceMarkdown v-if="selected" :selection="selected" @unauthorized="unauthorized" />
    <div v-else class="document-reader-empty" aria-hidden="true" />
  </section>
</template>

<style scoped>
.document-reader-shell {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--bg);
}
.document-reader-empty {
  flex: 1;
  min-width: 0;
  background: var(--bg);
}
</style>
