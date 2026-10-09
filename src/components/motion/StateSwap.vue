<script setup lang="ts">
import './transitions-dev/text-states-swap.css'
defineProps<{ text: string }>()
</script>
<template>
  <span class="state-swap-frame" aria-live="polite" aria-atomic="true">
    <Transition mode="out-in" enter-from-class="is-enter-start" leave-to-class="is-exit">
      <span :key="text" class="t-text-swap">{{ text }}</span>
    </Transition>
  </span>
</template>
<style scoped>
.state-swap-frame {
  display: block;
  min-height: 22px;
  overflow: hidden;
}
@media (prefers-reduced-motion: reduce) {
  .t-text-swap.is-exit,
  .t-text-swap.is-enter-start {
    transform: none;
    filter: none;
    opacity: 1;
  }
}
</style>
