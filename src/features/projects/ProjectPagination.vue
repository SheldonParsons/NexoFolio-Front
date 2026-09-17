<script setup lang="ts">
import AppIcon from '@/components/icons/AppIcon.vue'
import { useIconInteraction } from '@/components/motion/useIconInteraction'
const previousMotion = useIconInteraction()
const nextMotion = useIconInteraction()
defineProps<{
  page: number
  pages: number
  total: number
  limit: number
  busy: boolean
  filtered: boolean
  error: boolean
  hasResult: boolean
  showProgress: boolean
}>()
const emit = defineEmits<{ page: [value: number] }>()
</script>
<template>
  <footer class="project-pagination">
    <span role="status" aria-live="polite">{{
      error
        ? '未能获取项目列表'
        : !hasResult
          ? showProgress
            ? '正在加载项目…'
            : '\u00a0'
          : `${total ? (page - 1) * limit + 1 : 0}–${Math.min(page * limit, total)}，共 ${total} 个${filtered ? '匹配' : ''}项目`
    }}</span>
    <nav aria-label="项目分页">
      <button
        type="button"
        aria-label="上一页"
        :disabled="page <= 1 || busy || error"
        v-on="previousMotion.events"
        @click="emit('page', page - 1)"
      >
        <AppIcon
          name="chevron-left"
          active-name="arrow-left"
          :active="previousMotion.active.value && page > 1 && !busy && !error"
          :size="18"
        /></button
      ><span class="project-page-number"
        >{{ page }}<span>/ {{ pages }}</span></span
      ><button
        type="button"
        aria-label="下一页"
        :disabled="page >= pages || busy || error"
        v-on="nextMotion.events"
        @click="emit('page', page + 1)"
      >
        <AppIcon
          name="chevron-right"
          active-name="arrow-right"
          :active="nextMotion.active.value && page < pages && !busy && !error"
          :size="18"
        />
      </button>
    </nav>
  </footer>
</template>
