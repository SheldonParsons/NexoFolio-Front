<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { iconPaths, wordmarkPaths } from '@/features/auth/motion/nexofolioGeometry'
import { useReducedMotion } from '@/features/auth/motion/useReducedMotion'

const props = withDefaults(
  defineProps<{
    runId: number
    label?: string
    durationMs?: number
    minimumDurationMs?: number
    pending?: boolean
  }>(),
  { label: '正在进入 NexoFolio', pending: true, minimumDurationMs: 0 },
)
const emit = defineEmits<{ complete: [runId: number] }>()
const id = useId()
const maskId = `brand-transition-mask-${id}`
const gradientId = `brand-transition-gradient-${id}`
const root = ref<HTMLElement>()
const elapsed = ref(0)
const leavingAt = ref<number | null>(null)
const leavingDuration = ref(160)
const reduced = useReducedMotion()
const fixedDuration = computed(() =>
  props.durationMs === undefined ? null : Math.max(1, props.durationMs),
)
const opacity = computed(() => {
  if (fixedDuration.value !== null)
    return Math.min(
      1,
      Math.max(0, (fixedDuration.value - elapsed.value) / Math.min(200, fixedDuration.value)),
    )
  return leavingAt.value === null
    ? 1
    : Math.min(1, Math.max(0, 1 - (elapsed.value - leavingAt.value) / leavingDuration.value))
})
const sweep = computed(() => (reduced.value ? 0 : -950 + ((elapsed.value % 1500) / 1500) * 1900))
let started = 0
let raf = 0
let timer: ReturnType<typeof setTimeout> | undefined
let finished = false
function cleanup() {
  cancelAnimationFrame(raf)
  clearTimeout(timer)
  document.removeEventListener('visibilitychange', visibility)
}
function finish() {
  if (finished) return
  const remaining = props.minimumDurationMs - (performance.now() - started)
  if (fixedDuration.value === null && remaining > 0) {
    clearTimeout(timer)
    timer = setTimeout(finish, Math.ceil(remaining))
    return
  }
  finished = true
  cleanup()
  emit('complete', props.runId)
}
function tick() {
  if (finished) return
  elapsed.value = performance.now() - started
  if (
    (fixedDuration.value !== null && elapsed.value >= fixedDuration.value) ||
    (leavingAt.value !== null && elapsed.value - leavingAt.value >= leavingDuration.value)
  ) {
    finish()
    return
  }
  if (!document.hidden) raf = requestAnimationFrame(tick)
}
function leave() {
  if (fixedDuration.value !== null || leavingAt.value !== null || finished || !started) return
  const now = performance.now() - started
  if (props.minimumDurationMs > 0 && now >= props.minimumDurationMs) {
    finish()
    return
  }
  leavingAt.value = props.minimumDurationMs > 0 ? Math.max(now, props.minimumDurationMs - 160) : now
  leavingDuration.value =
    props.minimumDurationMs > 0 ? props.minimumDurationMs - leavingAt.value : 160
  timer = setTimeout(finish, leavingAt.value + leavingDuration.value - now)
}
function visibility() {
  cancelAnimationFrame(raf)
  if (!document.hidden) tick()
}
watch(
  () => props.pending,
  (pending) => {
    if (!pending) leave()
  },
)
onMounted(() => {
  started = performance.now()
  root.value?.focus({ preventScroll: true })
  if (fixedDuration.value !== null) timer = setTimeout(finish, fixedDuration.value)
  else if (!props.pending) leave()
  raf = requestAnimationFrame(tick)
  document.addEventListener('visibilitychange', visibility)
})
onBeforeUnmount(() => {
  finished = true
  cleanup()
})
</script>

<template>
  <div
    ref="root"
    class="brand-transition login-success-overlay"
    :style="{ opacity }"
    :data-run="runId"
    role="status"
    :aria-label="label"
    tabindex="-1"
  >
    <svg class="brand-transition-logo" viewBox="-25 -25 800 734" fill="none" aria-hidden="true">
      <defs>
        <mask :id="maskId" maskUnits="userSpaceOnUse" x="-25" y="-25" width="800" height="734">
          <g transform="translate(113 0)">
            <path
              v-for="(path, i) in iconPaths"
              :key="i"
              :d="path"
              fill="white"
              fill-rule="evenodd"
            />
          </g>
          <g transform="translate(0 530)">
            <path
              v-for="(path, i) in wordmarkPaths"
              :key="i"
              :d="path"
              fill="white"
              fill-rule="evenodd"
            />
          </g>
        </mask>
        <linearGradient
          :id="gradientId"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="640"
          y2="340"
          :gradientTransform="`translate(${sweep} 0)`"
        >
          <stop offset="0" stop-color="#f4f4f1" stop-opacity="0" />
          <stop offset=".25" stop-color="#80cdf2" />
          <stop offset=".46" stop-color="#b0a2f2" />
          <stop offset=".65" stop-color="#f5abc0" />
          <stop offset=".83" stop-color="#f8c68f" />
          <stop offset="1" stop-color="#f4f4f1" stop-opacity="0" />
        </linearGradient>
      </defs>
      <g :mask="`url(#${maskId})`">
        <rect x="-25" y="-25" width="800" height="734" fill="#eeeeeb" />
        <rect x="-25" y="-25" width="800" height="734" :fill="`url(#${gradientId})`" />
      </g>
    </svg>
  </div>
</template>

<style scoped>
.brand-transition {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  background: #000;
  outline: none;
  overscroll-behavior: none;
  touch-action: none;
}
.brand-transition-logo {
  display: block;
  width: clamp(150px, 19vw, 240px);
  height: auto;
  max-height: 60dvh;
}
</style>
