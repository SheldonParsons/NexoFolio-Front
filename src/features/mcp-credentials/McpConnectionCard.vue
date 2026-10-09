<script setup lang="ts">
import { computed, ref } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import { apiBaseUrl } from '@/api'
import { mcpServiceUrl } from './connection'
import { useMcpConnection } from './useMcpConnection'

const { info, loading, error, load } = useMcpConnection()
const address = mcpServiceUrl(apiBaseUrl, window.location.href)
const copyState = ref('')
const projectCount = computed(() => {
  if (loading.value) return '读取中…'
  if (!info.value) return '暂不可用'
  return info.value.accessible_projects === null
    ? '权限待同步'
    : `${info.value.accessible_projects} 个项目`
})
async function copyAddress() {
  try {
    await navigator.clipboard.writeText(address)
    copyState.value = '已复制'
  } catch {
    copyState.value = '复制失败，请选中服务地址手动复制。'
  }
}
defineExpose({ refresh: load })
</script>

<template>
  <section class="mcp-connection-card" aria-label="MCP 连接信息" :aria-busy="loading">
    <div class="mcp-connection-address">
      <div>
        <p class="mcp-connection-label">
          服务地址 <span>{{ info?.transport ?? 'Streamable HTTP' }}</span>
        </p>
        <code>{{ address || '服务地址未配置' }}</code>
      </div>
      <AppButton :disabled="!address" aria-label="复制 MCP 服务地址" @click="copyAddress">{{
        copyState === '已复制' ? '已复制' : '复制'
      }}</AppButton>
    </div>
    <dl class="mcp-connection-details">
      <div>
        <dt>协议版本</dt>
        <dd v-if="!loading && info?.protocol_versions.length" class="mcp-protocol-versions">
          <span v-for="version in info.protocol_versions" :key="version">{{ version }}</span>
        </dd>
        <dd v-else>{{ loading ? '读取中…' : '暂不可用' }}</dd>
      </div>
      <div class="mcp-connection-projects">
        <dt>可访问项目</dt>
        <dd>{{ projectCount }}</dd>
      </div>
    </dl>
    <p v-if="copyState" class="mcp-connection-feedback" role="status">{{ copyState }}</p>
    <div v-if="error" class="mcp-connection-feedback" role="alert">
      <span>{{ error }}</span
      ><AppButton variant="ghost" :disabled="loading" @click="load">重试</AppButton>
    </div>
  </section>
</template>
