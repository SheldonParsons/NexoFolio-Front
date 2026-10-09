<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import StateSwap from '@/components/motion/StateSwap.vue'
import '@/components/motion/transitions-dev/skeleton-reveal.css'
import type { ExampleSummary } from '@/contracts/knowledge/types'
import { formatTime } from '../presentation'
import { redactForDisplay, sampleProjection, type SamplePart } from './presentation'
import SampleDiff from './SampleDiff.vue'
import './samples.css'
const props = defineProps<{
  examples: ExampleSummary[]
  sample: unknown
  sampleId: string
  displayedId: string
  loading: boolean
  error: string
  comparisonIds: string[]
  baselineId: string
  payloads: Map<string, unknown>
  errors: Map<string, string>
  pending: Set<string>
  comparisonReady: boolean
}>()
const emit = defineEmits<{
  select: [id: string]
  compare: [id: string]
  baseline: [id: string]
  clear: []
  retry: [id: string]
}>()
function chooseSample(id: string) {
  comparing.value = false
  emit('select', id)
}
const part = ref<SamplePart>('response'),
  comparing = ref(false),
  copied = ref(false)
const projection = computed(() => sampleProjection(props.sample, part.value))
const json = computed(() => {
  if (!props.displayedId) return ''
  const safe = redactForDisplay(projection.value.value)
  return typeof safe === 'string' ? safe : (JSON.stringify(safe, null, 2) ?? '没有捕获报文内容')
})
const displayed = computed(() => props.examples.find((e) => e.id === props.displayedId))
const selectedNumber = (id: string) => props.examples.findIndex((e) => e.id === id) + 1
const bodyLabels: Record<string, string> = {
  full: '完整捕获',
  truncated: '仅捕获前段',
  partial: '可用摘要 · 非完整字节',
  unreadable: '内容未读取',
  none: '此样本未发送正文',
  record: '采集记录',
}
watch(
  () => props.comparisonIds.length,
  (count) => {
    if (count < 2) comparing.value = false
  },
)
watch(
  () => props.examples,
  () => {
    if (!props.examples.some((e) => e.id === props.displayedId)) comparing.value = false
  },
)
async function copy() {
  await navigator.clipboard.writeText(json.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1600)
}
</script>
<template>
  <section class="samples-workbench" aria-label="真实样本工作台">
    <aside class="samples-selection">
      <header>
        <strong>捕获样本</strong
        ><small
          >{{ examples.length }} 份原文 ·
          {{ new Set(examples.map((e) => e.structure_id || e.id)).size }} 种结构</small
        >
      </header>
      <p>选择查看，勾选 2–4 份进行对比。</p>
      <div class="samples-selection-scroll">
        <div
          v-for="(example, index) in examples"
          :key="example.id"
          class="sample-choice"
          :class="{
            'is-active': sampleId === example.id,
            'is-compared': comparisonIds.includes(example.id),
          }"
        >
          <input
            type="checkbox"
            :checked="comparisonIds.includes(example.id)"
            :disabled="!comparisonIds.includes(example.id) && comparisonIds.length >= 4"
            :aria-label="'将样本 ' + (index + 1) + ' 加入对比'"
            @change="$emit('compare', example.id)"
          /><button
            type="button"
            :aria-pressed="sampleId === example.id"
            @click="chooseSample(example.id)"
          >
            <strong
              ><span>样本 {{ index + 1 }}</span
              ><small>{{ example.status ?? '无响应' }}</small></strong
            ><time>{{ formatTime(example.last_seen) }}</time
            ><small>{{ example.calls }} 次同结构调用</small></button
          ><span
            v-if="pending.has(example.id)"
            class="sample-reading-dot"
            aria-label="读取中"
          ></span>
        </div>
      </div>
      <footer>
        <button
          type="button"
          class="samples-compare-button"
          :disabled="!comparisonReady"
          @click="comparing = true"
        >
          <AppIcon name="code" :size="14" />对比 {{ comparisonIds.length || '' }} 份样本</button
        ><button
          v-if="comparisonIds.length"
          type="button"
          class="sample-text-button"
          @click="$emit('clear')"
        >
          清除选择
        </button>
        <p v-if="comparisonIds.some((id) => errors.has(id))" class="sample-error">
          部分样本读取失败，点击该样本可重试。
        </p>
      </footer>
    </aside>
    <section class="samples-main">
      <header class="samples-content-heading">
        <div>
          <strong>{{
            comparing
              ? '样本差异'
              : displayedId
                ? '样本 ' + selectedNumber(displayedId)
                : '真实调用内容'
          }}</strong
          ><span v-if="displayed && !comparing"
            >HTTP {{ displayed.status ?? '未捕获' }} · {{ bodyLabels[projection.state] }}</span
          >
        </div>
        <div class="sample-part-switch" role="group" aria-label="报文范围">
          <button
            v-for="value in ['response', 'request', 'record'] as const"
            :key="value"
            type="button"
            :aria-pressed="part === value"
            @click="part = value"
          >
            {{ { response: '响应数据', request: '请求数据', record: '采集记录' }[value] }}
          </button>
        </div>
        <button v-if="displayedId && !comparing" type="button" class="sample-copy" @click="copy">
          <AppIcon :name="copied ? 'check' : 'code'" :size="13" />{{
            copied ? '已复制' : '复制内容'
          }}
        </button>
      </header>
      <div class="sample-load-status">
        <StateSwap
          :text="
            loading
              ? displayedId
                ? '正在读取新样本，已读取内容保持显示'
                : '正在读取捕获内容'
              : error
                ? '样本读取失败，已读取内容保留'
                : comparing
                  ? '差异仅代表这些捕获样本，按采集原文展示'
                  : displayedId
                    ? '展示已保存原文；同结构首次样本及近期不同值样本有限保留，调用次数另计'
                    : '选择左侧样本开始'
          "
        /><button v-if="error && sampleId" type="button" @click="$emit('retry', sampleId)">
          重试
        </button>
      </div>
      <SampleDiff
        v-if="comparing && comparisonReady"
        :ids="comparisonIds"
        :baseline-id="baselineId"
        :payloads="payloads"
        :examples="examples"
        :part="part"
        @baseline="$emit('baseline', $event)"
      />
      <div
        v-else
        class="sample-persistent-viewport t-skel"
        :class="{ 'is-revealed': !!displayedId || !loading }"
      >
        <div
          class="t-skel-skeleton is-pulsing sample-skeleton"
          :aria-hidden="!loading || !!displayedId"
        >
          <i
            v-for="i in 9"
            :key="i"
            :style="{ width: (i % 3 === 0 ? 45 : i % 2 === 0 ? 68 : 85) + '%' }"
          ></i>
        </div>
        <div class="t-skel-content sample-content">
          <pre v-if="displayedId" class="sample-json">{{ json }}</pre>
          <div v-else class="sample-initial-state">
            <AppIcon name="code" :size="28" />
            <h3>{{ examples.length ? '从一份真实样本开始' : '此环境还没有捕获样本' }}</h3>
            <p>
              {{
                examples.length
                  ? '查看请求或响应，或勾选多份样本找出变化。'
                  : '采集到调用后，样本会出现在这里。'
              }}
            </p>
          </div>
        </div>
      </div>
    </section>
  </section>
</template>
