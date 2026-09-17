<script setup lang="ts">
import { computed } from 'vue'
import MarkdownContent from './MarkdownContent.vue'
import KnowledgeFlow from './KnowledgeFlow.vue'
import FetcherDownloadButton from './FetcherDownloadButton.vue'
const props = defineProps<{ body: string; prefix: string }>()
const sections = computed(() =>
  props.body.split(/(?=^## )/m).filter((section) => section.trim()).map((section) => {
    const [before = '', insert, after] = section.split(/<!-- (fetcher-download|human-agent-illustration) -->/)
    return { before, insert, after }
  }),
)
const illustration = `${import.meta.env.BASE_URL}illustrations/philosophy-interweaving.png`
const humanAgentIllustration = `${import.meta.env.BASE_URL}illustrations/philosophy-human-agent.png`
</script>
<template>
  <div class="pd-philosophy">
    <figure class="pd-editorial-illustration">
      <img
        :src="illustration"
        width="1672"
        height="941"
        alt="灰蓝底色上，墨黑笔触与暖白色块交织，呈现片段之间的联系。"
        fetchpriority="high"
        decoding="async"
      />
    </figure>
    <template v-for="(section, index) in sections" :key="index">
      <MarkdownContent :body="section.before" :prefix="prefix" />
      <template v-if="section.after !== undefined">
        <FetcherDownloadButton v-if="section.insert === 'fetcher-download'" />
        <figure v-else-if="section.insert === 'human-agent-illustration'" class="pd-editorial-illustration">
          <img
            :src="humanAgentIllustration"
            width="1672"
            height="941"
            alt="灰紫色纸面上，人的手和机械手共同指向一本展开的资料，表达共享同一份知识。"
            loading="lazy"
            decoding="async"
          />
        </figure>
        <MarkdownContent :body="section.after" :prefix="prefix" />
      </template>
      <KnowledgeFlow v-if="index === 0" />
    </template>
  </div>
</template>
<style scoped>
.pd-editorial-illustration {
  margin: 34px 0 40px;
}
.pd-editorial-illustration img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 1672 / 941;
  object-fit: contain;
  border-radius: 12px;
}
:root[data-theme='dark'] .pd-editorial-illustration img {
  opacity: 0.9;
}
.pd-philosophy :deep(.pd-markdown a[href$='/docs/api']) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  position: relative;
  padding: 2px 10px 2px 5px;
  margin: 0 3px;
  vertical-align: baseline;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: linear-gradient(115deg, transparent 25%, color-mix(in srgb, var(--text) 9%, transparent) 48%, transparent 70%), color-mix(in srgb, var(--text) 3%, var(--bg));
  background-size: 260% 100%;
  background-position: 100% 0;
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.8;
  white-space: nowrap;
  text-decoration: none;
  transition: background-position 600ms cubic-bezier(.22, 1, .36, 1), border-color 180ms, box-shadow 180ms;
}
.pd-philosophy :deep(.pd-markdown a[href$='/docs/api']::before) {
  content: '{ }';
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 22px;
  border-radius: 4px;
  background: var(--text);
  color: var(--bg);
  font: 11px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
}
.pd-philosophy :deep(.pd-markdown a[href$='/docs/api']::after) {
  content: '↗';
  margin-left: 2px;
  color: var(--muted);
  transition: transform 180ms, color 180ms;
}
.pd-philosophy :deep(.pd-markdown a[href$='/docs/api']:is(:hover, :focus-visible)) {
  border-color: var(--text);
  background-position: 0 0;
  box-shadow: 0 3px 9px color-mix(in srgb, var(--text) 8%, transparent);
}
.pd-philosophy :deep(.pd-markdown a[href$='/docs/api']:is(:hover, :focus-visible)::after) {
  color: var(--text);
  transform: translate(1px, -1px);
}
.pd-philosophy :deep(.pd-markdown a[href$='/docs/api']:focus-visible) {
  outline: 2px solid var(--text);
  outline-offset: 3px;
}
@media (prefers-reduced-motion: reduce) {
  .pd-philosophy :deep(.pd-markdown a[href$='/docs/api']),
  .pd-philosophy :deep(.pd-markdown a[href$='/docs/api']::after) {
    transition: none;
  }
}
@media (max-width: 600px) {
  .pd-editorial-illustration {
    margin: 24px 0 30px;
  }
}
</style>
