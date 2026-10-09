<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
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
import { candidateStateLabels, type CandidateSummary } from './types'
import './run-picker.css'
defineProps<{
  selected: CandidateSummary
  options: CandidateSummary[]
  loading: boolean
  error: string
  environmentId: string
}>()
const emit = defineEmits<{ select: [id: string]; open: []; retry: [] }>()
const open = ref(false)
function opened(value: boolean) {
  open.value = value
  if (value) emit('open')
}
function select(id: string) {
  emit('select', id)
  open.value = false
}
</script>
<template>
  <DropdownMenuRoot :open="open" @update:open="opened">
    <DropdownMenuTrigger class="curation-run-trigger" aria-label="切换面板中的整理内容"
      >切换整理内容<AppIcon name="chevron-down" :size="12"
    /></DropdownMenuTrigger>
    <DropdownMenuPortal
      ><DropdownMenuContent
        class="curation-run-menu"
        align="end"
        :side-offset="7"
        :collision-padding="12"
      >
        <p class="curation-run-caption">
          {{ loading ? '正在读取整理记录…' : '选择面板展示的轮次' }}
        </p>
        <p v-if="error" class="curation-run-caption" role="alert">
          {{ error }} <button type="button" @click="emit('retry')">重试</button>
        </p>
        <DropdownMenuItem v-for="item in options" :key="item.id" as-child>
          <button
            type="button"
            class="curation-run-item curation-panel-run-item"
            :data-current="item.id === selected.id"
            @click="select(item.id)"
          >
            <span
              ><strong>{{ formatTime(item.created_at) }}</strong
              ><small
                >{{ candidateStateLabels[item.state] }} ·
                {{ item.target ? '单接口整理' : '项目整体整理' }}</small
              ></span
            >
            <AppIcon v-if="item.id === selected.id" name="check" :size="14" />
          </button>
        </DropdownMenuItem>
        <DropdownMenuSeparator class="curation-run-separator" />
        <DropdownMenuItem as-child
          ><RouterLink
            :to="{
              name: 'curation-review',
              params: { projectId: selected.project_id },
              query: environmentId ? { env: environmentId } : {},
            }"
            class="curation-run-item curation-run-all"
            >查看结果列表<AppIcon name="arrow-right" :size="14" /></RouterLink
        ></DropdownMenuItem> </DropdownMenuContent
    ></DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
<style scoped>
.curation-panel-run-item {
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
}
.curation-panel-run-item[data-current='true'] {
  background: var(--surface-muted);
}
</style>
