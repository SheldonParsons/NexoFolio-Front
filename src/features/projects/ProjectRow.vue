<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui'
import AppIcon from '@/components/icons/AppIcon.vue'
import { useIconInteraction } from '@/components/motion/useIconInteraction'
import type { IconName } from '@/components/icons/registry'
import { accessLabels, statusLabels, type Project } from './types'
import { createHoverCells, HOVER_CELL_SIZE, HOVER_CELL_GAP, HOVER_FILL_RATIO } from './hoverCells'
const props = defineProps<{ project: Project; blocked: boolean; opening: boolean }>()
const emit = defineEmits<{ open: [project: Project] }>()
const rowMotion = useIconInteraction()
const interacting = computed(() => rowMotion.active.value && (!props.blocked || props.opening))
const hoverRun = ref(0)
const rowElement = ref<HTMLTableRowElement>()
const cellColumns = ref(1)
const cellRows = ref(3)
const hoverCells = computed(() => createHoverCells(cellColumns.value, cellRows.value))
watch(interacting, (active) => {
  if (active) hoverRun.value++
})
const nameElement = ref<HTMLElement>()
const truncated = ref(false)
let sizeObserver: ResizeObserver | undefined
function measureName() {
  const element = nameElement.value
  truncated.value = !!element && element.scrollWidth > element.clientWidth + 1
  const row = rowElement.value
  if (row) {
    const bounds = row.getBoundingClientRect()
    const pitch = HOVER_CELL_SIZE + HOVER_CELL_GAP
    cellColumns.value = Math.max(
      1,
      Math.ceil((bounds.width * HOVER_FILL_RATIO + HOVER_CELL_GAP) / pitch),
    )
    cellRows.value = Math.max(1, Math.floor((bounds.height - 4 + HOVER_CELL_GAP) / pitch))
  }
}
onMounted(() => {
  measureName()
  sizeObserver = new ResizeObserver(measureName)
  if (nameElement.value) sizeObserver.observe(nameElement.value)
  if (rowElement.value) sizeObserver.observe(rowElement.value)
})
watch(
  () => props.project.name,
  async () => {
    await nextTick()
    measureName()
  },
)
onBeforeUnmount(() => sizeObserver?.disconnect())
const statusIcons: Record<string, IconName> = {
  doing: 'circle-dashed',
  wait: 'circle',
  suspended: 'circle-pause',
  closed: 'circle-check',
}
function open() {
  if (!props.blocked) emit('open', props.project)
}
function clickRow(event: MouseEvent) {
  if ((event.target as HTMLElement).closest('button') || window.getSelection()?.toString()) return
  open()
}
</script>
<template>
  <tr
    ref="rowElement"
    class="project-row"
    :class="{ 'is-opening': opening, 'is-blocked': blocked }"
    :data-interacting="interacting"
    v-on="rowMotion.events"
    @click="clickRow"
  >
    <td class="project-name-cell">
      <span class="project-hover-fill" aria-hidden="true">
        <span v-if="hoverRun > 0" :key="hoverRun" class="project-hover-progress">
          <span
            class="project-hover-cells"
            :style="{
              '--cell-columns': cellColumns,
              '--cell-size': `${HOVER_CELL_SIZE}px`,
              '--cell-gap': `${HOVER_CELL_GAP}px`,
            }"
          >
            <span
              v-for="cell in hoverCells"
              :key="cell.id"
              class="project-hover-cell"
              :style="cell.style"
            ></span>
          </span>
        </span>
      </span>
      <TooltipRoot :disabled="!truncated"
        ><TooltipTrigger as-child
          ><button
            type="button"
            class="project-name-button"
            :aria-disabled="blocked"
            @click.stop="open"
          >
            <span class="project-row-icon" aria-hidden="true"
              ><AppIcon
                name="folder"
                active-name="folder-open"
                :active="interacting"
                :size="22" /></span
            ><span ref="nameElement" class="project-name">{{ project.name }}</span>
          </button></TooltipTrigger
        ><TooltipPortal
          ><TooltipContent
            class="nf-project-tooltip"
            align="start"
            :side-offset="8"
            :collision-padding="12"
            >{{ project.name }}</TooltipContent
          ></TooltipPortal
        ></TooltipRoot
      >
      <span class="project-mobile-meta"
        ><span>{{ statusLabels[project.status] || '未知状态' }}</span
        ><span aria-hidden="true">·</span
        ><span>{{ accessLabels[project.access_state] }}</span></span
      >
    </td>
    <td class="project-status-cell">
      <span class="project-status"
        ><AppIcon :name="statusIcons[project.status] || 'circle'" :size="15" />{{
          statusLabels[project.status] || '未知状态'
        }}</span
      >
    </td>
    <td class="project-access-cell">
      <span class="project-access"
        ><span v-if="project.access_state === 'allowed'" class="permission-allowed"
          ><AppIcon name="check" :size="10" /></span
        ><AppIcon
          v-else
          :name="project.access_state === 'unknown' ? 'circle-help' : 'lock'"
          :size="15"
        />{{ accessLabels[project.access_state] }}</span
      >
    </td>
    <td class="project-action-cell">
      <button
        type="button"
        class="project-enter"
        :aria-disabled="blocked"
        :aria-busy="opening"
        :aria-label="`${project.can_access ? '进入' : '查看访问说明：'}${project.name}`"
        @click.stop="open"
      >
        <span class="project-enter-label sr-only">{{
          opening ? '确认中' : project.can_access ? '进入项目' : '查看原因'
        }}</span
        ><AppIcon
          v-if="!opening"
          name="arrow-up-right"
          active-name="arrow-right"
          :active="interacting"
          :size="18"
        /><span v-else class="project-progress" aria-hidden="true"><i></i><i></i><i></i></span>
      </button>
    </td>
  </tr>
</template>
