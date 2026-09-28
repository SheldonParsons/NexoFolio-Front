<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import MarkdownContent from '@/features/product-docs/MarkdownContent.vue'
import CollectWorkbench from './CollectWorkbench.vue'
import { collectContract } from './contract'

const props = defineProps<{ body: string; prefix: string }>()
const parts = computed(() => props.body.split('<!-- collect-workbench -->'))

const endpoint = '/v1/collect/batches'
const copyState = ref<'idle' | 'copied' | 'failed'>('idle')
let timer: ReturnType<typeof setTimeout> | undefined
async function copyEndpoint() {
  clearTimeout(timer)
  try {
    await navigator.clipboard.writeText(endpoint)
    copyState.value = 'copied'
  } catch {
    copyState.value = 'failed'
  }
  timer = setTimeout(() => {
    copyState.value = 'idle'
  }, 1800)
}
onScopeDispose(() => clearTimeout(timer))
</script>

<template>
  <div class="ca">
    <section class="ca-endpoint" aria-label="接口">
      <div class="ca-endpoint-line">
        <span class="ca-method">POST</span>
        <code class="ca-path">{{ endpoint }}</code>
        <button type="button" class="ca-copy" @click="copyEndpoint">
          <AppIcon v-if="copyState === 'copied'" name="check" :size="14" />
          {{ copyState === 'copied' ? '已复制' : copyState === 'failed' ? '无法复制' : '复制路径' }}
        </button>
      </div>
      <dl class="ca-facts">
        <div>
          <dt>请求体</dt>
          <dd><code>application/json</code></dd>
        </div>
        <div>
          <dt>鉴权</dt>
          <dd>不需要，用 <code>platform</code> 标记来源</dd>
        </div>
        <div>
          <dt>合同</dt>
          <dd><code>collect</code> {{ collectContract.version }}</dd>
        </div>
      </dl>
      <p class="ca-status">合同已定稿，服务端接口尚在开发中。</p>
    </section>
    <template v-for="(part, index) in parts" :key="index">
      <CollectWorkbench v-if="index > 0" />
      <MarkdownContent :body="part" :prefix="prefix" />
    </template>
  </div>
</template>

<style scoped>
.ca-endpoint {
  margin-top: 30px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.ca-endpoint-line {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 18px 18px 20px;
  border-bottom: 1px solid var(--border);
}
.ca-method {
  flex: none;
  padding: 3px 8px;
  border-radius: 5px;
  background: var(--text);
  color: var(--bg);
  font:
    600 12px/1.5 ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  letter-spacing: 0.5px;
}
.ca-path {
  flex: 1;
  min-width: 0;
  font:
    500 19px/1.4 ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  letter-spacing: -0.3px;
  overflow-wrap: anywhere;
}
.ca-copy {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.ca-copy:hover {
  border-color: var(--text);
  color: var(--text);
}
.ca-copy:focus-visible {
  outline: 2px solid var(--text);
  outline-offset: 2px;
}
.ca-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, auto));
  justify-content: start;
  gap: 8px 36px;
  margin: 0;
  padding: 14px 20px;
  font-size: 13px;
  line-height: 1.7;
}
.ca-facts dt {
  color: var(--muted);
  font-size: 12px;
}
.ca-facts dd {
  margin: 0;
}
.ca-facts code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
.ca-status {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  padding: 9px 20px;
  border-top: 1px solid var(--border);
  background: var(--surface-muted);
  color: var(--muted);
  font-size: 12px;
  border-radius: 0 0 8px 8px;
}
.ca-status::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--muted);
}
@media (max-width: 600px) {
  .ca-endpoint-line {
    flex-wrap: wrap;
    gap: 10px;
    padding: 16px;
  }
  .ca-path {
    flex-basis: calc(100% - 70px);
    font-size: 16px;
  }
  .ca-facts {
    grid-template-columns: minmax(0, 1fr);
    padding: 14px 16px;
  }
}
</style>
