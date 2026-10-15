<script setup lang="ts">
import { computed, ref } from 'vue'
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from 'reka-ui'
import AppButton from '@/components/ui/AppButton.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AuditProjectFilter from '@/features/audit/AuditProjectFilter.vue'
import DiagnosticDetail from '@/features/audit/DiagnosticDetail.vue'
import { stageLabels } from '@/features/audit/diagnostics'
import MetricSource from '@/features/operations/MetricSource.vue'
import OperationsResources from '@/features/operations/OperationsResources.vue'
import { useOperations } from '@/features/operations/useOperations'
import {
  stateLabels,
  stateOptions,
  reasonLabels,
  number,
  time,
  mib,
  freshness,
} from '@/features/operations/format'
import type { TaskState } from '@/features/operations/types'
import '@/features/management/management.css'
import '@/features/audit/console.css'
import '@/features/operations/operations.css'
const {
  project,
  state,
  page,
  summary,
  tasks,
  summaryError,
  tasksError,
  tasksLoading,
  loading,
  now,
  online,
  load,
  changePage,
  choose,
  detail,
  selected,
  detailOpen,
  detailError,
  detailLoading,
} = useOperations()
const tab = ref('tasks')
const count = (state: TaskState) =>
  summary.value?.tasks.value
    ? (summary.value.tasks.value.find((r) => r.state === state)?.count ?? 0)
    : null
const total = computed(() => summary.value?.tasks.value?.reduce((n, r) => n + r.count, 0) ?? null)
const taskFreshness = computed(() =>
  tasks.value
    ? freshness(
        {
          sampled_at: tasks.value.page.observed_at,
          stale_after_seconds: tasks.value.stale_after_seconds,
          error: tasksError.value || null,
        },
        now.value,
      )
    : '未采集',
)
</script>
<template>
  <section class="management-panel operations-panel">
    <header class="management-heading">
      <div>
        <p class="management-eyebrow">管理中心 / 运行状态</p>
        <h1>运行状态</h1>
        <p>任务是否推进、为什么等待，以及当前实例的模型与资源。</p>
      </div>
      <AppButton :disabled="loading || !online" @click="load">{{
        loading ? '读取中…' : '刷新状态'
      }}</AppButton>
    </header>
    <p v-if="!online" class="ops-alert" role="status">
      网络已断开，显示上次读取的快照。连接恢复后自动更新。
    </p>
    <p v-if="summaryError" class="ops-alert" role="alert" data-channel="summary">
      {{ summaryError }}<AppButton @click="load">重新读取摘要</AppButton>
    </p>
    <div class="ops-overview">
      <section class="ops-card">
        <p class="ops-label">整理任务 · 全库</p>
        <strong class="ops-number">{{ number(count('running')) }} <small>运行</small></strong>
        <p class="ops-note">
          {{ number(count('queued')) }} 排队 · {{ number(count('waiting')) }} 等待恢复
        </p>
        <MetricSource :value="summary?.tasks" :now="now" />
      </section>
      <section class="ops-card">
        <p class="ops-label">需要处理</p>
        <strong class="ops-number">{{ number(count('needs_attention')) }}</strong>
        <p class="ops-note">成果保留，等待检查后继续</p>
        <MetricSource :value="summary?.tasks" :now="now" />
      </section>
      <section class="ops-card">
        <p class="ops-label">模型实际在途 / 当前额度</p>
        <strong class="ops-number"
          >{{ number(summary?.model.value?.http_in_flight) }}
          <small>/ {{ number(summary?.model.value?.current_limit) }}</small></strong
        >
        <p class="ops-note">当前 API 实例 · HTTP 请求</p>
        <MetricSource :value="summary?.model" :now="now" />
      </section>
      <section class="ops-card">
        <p class="ops-label">API 进程 RSS</p>
        <strong class="ops-number ops-memory">{{
          mib(summary?.resources?.rss_bytes.value)
        }}</strong>
        <p class="ops-note">进程常驻内存</p>
        <MetricSource :value="summary?.resources?.rss_bytes" :now="now" />
      </section>
    </div>
    <TabsRoot v-model="tab"
      ><TabsList class="ops-tabs" aria-label="运行状态内容"
        ><TabsTrigger value="tasks">任务与队列</TabsTrigger
        ><TabsTrigger value="resources">模型与资源</TabsTrigger></TabsList
      >
      <TabsContent value="tasks">
        <p v-if="tasksError" class="ops-alert" role="alert" data-channel="tasks">
          {{ tasksError }}<AppButton @click="load">重新读取列表</AppButton>
        </p>
        <div class="ops-controls">
          <AuditProjectFilter v-model="project" /><label class="ops-state"
            ><span>状态</span><AppSelect v-model="state" label="任务状态" :options="stateOptions"
          /></label>
          <p class="ops-note ops-list-scope">
            全库保留 {{ number(total) }} 个任务<br />列表按项目和状态筛选
          </p>
        </div>
        <p class="ops-note" :class="{ 'ops-stale': taskFreshness === '已过期' }" role="status">
          {{ taskFreshness }} · 列表读取 {{ time(tasks?.page.observed_at) }} · 每页 20
          项，按接收时间从新到旧
        </p>
        <div v-if="tasks?.page.items.length" class="ops-table-scroll" :aria-busy="tasksLoading">
          <table class="ops-table ops-tasks">
            <thead>
              <tr>
                <th>任务 / 项目</th>
                <th>状态与阶段</th>
                <th>已保存检查点</th>
                <th>等待与心跳</th>
                <th><span class="sr-only">操作</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="task in tasks.page.items" :key="task.id" :data-task-id="task.id">
                <td>
                  <strong>{{ task.target ? '单接口整理' : '项目整理' }}</strong
                  ><small :title="task.project_id">{{
                    tasks.projects?.[task.project_id] || `项目 ${task.project_id.slice(0, 8)}`
                  }}</small
                  ><code :title="task.id">任务 {{ task.id.slice(0, 8) }}</code
                  ><small>{{ time(task.created_at) }}</small>
                </td>
                <td>
                  <span class="ops-status" :data-state="task.state">{{
                    stateLabels[task.state]
                  }}</span
                  ><small>{{
                    task.stage
                      ? stageLabels[task.stage] || task.stage
                      : task.state === 'running'
                        ? '执行阶段未采集'
                        : '当前无执行阶段'
                  }}</small
                  ><small
                    v-if="
                      task.state === 'running' &&
                      task.lease_until &&
                      Date.parse(task.lease_until) < now
                    "
                    class="ops-stale"
                    >租约已过期，待核对接管</small
                  >
                </td>
                <td>
                  <template v-if="task.checkpoint"
                    ><strong
                      >{{ number(task.checkpoint.completed) }} /
                      {{ number(task.checkpoint.total) }}</strong
                    ><small
                      >{{
                        task.checkpoint.stage ? stageLabels[task.checkpoint.stage] : '阶段未采集'
                      }}
                      · {{ time(task.checkpoint.updated_at) }}</small
                    ><small v-if="task.checkpoint.run_id !== task.run_id"
                      >来自此前执行检查点</small
                    ></template
                  ><span v-else class="ops-note">{{
                    task.candidate_id ? '摘要未采集，请按需查看诊断' : '尚无候选 / 未采集'
                  }}</span>
                </td>
                <td>
                  <strong v-if="task.retry_reason">{{
                    reasonLabels[task.retry_reason] || '原因未采集'
                  }}</strong
                  ><strong v-else-if="task.state === 'queued'">等待运行位置</strong
                  ><span
                    v-else-if="['waiting', 'needs_attention', 'failed'].includes(task.state)"
                    class="ops-note"
                    >原因未采集</span
                  ><small v-if="task.state === 'waiting'"
                    >下次尝试 {{ time(task.next_retry_at) }}</small
                  ><small v-if="task.state === 'running'">心跳 {{ time(task.heartbeat_at) }}</small
                  ><small v-else>当前无运行心跳</small>
                </td>
                <td><AppButton @click="choose(task)">查看诊断</AppButton></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="management-empty" role="status">
          {{
            tasksLoading ? '正在读取任务…' : tasksError ? '任务列表暂不可用' : '当前筛选下没有任务'
          }}
        </p>
        <footer class="management-pagination">
          <span>第 {{ page }} 页 · 本页 {{ tasks?.page.items.length ?? 0 }} 项</span
          ><AppButton :disabled="page <= 1 || tasksLoading" @click="changePage(-1)"
            >上一页</AppButton
          ><AppButton :disabled="!tasks?.page.next || tasksLoading" @click="changePage(1)"
            >下一页</AppButton
          >
        </footer>
        <p class="ops-note ops-boundary">
          任务与总计来自数据库，汇总每 15 秒采样；当前模型调用来自上方标明的 API
          实例。候选检查点保留已保存进度，不代表任务此刻仍在执行该阶段。周期列表不读取候选正文或统计批次；旧记录的进度摘要可能未采集，保存内容可按需查看诊断。单个任务的瞬时模型或数据库等待尚未采集。
        </p>
      </TabsContent>
      <TabsContent value="resources"
        ><OperationsResources v-if="summary" :data="summary" :now="now" />
        <p v-else class="management-empty">资源尚未采集</p></TabsContent
      >
    </TabsRoot>
    <footer v-if="summary" class="ops-footer">
      实例 {{ summary.instance_id.slice(0, 8) }} · PID {{ summary.process_id }} · 启动
      {{ time(summary.started_at) }}<span>可见时每 5 秒读取 · 隐藏后暂停</span>
    </footer>
    <AppDialog
      v-model:open="detailOpen"
      title="任务诊断"
      description="查看本任务的持久状态和已保存进度，复制脱敏排查资料。"
      placement="right"
      ><p v-if="detailLoading" class="audit-empty" role="status">正在读取诊断…</p>
      <p v-else-if="detailError" role="alert">
        {{ detailError }}<AppButton v-if="selected" @click="choose(selected)">重试</AppButton>
      </p>
      <DiagnosticDetail v-else-if="detail" :value="detail"
    /></AppDialog>
  </section>
</template>
