<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import { useIconInteraction } from '@/components/motion/useIconInteraction'
import { useMarqueeOverflow } from './useMarqueeOverflow'
import type { FolderRow } from './catalogTree'

const props = defineProps<{ row: FolderRow; index: number }>()
const emit = defineEmits<{ toggle: [key: string] }>()
const motion = useIconInteraction()
const nameElement = ref<HTMLElement>()
const label = computed(() => props.row.name)
const marquee = useMarqueeOverflow(nameElement, label)
// Rows stream in from the top; past the first screenful the stagger would only
// delay content nobody is looking at yet.
const enterDelay = computed(() => `${Math.min(props.index, 14) * 26}ms`)
</script>

<template>
  <button
    type="button"
    class="ct-row ct-folder"
    :class="{ 'is-open': row.expanded }"
    :style="{ '--row-depth': row.depth, '--row-enter-delay': enterDelay }"
    :data-interacting="motion.active.value"
    :aria-expanded="row.expanded"
    v-on="motion.events"
    @click="emit('toggle', row.key)"
  >
    <span class="ct-rails" aria-hidden="true">
      <i v-for="(guide, level) in row.guides" :key="level" :class="{ 'is-drawn': guide }"></i>
    </span>
    <span class="ct-twist" aria-hidden="true">
      <AppIcon name="chevron-right" :size="14" />
    </span>
    <span class="ct-folder-icon" aria-hidden="true">
      <AppIcon name="folder" active-name="folder-open" :active="row.expanded" :size="17" />
    </span>
    <span
      ref="nameElement"
      class="ct-name"
      :class="{ 'is-overflowing': marquee.overflowing.value }"
      :style="marquee.style()"
      ><b>{{ row.name }}</b></span
    >
    <span v-if="row.summary" class="ct-folder-summary">{{ row.summary }}</span>
    <span class="ct-count" :class="{ 'is-busy': row.loading }">
      <span v-if="row.loading" class="ct-pulse" aria-hidden="true"><i></i><i></i><i></i></span>
      <template v-else>{{ row.count }}</template>
    </span>
  </button>
</template>
