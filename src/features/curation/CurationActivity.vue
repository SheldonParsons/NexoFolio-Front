<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import StreamingText from '@/components/motion/StreamingText.vue'
import NumberPop from '@/components/motion/NumberPop.vue'
import CurationWorkCard from './CurationWorkCard.vue'
import CurationMessage from './CurationMessage.vue'
import CurationRunSummary from './CurationRunSummary.vue'
import ProcessingMark from './ProcessingMark.vue'
import type { CurateProgress } from '@/contracts/knowledge/types'
import { unfinishedFields } from './activity'
import { eventState, workKey } from './workPresentation'
import { workPage, workPageSize } from './workPaging'
import '@/components/motion/transitions-dev/reasoning-stream.css'
import './activity.css'
import './answer.css'
import './work-motion.css'
const props = defineProps<{ progress: CurateProgress; busy: boolean; now: number }>()
const viewport = ref<HTMLElement>(),
  follow = ref(true)
let autoScrolling = false
let firstDisplay = true
const records = computed(() => (props.progress.activity ?? []).slice(-30))
const active = computed(() => (props.busy ? (props.progress.active ?? []) : []))
const closed = computed(() =>
  ['applied', 'discarded'].includes(props.progress.candidate_state ?? ''),
)
const gaps = computed(() =>
  closed.value ? 0 : new Set(props.progress.issues?.map((issue) => issue.endpoint)).size,
)
const processing = ref<HTMLElement>()
const availableHeight = ref(0)
const selectedPage = ref(0)
const viewingTasks = ref(false)
// Outcome notices also consume fixed height; reserve room before sizing task previews.
const pageSize = computed(() => workPageSize(availableHeight.value - (gaps.value ? 64 : 0)))
const page = computed(() => workPage(active.value, selectedPage.value, pageSize.value || 1))
const rowHeight = computed(() => (props.progress.stage === 'fields' ? 56 : 70))
let sizeObserver: ResizeObserver | undefined
watch(processing, (element) => {
  sizeObserver?.disconnect()
  if (!element) return
  availableHeight.value = element.clientHeight
  sizeObserver = new ResizeObserver(([entry]) => {
    if (entry) availableHeight.value = entry.contentRect.height
  })
  sizeObserver.observe(element)
})
onScopeDispose(() => sizeObserver?.disconnect())
watch(
  () => page.value.index,
  (index) => {
    selectedPage.value = index
  },
)
watch(pageSize, (size) => {
  selectedPage.value = 0
  if (size > 0) viewingTasks.value = false
})
watch(
  () => active.value.length,
  (count) => {
    if (!count) viewingTasks.value = false
  },
)
const finishedNow = ref(false)
watch(
  () => props.busy,
  (busy, before) => {
    finishedNow.value = before && !busy
  },
)
const firstSeen = new Set<number>()
watch(
  () => props.progress.run_id,
  () => {
    firstSeen.clear()
    firstDisplay = true
    follow.value = true
    selectedPage.value = 0
    viewingTasks.value = false
  },
)
watch(
  () => records.value.map((row) => row.id).join(','),
  async () => {
    const rows = records.value
    const initial = firstDisplay
    if (initial) rows.forEach((row) => firstSeen.add(row.id))
    firstDisplay = false
    await nextTick()
    const node = viewport.value
    if (!node || !follow.value || viewingTasks.value) return
    autoScrolling = node.scrollHeight - node.clientHeight - node.scrollTop > 1
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    node.scrollTo({ top: node.scrollHeight, behavior: initial || reduce ? 'instant' : 'smooth' })
  },
  { immediate: true },
)
function onScroll() {
  const node = viewport.value
  if (!node || autoScrolling) return
  follow.value = node.scrollHeight - node.clientHeight - node.scrollTop < 28
}
async function latest() {
  viewingTasks.value = false
  follow.value = true
  await nextTick()
  autoScrolling = true
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  viewport.value?.scrollTo({
    top: viewport.value.scrollHeight,
    behavior: reduce ? 'instant' : 'smooth',
  })
}
async function showTasks() {
  viewingTasks.value = true
  autoScrolling = false
  await nextTick()
  viewport.value?.scrollTo({ top: 0, behavior: 'instant' })
}
function action(kind: string) {
  const labels: Record<string, string> = {
    saved: '已保存',
    complete: '本轮完成',
    retry: '重试',
    gap: '需要补充',
    partial: '本轮待补充',
    started: '开始处理',
    reused: '已复用',
  }
  return labels[kind] ?? '处理动态'
}
</script>
<template>
  <section ref="processing" class="curation-processing">
    <div v-if="active.length && pageSize" class="curation-work-pager">
      <span
        >当前处理 {{ active.length }} 批<span v-if="page.pages > 1">
          · 展示 {{ page.start }}–{{ page.end }}</span
        ></span
      >
      <div v-if="page.pages > 1" aria-label="当前任务分页">
        <button
          type="button"
          aria-label="上一页任务"
          :disabled="page.index === 0"
          @click="selectedPage--"
        >
          <AppIcon name="chevron-left" :size="12" />
        </button>
        <span>{{ page.index + 1 }} / {{ page.pages }}</span>
        <button
          type="button"
          aria-label="下一页任务"
          :disabled="page.index + 1 === page.pages"
          @click="selectedPage++"
        >
          <AppIcon name="chevron-right" :size="12" />
        </button>
      </div>
    </div>
    <TransitionGroup
      v-if="pageSize && active.length"
      name="curation-work"
      tag="div"
      class="curation-current-work is-paged"
      :style="{ height: page.rows * rowHeight + 'px', gridAutoRows: rowHeight + 'px' }"
    >
      <div
        v-for="item in page.items"
        :key="workKey(progress.stage, item)"
        class="curation-work-row"
      >
        <div>
          <CurationWorkCard :item="item" :fields-stage="progress.stage === 'fields'" :now="now" />
        </div>
      </div>
    </TransitionGroup>
    <Transition name="processing-event">
      <div
        v-if="busy && progress.stage === 'fields' && !active.length && progress.queued_batches"
        class="curation-queue-count"
      >
        <NumberPop :value="progress.queued_batches" /> 批等待处理<span>已完成的批次持续保留</span>
      </div>
    </Transition>
    <header class="curation-feed-heading">
      <span>{{ viewingTasks ? '当前处理任务' : '最近处理动态' }}</span>
      <div class="curation-feed-controls">
        <button
          v-if="!pageSize && active.length && !viewingTasks"
          type="button"
          class="curation-task-toggle"
          @click="showTasks"
        >
          查看 {{ active.length }} 批任务
        </button>
        <button
          class="curation-follow-button"
          type="button"
          :disabled="follow && !viewingTasks"
          @click="latest"
        >
          {{ viewingTasks ? '返回动态' : follow ? '自动跟随' : '跟随最新' }}
          <AppIcon
            name="chevron-down"
            :size="12"
            :class="{ 'is-placeholder': follow && !viewingTasks }"
          />
        </button>
      </div>
    </header>
    <div
      ref="viewport"
      class="curation-feed t-reason"
      @scroll="onScroll"
      @scrollend="autoScrolling = false"
      @wheel="autoScrolling = false"
      @touchstart="autoScrolling = false"
      @keydown="autoScrolling = false"
      tabindex="0"
      :aria-label="viewingTasks ? '当前处理任务' : '整理处理动态'"
    >
      <div v-if="viewingTasks" class="curation-task-details">
        <CurationWorkCard
          v-for="item in active"
          :key="workKey(progress.stage, item)"
          :item="item"
          :fields-stage="progress.stage === 'fields'"
          :now="now"
        />
      </div>
      <TransitionGroup
        v-else-if="records.length"
        name="processing-event"
        tag="ol"
        class="curation-feed-records"
        :aria-live="busy ? 'polite' : 'off'"
        aria-relevant="additions"
      >
        <li v-for="event in records" :key="event.id" class="curation-reply">
          <CurationMessage
            :label="action(event.kind)"
            :state="eventState(event)"
            :animate="!firstSeen.has(event.id)"
            :at="event.at"
          >
            <h3>
              {{
                event.name ||
                { describe: '接口说明', fields: '字段知识', organize: '目录整理' }[event.stage]
              }}
            </h3>
            <p><StreamingText :text="event.message" :animate="!firstSeen.has(event.id)" /></p>
            <template v-if="event.fields != null || event.batch != null" #details>
              <span v-if="event.fields != null">{{ event.fields }} 个字段</span>
              <span v-if="event.batch != null">第 {{ event.batch }} 批</span>
            </template>
          </CurationMessage>
        </li>
      </TransitionGroup>
      <CurationRunSummary v-else :progress="progress" :busy="busy" />
    </div>
    <Transition name="curation-outcome">
      <div v-if="gaps" class="curation-processing-gap" key="gap">
        <ProcessingMark state="gap" :animate="finishedNow" />
        <div>
          <strong>{{ gaps }} 个接口需要补充</strong
          ><small>{{
            busy
              ? '已保存内容继续保留，其他批次仍在处理'
              : unfinishedFields(progress) + ' 个字段尚未完成本轮更新，已保存内容可先审阅'
          }}</small>
        </div>
      </div>
      <div
        v-else-if="!busy && !closed && progress.status === 'done'"
        class="curation-processing-finished"
        key="done"
      >
        <ProcessingMark state="saved" :animate="finishedNow" /><span>本轮已完成，等待你的审阅</span>
      </div>
    </Transition>
  </section>
</template>
