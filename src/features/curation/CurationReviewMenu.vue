<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, type RouteLocationRaw } from 'vue-router'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from 'reka-ui'
import AppIcon from '@/components/icons/AppIcon.vue'
import type { Candidate } from './types'
import { canReviewDecision } from './reviewActions'
import './review-menu.css'
const props = defineProps<{
  lifecycleStale?: boolean
  candidate: Candidate
  officialTo: RouteLocationRaw
  pending: boolean
  resuming: boolean
  progressOpen: boolean
}>()
defineEmits<{ resume: []; progress: []; apply: []; discard: [] }>()
const route = useRoute(),
  open = ref(false)
const canResume = computed(
  () =>
    !props.lifecycleStale &&
    !!props.candidate.execution_input &&
    ['partial', 'interrupted'].includes(props.candidate.state),
)
const canApply = computed(
  () => !props.lifecycleStale && canReviewDecision(props.candidate.state, 'apply'),
)
const canDiscard = computed(() => canReviewDecision(props.candidate.state, 'discard'))
watch(
  [() => route.fullPath, () => props.candidate.state, () => props.pending, () => props.resuming],
  () => {
    open.value = false
  },
)
</script>
<template>
  <DropdownMenuRoot v-model:open="open">
    <DropdownMenuTrigger
      class="curation-review-menu-trigger"
      :disabled="pending || resuming"
      aria-label="本轮操作"
      title="本轮操作"
      ><AppIcon name="more-horizontal" :size="16" mode="static"
    /></DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        class="curation-review-menu"
        align="end"
        :side-offset="7"
        :collision-padding="12"
      >
        <p class="curation-review-menu-caption">本轮操作</p>
        <DropdownMenuItem
          v-if="candidate.state === 'running'"
          class="curation-review-menu-item"
          @select="$emit('progress')"
        >
          <AppIcon name="panels" :size="15" mode="static" />{{
            progressOpen ? '收起本轮进度' : '查看本轮进度'
          }}
        </DropdownMenuItem>
        <DropdownMenuItem
          v-if="canResume"
          title="沿用本轮冻结资料和已生成内容，只补齐缺口"
          class="curation-review-menu-item"
          @select="$emit('resume')"
        >
          <AppIcon name="scan-search" :size="15" mode="static" />续跑本轮
        </DropdownMenuItem>
        <DropdownMenuItem
          v-if="canApply"
          class="curation-review-menu-item"
          @select="$emit('apply')"
        >
          <AppIcon name="check" :size="15" mode="static" />{{
            candidate.state === 'partial' ? '应用已完成内容' : '应用到现行文档'
          }}
        </DropdownMenuItem>
        <DropdownMenuItem as-child>
          <RouterLink :to="officialTo" class="curation-review-menu-item"
            ><AppIcon name="book" :size="15" mode="static" />查看现行文档</RouterLink
          >
        </DropdownMenuItem>
        <template v-if="canDiscard">
          <DropdownMenuSeparator class="curation-review-menu-separator" />
          <DropdownMenuItem class="curation-review-menu-item" @select="$emit('discard')"
            ><AppIcon name="circle-x" :size="15" mode="static" />废弃本轮</DropdownMenuItem
          >
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
