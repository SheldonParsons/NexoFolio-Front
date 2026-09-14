<script setup lang="ts">
import AppIcon from '@/components/icons/AppIcon.vue'
import type { IconName } from '@/components/icons/registry'
withDefaults(defineProps<{ title: string; description: string; icon?: IconName }>(), {
  icon: 'folder',
})
</script>

<template>
  <section class="empty-state">
    <div class="empty-illustration" aria-hidden="true">
      <div class="illustration-orbit"></div>
      <div class="illustration-tile tile-back"><AppIcon name="code" :size="28" /></div>
      <div class="illustration-tile tile-front"><AppIcon :name="icon" :size="34" /></div>
      <span class="illustration-dot"></span>
    </div>
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
    <div v-if="$slots.default" class="empty-actions"><slot /></div>
  </section>
</template>
