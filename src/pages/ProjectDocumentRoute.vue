<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDocumentAccess } from '@/features/documents/useDocumentAccess'
import ProjectDocumentPage from './ProjectDocumentPage.vue'
import PublicDocumentPage from './PublicDocumentPage.vue'
const route = useRoute()
const auth = useAuthStore()
const access = useDocumentAccess(
  () => String(route.params.projectId),
  () => auth.user?.id,
)
</script>
<template>
  <div v-if="access.mode.value === 'checking'" class="document-large-state" role="status">
    正在读取文档…
  </div>
  <ProjectDocumentPage
    v-else-if="access.mode.value === 'member'"
    :key="auth.user?.id"
    @read-only="access.readOnly"
  />
  <PublicDocumentPage v-else />
</template>
