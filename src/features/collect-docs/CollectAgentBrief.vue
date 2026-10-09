<script setup lang="ts">
import { computed, ref } from 'vue'
import { apiBaseUrl } from '@/api'
import { useActiveProject } from '@/features/projects/useActiveProject'
import AppIcon from '@/components/icons/AppIcon.vue'
import { collectAgentLinks, collectAgentPrompt } from './agent'
const links = collectAgentLinks(apiBaseUrl, window.location.href, import.meta.env.BASE_URL)
const project = useActiveProject()
const prompt = computed(() => collectAgentPrompt(links, project.current.value ?? {}))
const feedback = ref('')
async function copy() {
  try {
    await navigator.clipboard.writeText(prompt.value)
    feedback.value = '已复制，粘贴给你的 Agent 即可。'
  } catch {
    feedback.value = '复制失败，请选中话术手动复制。'
  }
}
</script>
<template>
  <section id="api-agent" class="cg-start" aria-labelledby="cg-agent-title">
    <header class="cg-heading">
      <div>
        <span class="cg-eyebrow">DEVELOP WITH AN AGENT</span>
        <h2 id="cg-agent-title">把文档交给 Agent，帮你写接入程序。</h2>
      </div>
    </header>
    <p class="cg-intro">
      复制下面的话术发给能阅读文档、修改代码的
      Agent。文档、录入地址和规范包已按当前环境填写；你只需说明想接入的数据和开发语言。
    </p>
    <div class="cg-code">
      <header>
        <span>可直接发送给 Agent 的开场</span
        ><button type="button" :disabled="!links.endpoint" @click="copy">
          复制话术<AppIcon name="panels" :size="13" mode="static" />
        </button>
      </header>
      <pre tabindex="0"><code>{{ prompt }}</code></pre>
    </div>
    <p class="cg-intro" role="status">{{ feedback }}</p>
    <a :href="links.referenceUrl" class="cg-text-button"
      >打开 Agent 可直接读取的完整文本<AppIcon name="arrow-up-right" :size="13" mode="static"
    /></a>
  </section>
</template>
