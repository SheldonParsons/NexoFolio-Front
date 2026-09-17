<script setup lang="ts">
import { computed, ref } from 'vue'
import EvidenceLinks from './EvidenceLinks.vue'
import { basisLabels, changeLabels, diffText, revisionState } from './presentation'
import type { EvidenceRef, MaintenanceCandidate } from './models'
import './maintenance.css'
const props = defineProps<{ candidate: MaintenanceCandidate }>()
const emit = defineEmits<{ evidence: [ref: EvidenceRef] }>()
const filter = ref<'all' | 'directory' | 'semantic'>('all')
const changes = computed(() =>
  props.candidate.changes.filter(
    (change) =>
      filter.value === 'all' ||
      (filter.value === 'directory' ? change.kind === 'directory' : change.kind !== 'directory'),
  ),
)
</script>
<template>
  <section class="maintenance-panel" aria-label="统一候选改动">
    <header>
      <h2>候选改动</h2>
      <p>目录和语义改动统一审阅；这里只展示候选，不会自动发布。</p>
    </header>
    <nav class="maintenance-filters" aria-label="候选改动类型">
      <button type="button" :aria-pressed="filter === 'all'" @click="filter = 'all'">全部</button
      ><button type="button" :aria-pressed="filter === 'directory'" @click="filter = 'directory'">
        目录</button
      ><button type="button" :aria-pressed="filter === 'semantic'" @click="filter = 'semantic'">
        语义资料
      </button>
    </nav>
    <ul v-if="candidate.problems.length" class="maintenance-note" role="alert">
      <li v-for="(problem, index) in candidate.problems" :key="index">{{ problem }}</li>
    </ul>
    <p v-if="!changes.length" class="maintenance-caption">该范围内没有候选改动。</p>
    <article
      v-for="change in changes"
      :key="`${candidate.id}:${change.id}`"
      class="maintenance-change"
    >
      <header>
        <h3>{{ changeLabels[change.kind] }} · {{ change.target }}</h3>
        <span class="maintenance-badge">{{ basisLabels[change.basis] }}</span
        ><span
          v-if="change.kind !== 'directory' && revisionState(change) === 'stale'"
          class="maintenance-badge"
          >stale · 需重新复核</span
        ><span
          v-else-if="change.kind !== 'directory' && revisionState(change) === 'unknown'"
          class="maintenance-badge"
          >修订未核对</span
        >
      </header>
      <div class="maintenance-diff">
        <section>
          <h4>变更前</h4>
          <pre>{{ diffText(change.before) }}</pre>
        </section>
        <section>
          <h4>候选变更后</h4>
          <pre>{{ diffText(change.after) }}</pre>
        </section>
      </div>
      <p>{{ change.reason }}</p>
      <EvidenceLinks :evidence="change.evidence" @open="emit('evidence', $event)" />
    </article>
  </section>
</template>
