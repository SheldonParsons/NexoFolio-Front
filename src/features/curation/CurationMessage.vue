<script setup lang="ts">
import BrandLogo from '@/components/brand/BrandLogo.vue'
import ProcessingMark from './ProcessingMark.vue'
import type { ProcessingState } from './workPresentation'
withDefaults(
  defineProps<{ label: string; state?: ProcessingState; animate?: boolean; at?: string }>(),
  { state: 'idle', animate: false },
)
</script>
<template>
  <article class="curation-answer" :data-state="state">
    <header class="curation-answer-author">
      <span class="curation-answer-avatar"><BrandLogo variant="icon" /></span>
      <div>
        <strong>NexoFolio</strong>
        <span class="curation-answer-label"
          ><ProcessingMark :state="state" :animate="animate" />{{ label }}</span
        >
      </div>
      <time v-if="at" :datetime="at">{{
        new Date(at).toLocaleTimeString('zh-CN', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        })
      }}</time>
    </header>
    <div class="curation-answer-body"><slot /></div>
    <footer v-if="$slots.details" class="curation-answer-details"><slot name="details" /></footer>
  </article>
</template>
