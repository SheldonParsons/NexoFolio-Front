<script setup lang="ts">
import { AvatarRoot, AvatarImage, AvatarFallback } from 'reka-ui'
defineProps<{ name: string; account: string; src: string | null }>()
</script>
<template>
  <AvatarRoot class="management-user-avatar">
    <AvatarImage v-if="src" :src="src" alt="" referrerpolicy="no-referrer" />
    <AvatarFallback>{{ Array.from(name || account)[0] || 'N' }}</AvatarFallback>
  </AvatarRoot>
</template>
<style scoped>
.management-user-avatar {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  overflow: hidden;
  color: var(--text);
  background: var(--surface-muted);
  font-size: 14px;
  font-weight: 500;
}
.management-user-avatar :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
