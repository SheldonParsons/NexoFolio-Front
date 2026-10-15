<script setup lang="ts">
import { computed } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppConfirmDialog from '@/components/ui/AppConfirmDialog.vue'
import AuditProjectFilter from '@/features/audit/AuditProjectFilter.vue'
import MetricSource from '@/features/operations/MetricSource.vue'
import { freshness, time, number } from '@/features/operations/format'
import { useStorage } from '@/features/storage/useStorage'
import { reasons, bytes } from '@/features/storage/types'
import '@/features/management/management.css'
import '@/features/audit/console.css'
import '@/features/operations/operations.css'
import '@/features/storage/storage.css'
const {
  project,
  data,
  result,
  error,
  loading,
  busy,
  confirm,
  now,
  online,
  after,
  load,
  run,
  next,
  restart,
} = useStorage()
const status = computed(() => data.value?.snapshot.retention)
const enabled = computed(() => !!status.value?.value?.enabled_at)
const protection = computed(() =>
  !status.value?.value
    ? '保护状态未采集'
    : !enabled.value
      ? '尚未启用'
      : Date.parse(status.value.value.protected_until!) > now.value
        ? '首次7天保护中'
        : '已启用 · 按政策处理',
)
const ready = computed(
  () =>
    !busy.value &&
    online.value &&
    data.value?.execution_allowed &&
    freshness(status.value, now.value) === '快照有效',
)
const outcomes = {
  preview: '策略预览 · 未提交',
  committed: '本批已提交',
  not_committed: '本批未提交',
  unknown: '提交结果未知',
  failed: '预览失败',
}
const physical = computed(
  () => data.value?.snapshot.modules.flatMap((m) => m.value?.tables ?? []) ?? [],
)
</script>
<template>
  <section class="management-panel storage-panel">
    <header class="management-heading">
      <div>
        <p class="management-eyebrow">管理中心 / 存储与清理</p>
        <h1>存储与清理</h1>
        <p>看清资料占用，保留仍有价值的历史。</p>
      </div>
      <AppButton :disabled="!project || loading || !online" @click="load(true)">{{
        loading ? '读取中…' : '刷新统计'
      }}</AppButton>
    </header>
    <div class="ops-controls">
      <div :inert="busy"><AuditProjectFilter v-model="project" required :disabled="busy" /></div>
      <p class="ops-note ops-list-scope">
        后台有界采样 · 可见时读取缓存<br />统计与预览均不会启用清理
      </p>
    </div>
    <p v-if="!online" class="ops-alert" role="status">
      网络已断开，连接恢复后重新读取。保留值可能已过期。
    </p>
    <p v-if="error" class="ops-alert" role="alert">
      {{ error }}<AppButton :disabled="loading || !online" @click="load(true)">重新读取</AppButton>
    </p>
    <p v-if="!project" class="management-empty">先选择一个项目，查看占用和保护状态。</p>
    <template v-else>
      <section class="storage-policy ops-card">
        <div>
          <p class="ops-label">既定保留策略</p>
          <h2>{{ protection }}</h2>
          <p class="ops-note">
            {{
              enabled
                ? `保护期截至 ${time(status?.value?.protected_until)}`
                : '首次启用只登记项目，额外保护7天。之后仍需管理员逐批执行。'
            }}
          </p>
          <MetricSource :value="status" :now="now" />
        </div>
        <div class="storage-actions">
          <AppButton :disabled="busy || !online" @click="run('preview')">{{
            busy ? '处理中…' : '预览本批策略'
          }}</AppButton
          ><AppButton variant="primary" :disabled="!ready" @click="confirm = true">{{
            enabled ? '执行本批策略' : '启用7天保护'
          }}</AppButton>
          <p v-if="data && !data.execution_allowed" class="ops-note">
            服务器尚未允许执行，当前可查看和预览。
          </p>
        </div>
      </section>
      <div class="storage-section-heading">
        <h2>空间花在哪里</h2>
        <span>选定项目 · 已覆盖的主要内容列</span>
      </div>
      <div v-if="!data" class="management-empty" role="status">
        {{ loading ? '正在读取统计…' : '统计暂不可用' }}
      </div>
      <section
        v-for="(sample, index) in data?.snapshot.modules"
        :key="index"
        class="storage-sample"
      >
        <MetricSource :value="sample" :now="now" />
        <table v-if="sample.value" class="ops-table storage-table">
          <thead>
            <tr>
              <th>资料分类</th>
              <th>压缩后列大小</th>
              <th>逻辑内容大小</th>
              <th>统计范围</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="group in sample.value.groups" :key="group.name">
              <td>
                <strong>{{ group.name }}</strong>
              </td>
              <td>{{ bytes(group.column_bytes) }}</td>
              <td>{{ bytes(group.logical_bytes) }}</td>
              <td>{{ number(group.rows) }}条统计记录 · 完整覆盖</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="ops-note" role="status">
          {{ sample.error ? '本模块采样暂不可用，请刷新后重试。' : '统计排队中，尚未采集。' }}
        </p>
      </section>
      <p class="ops-note storage-caption">
        列大小来自数据库实际列存储，含压缩效果，不含行头、索引和空闲页。逻辑正文未展开统计；冻结块同时承载执行材料与证据，统一归入快照，未重复计入归档。目录、关联、回执等辅助资料未纳入上述列统计。各模块独立采样。
      </p>
      <details class="storage-physical">
        <summary>共享表与索引实际占用 <span>全库共享，不能归给单个项目</span></summary>
        <table class="ops-table">
          <thead>
            <tr>
              <th>共享表</th>
              <th>表及 TOAST</th>
              <th>索引</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="table in physical" :key="table.name">
              <td>{{ table.name }}</td>
              <td>{{ bytes(table.table_bytes) }}</td>
              <td>{{ bytes(table.index_bytes) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="ops-note">
          只列上述内容涉及的表，采样时间随对应模块。不是整个数据库容量；不能再与项目列大小相加。逻辑清理量未估算，清理后磁盘文件通常不会立即缩小。
        </p>
      </details>
      <div class="storage-section-heading">
        <h2>哪些会保留</h2>
        <span>执行时重新检查状态与引用</span>
      </div>
      <div class="ops-resource-grid">
        <section class="ops-card">
          <h2>资料与证据</h2>
          <p>
            原始资料、正式文档、人工知识和废弃记录继续保留。仍被引用的证据不会回收；确认无引用后，还要经过7天宽限。
          </p>
        </section>
        <section class="ops-card">
          <h2>可恢复的工作</h2>
          <p>
            运行、排队、重试、待处理、待审核和停止但可恢复的任务均受保护。需要在原整理流程明确放弃后，才开始相应保留周期。
          </p>
          <p v-if="status?.value">
            本页列出 {{ status.value.stopped_recoverable.length }} 个停止但可恢复任务{{
              status.value.more_stopped ? '（还有更多）' : ''
            }}
          </p>
          <ul v-if="status?.value?.stopped_recoverable.length">
            <li v-for="task in status.value.stopped_recoverable" :key="task">
              <code>{{ task }}</code>
            </li>
          </ul>
        </section>
      </div>
      <p class="ops-note storage-caption">
        已结束7天的执行资料可释放。完整历史保留最近30天与最近5轮的并集；精简后仅留摘要，完整详情、对比与回滚到期。本页不提供放弃任务或强制删除入口。
      </p>
      <section v-if="result" class="ops-card storage-result" aria-live="polite">
        <div class="storage-section-heading">
          <h2>{{ outcomes[result.outcome] }}</h2>
          <span>{{ time(result.at) }}</span>
        </div>
        <p v-if="result.outcome === 'unknown'">
          请求未取得确定的提交回执。请重新预览同一批核对当前状态；可以安全重入，不要据此判断已删除或直接进入下一批。
        </p>
        <template v-if="result.report"
          ><div class="storage-counts">
            <div>
              <b>{{ result.report.scanned }}</b
              ><span>本批检查</span>
            </div>
            <div>
              <b>{{ result.report.inputs_released }}</b
              ><span>释放执行资料</span>
            </div>
            <div>
              <b>{{ result.report.compacted }}</b
              ><span>精简历史</span>
            </div>
            <div>
              <b>{{ result.report.archives_reclaimed }}</b
              ><span>回收证据归档</span>
            </div>
          </div>
          <p class="ops-note">
            {{ result.report.chunks_deleted }} 个冻结块 ·
            {{ result.report.grace_started }} 个归档开始无引用宽限。以上为对象数，不是回收字节数。{{
              result.outcome === 'preview' ? '预览在事务中回滚；执行将重新检查。' : ''
            }}
          </p>
          <ul class="storage-skips">
            <li v-for="(count, reason) in result.report.skipped" :key="reason">
              {{ reasons[reason] || '引用证明未完成或对象异常，延后处理' }} · {{ count }}
            </li>
          </ul>
          <p v-if="Object.keys(result.report.deferred_objects).length" class="ops-note">
            {{ Object.keys(result.report.deferred_objects).length }}
            个对象延后处理，相关证据保持保护。
          </p>
          <p>
            {{
              result.report.next
                ? '本轮部分推进，可继续下一批。下一批为空表示本轮检查结束。'
                : '本轮没有后续游标。保护项仍保留，之后可从头重新预览。'
            }}
          </p>
          <AppButton v-if="result.report.next" :disabled="busy" @click="next">预览下一批</AppButton
          ><AppButton v-if="after" :disabled="busy" @click="restart">从头预览</AppButton></template
        >
      </section>
    </template>
    <AppConfirmDialog
      v-model:open="confirm"
      :title="enabled ? '执行本批既定策略' : '启用项目保护期'"
      :description="
        enabled
          ? '服务器将重新核对状态和引用，每次最多10个候选。到期历史精简后，完整详情、对比与回滚将不可用；仍受保护的资料会跳过。'
          : '首次启用只登记项目并开始7天保护期，不会立即清理。之后仍需明确发起执行。'
      "
      :confirm-label="enabled ? '确认执行本批' : '确认启用7天保护'"
      :pending="busy"
      :disabled="!ready"
      @confirm="run(enabled ? 'execute' : 'enable')"
    />
  </section>
</template>
