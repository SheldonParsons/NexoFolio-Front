<script setup lang="ts">
import './review-summary.css'
defineProps<{
  items: { kind: string; label: string; description: string; count: number }[]
}>()
</script>
<template>
  <div class="curation-review-summary">
    <span class="curation-review-summary-label" aria-hidden="true">本轮变化</span>
    <dl aria-label="本轮变化统计">
      <div
        v-for="item in items"
        :key="item.kind"
        :title="`${item.description}：${item.count} 项`"
        :aria-label="`${item.description}：${item.count} 项`"
        :data-empty="item.count === 0"
      >
        <dt>{{ item.label }}</dt>
        <dd>{{ item.count }}</dd>
      </div>
    </dl>
  </div>
</template>
