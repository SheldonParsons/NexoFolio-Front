<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { RequestMaterial } from '@/contracts/knowledge/types'
import { formatTime } from './presentation'
const props = defineProps<{ requests: RequestMaterial[]; environmentId?: string }>()
const selected = ref(''),
  copied = ref('')
const materials = computed(() =>
  props.requests.filter((r) => !props.environmentId || r.environment_id === props.environmentId),
)
const current = computed(
  () => materials.value.find((r) => r.example_id === selected.value) ?? materials.value[0],
)
watch(materials, () => {
  selected.value = ''
  copied.value = ''
})
const states = {
  full: '完整捕获',
  none: '此样本未发送正文',
  unreadable: '存在正文但未能读取',
  truncated: '只捕获前段',
  partial: '可用摘要，非完整原始字节',
}
const bodyText = computed(() => {
  const body = current.value?.request.body
  if (!body || !('content' in body)) return ''
  if (body.content.encoding === 'binary') return JSON.stringify(body.content.data)
  try {
    return JSON.stringify(JSON.parse(String(body.content.data)), null, 2)
  } catch {
    return String(body.content.data)
  }
})
async function copy() {
  try {
    await navigator.clipboard.writeText(JSON.stringify(current.value, null, 2))
    copied.value = '已复制完整请求资料'
  } catch {
    copied.value = '复制失败，可选中内容复制'
  }
}
</script>
<template>
  <section class="request-material" aria-label="请求资料">
    <header>
      <h3>请求资料</h3>
      <button v-if="current" type="button" @click="copy">复制请求资料</button>
    </header>
    <p v-if="!current">此环境尚无请求原文，需采集后确认 Header 与正文状态。</p>
    <template v-else>
      <select v-if="materials.length > 1" v-model="selected" aria-label="选择请求资料样本">
        <option value="">最近保留的样本</option>
        <option v-for="item in materials" :key="item.example_id" :value="item.example_id">
          {{ formatTime(item.observed_at) }} · {{ item.example_id.slice(0, 12) }}
        </option>
      </select>
      <p>
        <code>{{ current.request.method }} {{ current.request.url }}</code>
      </p>
      <small
        >来源 {{ current.source.platform }} · {{ formatTime(current.observed_at) }} · 环境
        {{ current.environment_id }}</small
      >
      <h4>
        请求 Header
        <small>{{ current.request.headers?.complete ? '完整捕获' : '部分可见或未捕获' }}</small>
      </h4>
      <dl v-if="current.request.headers?.entries.length">
        <div v-for="([name, value], i) in current.request.headers.entries" :key="i">
          <dt>{{ name }}</dt>
          <dd>
            <code>{{ value }}</code>
          </dd>
        </div>
      </dl>
      <p v-else>未保存可用的请求 Header。</p>
      <p v-if="!current.request.headers?.complete" class="muted">
        仅说明采集时可见的 Header；不能据此认定浏览器自动 Cookie 等不存在，也不代表这些 Header
        必填。
      </p>
      <h4>
        请求体 <small>{{ states[current.request.body.state] }}</small>
      </h4>
      <p v-if="'media_type' in current.request.body">
        {{ current.request.body.media_type || '格式未记录' }}
      </p>
      <pre v-if="bodyText">{{ bodyText }}</pre>
      <p v-if="'note' in current.request.body && current.request.body.note">
        {{ current.request.body.note }}
      </p>
      <p v-if="current.request.body.state === 'partial'" class="muted">
        局部摘要不能证明其他字段不存在。multipart
        会保留文字和文件名称、类型、大小；文件字节需另行提供。
      </p>
      <details>
        <summary>响应 Header · {{ current.response_status ?? '未捕获响应' }}</summary>
        <small>{{ current.response_headers?.complete ? '完整捕获' : '部分可见或未捕获' }}</small>
        <dl>
          <div v-for="([name, value], i) in current.response_headers?.entries ?? []" :key="i">
            <dt>{{ name }}</dt>
            <dd>
              <code>{{ value }}</code>
            </dd>
          </div>
        </dl>
      </details>
      <p class="muted">
        认证为历史观测，当前是否有效、取得来源和必填要求尚未确认；调用时需提供当前业务凭据，与
        NexoFolio MCP 访问凭证无关。
      </p>
      <p v-if="copied" role="status">{{ copied }}</p>
    </template>
  </section>
</template>
<style scoped>
.request-material {
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
h3,
h4 {
  margin: 10px 0;
  font-weight: 600;
}
h4 small,
small,
.muted {
  color: var(--muted);
  font-weight: 400;
}
button,
select {
  font: inherit;
  color: inherit;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 5px 8px;
}
dl {
  margin: 6px 0;
}
dl div {
  display: grid;
  grid-template-columns: minmax(100px, 24%) 1fr;
  gap: 12px;
  padding: 5px 0;
}
dd {
  margin: 0;
}
code,
pre {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  word-break: break-word;
}
pre {
  max-height: 260px;
  overflow: auto;
  background: var(--surface-muted);
  padding: 10px;
  border-radius: 5px;
}
p {
  line-height: 1.6;
}
</style>
