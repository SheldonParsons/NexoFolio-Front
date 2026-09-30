<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import { useIconInteraction } from '@/components/motion/useIconInteraction'
import { useMarqueeOverflow } from './useMarqueeOverflow'
import { createHoverCells, HOVER_CELL_GAP, HOVER_CELL_SIZE } from '@/features/projects/hoverCells'
import type { EndpointRow } from './catalogTree'

const props = defineProps<{
  row: EndpointRow
  index: number
  selected: boolean
  describing: boolean
  locked: boolean
}>()
const emit = defineEmits<{ open: [id: string]; describe: [id: string] }>()

const motion = useIconInteraction()
const interacting = computed(() => motion.active.value)
const nameElement = ref<HTMLElement>()

// The name is what describe wrote; before it runs the path is the only label there is.
const label = computed(() => props.row.card.name || props.row.card.path)
const marquee = useMarqueeOverflow(nameElement, label)
const unnamed = computed(() => !props.row.card.name)

const cells = createHoverCells(24, 2)
const cellStyle = {
  '--cell-columns': 24,
  '--cell-size': `${HOVER_CELL_SIZE}px`,
  '--cell-gap': `${HOVER_CELL_GAP}px`,
}
const enterDelay = computed(() => `${Math.min(props.index, 18) * 22}ms`)
const method = computed(() => props.row.card.method.toUpperCase())
</script>

<template>
  <div
    class="ct-row ct-endpoint"
    :class="{ 'is-selected': selected, 'is-busy': describing, 'is-unnamed': unnamed }"
    :style="{ '--row-depth': row.depth, '--row-enter-delay': enterDelay }"
    :data-interacting="interacting"
    v-on="motion.events"
  >
    <!-- The row and the describe action are two separate controls, so the opener is
         a stretched button rather than a clickable row wrapping another button. -->
    <button
      type="button"
      class="ct-open"
      :aria-pressed="selected"
      @click="emit('open', row.card.interface_id)"
    >
      <span class="ct-sr">{{ label }}</span>
    </button>

    <span class="ct-hover-fill" aria-hidden="true">
      <span class="ct-hover-cells" :style="cellStyle">
        <span v-for="cell in cells" :key="cell.id" class="ct-hover-cell" :style="cell.style"></span>
      </span>
    </span>

    <span class="ct-rails" aria-hidden="true">
      <i v-for="(guide, level) in row.guides" :key="level" :class="{ 'is-drawn': guide }"></i>
      <b :class="{ 'is-last': row.last }"></b>
    </span>

    <span class="ct-method" :data-method="method" aria-hidden="true">{{ method }}</span>

    <span
      ref="nameElement"
      class="ct-name"
      :class="{ 'is-overflowing': marquee.overflowing.value }"
      :style="marquee.style()"
      aria-hidden="true"
      ><b>{{ label }}</b></span
    >

    <span v-if="row.card.name" class="ct-path" aria-hidden="true">{{ row.card.path }}</span>

    <span class="ct-row-tail">
      <button
        type="button"
        class="ct-describe"
        :aria-busy="describing"
        :aria-disabled="locked"
        :aria-label="row.card.name ? '重新生成接口说明' : '生成接口说明'"
        @click.stop="!locked && emit('describe', row.card.interface_id)"
      >
        <span v-if="describing" class="ct-pulse" aria-hidden="true"><i></i><i></i><i></i></span>
        <AppIcon v-else name="scan-search" :size="15" />
      </button>
      <AppIcon
        class="ct-row-arrow"
        name="arrow-up-right"
        active-name="arrow-right"
        :active="interacting"
        :size="15"
      />
    </span>
  </div>
</template>
