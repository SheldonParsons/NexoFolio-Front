<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { ApiError } from '@/api'
import { loadInterfaceReport, reportError, type InterfaceReport, type ReportSelection } from './interfaceReport'
import { renderInterfaceReportBlocks } from './reportMarkdown'
import AppIcon from '@/components/icons/AppIcon.vue'

const props = defineProps<{ selection: ReportSelection }>()
const emit = defineEmits<{ unauthorized: [] }>()
const report = shallowRef<InterfaceReport | null>(null)
const error = ref('')
const busy = ref(false)
const progress = ref('')
const scroll = ref<HTMLElement | null>(null)
const blocks = computed(() => report.value ? renderInterfaceReportBlocks(report.value) : [])
const expanded = ref<Record<string, boolean>>({})
function rememberToggle(id: string, event: Event) {
  expanded.value[id] = (event.target as HTMLDetailsElement).open
}
let request: AbortController | undefined
async function load() {
  request?.abort()
  const current = new AbortController()
  request = current
  report.value = null
  expanded.value = {}
  error.value = ''
  busy.value = true
  progress.value = '正在读取接口资料…'
  await nextTick()
  if (request !== current || current.signal.aborted) return
  scroll.value?.scrollTo({ top: 0, behavior: 'instant' })
  try {
    await loadInterfaceReport(props.selection, current.signal, (value, stage) => {
      if (request === current && !current.signal.aborted) {
        report.value = value
        progress.value = stage
      }
    })
  } catch (cause) {
    if (current.signal.aborted || request !== current) return
    current.abort()
    error.value = reportError(cause)
    if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) report.value = null
    if (cause instanceof ApiError && cause.status === 401) emit('unauthorized')
  } finally {
    if (request === current) { busy.value = false; progress.value = '' }
  }
}
watch(() => props.selection, load, { immediate: true })
onScopeDispose(() => request?.abort())
</script>

<template>
  <section class="interface-reader" aria-label="接口全部资料">
    <div class="interface-reader-toolbar">
      <span role="status">{{ busy ? progress : error || '接口资料 · Markdown' }}</span>
      <button type="button" :disabled="busy" @click="load">重新加载</button>
    </div>
    <div ref="scroll" class="interface-reader-scroll" tabindex="0" aria-label="接口文档内容">
      <p v-if="error" class="interface-reader-error" role="alert">{{ error }}</p>
      <article v-if="report" class="interface-markdown">
        <template v-for="block in blocks" :key="block.id">
          <details
            v-if="block.collapsible"
            class="interface-module"
            :open="expanded[block.id] ?? block.defaultOpen"
            @toggle="rememberToggle(block.id, $event)"
          >
            <summary>
              <AppIcon class="interface-module-chevron" name="chevron-right" mode="static" :size="16" />
              <span>{{ block.title }}</span>
              <span class="interface-module-action" aria-hidden="true" />
            </summary>
            <div class="interface-module-content" v-html="block.html" />
          </details>
          <div v-else v-html="block.html" />
        </template>
      </article>
    </div>
  </section>
</template>

<style scoped>
.interface-reader { display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; color: var(--text); background: var(--bg); }
.interface-reader-toolbar { min-height: 48px; padding: 12px 28px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--border); font-size: 12px; color: var(--muted); }
.interface-reader-toolbar button { flex: none; background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 5px 10px; font: inherit; cursor: pointer; }
.interface-reader-toolbar button:disabled { opacity: .45; cursor: wait; }
.interface-reader-scroll { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; scrollbar-width: none; padding: 32px clamp(20px, 4vw, 64px) 64px; }
.interface-reader-scroll::-webkit-scrollbar { display: none; }
.interface-reader-error { color: var(--muted); font-size: 13px; margin-bottom: 24px; }
.interface-markdown { max-width: 1080px; margin: 0 auto; overflow-wrap: anywhere; font-size: 14px; line-height: 1.85; }
.interface-module { border-bottom: 1px solid var(--border); }
.interface-module > summary { display: flex; align-items: center; gap: 10px; min-height: 54px; padding: 13px 8px; border-radius: 6px; list-style: none; cursor: pointer; font-size: 15px; font-weight: 500; transition: background-color 160ms; }
.interface-module > summary::-webkit-details-marker { display: none; }
.interface-module > summary:hover { background: var(--surface-muted); }
.interface-module > summary:focus-visible { outline: 2px solid var(--text); outline-offset: -2px; }
.interface-module-chevron { color: var(--muted); transition: transform 180ms ease; }
.interface-module[open] > summary .interface-module-chevron { transform: rotate(90deg); }
.interface-module-action { margin-left: auto; flex: none; color: var(--muted); font-size: 11px; font-weight: 400; }
.interface-module-action::after { content: '展开'; }
.interface-module[open] > summary .interface-module-action::after { content: '收起'; }
.interface-module-content { padding: 0 8px 20px; }
.interface-module[open] > .interface-module-content { animation: interface-module-reveal 160ms ease-out; }
@keyframes interface-module-reveal { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .interface-module > summary, .interface-module-chevron { transition: none; }
  .interface-module[open] > .interface-module-content { animation: none; }
}
.interface-markdown :deep(h1) { font-size: 24px; line-height: 1.5; font-weight: 600; margin: 0 0 28px; }
.interface-markdown :deep(h2) { font-size: 20px; font-weight: 600; margin: 44px 0 18px; padding-top: 24px; border-top: 1px solid var(--border); }
.interface-markdown :deep(h3) { font-size: 17px; font-weight: 550; margin: 32px 0 14px; }
.interface-markdown :deep(h4) { font-size: 14px; font-weight: 550; margin: 24px 0 12px; }
.interface-markdown :deep(p) { margin: 12px 0; }
.interface-markdown :deep(ul) { padding-left: 22px; }
.interface-markdown :deep(pre) { padding: 18px 20px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-muted); white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.8 ui-monospace, SFMono-Regular, Consolas, monospace; tab-size: 2; }
.interface-markdown :deep(code) { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.interface-markdown :deep(.interface-markdown-table) { overflow-x: auto; margin: 16px 0; }
.interface-markdown :deep(table) { width: 100%; border-collapse: collapse; font-size: 13px; }
.interface-markdown :deep(th), .interface-markdown :deep(td) { border: 1px solid var(--border); padding: 9px 12px; text-align: left; vertical-align: top; }
.interface-markdown :deep(th) { background: var(--surface-muted); font-weight: 500; }
.interface-markdown :deep(blockquote) { border-left: 2px solid var(--muted); margin: 16px 0; padding: 2px 16px; color: var(--muted); }
.interface-reader button:focus-visible, .interface-reader-scroll:focus-visible { outline: 2px solid var(--text); outline-offset: -2px; }
@media (max-width: 640px) { .interface-reader-toolbar { padding-inline: 16px; } .interface-reader-scroll { padding: 24px 16px; } }
</style>
