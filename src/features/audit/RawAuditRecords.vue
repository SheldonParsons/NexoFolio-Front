<script setup lang="ts">
import { computed, ref } from 'vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AuditEventDetail from './AuditEventDetail.vue'
import { useAuditReport } from './useAuditReport'
import type { AuditEvent } from './types'
const open = defineModel<boolean>('open', { default: false })
const {
  report,
  loading,
  error,
  actor,
  requestId,
  project,
  kind,
  days,
  routeFilter,
  updated,
  loss,
  load,
  trace,
} = useAuditReport()
const kindModel = computed({
  get: () => kind.value || 'all',
  set: (v) => {
    kind.value = v === 'all' ? '' : v
  },
})
const daysModel = computed({
  get: () => String(days.value),
  set: (v) => {
    days.value = Number(v)
  },
})
const selected = ref<AuditEvent | null>(null),
  details = ref(false)
function choose(row: AuditEvent) {
  selected.value = row
  details.value = true
}
function follow(id: string) {
  trace(id)
  details.value = false
}
</script>
<template>
  <AppDialog
    v-model:open="open"
    placement="right"
    title="高级记录查询"
    description="保留原有操作、异常和请求追踪入口，最多返回 200 条明细。"
    ><form class="audit-raw-form" @submit.prevent="load">
      <AppSelect
        v-model="kindModel"
        label="记录类型"
        :options="[
          { value: 'operation', label: '核心操作' },
          { value: 'error', label: '异常记录' },
          { value: 'mcp', label: 'MCP 调用' },
          { value: 'all', label: '所有类型' },
        ]"
      /><AppSelect
        v-model="daysModel"
        label="时间范围"
        :options="[
          { value: '1', label: '最近 24 小时' },
          { value: '7', label: '最近 7 天' },
          { value: '30', label: '最近 30 天' },
          { value: '90', label: '最近 90 天' },
        ]"
      /><label
        >用户 / IP 标识<input
          v-model="actor"
          class="project-management-input"
          maxlength="64" /></label
      ><label
        >项目 ID<input v-model="project" class="project-management-input" maxlength="36" /></label
      ><label
        >请求 ID<input v-model="requestId" class="project-management-input" maxlength="36" /></label
      ><label
        >页面 / 接口模板<input
          v-model="routeFilter"
          class="project-management-input"
          maxlength="200" /></label
      ><AppButton type="submit" :disabled="loading">查询记录</AppButton>
    </form>
    <p v-if="error" role="alert" class="audit-warning">{{ error }}</p>
    <p v-if="loading" role="status">读取中…</p>
    <template v-if="report"
      ><p class="audit-note">
        本次返回 {{ report.events.length }} 条事件，最多 200 条；不代表完整匹配数量。
      </p>
      <ol class="audit-visits">
        <li v-for="(row, index) in report.events" :key="index">
          <p>{{ row.kind }} · {{ row.action }} · {{ row.code || row.status }}</p>
          <small
            >{{ new Date(row.at).toLocaleString('zh-CN') }} ·
            {{ report.actors?.[row.actor] || row.actor }}</small
          ><AppButton variant="ghost" @click="choose(row)">记录详情</AppButton>
        </li>
      </ol>
      <p v-if="!report.events.length" class="audit-note">没有匹配的操作或异常明细。</p>
      <details class="audit-coverage">
        <summary>存储、保留期限与采集完整性</summary>
        <p>
          存储（含索引）{{ (report.storage.bytes / 1048576).toFixed(1) }} MB；操作/异常事件
          {{ report.storage.events }} / {{ report.limits?.events ?? '未记录' }}。
        </p>
        <p>
          访问 {{ report.limits?.access_days }} 天；异常 {{ report.limits?.error_days }} 天；操作
          {{ report.limits?.operation_days }} 天。操作/异常明细累计清理
          {{ report.storage.evicted_events }} 条。
        </p>
        <p>
          当前进程丢失 {{ loss }} 条；存储失败
          {{ report.health?.storage_failures ?? '未记录' }} 次。{{
            report.health?.enabled === false ? '采集已停用。' : ''
          }}更新于 {{ updated }}。
        </p>
      </details></template
    ><AuditEventDetail
      v-model:open="details"
      :event="selected"
      :actor-name="selected ? report?.actors?.[selected.actor] : undefined"
      @trace="follow"
  /></AppDialog>
</template>
<style scoped>
.audit-raw-form {
  display: grid;
  gap: 14px;
  font-size: 12px;
}
.audit-raw-form label {
  display: grid;
  gap: 6px;
  color: var(--muted);
}
</style>
