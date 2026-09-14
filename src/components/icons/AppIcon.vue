<script setup lang="ts">
import { MorphIcon } from 'morphicons/vue'
import { icons, staticIcons, type IconName } from './registry'

withDefaults(
  defineProps<{ name: IconName; size?: number; label?: string; mode?: 'morph' | 'static' }>(),
  { size: 20, mode: 'morph' },
)
</script>

<template>
  <MorphIcon
    v-if="mode === 'morph'"
    class="app-icon"
    :icon="icons[name]"
    :size="size"
    :stroke-width="1.7"
    :label="label"
    reduced-motion="user"
    spring="smooth"
  />
  <component
    :is="staticIcons[name]"
    v-else
    class="app-icon"
    :size="size"
    :stroke-width="1.7"
    :aria-hidden="label ? undefined : true"
    :aria-label="label"
    :role="label ? 'img' : undefined"
  />
</template>

<style scoped>
.app-icon {
  flex: none;
  vertical-align: middle;
}
</style>
