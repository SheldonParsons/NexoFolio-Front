<script setup lang="ts">
import AppIcon from '@/components/icons/AppIcon.vue'
import MatrixLoader from '@/components/motion/MatrixLoader.vue'
import type { ProcessingState } from './workPresentation'
import './processing-mark.css'
withDefaults(defineProps<{ state: ProcessingState; animate?: boolean }>(), { animate: true })
</script>
<template>
  <span class="processing-mark" :data-state="state" :data-animate="animate" aria-hidden="true">
    <Transition name="processing-mark-swap">
      <span :key="state" class="processing-mark-glyph">
        <MatrixLoader v-if="state === 'working'" />
        <svg v-else-if="state === 'saved'" class="processing-check" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" />
          <path pathLength="1" d="m7.5 12 3 3 6-6" />
        </svg>
        <AppIcon v-else-if="state === 'retrying'" name="circle-dashed" :size="16" mode="static" />
        <AppIcon v-else-if="state === 'saving'" name="layers" :size="16" mode="static" />
        <AppIcon v-else-if="state === 'gap'" name="circle-help" :size="16" mode="static" />
        <AppIcon v-else name="circle" :size="9" mode="static" />
      </span>
    </Transition>
  </span>
</template>
