<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from 'reka-ui'
import AppIcon from '@/components/icons/AppIcon.vue'
import { formatTime } from '@/features/documents/presentation'
import { candidateStateLabels, type Candidate, type CandidateSummary } from './types'
import './run-picker.css'
const props = defineProps<{ candidate: Candidate; runs: CandidateSummary[]; disabled: boolean }>()
const route = useRoute(),
  open = ref(false)
const options = computed(() => {
  const rows = props.runs.filter((row) => row.project_id === props.candidate.project_id)
  // A directly opened older round remains selectable outside the recent-history window.
  const values = rows.some((row) => row.id === props.candidate.id)
    ? rows
    : [props.candidate, ...rows]
  return [...values].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
})
watch(
  () => route.fullPath,
  () => {
    open.value = false
  },
)
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) open.value = false
  },
)
</script>
<template>
  <DropdownMenuRoot v-model:open="open">
    <DropdownMenuTrigger
      class="curation-run-trigger"
      :disabled="disabled"
      aria-label="切换整理结果"
    >
      切换结果<AppIcon name="chevron-down" :size="12" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        class="curation-run-menu"
        align="start"
        :side-offset="7"
        :collision-padding="12"
      >
        <p class="curation-run-caption">最近整理结果</p>
        <DropdownMenuItem v-for="item in options" :key="item.id" as-child>
          <RouterLink
            :to="{
              name: 'curation-review',
              params: { projectId: candidate.project_id, candidateId: item.id },
              query: route.query,
            }"
            class="curation-run-item"
            :aria-current="item.id === candidate.id ? 'page' : undefined"
          >
            <span
              ><strong>{{ formatTime(item.created_at) }}</strong
              ><small
                >{{ candidateStateLabels[item.state] }} ·
                {{ item.target ? '单接口整理' : '项目整体整理' }}</small
              ></span
            >
            <AppIcon v-if="item.id === candidate.id" name="check" :size="14" />
          </RouterLink>
        </DropdownMenuItem>
        <DropdownMenuSeparator class="curation-run-separator" />
        <DropdownMenuItem as-child>
          <RouterLink
            :to="{
              name: 'curation-review',
              params: { projectId: candidate.project_id },
              query: route.query,
            }"
            class="curation-run-item curation-run-all"
          >
            查看结果列表<AppIcon name="arrow-right" :size="14" />
          </RouterLink>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
