<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createHoverCells, HOVER_CELL_SIZE, HOVER_CELL_GAP, HOVER_FILL_RATIO } from './hoverCells'

const props = withDefaults(
  defineProps<{ active: boolean; cellSize?: number; cellGap?: number }>(),
  {
    cellSize: HOVER_CELL_SIZE,
    cellGap: HOVER_CELL_GAP,
  },
)
const element = ref<HTMLElement>()
const columns = ref(1)
const rows = ref(1)
const run = ref(0)
const cells = computed(() => createHoverCells(columns.value, rows.value))
let observer: ResizeObserver | undefined
function measure() {
  if (!element.value) return
  const bounds = element.value.getBoundingClientRect()
  const pitch = props.cellSize + props.cellGap
  columns.value = Math.max(1, Math.ceil((bounds.width * HOVER_FILL_RATIO + props.cellGap) / pitch))
  rows.value = Math.max(1, Math.floor((bounds.height + props.cellGap) / pitch))
}
watch(
  () => props.active,
  (active) => {
    if (active) run.value++
  },
  { immediate: true },
)
watch(() => [props.cellSize, props.cellGap], measure, { flush: 'post' })
onMounted(() => {
  measure()
  observer = new ResizeObserver(measure)
  if (element.value) observer.observe(element.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <span ref="element" class="project-hover-fill" :data-active="active" aria-hidden="true">
    <span v-if="run > 0" :key="run" class="project-hover-progress">
      <span
        class="project-hover-cells"
        :style="{
          '--cell-columns': columns,
          '--cell-size': `${cellSize}px`,
          '--cell-gap': `${cellGap}px`,
        }"
      >
        <span v-for="cell in cells" :key="cell.id" class="project-hover-cell" :style="cell.style" />
      </span>
    </span>
  </span>
</template>

<style scoped>
.project-hover-fill {
  position: absolute;
  inset: 2px 0;
  z-index: 0;
  overflow: hidden;
  border-radius: 7px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 200ms var(--project-ease, cubic-bezier(0.22, 1, 0.36, 1));
}
.project-hover-progress {
  position: absolute;
  inset: 0 auto 0 0;
  width: 70%;
  overflow: hidden;
  mask-image: linear-gradient(90deg, transparent 0%, #000 14%, #000 86%, transparent 100%);
}
.project-hover-cells {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(var(--cell-columns), var(--cell-size));
  grid-auto-rows: var(--cell-size);
  gap: var(--cell-gap);
  align-content: center;
}
.project-hover-cell {
  width: var(--cell-size);
  height: var(--cell-size);
  border-radius: 2px;
  background: color-mix(in srgb, var(--text) 8%, transparent);
  filter: blur(var(--cell-edge-blur, 0px));
  transform: scale(0);
  animation:
    project-cell-ignite 180ms ease-out forwards,
    project-cell-flicker 420ms ease-in-out infinite;
  animation-delay: var(--cell-delay), var(--cell-delay);
  animation-play-state: paused, paused;
}
.project-hover-fill[data-active='true'] {
  opacity: 1;
}
.project-hover-fill[data-active='true'] .project-hover-cell {
  animation-play-state: running, running;
}
@keyframes project-cell-ignite {
  to {
    transform: scale(1);
  }
}
@keyframes project-cell-flicker {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: var(--cell-min-opacity, 0.6);
  }
}
@media (prefers-reduced-motion: reduce) {
  .project-hover-fill {
    display: none;
    transition: none;
  }
  .project-hover-cell {
    animation: none;
  }
}
</style>
