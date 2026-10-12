<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import AppIcon from '@/components/icons/AppIcon.vue'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import ThinkingState from '@/components/motion/ThinkingState.vue'
import NumberPop from '@/components/motion/NumberPop.vue'
import CurationActivity from './CurationActivity.vue'
import CurationStages from './CurationStages.vue'
import CurationLiveness from './CurationLiveness.vue'
import { liveness } from './liveness'
import { usePanelSize } from './usePanelSize'
import type { CurationPanelSize } from './panelSize'
import type { CurateProgress } from '@/contracts/knowledge/types'
import { elapsedLabel, phaseProgress } from './progress'
import { processingHeadline } from './activity'
import './progress.css'
import './panel-sizes.css'
import './field-progress.css'
const props = withDefaults(
  defineProps<{
    progress: CurateProgress | null
    busy: boolean
    reviewTo: RouteLocationRaw
    error?: string
    historicalOnly?: boolean
    lockClose?: boolean
    actionBusy?: boolean
    dismissible?: boolean
    initialSize?: CurationPanelSize
  }>(),
  { historicalOnly: false, lockClose: false, actionBusy: false },
)
const emit = defineEmits<{ retry: [id: string]; cancel: [id: string]; close: []; view: [] }>()
const closed = ref(false)
const { size, setSize } = usePanelSize(() => props.historicalOnly, props.initialSize)
function close() {
  closed.value = true
  emit('close')
}
const expanded = computed(() => size.value === 'full')
const finishedNow = ref(false)
watch(
  () =>
    [
      props.progress?.status,
      props.progress?.candidate_id,
      props.progress?.candidate_state,
    ] as const,
  ([status, id, state], [before, beforeId]) => {
    finishedNow.value =
      id === beforeId && status === 'done' && before === 'running' && state === 'ready'
  },
)
const now = ref(Date.now())
const timer = setInterval(() => (now.value = Date.now()), 1000)
onScopeDispose(() => clearInterval(timer))
watch(
  () => props.progress?.run_id ?? props.progress?.candidate_id,
  () => {
    closed.value = false
  },
)
watch(
  () => props.busy,
  (busy) => {
    if (busy) closed.value = false
  },
)
watch(
  () => props.error,
  (error) => {
    if (error) closed.value = false
  },
)
const visible = computed(
  () =>
    !closed.value &&
    (props.busy || props.error || (props.progress && props.progress.status !== 'idle')),
)
const label = computed(() => props.error || processingHeadline(props.progress, props.busy))
const percent = computed(() => phaseProgress(props.progress))
const health = computed(() => (props.busy ? liveness(props.progress, now.value) : null))
const title = computed(() => {
  if (props.progress?.lifecycle_stale) return '本轮基于旧废弃状态'
  if (!props.progress && props.error) return '整理暂时无法继续'
  if (props.progress?.candidate_state === 'applied') return '本轮已应用'
  if (props.progress?.candidate_state === 'discarded') return '本轮已废弃'
  if (props.progress?.candidate_state === 'interrupted')
    return props.progress.resume_available === false ? '整理准备未完成' : '本轮中断可恢复'
  if (health.value?.state === 'stale') return '暂时无法确认运行状态'
  if (health.value?.state === 'waiting') return '整理长时间无新进展'
  if (props.busy) return size.value === 'mini' ? '正在整理文档' : '知识正在成长'
  return props.progress?.status === 'done'
    ? (props.progress.fields_confirmation ?? 0) > 0
      ? '本轮处理结束 · 有待确认项'
      : '本轮整理完成'
    : '本轮整理需要补充'
})
const subtitle = computed(() =>
  props.busy
    ? '生成候选结果 · 现行文档保持稳定'
    : props.progress?.candidate_state === 'applied'
      ? '内容已应用到现行文档'
      : props.progress?.candidate_state === 'discarded'
        ? '已保留本轮历史记录'
        : '已保存本轮候选结果',
)
const reviewLabel = computed(() =>
  props.busy
    ? '查看已生成内容'
    : ['applied', 'discarded'].includes(props.progress?.candidate_state ?? '')
      ? '查看整理记录'
      : '审阅整理结果',
)
const fieldsDone = computed(() => props.progress?.fields_completed ?? 0)
const duration = computed(() =>
  elapsedLabel(
    props.progress?.attempt_started_at ?? props.progress?.started_at,
    props.busy ? now.value : Date.parse(props.progress?.updated_at ?? '') || now.value,
  ),
)
</script>
<template>
  <Transition name="curation-dock" appear>
    <aside
      v-if="visible"
      class="curation-dock"
      aria-label="文档整理进度"
      :data-state="progress?.status"
      :data-stage="progress?.stage"
      :data-size="size"
      :data-finished-now="finishedNow"
    >
      <header class="curation-dock-header">
        <span class="curation-brand-pulse" :class="{ 'is-running': busy }"
          ><BrandLogo variant="icon"
        /></span>
        <div>
          <span class="curation-title-frame"
            ><Transition name="curation-title"
              ><strong :key="title">{{ title }}</strong></Transition
            ></span
          >
          <small v-if="size !== 'mini'">{{ subtitle }}</small>
        </div>
        <button
          type="button"
          :aria-expanded="expanded"
          :aria-label="expanded ? '收起为摘要' : size === 'mini' ? '展开进度摘要' : '展开完整进度'"
          :title="expanded ? '收起为摘要' : size === 'mini' ? '展开进度摘要' : '展开完整进度'"
          @click="setSize(expanded ? 'compact' : size === 'mini' ? 'compact' : 'full')"
        >
          <AppIcon name="chevron-down" active-name="chevron-up" :active="!expanded" :size="15" />
        </button>
        <button
          v-if="size === 'compact'"
          type="button"
          aria-label="缩小为最小进度条"
          title="缩小为最小进度条"
          @click="setSize('mini')"
        >
          <AppIcon name="panels" :size="15" />
        </button>
        <button
          v-if="dismissible || (!busy && !lockClose)"
          type="button"
          aria-label="关闭进度面板"
          @click="close"
        >
          <AppIcon name="x" :size="15" />
        </button>
      </header>
      <div class="curation-dock-body" :aria-hidden="size === 'mini'" :inert="size === 'mini'">
        <p
          v-if="visible && progress?.lifecycle_stale && size !== 'mini'"
          class="lifecycle-project-notice"
          role="status"
        >
          废弃状态已变化。本轮成果保留，不能直接应用或续跑；是否停止本轮由你决定，之后开始新一轮整理。
        </p>

        <div
          class="curation-summary"
          :class="{ 'is-hidden': size === 'mini' }"
          :aria-hidden="size === 'mini'"
          :inert="size === 'mini'"
        >
          <div>
            <div class="curation-state-line" :role="error ? 'alert' : undefined">
              <ThinkingState :text="label" :busy="busy" /><span aria-hidden="true">{{
                duration
              }}</span>
            </div>
            <CurationStages :progress="progress" :busy="busy" />
            <CurationLiveness v-if="busy" :progress="progress" :now="now" />
          </div>
        </div>
        <div
          v-if="busy && size !== 'mini'"
          class="curation-meter"
          :class="{ 'is-indeterminate': percent === null }"
          role="progressbar"
          :aria-label="label"
          :aria-valuenow="percent === null ? undefined : Math.round(percent)"
          :aria-valuemin="0"
          :aria-valuemax="100"
        >
          <i :style="percent === null ? undefined : { width: percent + '%' }"></i>
        </div>
        <div
          class="curation-expand"
          :class="{ 'is-collapsed': !expanded }"
          :aria-hidden="!expanded"
          :inert="!expanded"
        >
          <div>
            <div v-if="expanded && $slots.switch" class="curation-panel-switch">
              <slot name="switch" />
            </div>
            <div class="curation-stat-grid">
              <span
                ><small>接口说明</small
                ><strong
                  ><NumberPop :value="progress?.completed ?? 0" /><em
                    >/ <NumberPop :value="progress?.total ?? '—'" /></em></strong
              ></span>
              <span
                ><small>字段处理</small
                ><strong
                  ><NumberPop :value="fieldsDone" /><em
                    >/ <NumberPop :value="progress?.total ?? '—'" /></em></strong
              ></span>
              <span
                ><small>本轮字段补充</small
                ><strong
                  ><NumberPop :value="progress?.fields_updated ?? 0" /><em
                    v-if="progress?.fields_total"
                    >/ <NumberPop :value="progress.fields_total" /></em></strong
              ></span>
            </div>
            <div
              v-if="progress?.fields_in_scope"
              class="curation-field-outcomes"
              aria-label="字段整理结果统计"
            >
              <span
                >已补齐 <b><NumberPop :value="progress.fields_filled ?? 0" /></b
              ></span>
              <span
                >待确认 / 待采集 <b><NumberPop :value="progress.fields_confirmation ?? 0" /></b
              ></span>
              <span
                >{{ busy ? '待补齐' : '待补跑' }}
                <b><NumberPop :value="progress.fields_pending ?? 0" /></b
              ></span>
            </div>
            <CurationActivity
              v-if="progress"
              :key="progress.run_id || progress.candidate_id || 'starting'"
              :progress="progress"
              :busy="busy"
              :now="now"
            />
          </div>
        </div>
      </div>
      <footer v-if="expanded && (progress?.candidate_id || error)" class="curation-dock-actions">
        <button
          v-if="busy && progress?.candidate_id"
          type="button"
          @click="$emit('cancel', progress.candidate_id)"
        >
          停止本轮
        </button>
        <RouterLink v-if="progress?.candidate_id" :to="reviewTo" @click="emit('view')"
          >{{ reviewLabel }}<AppIcon name="arrow-right" :size="14"
        /></RouterLink>
        <button
          v-if="
            !busy &&
            progress?.candidate_id &&
            progress.resume_available !== false &&
            !['applied', 'discarded', 'ready'].includes(progress.candidate_state ?? '') &&
            (progress?.status === 'failed' || error)
          "
          type="button"
          :disabled="actionBusy"
          :title="
            actionBusy
              ? '当前项目有整理任务正在处理，请结束后再续跑本轮'
              : '沿用本轮冻结资料和已生成内容，只补齐缺口'
          "
          @click="$emit('retry', progress?.candidate_id ?? '')"
        >
          续跑本轮
        </button>
      </footer>
    </aside>
  </Transition>
</template>
