<script setup lang="ts">
import { computed } from 'vue'
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from 'reka-ui'
import AppIcon from '@/components/icons/AppIcon.vue'
import { useIconInteraction } from '@/components/motion/useIconInteraction'
import DefinitionView from './DefinitionView.vue'
import { outcomeLabels, processingLabels } from './presentation'
import type { InterfaceDetail, ObservationDetail } from './types'
const props = defineProps<{ record: ObservationDetail; baseline: InterfaceDetail }>()
const emit = defineEmits<{ close: []; refresh: [] }>()
const view = defineModel<'raw' | 'difference'>('view', { default: 'raw' })
const closeMotion = useIconInteraction()
const rawText = computed(() => JSON.stringify(props.record.raw_record, null, 2))
const matchingBaseline = computed(
  () => props.record.compared_revision_id === props.baseline.revision_id,
)
function setView(value: unknown) {
  if (value === 'raw' || value === 'difference') view.value = value
}
</script>
<template>
  <section class="observation-viewer" aria-label="观测记录详情">
    <header class="observation-viewer-heading">
      <div>
        <p class="document-eyebrow">OBSERVATION</p>
        <h3>观测记录</h3>
      </div>
      <button
        type="button"
        class="document-icon-button"
        aria-label="关闭观测记录"
        v-on="closeMotion.events"
        @click="emit('close')"
      >
        <AppIcon name="x" active-name="circle-x" :active="closeMotion.active.value" :size="18" />
      </button>
    </header>
    <div class="observation-state-line">
      <span class="document-chip">{{ processingLabels[record.status] }}</span
      ><span v-if="record.outcome" class="document-chip">{{ outcomeLabels[record.outcome] }}</span
      ><button type="button" class="document-text-button" @click="emit('refresh')">
        重新读取状态
      </button>
    </div>
    <dl class="document-provenance">
      <div>
        <dt>采集 ID</dt>
        <dd>
          <code>{{ record.ingestion_id }}</code>
        </dd>
      </div>
      <div>
        <dt>处理次数</dt>
        <dd>{{ record.attempts }}</dd>
      </div>
      <div>
        <dt>对照版本</dt>
        <dd>
          <code>{{ record.compared_revision_id || '尚未关联' }}</code>
        </dd>
      </div>
      <div v-if="record.difference_id">
        <dt>差异 ID</dt>
        <dd>
          <code>{{ record.difference_id }}</code>
        </dd>
      </div>
      <div v-if="record.error_code">
        <dt>处理错误</dt>
        <dd>
          <code>{{ record.error_code }}</code>
        </dd>
      </div>
    </dl>
    <p v-if="record.status === 'pending' || record.status === 'processing'" class="document-note">
      此记录尚未处理完成。
    </p>
    <p v-if="record.outcome === 'difference_recorded'" class="document-observed-note">
      结构变化已记录为待处理差异，尚未应用到当前定义。
    </p>
    <TabsRoot :model-value="view" @update:model-value="setView">
      <TabsList class="document-tabs document-tabs--small" aria-label="观测记录内容">
        <TabsTrigger value="raw" class="document-tab">样例原文</TabsTrigger>
        <TabsTrigger
          v-if="record.proposed_definition || record.outcome === 'difference_recorded'"
          value="difference"
          class="document-tab"
          >待处理差异</TabsTrigger
        >
      </TabsList>
      <TabsContent value="raw" class="document-tab-panel">
        <p v-if="record.raw_record === null" class="document-note" role="status">
          临时原文已过期，不再提供原始采集内容。观测元数据和已保存的差异仍可查看。
        </p>
        <p v-else class="document-note">原始采集记录，保留采集到的字段与原始值。</p>
        <textarea
          v-if="record.raw_record !== null"
          class="observation-raw"
          :value="rawText"
          readonly
          spellcheck="false"
          aria-label="完整原始采集记录 JSON"
        />
      </TabsContent>
      <TabsContent value="difference" class="document-tab-panel">
        <template v-if="record.proposed_definition">
          <p v-if="!matchingBaseline" class="document-notice">
            此差异针对另一观测版本，无法用当前定义作准确对照。下面只展示差异提议。
          </p>
          <div
            class="difference-columns"
            :class="{ 'difference-columns--single': !matchingBaseline }"
          >
            <section v-if="matchingBaseline">
              <header>
                <h4>当前观测基线</h4>
                <span>保持不变</span>
              </header>
              <DefinitionView :definition="baseline.definition" />
            </section>
            <section>
              <header>
                <h4>差异提议</h4>
                <span>待处理 · 未应用</span>
              </header>
              <DefinitionView :definition="record.proposed_definition" />
            </section>
          </div>
        </template>
        <p v-else class="document-empty-inline">暂未取得差异提议结构。</p>
      </TabsContent>
    </TabsRoot>
  </section>
</template>
