<script setup lang="ts">
import { ref, shallowRef, watch, onScopeDispose } from 'vue'
import { useRoute } from 'vue-router'
import { observedValues, observedValueJson } from './observedValues'
import type { FieldObservationSummary, ObservedValuePage } from '@/contracts/knowledge/types'
const props = defineProps<{
  summary: FieldObservationSummary
  fieldKey: string
  endpointId: string
  environmentId?: string
}>()
const emit = defineEmits<{ example: [id: string] }>()
const route = useRoute(),
  page = shallowRef<ObservedValuePage>(),
  loading = ref(false),
  error = ref(''),
  copied = ref(''),
  offset = ref(0)
let request: AbortController | undefined
const labels: Record<string, string> = {
  full: '完整采集',
  partial: '部分采集 / 摘要',
  truncated: '已截断',
  none: '无正文',
  unreadable: '无法读取',
  unreadable_structure: '结构无法解析',
  absent: '此样本未出现',
  unavailable: '未捕获或缺少来源',
}
const scope = () => ({
  project: String(route.params.projectId),
  endpoint: props.endpointId,
  archive: props.summary.archive_id!,
  field: props.fieldKey,
  environment: props.environmentId,
})
async function load(next = 0) {
  request?.abort()
  const current = new AbortController()
  request = current
  offset.value = next
  loading.value = true
  error.value = ''
  copied.value = ''
  try {
    const value = await observedValues(scope(), offset.value, current.signal)
    if (!current.signal.aborted) page.value = value
  } catch {
    if (!current.signal.aborted) error.value = '暂时无法读取完整观测值，请重试。'
  } finally {
    if (!current.signal.aborted) loading.value = false
  }
}
async function copy(id: string) {
  const current = request
  try {
    const result = await observedValueJson(scope(), id, current?.signal)
    if (current !== request || current?.signal.aborted) return
    await navigator.clipboard.writeText(result)
    copied.value = '已复制完整值（JSON，保留类型）'
  } catch {
    if (current === request && !current?.signal.aborted) error.value = '读取或复制失败，请重试。'
  }
}
watch(
  () => [
    route.params.projectId,
    props.summary.archive_id,
    props.fieldKey,
    props.endpointId,
    props.environmentId,
  ],
  () => {
    page.value = undefined
    void load()
  },
  { immediate: true },
)
onScopeDispose(() => request?.abort())
</script>
<template>
  <div class="observed-values" :aria-busy="loading">
    <p v-if="page">当前范围保存了 {{ page.summary.total }} 种不同值 · 不代表完整业务枚举</p>
    <p v-if="loading" role="status">正在读取…</p>
    <p v-if="error" role="alert">
      {{ error }} <button type="button" @click="load(offset)">重试</button>
    </p>
    <template v-if="page">
      <div class="capture-states">
        <small v-for="(count, state) in page.summary.states" :key="state"
          >{{ labels[state] ?? state }} {{ count }}</small
        >
      </div>
      <p v-if="!page.items.length">此范围暂无可提取的值，以上状态保留实际采集缺口。</p>
      <div v-for="item in page.items" :key="item.id" class="observed-item">
        <small
          >{{ item.value_type }} · {{ item.representation }} · {{ item.occurrences }} 次观测</small
        >
        <code>{{ item.preview }}{{ item.preview_truncated ? '…' : '' }}</code>
        <div>
          <button type="button" @click="copy(item.id)">复制完整值</button>
          <button
            v-for="example in [...new Set(item.sources.map((s) => s.example))]"
            :key="example"
            type="button"
            @click="emit('example', example)"
          >
            查看真实样本
          </button>
        </div>
      </div>
      <nav aria-label="观测值分页">
        <button
          type="button"
          :disabled="loading || offset === 0"
          @click="load(Math.max(0, offset - 12))"
        >
          上一页</button
        ><span
          >{{ offset + (page.items.length ? 1 : 0) }}–{{ offset + page.items.length }} /
          {{ page.summary.total }}</span
        ><button
          type="button"
          :disabled="loading || !page.has_more"
          @click="load(offset + page.items.length)"
        >
          下一页
        </button>
      </nav>
    </template>
    <p v-if="copied" role="status">{{ copied }}</p>
  </div>
</template>
<style scoped>
.observed-values {
  font-size: 11px;
  min-width: 0;
}
.observed-item {
  padding: 9px 0;
  border-bottom: 1px solid var(--border);
}
.observed-item code {
  display: block;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  max-height: 80px;
  overflow: auto;
  margin: 5px 0;
}
.capture-states,
nav,
.observed-item div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
small,
.capture-states {
  color: var(--muted);
}
button {
  font: inherit;
  border: 0;
  background: transparent;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
  padding: 3px 0;
}
button:disabled {
  opacity: 0.4;
  cursor: default;
}
nav {
  margin-top: 10px;
}
</style>
