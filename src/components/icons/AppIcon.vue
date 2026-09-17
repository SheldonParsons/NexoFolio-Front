<script setup lang="ts">
import { computed } from 'vue'
import { MorphIcon } from 'morphicons/vue'
import { icons, staticIcons, type IconName } from './registry'

const props = withDefaults(
  defineProps<{
    name: IconName
    activeName?: IconName
    active?: boolean
    size?: number
    label?: string
    mode?: 'morph' | 'static'
  }>(),
  { size: 20, mode: 'morph' },
)
const currentName = computed(() =>
  props.active && props.activeName ? props.activeName : props.name,
)
</script>

<template>
  <MorphIcon
    v-if="mode === 'morph'"
    class="app-icon"
    :icon="icons[currentName]"
    :data-icon="currentName"
    :size="size"
    :stroke-width="1.7"
    :label="label"
    reduced-motion="user"
    :spring="activeName ? 'snappy' : 'smooth'"
  />
  <component
    :is="staticIcons[currentName]"
    :data-icon="currentName"
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
