<script setup lang="ts">
import { computed } from 'vue'
import './transitions-dev/streaming-text.css'
const props = defineProps<{ text: string; animate: boolean }>()
const chunks = computed(() => {
  const characters = Array.from(props.text),
    result: string[] = []
  for (let i = 0; i < characters.length; i += 6) result.push(characters.slice(i, i + 6).join(''))
  return result
})
</script>
<template>
  <span
    ><span class="sr-only">{{ text }}</span
    ><span aria-hidden="true"
      ><span
        v-for="(chunk, i) in chunks"
        :key="i"
        class="nf-stream-chunk"
        :class="{ 'is-new': animate }"
        :style="{ '--chunk-delay': Math.min(i, 8) * 35 + 'ms' }"
        >{{ chunk }}</span
      ></span
    ></span
  >
</template>
<style scoped>
.nf-stream-chunk.is-new {
  animation: nf-stream-in var(--stream-fade, 350ms) var(--stream-ease) both;
  animation-delay: var(--chunk-delay);
}
@keyframes nf-stream-in {
  from {
    opacity: 0;
    filter: blur(var(--stream-blur, 1px));
  }
  to {
    opacity: 1;
    filter: blur(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .nf-stream-chunk.is-new {
    animation: none !important;
  }
}
</style>
