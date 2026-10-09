<script setup lang="ts">
import './transitions-dev/thinking-states.css'
defineProps<{ text: string; busy: boolean }>()
</script>
<template>
  <span
    class="nf-thinking"
    :class="{ 'is-busy': busy }"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <Transition name="thinking-swap">
      <span :key="text" class="t-think-text" :data-text="text">{{ text }}</span>
    </Transition>
  </span>
</template>
<style scoped>
.nf-thinking {
  position: relative;
  display: block;
  min-height: 22px;
  overflow: hidden;
}
.nf-thinking .t-think-text {
  position: relative;
  white-space: normal;
  --think-base: var(--muted);
  --think-highlight: var(--text);
}
.nf-thinking:not(.is-busy) .t-think-text::before {
  display: none;
}
.thinking-swap-enter-active,
.thinking-swap-leave-active {
  transition:
    transform 150ms ease-in-out,
    filter 150ms ease-in-out,
    opacity 150ms ease-in-out;
}
.thinking-swap-leave-active {
  position: absolute !important;
  width: 100%;
}
.thinking-swap-enter-from {
  transform: translateY(6px);
  filter: blur(2px);
  opacity: 0;
}
.thinking-swap-leave-to {
  transform: translateY(-6px);
  filter: blur(2px);
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .thinking-swap-enter-active,
  .thinking-swap-leave-active {
    transition: none !important;
  }
}
</style>
