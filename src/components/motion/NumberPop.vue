<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import './transitions-dev/number-pop-in.css'
const props = defineProps<{ value: number | string }>()
const text = computed(() => String(props.value))
const changed = ref(false)
const direction = ref(1)
watch(text, (value, previous) => {
  direction.value = Number(value) < Number(previous) ? -1 : 1
  changed.value = true
})
</script>
<template>
  <span class="number-pop" :style="{ '--digit-dir-y': direction }">
    <span class="sr-only">{{ text }}</span>
    <span :key="text" class="t-digit-group" :class="{ 'is-animating': changed }" aria-hidden="true">
      <span
        v-for="(character, index) in text"
        :key="index"
        class="t-digit"
        :data-stagger="index === text.length - 2 ? 1 : index === text.length - 1 ? 2 : undefined"
        >{{ character }}</span
      >
    </span>
  </span>
</template>
<style scoped>
.number-pop {
  display: inline-flex;
  align-items: baseline;
  flex: none;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
</style>
