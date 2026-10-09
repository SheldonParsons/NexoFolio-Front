<script setup lang="ts">
import './transitions-dev/matrix-loader.css'
</script>
<template>
  <span class="t-matrix nf-matrix" aria-hidden="true"
    ><i
      v-for="index in 16"
      :key="index"
      :style="{ '--d': (((index - 1) % 4) + Math.floor((index - 1) / 4)) * 120 }"
    ></i
  ></span>
</template>
<style scoped>
.nf-matrix {
  --matrix-base: var(--border);
  --matrix-active: var(--text);
  flex: none;
}
</style>
