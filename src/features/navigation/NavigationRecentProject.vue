<script setup lang="ts">
import { computed } from 'vue'
import { NavigationMenuLink } from 'reka-ui'
import AppIcon from '@/components/icons/AppIcon.vue'
import { useIconInteraction } from '@/components/motion/useIconInteraction'
import ProjectHoverFill from '@/features/projects/ProjectHoverFill.vue'
import type { Project } from '@/features/projects/types'

const props = defineProps<{
  project: Project
  current: boolean
  blocked: boolean
  opening: boolean
}>()
const emit = defineEmits<{ enter: [project: Project] }>()
const motion = useIconInteraction()
const interacting = computed(() => motion.active.value && (!props.blocked || props.opening))
function enter(event: Event) {
  event.preventDefault()
  if (!props.blocked) emit('enter', props.project)
}
</script>

<template>
  <NavigationMenuLink as-child @select="enter">
    <button
      type="button"
      class="navigation-recent-link"
      :class="{ 'is-current': current }"
      :data-interacting="interacting"
      :aria-current="current ? 'true' : undefined"
      :aria-disabled="blocked"
      :aria-busy="opening"
      v-on="motion.events"
    >
      <ProjectHoverFill :active="interacting" :cell-size="9" :cell-gap="2" />
      <span class="navigation-recent-icon" aria-hidden="true">
        <AppIcon name="folder" active-name="folder-open" :active="interacting" :size="16" />
      </span>
      <span data-navigation-project-name>{{ project.name }}</span>
      <AppIcon
        v-if="current"
        class="navigation-recent-check"
        name="check"
        mode="static"
        :size="14"
      />
    </button>
  </NavigationMenuLink>
</template>
