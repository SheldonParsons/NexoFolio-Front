<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { Folder } from '@/contracts/knowledge/types'
import { documentLocation } from './documentRoutes'
defineProps<{ path: Folder[]; projectId: string; environmentId: string }>()
</script>
<template>
  <nav class="document-breadcrumbs" aria-label="文档路径">
    <RouterLink :to="documentLocation(projectId, null, environmentId)">项目文档</RouterLink
    ><template v-for="folder in path" :key="folder.id"
      ><span aria-hidden="true">/</span
      ><RouterLink
        :to="documentLocation(projectId, { kind: 'folder', id: folder.id }, environmentId)"
        >{{ folder.name }}</RouterLink
      ></template
    >
  </nav>
</template>
