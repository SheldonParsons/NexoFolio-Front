<script setup lang="ts">
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import type { AuditEvent } from './types'
defineProps<{ event: AuditEvent | null; actorName?: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ trace: [requestId: string] }>()
</script>
<template>
  <AppDialog
    v-model:open="open"
    placement="right"
    title="记录详情"
    :description="event?.action || '审计记录'"
  >
    <template v-if="event"
      ><dl class="audit-event-details">
        <dt>时间</dt>
        <dd>{{ new Date(event.at).toLocaleString('zh-CN') }}</dd>
        <dt>用户 / IP</dt>
        <dd>
          {{ actorName || event.actor }}<small v-if="actorName">{{ event.actor }}</small>
        </dd>
        <dt>类型 / 结果</dt>
        <dd>{{ event.kind }} · {{ event.code || event.status || '—' }}</dd>
        <dt>位置</dt>
        <dd>{{ event.method }} {{ event.route }}</dd>
        <dt>项目</dt>
        <dd>{{ event.project || '—' }}</dd>
        <dt>对象</dt>
        <dd>{{ event.resource || '—' }}</dd>
        <dt>耗时</dt>
        <dd>{{ event.duration_ms }} ms</dd>
        <dt>请求 ID</dt>
        <dd>{{ event.request_id || '—' }}</dd>
      </dl>
      <AppButton v-if="event.request_id" @click="emit('trace', event.request_id)"
        >查看关联请求</AppButton
      ></template
    >
  </AppDialog>
</template>
<style scoped>
.audit-event-details {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  gap: 16px 12px;
  margin: 28px 0;
  font-size: 13px;
}
dt {
  color: var(--muted);
}
dd {
  margin: 0;
  overflow-wrap: anywhere;
}
small {
  display: block;
  color: var(--muted);
  margin-top: 5px;
}
</style>
