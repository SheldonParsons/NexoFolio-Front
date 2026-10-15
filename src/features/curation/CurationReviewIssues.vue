<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import type { IconName } from '@/components/icons/registry'
import type { DocumentIndex } from '@/features/documents/source'
import type { Candidate } from './types'
import './review-issues.css'
const props = defineProps<{ candidate: Candidate; index: DocumentIndex | null; busy: boolean }>()
defineEmits<{ document: []; progress: []; resume: [] }>()
const issues = computed(() => props.candidate.progress.issues ?? [])
const canResume = computed(
  () =>
    (props.candidate.resume_available ?? !!props.candidate.execution_input) &&
    ['partial', 'interrupted'].includes(props.candidate.state),
)
const empty = computed<{ icon: IconName; title: string; description: string }>(() => {
  switch (props.candidate.state) {
    case 'running':
      return {
        icon: 'circle-dashed',
        title: '暂未记录待处理项',
        description: '本轮仍在整理，处理记录会随进度更新。',
      }
    case 'interrupted':
      return {
        icon: 'circle-pause',
        title: '本轮整理已中断',
        description: '已生成的内容保留在候选文档中，当前没有逐项待处理记录。',
      }
    case 'partial':
      return {
        icon: 'circle-help',
        title: '本轮还有内容需要补充',
        description: '当前没有逐项缺口记录，可以先查看已生成的内容。',
      }
    case 'discarded':
      return {
        icon: 'circle-x',
        title: '本轮结果已废弃',
        description: '本轮未记录待处理项，已保存的候选内容仍可查看。',
      }
    default:
      return {
        icon: 'circle-check',
        title: '暂无待处理项',
        description: '本轮没有记录需要补充或处理的项目。',
      }
  }
})
</script>
<template>
  <div class="curation-issues" :class="{ 'is-empty': !issues.length }" data-scroll-container>
    <section v-if="!issues.length" class="curation-issues-empty">
      <span class="curation-issues-empty-mark" aria-hidden="true"
        ><AppIcon :name="empty.icon" :size="28" mode="static"
      /></span>
      <span class="curation-issues-empty-label">本轮处理情况</span>
      <h2>{{ empty.title }}</h2>
      <p>{{ empty.description }}</p>
      <p v-if="candidate.progress.message" class="curation-issues-empty-reason">
        {{ candidate.progress.message }}
      </p>
      <div class="curation-issues-empty-actions">
        <button type="button" :disabled="busy" @click="$emit('document')">
          查看候选文档<AppIcon name="arrow-right" :size="14" mode="static" />
        </button>
        <button
          v-if="candidate.state === 'running'"
          type="button"
          :disabled="busy"
          class="is-secondary"
          @click="$emit('progress')"
        >
          查看本轮进度
        </button>
        <button
          v-else-if="canResume"
          type="button"
          :disabled="busy"
          class="is-secondary"
          @click="$emit('resume')"
        >
          {{ busy ? '正在恢复本轮' : '续跑本轮' }}
        </button>
      </div>
    </section>
    <template v-else>
      <h2>本轮处理情况</h2>
      <p>
        {{
          candidate.progress.message ||
          (candidate.state === 'running'
            ? '任务仍在生成，已完成批次持续保存。'
            : '业务未知项保留在对应说明里。')
        }}
      </p>
      <article v-for="(issue, i) in issues" :key="i">
        <strong>{{
          candidate.view.notes.find((n) => n.endpoint === issue.endpoint)?.name ||
          index?.entries.find((e) => e.interface_id === issue.endpoint)?.path ||
          issue.endpoint
        }}</strong>
        <p>{{ issue.message }}</p>
        <small
          >{{ issue.fields }} 个字段 ·
          {{ issue.retryable ? '可继续整理补充' : '需检查模型服务配置' }}</small
        >
      </article>
    </template>
  </div>
</template>
