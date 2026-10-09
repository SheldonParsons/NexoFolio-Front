<script setup lang="ts">
import { computed } from 'vue'
import AppConfirmDialog from '@/components/ui/AppConfirmDialog.vue'
import { formatTime } from '@/features/documents/presentation'
import type { ReviewDecision, ReviewDecisionTarget } from './reviewActions'
const props = defineProps<{
  action: ReviewDecision
  candidate: ReviewDecisionTarget | null
  projectName: string
  pending: boolean
  disabled: boolean
  error: string
}>()
defineEmits<{ confirm: [] }>()
const open = defineModel<boolean>('open', { default: false })
const description = computed(() =>
  props.action === 'discard'
    ? '本轮结果将标记为已废弃，历史仍可查看。现行文档和原始采集数据不会改变。'
    : props.candidate?.state === 'partial'
      ? '本轮还有未完成内容。确认后，仅将已生成的候选知识应用到现行文档，MCP 也会读取这些更新。'
      : '确认后，本轮目录、接口和字段知识的更新将应用到现行文档，MCP 也会读取更新后的知识。',
)
</script>
<template>
  <AppConfirmDialog
    v-model:open="open"
    :title="action === 'discard' ? '废弃本轮整理结果？' : '应用到现行文档？'"
    :description="description"
    :confirm-label="
      action === 'discard'
        ? '确认废弃本轮'
        : candidate?.state === 'partial'
          ? '确认应用已完成内容'
          : '确认应用'
    "
    :pending="pending"
    :disabled="disabled"
    :error="error"
    @confirm="$emit('confirm')"
  >
    <p v-if="candidate" class="confirm-context">
      {{ projectName }} · {{ formatTime(candidate.created_at) }}
    </p>
  </AppConfirmDialog>
</template>
