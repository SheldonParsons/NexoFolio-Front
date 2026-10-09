<script setup lang="ts">
import { computed } from 'vue'
import CurationMessage from './CurationMessage.vue'
import type { CurateProgress } from '@/contracts/knowledge/types'
import { processingHeadline, unfinishedFields } from './activity'
const props = defineProps<{ progress: CurateProgress; busy: boolean }>()
const closed = computed(() =>
  ['applied', 'discarded'].includes(props.progress.candidate_state ?? ''),
)
const headline = computed(() => {
  if (props.busy) return processingHeadline(props.progress, true)
  if (props.progress.candidate_state === 'applied') return '本轮内容已应用'
  if (props.progress.candidate_state === 'discarded') return '本轮结果已废弃'
  return props.progress.status === 'done' ? '本轮候选文档已保存' : '已完成的内容都已保留'
})
</script>
<template>
  <CurationMessage
    :label="busy ? '正在整理' : '本轮总结'"
    :state="
      busy
        ? 'working'
        : progress.candidate_state === 'discarded'
          ? 'idle'
          : progress.status === 'done'
            ? 'saved'
            : 'idle'
    "
  >
    <h3>{{ headline }}</h3>
    <p v-if="busy">实际处理记录会在这里持续更新。</p>
    <template v-else>
      <p v-if="!closed">
        {{
          unfinishedFields(progress)
            ? `还有 ${unfinishedFields(progress)} 个字段未完成，已生成的内容可以先审阅。`
            : progress.status === 'done'
              ? '可以审阅候选文档，再决定是否应用。'
              : '已保存内容可以先审阅，未完成的部分仍可继续处理。'
        }}
      </p>
      <dl class="curation-answer-facts">
        <div>
          <dt>接口说明</dt>
          <dd>
            <b>{{ progress.generated }}</b> 个生成<span>· {{ progress.unchanged }} 个复用</span>
          </dd>
        </div>
        <div>
          <dt>字段说明</dt>
          <dd>
            <b>{{ progress.fields_updated ?? 0 }}</b> 个保存<span
              >· {{ progress.fields_reused ?? 0 }} 个复用</span
            >
          </dd>
        </div>
        <div v-if="progress.folders_saved != null || progress.directory_completed">
          <dt>目录结构</dt>
          <dd>
            {{
              progress.folders_saved != null
                ? `${progress.folders_saved} 个目录候选已保存`
                : '目录候选已保存'
            }}
          </dd>
        </div>
      </dl>
    </template>
    <template v-if="!busy" #details><span>这轮保留了处理汇总，没有逐批记录。</span></template>
  </CurationMessage>
</template>
