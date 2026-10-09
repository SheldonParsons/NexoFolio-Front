<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import type { ExampleSummary } from '@/contracts/knowledge/types'
import { formatTime } from '../presentation'
import { sampleProjection, type SamplePart } from './presentation'
import { useSampleDiff } from './useSampleDiff'
const props = defineProps<{
  ids: string[]
  baselineId: string
  payloads: Map<string, unknown>
  examples: ExampleSummary[]
  part: SamplePart
}>()
const emit = defineEmits<{ baseline: [id: string] }>()
const align = ref<'position' | 'id'>('position'),
  onlyChanges = ref(true),
  scrollTop = ref(0)
const scroller = ref<HTMLElement>()
const ordered = computed(() =>
  [props.baselineId, ...props.ids.filter((id) => id !== props.baselineId)].filter((id) =>
    props.ids.includes(id),
  ),
)
const inputs = computed(() =>
  ordered.value.map((id) => ({ id, ...sampleProjection(props.payloads.get(id), props.part) })),
)
const { result, loading, error } = useSampleDiff(
  () => inputs.value,
  () => align.value,
)
const rows = computed(() =>
  (result.value?.rows ?? []).filter((row) => !onlyChanges.value || row.changed),
)
const rowHeight = 30
const start = computed(() => Math.max(0, Math.floor(scrollTop.value / rowHeight) - 8))
const visible = computed(() => rows.value.slice(start.value, start.value + 70))
const columnStyle = computed(() => ({
  gridTemplateColumns: `minmax(170px, .9fr) repeat(${ordered.value.length}, minmax(180px, 1fr))`,
}))
const currentChange = ref(0)
const scrollLeft = ref(0)
function onScroll(event: Event) {
  const node = event.target as HTMLElement
  scrollTop.value = node.scrollTop
  scrollLeft.value = node.scrollLeft
}
function jump(direction: number) {
  const positions = rows.value.map((row, i) => (row.changed ? i : -1)).filter((i) => i >= 0)
  if (!positions.length) return
  currentChange.value = (currentChange.value + direction + positions.length) % positions.length
  scroller.value?.scrollTo({
    top: positions[currentChange.value]! * rowHeight,
    behavior: 'instant',
  })
}
watch([rows, ordered], () => {
  scrollTop.value = 0
  currentChange.value = -1
  if (scroller.value) scroller.value.scrollTop = 0
})
</script>
<template>
  <section class="sample-diff" :aria-busy="loading">
    <div class="sample-diff-toolbar">
      <div class="sample-diff-counts">
        <strong>{{ result?.changed ?? 0 }} 处字段差异</strong
        ><span class="diff-added">+{{ result?.added ?? 0 }} 新增</span
        ><span class="diff-removed">−{{ result?.removed ?? 0 }} 缺失</span
        ><span>~{{ result?.modified ?? 0 }} 变化</span
        ><span v-if="result?.unknown">{{ result.unknown }} 处范围不足</span>
      </div>
      <label><input v-model="onlyChanges" type="checkbox" />只看差异</label
      ><button type="button" aria-label="上一处差异" @click="jump(-1)">
        <AppIcon name="chevron-up" :size="14" /></button
      ><button type="button" aria-label="下一处差异" @click="jump(1)">
        <AppIcon name="chevron-down" :size="14" />
      </button>
    </div>
    <div class="sample-alignment">
      <span>数组对齐</span
      ><button type="button" :aria-pressed="align === 'position'" @click="align = 'position'">
        按位置</button
      ><button type="button" :aria-pressed="align === 'id'" @click="align = 'id'">
        按样本中的唯一 id</button
      ><small>{{
        align === 'id'
          ? '不满足唯一 id 的数组仍按位置；对齐方式不代表业务身份已确认。'
          : '数组按索引比较，顺序变化也会显示差异。'
      }}</small
      ><span v-if="loading" class="sample-calculating" role="status">计算差异中…</span>
    </div>
    <p v-if="error" class="sample-error" role="alert">{{ error }}</p>
    <p v-if="result?.truncated" class="sample-error">
      内容超过本次展示范围，当前统计并非完整差异。
    </p>
    <div class="sample-diff-head-clip">
      <div
        class="sample-diff-column-head"
        :style="{
          ...columnStyle,
          minWidth: 170 + 180 * ordered.length + 'px',
          transform: `translateX(${-scrollLeft}px)`,
        }"
      >
        <span>字段路径</span>
        <div v-for="id in ordered" :key="id">
          <span>{{ formatTime(examples.find((e) => e.id === id)?.last_seen ?? '') }}</span
          ><button type="button" :aria-pressed="baselineId === id" @click="emit('baseline', id)">
            {{ baselineId === id ? '基准样本' : '设为基准' }}
          </button>
        </div>
      </div>
    </div>
    <div ref="scroller" class="sample-diff-scroll" @scroll="onScroll($event)">
      <div
        class="sample-diff-spacer"
        :style="{
          height: Math.max(rows.length * rowHeight, 120) + 'px',
          minWidth: 170 + 180 * ordered.length + 'px',
        }"
      >
        <div
          v-for="(row, index) in visible"
          :key="row.path"
          class="sample-diff-row"
          :style="{ ...columnStyle, transform: `translateY(${(start + index) * rowHeight}px)` }"
        >
          <code class="sample-diff-path" :title="row.path">{{ row.path }}</code>
          <div v-for="(cell, i) in row.cells" :key="i" :data-kind="cell.kind" :title="cell.text">
            <span class="sample-diff-sign">{{
              { same: '', added: '+', removed: '−', changed: '~', unknown: '?' }[cell.kind]
            }}</span
            ><code>{{ cell.text }}</code
            ><small>{{ cell.type === 'missing' ? '' : cell.type }}</small>
          </div>
        </div>
        <div v-if="!rows.length && !loading" class="sample-diff-empty">
          {{ onlyChanges ? '当前捕获内容没有字段差异。' : '没有可比较内容。' }}
        </div>
      </div>
    </div>
  </section>
</template>
