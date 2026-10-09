<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppIcon from '@/components/icons/AppIcon.vue'
import { formatTime } from '@/features/documents/presentation'
import { candidateStateLabels, type CandidateSummary } from './types'
import { canReviewDecision } from './reviewActions'
const props = defineProps<{ projectId: string; runs: CandidateSummary[]; error: string }>()
const route = useRoute()
const groups = computed(() => {
  const rows = props.runs
    .filter((row) => row.project_id === props.projectId)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  return [
    { title: '待审阅', rows: rows.filter((row) => canReviewDecision(row.state, 'apply')) },
    { title: '其他整理记录', rows: rows.filter((row) => !canReviewDecision(row.state, 'apply')) },
  ].filter((group) => group.rows.length)
})
</script>
<template>
  <div class="curation-history" data-scroll-container>
    <div class="curation-history-intro">
      <h2>选择一轮整理结果</h2>
      <p>每轮结果分别保留，选择一轮查看内容，再决定是否应用或废弃。</p>
      <small>显示最近 30 轮记录</small>
    </div>
    <section v-for="group in groups" :key="group.title" class="curation-history-group">
      <h3>
        {{ group.title }}<span>{{ group.rows.length }}</span>
      </h3>
      <RouterLink
        v-for="item in group.rows"
        :key="item.id"
        :to="{
          name: 'curation-review',
          params: { projectId, candidateId: item.id },
          query: route.query,
        }"
        class="curation-history-item"
      >
        <span class="curation-history-mark"
          ><AppIcon :name="item.state === 'applied' ? 'check' : 'layers'" :size="18"
        /></span>
        <div>
          <strong>{{ formatTime(item.created_at) }}</strong>
          <p>
            {{ candidateStateLabels[item.state] }} ·
            {{ item.target ? '单接口整理' : '项目整体整理' }}
          </p>
        </div>
        <span>{{ item.progress.fields_updated ?? 0 }} 个字段补充</span
        ><AppIcon name="arrow-right" :size="16" />
      </RouterLink>
    </section>
    <p v-if="!groups.length && !error" class="curation-placeholder">
      暂无整理结果，请先进行整理文档
    </p>
  </div>
</template>
