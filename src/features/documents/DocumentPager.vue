<script setup lang="ts">
import AppIcon from '@/components/icons/AppIcon.vue'
defineProps<{ page: number; pages: number; total: number; loading: boolean; label: string }>()
const emit = defineEmits<{ change: [page: number] }>()
</script>
<template>
  <nav class="document-pager" :aria-label="label">
    <span>共 {{ total }} 条</span>
    <div>
      <button
        type="button"
        :aria-label="`${label}上一页`"
        :disabled="loading || page <= 1"
        @click="emit('change', page - 1)"
      >
        <AppIcon name="chevron-left" :size="16" /></button
      ><span>{{ page }} / {{ pages }}</span
      ><button
        type="button"
        :aria-label="`${label}下一页`"
        :disabled="loading || page >= pages"
        @click="emit('change', page + 1)"
      >
        <AppIcon name="chevron-right" :size="16" />
      </button>
    </div>
  </nav>
</template>
