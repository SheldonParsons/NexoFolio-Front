<script setup lang="ts">
import type { Project } from '@/features/projects/types'
import NavigationRecentProject from './NavigationRecentProject.vue'

defineProps<{
  items: Project[]
  currentId: string
  openingId: string | null
  loading: boolean
  message: string
}>()
const emit = defineEmits<{ enter: [project: Project] }>()
</script>

<template>
  <div class="navigation-recent" :aria-busy="loading">
    <p class="navigation-eyebrow">最近访问</p>
    <ul v-if="items.length" class="navigation-recent-list" aria-label="最近访问的项目">
      <li v-for="project in items" :key="project.project_id">
        <NavigationRecentProject
          :project="project"
          :current="project.project_id === currentId"
          :blocked="!!openingId"
          :opening="openingId === project.project_id"
          @enter="emit('enter', $event)"
        />
      </li>
    </ul>
    <p v-else class="navigation-recent-empty" role="status">{{ message }}</p>
  </div>
</template>
