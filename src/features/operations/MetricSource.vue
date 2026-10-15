<script setup lang="ts">
import type { Snapshot } from './types'
import { freshness, time } from './format'
defineProps<{ value: Snapshot<unknown> | null | undefined; now: number }>()
</script>
<template>
  <details class="ops-source">
    <summary :class="{ 'ops-stale': freshness(value, now) === '已过期' }">
      {{ freshness(value, now)
      }}<template v-if="value?.sampled_at"> · {{ time(value.sampled_at) }}</template>
      <span>查看来源</span>
    </summary>
    <div v-if="value">
      <p>来源：{{ value.source }}</p>
      <p>范围：{{ value.scope }}</p>
      <p>采样时间：{{ time(value.sampled_at) }} · {{ value.stale_after_seconds }} 秒后过期</p>
      <p v-if="value.error">最近采样未成功：{{ value.error }}。保留值仍属于原采样时间。</p>
    </div>
  </details>
</template>
