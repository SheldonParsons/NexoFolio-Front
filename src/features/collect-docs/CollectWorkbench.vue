<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import {
  checkBatch,
  collectContract,
  formatBytes,
  invalidExamples,
  validExamples,
  type CollectExample,
} from './contract'

const groups = [
  { title: '可以通过', examples: validExamples },
  { title: '常见错误', examples: invalidExamples },
]
const selected = ref<CollectExample | undefined>(validExamples[0])
const text = ref(selected.value?.text ?? '')
const checked = ref(checkBatch(text.value))
const edited = computed(() => text.value !== selected.value?.text)

let timer: ReturnType<typeof setTimeout> | undefined
watch(text, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    checked.value = checkBatch(value)
  }, 180)
})
onScopeDispose(() => clearTimeout(timer))

function choose(example: CollectExample) {
  selected.value = example
  restore()
}
function restore() {
  clearTimeout(timer)
  text.value = selected.value?.text ?? ''
  checked.value = checkBatch(text.value)
}

const summary = computed(() => {
  const result = checked.value
  if (!result.parsed) return '不是合法的 JSON'
  if (result.valid) return '符合合同'
  return `${result.issues.length} 处不符合合同`
})
const counts = computed(() => {
  const { exchanges, declarations } = checked.value.records
  return [exchanges && `${exchanges} 条调用`, declarations && `${declarations} 条声明`]
    .filter(Boolean)
    .join('，')
})
</script>

<template>
  <section class="cw" aria-label="校验一个批次">
    <nav class="cw-examples" aria-label="示例批次">
      <div v-for="group in groups" :key="group.title" class="cw-group">
        <h3>
          {{ group.title }}<span>{{ group.examples.length }}</span>
        </h3>
        <button
          v-for="example in group.examples"
          :key="example.name"
          type="button"
          :class="['cw-example', `is-${example.expected}`]"
          :aria-pressed="selected === example"
          @click="choose(example)"
        >
          {{ example.label }}
        </button>
      </div>
    </nav>

    <div class="cw-editor">
      <div class="cw-editor-bar">
        <span class="cw-editor-title">
          {{ selected?.label ?? '批次' }}
          <em v-if="edited">已修改</em>
        </span>
        <button v-if="edited" type="button" class="cw-restore" @click="restore">恢复样例</button>
      </div>
      <label class="cw-sr-only" for="collect-workbench-input">批次 JSON</label>
      <textarea
        id="collect-workbench-input"
        v-model="text"
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        wrap="off"
      />
    </div>

    <div
      class="cw-result"
      :class="checked.valid ? 'is-valid' : 'is-invalid'"
      role="status"
      aria-live="polite"
    >
      <p class="cw-summary">
        <AppIcon :name="checked.valid ? 'circle-check' : 'circle-x'" :size="16" />
        <strong>{{ summary }}</strong>
        <span v-if="counts">{{ counts }}</span>
        <span class="cw-size">
          {{ formatBytes(checked.bytes) }} / {{ formatBytes(collectContract.batchBytes) }}
        </span>
      </p>
      <ol v-if="checked.issues.length" class="cw-issues">
        <li v-for="issue in checked.issues" :key="`${issue.path}\n${issue.message}`">
          <code>{{ issue.path || '批次' }}</code>
          <span>{{ issue.message }}</span>
        </li>
      </ol>
      <p v-for="index in checked.oversizedRecords" :key="index" class="cw-note">
        <code>records[{{ index }}]</code>
        超过 4 MiB。批次仍会被接收，这条记录会出现在回执的 <code>rejected</code> 里。
      </p>
    </div>
    <p class="cw-footnote">只在这个页面里校验，内容不会发送到任何地方。</p>
  </section>
</template>

<style scoped>
.cw {
  --cw-danger: #d1242f;
  --cw-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  display: grid;
  grid-template-columns: 212px minmax(0, 1fr);
  grid-template-areas:
    'examples editor'
    'result result'
    'footnote footnote';
  margin: 26px 0 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  overflow: hidden;
}
:root[data-theme='dark'] .cw {
  --cw-danger: #ff6369;
}
.cw-examples {
  grid-area: examples;
  height: 440px;
  overflow-y: auto;
  padding: 14px 8px 16px;
  border-right: 1px solid var(--border);
  background: var(--surface-muted);
  scrollbar-width: thin;
}
.cw-group + .cw-group {
  margin-top: 18px;
}
.cw-group h3 {
  display: flex;
  justify-content: space-between;
  margin: 0 8px 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.6;
}
.cw-group h3 span {
  font-variant-numeric: tabular-nums;
}
.cw-example {
  display: flex;
  align-items: baseline;
  gap: 9px;
  width: 100%;
  padding: 5px 8px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 13px;
  line-height: 1.55;
  text-align: left;
  cursor: pointer;
}
.cw-example::before {
  content: '';
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  transform: translateY(-1px);
  background: var(--status-success);
}
.cw-example.is-invalid::before {
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--cw-danger);
}
.cw-example:hover {
  color: var(--text);
}
.cw-example[aria-pressed='true'] {
  background: var(--bg);
  color: var(--text);
  box-shadow: 0 0 0 1px var(--border);
}
.cw-example:focus-visible,
.cw-restore:focus-visible {
  outline: 2px solid var(--text);
  outline-offset: 1px;
}
.cw-editor {
  grid-area: editor;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 440px;
}
.cw-editor-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 42px;
  padding: 0 14px 0 18px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.cw-editor-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-weight: 500;
}
.cw-editor-title em {
  color: var(--muted);
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
}
.cw-restore {
  flex: none;
  padding: 3px 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.cw-restore:hover {
  border-color: var(--text);
}
.cw-editor textarea {
  flex: 1;
  width: 100%;
  min-height: 0;
  padding: 16px 18px;
  border: 0;
  outline: none;
  resize: none;
  background: transparent;
  color: var(--text);
  font-family: var(--cw-mono);
  font-size: 12px;
  line-height: 1.75;
  tab-size: 2;
}
.cw-editor:focus-within {
  box-shadow: inset 0 0 0 2px var(--text);
}
.cw-result {
  grid-area: result;
  padding: 13px 18px 14px;
  border-top: 1px solid var(--border);
  font-size: 13px;
  line-height: 1.7;
}
.cw-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  margin: 0;
}
.cw-summary strong {
  font-weight: 550;
}
.cw-summary > span {
  color: var(--muted);
}
.cw-summary .cw-size {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}
.is-valid .cw-summary :deep(.app-icon) {
  color: var(--status-success);
}
.is-invalid .cw-summary :deep(.app-icon),
.is-invalid .cw-summary strong {
  color: var(--cw-danger);
}
.cw-issues {
  max-height: 176px;
  overflow-y: auto;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}
.cw-issues li {
  display: grid;
  grid-template-columns: minmax(0, max-content) minmax(0, 1fr);
  gap: 14px;
  padding: 5px 0;
  border-top: 1px dashed var(--border);
}
.cw-result code {
  font-family: var(--cw-mono);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.cw-note {
  margin: 8px 0 0;
  color: var(--muted);
}
.cw-footnote {
  grid-area: footnote;
  margin: 0;
  padding: 9px 18px;
  border-top: 1px solid var(--border);
  background: var(--surface-muted);
  color: var(--muted);
  font-size: 12px;
}
.cw-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
@media (max-width: 760px) {
  .cw {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'examples' 'editor' 'result' 'footnote';
  }
  .cw-examples {
    height: auto;
    max-height: 196px;
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }
  .cw-editor {
    height: 380px;
  }
  .cw-issues li {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }
  .cw-summary .cw-size {
    margin-left: 0;
  }
}
</style>
