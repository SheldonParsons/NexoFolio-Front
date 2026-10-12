<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CollapsibleRoot, CollapsibleTrigger, CollapsibleContent } from 'reka-ui'
import AppIcon from '@/components/icons/AppIcon.vue'
import { useLifecycle } from './lifecycle/context'
import { formatTime } from './presentation'

const props = defineProps<{
  endpointId: string
  method: string
  path: string
  purpose?: string | null
  retiredSourceCount?: number
}>()
const lifecycle = useLifecycle()
const decision = computed(() => lifecycle?.get({ kind: 'endpoint', id: props.endpointId }))
const pending = computed(
  () =>
    !!decision.value && decision.value.version > (lifecycle?.state.value.reconciled_version ?? 0),
)
const recordOpen = ref(false)
watch(
  () => props.endpointId,
  () => {
    recordOpen.value = false
  },
)
</script>
<template>
  <div class="endpoint-summary">
    <div class="endpoint-address" aria-label="接口方法与路径">
      <span class="http-method" :data-method="method">{{ method }}</span>
      <code class="endpoint-address-path">{{ path }}</code>
    </div>
    <p v-if="purpose" class="document-purpose endpoint-summary-purpose">{{ purpose }}</p>
    <aside
      v-if="decision || retiredSourceCount"
      class="endpoint-context"
      aria-label="废弃与关联说明"
    >
      <CollapsibleRoot v-if="decision" v-model:open="recordOpen" class="endpoint-retirement">
        <CollapsibleTrigger
          class="endpoint-retirement-trigger"
          :aria-label="recordOpen ? '收起废弃说明' : '查看废弃说明'"
        >
          <span class="endpoint-context-label">废弃说明</span>
          <span class="endpoint-retirement-preview" :title="decision.reason">{{
            decision.reason
          }}</span>
          <span v-if="pending" class="endpoint-retirement-pending">等待下一轮整理核对</span>
          <AppIcon name="chevron-down" :size="13" mode="static" />
        </CollapsibleTrigger>
        <CollapsibleContent class="endpoint-retirement-content">
          <dl>
            <div>
              <dt>原因</dt>
              <dd>{{ decision.reason }}</dd>
            </div>
            <div>
              <dt>操作人</dt>
              <dd>{{ decision.actor.display_name || '操作人未记录' }}</dd>
            </div>
            <div>
              <dt>时间</dt>
              <dd>
                <time :datetime="decision.at">{{ formatTime(decision.at) }}</time>
              </dd>
            </div>
          </dl>
        </CollapsibleContent>
      </CollapsibleRoot>
      <p v-if="retiredSourceCount" class="endpoint-source-notice">
        <span class="endpoint-context-label">关联提示</span>
        <span>关联来源已废弃；当前接口仍按自身状态判断。</span>
      </p>
    </aside>
  </div>
</template>
<style scoped>
.endpoint-summary {
  margin-top: 10px;
}
.endpoint-address {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--surface-muted);
  min-width: 0;
}
.endpoint-address .http-method {
  flex: none;
  min-width: 42px;
  height: 21px;
  margin-top: 1px;
  color: var(--bg);
  background: var(--text);
}
.endpoint-address-path {
  min-width: 0;
  font-family: var(--font-mono);
  color: var(--text);
  font-size: 12px;
  font-weight: 500;
  line-height: 22px;
  overflow-wrap: anywhere;
  user-select: text;
}
.endpoint-summary-purpose {
  margin-top: 9px;
  line-height: 1.75;
  overflow-wrap: anywhere;
}
.endpoint-context {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  line-height: 1.7;
}
.endpoint-retirement-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
  padding: 3px 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.endpoint-context-label {
  flex: none;
  font-size: 11px;
  color: var(--muted);
}
.endpoint-retirement-preview {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.endpoint-retirement-pending {
  flex: none;
  font-size: 11px;
  color: var(--muted);
}
.endpoint-retirement-trigger > svg {
  flex: none;
  color: var(--muted);
  transition: transform 160ms ease;
}
.endpoint-retirement-trigger[data-state='open'] > svg {
  transform: rotate(180deg);
}
.endpoint-retirement-trigger:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 3px;
  border-radius: 3px;
}
.endpoint-retirement-content {
  padding: 8px 0 5px;
}
.endpoint-retirement-content dl {
  display: grid;
  gap: 5px;
  margin: 0;
}
.endpoint-retirement-content dl > div {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 10px;
}
.endpoint-retirement-content dt {
  color: var(--muted);
  font-size: 11px;
}
.endpoint-retirement-content dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.endpoint-source-notice {
  display: flex;
  gap: 10px;
  margin: 3px 0;
  color: var(--muted);
}
.endpoint-source-notice > span:last-child {
  min-width: 0;
  overflow-wrap: anywhere;
}
@media (max-width: 760px) {
  .endpoint-address {
    gap: 8px;
    padding: 9px 10px;
  }
  .endpoint-address-path {
    font-size: 11px;
    line-height: 21px;
  }
  .endpoint-retirement-trigger {
    flex-wrap: wrap;
    gap: 2px 10px;
  }
  .endpoint-retirement-preview {
    flex-basis: calc(100% - 90px);
  }
  .endpoint-retirement-pending {
    order: 1;
    width: 100%;
    padding-left: 54px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .endpoint-retirement-trigger > svg {
    transition: none;
  }
}
</style>
