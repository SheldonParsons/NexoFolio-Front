<script setup lang="ts">
import ObservedFields from './ObservedFields.vue'
import ObservedBody from './ObservedBody.vue'
import JsonDisclosure from './JsonDisclosure.vue'
import { captureLabels, limitationText } from './presentation'
import type { ObservedDefinition } from './types'
defineProps<{ definition: ObservedDefinition }>()
</script>
<template>
  <div class="definition-view">
    <p class="document-observed-note">
      以下仅反映采集到的名称与结构，不推断必填、默认值、枚举或业务含义。
    </p>
    <section class="document-definition-section">
      <header>
        <h3>请求</h3>
        <span>REQUEST</span>
      </header>
      <ObservedFields
        v-if="definition.request.parameters.some((parameter) => parameter.in === 'path')"
        :fields="definition.request.parameters.filter((parameter) => parameter.in === 'path')"
        title="Path 参数"
      />
      <ObservedFields
        :fields="definition.request.parameters.filter((parameter) => parameter.in === 'query')"
        title="Query 参数"
      />
      <ObservedFields :fields="definition.request.headers" title="请求头" />
      <ObservedBody :body="definition.request.body" />
    </section>
    <section class="document-definition-section">
      <header>
        <h3>响应</h3>
        <span>RESPONSE</span>
      </header>
      <div class="document-response-summary">
        <span
          >HTTP 状态 <strong>{{ definition.response.status ?? '未记录' }}</strong></span
        ><span class="document-chip">{{
          captureLabels[definition.response.capture_state] || definition.response.capture_state
        }}</span>
      </div>
      <ObservedFields :fields="definition.response.headers" title="响应头" />
      <ObservedBody :body="definition.response.body" />
    </section>
    <section class="document-definition-section document-limitations">
      <header>
        <h3>观测限制</h3>
        <span>{{ definition.limitations.length }}</span>
      </header>
      <ul v-if="definition.limitations.length">
        <li v-for="code in definition.limitations" :key="code">
          <span>{{ limitationText(code) }}</span
          ><code>{{ code }}</code>
        </li>
      </ul>
      <p v-else class="document-empty-inline">未提供额外限制说明。</p>
    </section>
    <JsonDisclosure :value="definition" label="查看完整定义 JSON" />
  </div>
</template>
