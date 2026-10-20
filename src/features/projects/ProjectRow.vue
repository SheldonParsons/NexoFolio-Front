<script setup lang="ts">
import { computed } from 'vue'
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui'
import AppIcon from '@/components/icons/AppIcon.vue'
import { useIconInteraction } from '@/components/motion/useIconInteraction'
import { accessLabels, type Project } from './types'
import { curationLabel, curatorLabel } from './curation'
import ProjectHoverFill from './ProjectHoverFill.vue'
const props = defineProps<{
  project: Project
  blocked: boolean
  opening: boolean
}>()
const emit = defineEmits<{
  open: [project: Project]
}>()
const rowMotion = useIconInteraction()
const interacting = computed(() => rowMotion.active.value && (!props.blocked || props.opening))
function open() {
  if (!props.blocked) emit('open', props.project)
}
function clickRow(event: MouseEvent) {
  if (
    (event.target as HTMLElement).closest('button, [data-project-tooltip]') ||
    window.getSelection()?.toString()
  )
    return
  open()
}
</script>
<template>
  <tr
    class="project-row"
    :class="{ 'is-opening': opening, 'is-blocked': blocked }"
    :data-interacting="interacting"
    v-on="rowMotion.events"
    @click="clickRow"
  >
    <td class="project-name-cell">
      <ProjectHoverFill :active="interacting" />
      <button type="button" class="project-name-button" :aria-disabled="blocked" @click.stop="open">
        <span class="project-row-icon" aria-hidden="true">
          <AppIcon name="folder" active-name="folder-open" :active="interacting" :size="22" />
        </span>
        <span class="project-name">{{ project.name }}</span>
      </button>
      <span class="project-mobile-meta">{{ accessLabels[project.access_state] }}</span>
    </td>
    <td class="project-curation-cell">
      <span class="project-mobile-label">最近整理</span>
      <span
        class="project-curation"
        :class="{ 'is-running': project.curation?.state === 'running' }"
      >
        {{ curationLabel(project.curation) }}
      </span>
    </td>
    <td class="project-curator-cell">
      <span class="project-mobile-label">整理人</span>
      <TooltipRoot>
        <TooltipTrigger as-child>
          <span
            tabindex="0"
            data-project-tooltip
            class="project-curator"
            :aria-label="`整理人：${curatorLabel(project.curation)}`"
            @click.stop
          >
            {{ curatorLabel(project.curation) }}
          </span>
        </TooltipTrigger>
        <TooltipPortal
          ><TooltipContent class="nf-project-tooltip" :side-offset="8" :collision-padding="12">
            {{ curatorLabel(project.curation) }}
          </TooltipContent></TooltipPortal
        >
      </TooltipRoot>
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
        :aria-label="`${project.can_access ? '进入' : '只读查看：'}${project.name}`"
        @click.stop="open"
      >
        <span class="project-enter-label sr-only">{{
          opening ? '确认中' : project.can_access ? '进入项目' : '只读查看'
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
