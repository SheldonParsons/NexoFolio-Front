<script setup lang="ts">
import SchemaView from './SchemaView.vue'
import { captureLabels } from './presentation'
import type { ObservedDefinition } from './types'
defineProps<{ body: ObservedDefinition['request']['body'] }>()
</script>
<template>
  <section class="document-field-section">
    <div class="document-body-heading">
      <h4>正文结构</h4>
      <span class="document-chip">{{ captureLabels[body.state] || body.state }}</span
      ><code>{{ body.media_type || '未记录媒体类型' }}</code>
    </div>
    <SchemaView
      v-if="'observed_schema' in body && body.observed_schema"
      :schema="body.observed_schema"
    />
    <p v-else class="document-empty-inline">
      {{
        body.state === 'none'
          ? '此条基线样例未携带正文。'
          : '未取得可展示的正文结构，请结合限制说明与原始样例查看。'
      }}
    </p>
  </section>
</template>
