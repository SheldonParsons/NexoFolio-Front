<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import {
  diagnosticText,
  statusLabels,
  stageLabels,
  fact,
  type DiagnosticPackage,
} from './diagnostics'
import { auditTime } from './analysis'
const props = defineProps<{ value: DiagnosticPackage }>()
const feedback = ref(''),
  copying = ref(false),
  manual = ref(false)
const text = computed(() => diagnosticText(props.value))
const models = computed(
  () =>
    [...new Set(props.value.batches.items.map((row) => row.model).filter(Boolean))].join('、') ||
    '未记录',
)
const clipped = computed(() =>
  ['attempts', 'activities', 'issues', 'batches', 'operations', 'related_events'].filter(
    (key) => props.value[key as 'issues'].truncated,
  ),
)
const duration = (start: unknown, end: unknown) =>
  typeof start === 'string' && typeof end === 'string'
    ? `${Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 1000))} 秒`
    : '未记录 / 尚未结束'
watch(
  () => props.value,
  () => {
    feedback.value = ''
    manual.value = false
  },
)
async function copy() {
  const current = props.value
  copying.value = true
  feedback.value = ''
  try {
    await navigator.clipboard.writeText(text.value)
    if (current === props.value) feedback.value = '排查资料已复制，可直接交给 Agent。'
  } catch {
    if (current === props.value) {
      manual.value = true
      feedback.value = '剪贴板写入失败。可使用下方文本手动复制，或下载诊断包。'
    }
  } finally {
    copying.value = false
  }
}
function download() {
  const blob = new Blob([text.value], { type: 'text/plain;charset=utf-8' }),
    url = URL.createObjectURL(blob),
    link = document.createElement('a')
  link.href = url
  link.download = `nexofolio-diagnostic-${props.value.candidate.id}.txt`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>
<template>
  <section class="diagnostic-detail" aria-label="整理排查详情">
    <header class="diagnostic-heading">
      <div>
        <p class="audit-label">
          {{ value.project.name }} · {{ auditTime(value.candidate.created_at) }}
        </p>
        <h2>{{ statusLabels[value.candidate.status] || value.candidate.status }}</h2>
      </div>
      <div class="diagnostic-actions">
        <AppButton variant="primary" :disabled="copying" @click="copy">{{
          copying ? '正在复制…' : '一键复制排查资料'
        }}</AppButton
        ><AppButton @click="download">下载诊断包</AppButton>
      </div>
    </header>
    <p v-if="feedback" role="status" class="audit-note">{{ feedback }}</p>
    <textarea
      v-if="manual"
      class="audit-copy-text"
      readonly
      aria-label="可手动复制的排查资料"
      :value="text"
      @focus="($event.target as HTMLTextAreaElement).select()"
    ></textarea>
    <p
      v-if="['review', 'applied', 'stopped', 'discarded'].includes(value.candidate.status)"
      class="audit-note"
    >
      {{
        value.candidate.status === 'stopped'
          ? '本轮由人工停止，已保存内容保留；停止本身不判为故障。'
          : value.candidate.status === 'review'
            ? '本轮等待审阅；尚未应用不表示整理失败。'
            : value.candidate.status === 'applied'
              ? '此候选已经应用。'
              : '此候选已放弃，历史记录仍可用于追溯。'
      }}
    </p>
    <p v-if="value.liveness?.heartbeat_stale" class="audit-warning" role="alert">
      持久化心跳超过
      {{ value.liveness.threshold_seconds }}
      秒未更新，请核对服务或任务是否中断；这不自动改判为失败。
    </p>
    <p v-if="value.candidate.failure_code" class="audit-warning">
      终止错误码：{{ value.candidate.failure_code }}。具体阶段问题见下方记录。
    </p>
    <dl class="diagnostic-facts">
      <dt>当前阶段</dt>
      <dd>
        {{
          value.candidate.stage
            ? stageLabels[value.candidate.stage] || value.candidate.stage
            : '无执行阶段 / 未记录'
        }}
      </dd>
      <dt>记录的模型</dt>
      <dd>{{ models }}</dd>
      <dt>接口完成</dt>
      <dd>{{ fact(value.counts.completed) }} / {{ fact(value.counts.total) }}</dd>
      <dt>字段完成 / 失败</dt>
      <dd>{{ fact(value.counts.fields_completed) }} / {{ fact(value.counts.fields_failed) }}</dd>
      <dt>重试 / 执行尝试</dt>
      <dd>{{ fact(value.counts.retries) }} / {{ fact(value.counts.attempts) }}</dd>
      <dt>最后进展</dt>
      <dd>{{ auditTime(value.timing.last_progress_at as string | null) }}</dd>
      <dt>心跳</dt>
      <dd>{{ auditTime(value.timing.heartbeat_at as string | null) }}</dd>
    </dl>
    <h3>执行尝试</h3>
    <ol class="diagnostic-attempts">
      <li v-for="(attempt, index) in value.attempts.items" :key="index">
        <strong
          >第 {{ index + 1 }} 次 ·
          {{
            attempt.outcome === 'cancelled'
              ? '人工停止'
              : attempt.outcome === 'ready'
                ? '完成，等待审阅'
                : attempt.outcome === 'partial'
                  ? '结束，存在缺口'
                  : fact(attempt.outcome)
          }}</strong
        >
        <p>
          {{ auditTime(attempt.started_at as string) }} →
          {{ auditTime(attempt.ended_at as string) }} ·
          {{ duration(attempt.started_at, attempt.ended_at) }}
        </p>
        <code>run ID：{{ fact(attempt.run_id) }}</code>
      </li>
    </ol>
    <p v-if="!value.attempts.items.length" class="audit-note">
      未记录执行尝试历史；不能从 HTTP 响应推断运行成功。
    </p>
    <h3>问题与资料缺口</h3>
    <ul class="diagnostic-issues">
      <li v-for="(issue, index) in value.issues.items" :key="index">
        <strong
          >{{ stageLabels[String(issue.stage)] || fact(issue.stage) }} ·
          {{ fact(issue.code) }}</strong
        >
        <p>
          涉及 {{ fact(issue.fields) }} 个字段 ·
          {{ issue.retryable ? '记录为可重试' : '未记录为可重试' }}
        </p>
        <code>接口 {{ fact(issue.endpoint) }}</code>
      </li>
    </ul>
    <p v-if="!value.issues.items.length" class="audit-note">
      未记录具体问题条目；这不单独证明本轮完整成功。
    </p>
    <p class="audit-note">
      准备阶段读到的缺失样本：{{ fact(value.preparation.samples_unavailable) }}；待处理字段：{{
        fact(value.counts.fields_pending)
      }}。
    </p>
    <h3>近期阶段活动</h3>
    <ol class="diagnostic-activity">
      <li v-for="(activity, index) in value.activities.items" :key="index">
        <time>{{ auditTime(activity.at as string) }}</time
        ><span
          >{{ stageLabels[String(activity.stage)] || fact(activity.stage) }} ·
          {{ fact(activity.kind)
          }}<small v-if="activity.batch !== null"
            >批次 {{ activity.batch }} · {{ fact(activity.elapsed_ms) }} ms</small
          ></span
        >
      </li>
    </ol>
    <p class="audit-note">
      阶段活动按记录时间排列，原始记录不含逐事件 run ID，不自动将它们归入某次尝试。
    </p>
    <details class="audit-coverage">
      <summary>批次、操作与请求标识</summary>
      <p>
        候选 ID：<code>{{ value.candidate.id }}</code>
      </p>
      <p>
        当前 run ID：<code>{{ fact(value.candidate.run_id) }}</code>
      </p>
      <pre>{{
        JSON.stringify(
          {
            batches: value.batches,
            operations: value.operations,
            related_events: value.related_events,
          },
          null,
          2,
        )
      }}</pre>
    </details>
    <div class="audit-coverage">
      <h3>本包覆盖范围</h3>
      <p>
        来自持久化候选，不依赖当前进程临时进度。阶段活动最多保留最近 80
        条；关联事件按项目＋候选严格匹配，已纳入 {{ value.coverage.event_included }} /
        {{ fact(value.coverage.event_total) }} 条。
      </p>
      <p v-if="!value.coverage.events_available">关联审计事件暂不可用，候选诊断仍可读取。</p>
      <p v-if="clipped.length" role="alert">
        以下集合超过导出上限，包中已标明纳入与记录数量：{{
          clipped.join('、')
        }}。这份包不包含超出范围的记录。
      </p>
      <p>
        提供商请求
        ID、执行时服务端版本和未记录的阶段结束时间均标为未知。已排除自由文本错误、样本、凭证、模型输入与请求正文。
      </p>
    </div>
  </section>
</template>
