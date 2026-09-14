<script setup lang="ts">
import AppIcon from '@/components/icons/AppIcon.vue'
import type { IconName } from '@/components/icons/registry'

withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost'
    icon?: IconName
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
  }>(),
  { variant: 'secondary', type: 'button' },
)
</script>

<template>
  <button :type="type" :disabled="disabled" class="button" :class="`button--${variant}`">
    <AppIcon v-if="icon" :name="icon" :size="17" />
    <slot />
  </button>
</template>
