<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDocumentAccess } from '@/features/documents/useDocumentAccess'
import ProjectDocumentPage from './ProjectDocumentPage.vue'
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
    v-else
    :key="`${access.mode.value}:${auth.user?.id ?? ''}`"
    :read-only="access.mode.value === 'public'"
    @read-only="access.readOnly"
  />
</template>
