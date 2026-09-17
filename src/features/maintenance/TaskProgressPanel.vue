<script setup lang="ts">
import { computed } from 'vue'
import EvidenceLinks from './EvidenceLinks.vue'
import { coveragePresentation, phaseLabel, taskLabels, workLabels } from './presentation'
import type { EvidenceRef, TaskProgress } from './models'
import './maintenance.css'
const props = defineProps<{ task: TaskProgress }>()
const emit = defineEmits<{ evidence: [ref: EvidenceRef] }>()
const coverage = computed(() => coveragePresentation(props.task.coverage))
</script>
<template>
  <section class="maintenance-panel" aria-label="重构任务进度">
    <header>
      <h2>{{ taskLabels[task.state] }}</h2>
      <span class="maintenance-caption">任务 {{ task.id }}</span>
    </header>
    <section>
      <h3>快照范围</h3>
      <p>
        {{ task.snapshot.createdAt }} · {{ task.snapshot.interfaceCount ?? '未知' }} 个接口 ·
        {{ task.snapshot.fieldCount ?? '未知' }} 个字段
      </p>
      <p class="maintenance-caption">快照之后的新观测继续保留，不算作本次已审阅内容。</p>
      <EvidenceLinks :evidence="task.snapshot.evidence" @open="emit('evidence', $event)" />
    </section>
    <section>
      <h3>全量字段审阅</h3>
      <p>{{ coverage.text }}</p>
      <progress
        v-if="coverage.ratio !== null"
        :value="coverage.ratio"
        max="100"
        aria-label="字段审阅覆盖比例"
      />
      <dl class="maintenance-counts">
        <div>
          <dt>已审阅 / 总数</dt>
          <dd>{{ task.coverage.reviewed ?? '未知' }} / {{ task.coverage.total ?? '未知' }}</dd>
        </div>
        <div>
          <dt>缺失</dt>
          <dd>{{ task.coverage.missing ?? '未知' }}</dd>
        </div>
        <div>
          <dt>失败</dt>
          <dd>{{ task.coverage.failed ?? '未知' }}</dd>
        </div>
      </dl>
    </section>
    <section>
      <h3>分片进度</h3>
      <p v-if="task.segments">
        已完成 {{ task.segments.completed }} / {{ task.segments.total }} 个分片
      </p>
      <p v-if="task.phase" class="maintenance-caption">当前阶段：{{ phaseLabel(task.phase) }}</p>
      <p v-if="!task.shards.length" class="maintenance-caption">尚未提供分片结果。</p>
      <ul class="maintenance-shards">
        <li v-for="shard in task.shards" :key="shard.id">
          <strong>{{ shard.label }}</strong
          ><span
            >{{ workLabels[shard.state] }} · {{ shard.reviewed ?? '未知' }}/{{
              shard.total ?? '未知'
            }}</span
          >
          <p v-if="shard.problem" role="status">{{ shard.problem }}</p>
        </li>
      </ul>
    </section>
    <section>
      <h3>回读核对 · {{ workLabels[task.readback.state] }}</h3>
      <p>{{ task.readback.description || '尚未提供回读说明。' }}</p>
      <EvidenceLinks :evidence="task.readback.evidence" @open="emit('evidence', $event)" />
    </section>
    <section>
      <h3>模型策略与原因</h3>
      <template v-if="task.strategy"
        ><strong>{{ task.strategy.label }}</strong>
        <p>{{ task.strategy.reason }}</p></template
      >
      <p v-else class="maintenance-caption">策略尚未提供；用户无需选择全量或局部。</p>
    </section>
    <section v-if="task.problems.length" role="alert">
      <h3>需要关注的问题</h3>
      <ul>
        <li v-for="(problem, index) in task.problems" :key="index">{{ problem }}</li>
      </ul>
    </section>
  </section>
</template>
