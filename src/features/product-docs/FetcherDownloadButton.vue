<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import { useDownloads } from '@/features/downloads/useDownloads'

const { state, refresh } = useDownloads()
const release = computed(() => state.fetcher.release)
const waiting = computed(() => !release.value && ['idle', 'loading'].includes(state.fetcher.status))
const caption = computed(() => {
  if (release.value) return `下载插件 · v${release.value.version}`
  if (state.fetcher.status === 'error') return '版本获取失败 · 点击重试'
  if (state.fetcher.status === 'unpublished') return '暂未发布 · 点击检查'
  return '正在获取最新版本…'
})
const logo = `${import.meta.env.BASE_URL}brand/nexofolio-icon.svg`
function handleClick() {
  if (!release.value && !waiting.value) void refresh()
}
</script>

<template>
  <div class="fetcher-cta">
    <component
      :is="release ? 'a' : 'button'"
      class="fetcher-cta-button"
      :href="release?.url"
      :download="release?.filename"
      :target="release ? '_blank' : undefined"
      :rel="release ? 'noopener noreferrer' : undefined"
      :type="release ? undefined : 'button'"
      :disabled="waiting"
      :aria-busy="waiting"
      :aria-label="`NexoFolio Fetcher，${caption}`"
      @click="handleClick"
    >
      <span class="fetcher-cta-light" aria-hidden="true" />
      <img class="fetcher-cta-logo" :src="logo" alt="" width="29" height="29" />
      <span class="fetcher-cta-copy">
        <strong>NexoFolio Fetcher</strong>
        <span>{{ caption }}</span>
      </span>
      <span class="fetcher-cta-arrow" aria-hidden="true">
        <AppIcon name="arrow-right" mode="static" :size="18" />
      </span>
    </component>
    <p>开发版 ZIP · 解压后通过 Chrome 开发者模式加载</p>
  </div>
</template>

<style scoped>
.fetcher-cta { margin: 24px 0 28px; }
.fetcher-cta-button {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  gap: 16px;
  min-height: 72px;
  width: 318px;
  max-width: 100%;
  padding: 15px 19px;
  overflow: hidden;
  border: 1px solid #343434;
  border-radius: 13px;
  background: #111;
  color: #fff;
  font: inherit;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  box-shadow: inset 0 1px 0 #ffffff0d, 0 4px 10px #0000000c;
  transition: border-color 220ms, box-shadow 220ms, transform 220ms;
}
.fetcher-cta-button::after {
  content: '';
  position: absolute;
  z-index: -1;
  inset: -70% auto -70% -80%;
  width: 55%;
  background: linear-gradient(90deg, transparent, #ffffff05 20%, #ffffff29 52%, #ffffff05 75%, transparent);
  transform: skewX(-25deg);
  pointer-events: none;
}
.fetcher-cta-light {
  position: absolute;
  z-index: -2;
  inset: -60%;
  opacity: 0;
  background: radial-gradient(ellipse at 35% 60%, #7c8ba64d, transparent 40%), radial-gradient(ellipse at 70% 65%, #b3a9c333, transparent 35%);
  transition: opacity 250ms;
  pointer-events: none;
}
.fetcher-cta-button:is(:hover, :focus-visible):not(:disabled) {
  transform: translateY(-1px);
  border-color: #686868;
  box-shadow: inset 0 1px 0 #ffffff17, 0 8px 22px #0000001a;
}
.fetcher-cta-button:is(:hover, :focus-visible):not(:disabled)::after {
  animation: fetcher-sheen 2.8s cubic-bezier(.22, 1, .36, 1) infinite;
}
.fetcher-cta-button:is(:hover, :focus-visible):not(:disabled) .fetcher-cta-light {
  opacity: 1;
  animation: fetcher-light 3s ease-in-out infinite alternate;
}
.fetcher-cta-button:focus-visible { outline: 2px solid var(--text); outline-offset: 4px; }
.fetcher-cta-button:active:not(:disabled) { transform: translateY(0); }
.fetcher-cta-button:disabled { cursor: wait; }
.fetcher-cta-logo { flex: none; object-fit: contain; filter: invert(1); }
.fetcher-cta-copy { display: grid; gap: 4px; min-width: 0; }
.fetcher-cta-copy strong { font-size: 15px; line-height: 1.3; font-weight: 550; letter-spacing: -.2px; }
.fetcher-cta-copy > span { font-size: 11px; line-height: 1.5; color: #b7b7bd; }
.fetcher-cta-arrow { margin-left: auto; display: flex; transform: rotate(90deg); transition: transform 220ms; }
.fetcher-cta-button:is(:hover, :focus-visible) .fetcher-cta-arrow { transform: translateY(2px) rotate(90deg); }
.fetcher-cta > p { margin: 10px 0 0; font-size: 11px; line-height: 1.7; color: var(--muted); }
@keyframes fetcher-sheen { 0% { left: -80%; } 65%, 100% { left: 150%; } }
@keyframes fetcher-light { to { transform: translate(5%, -5%) rotate(12deg); } }
@media (prefers-reduced-motion: reduce) {
  .fetcher-cta-button, .fetcher-cta-arrow, .fetcher-cta-light { transition: none; }
  .fetcher-cta-button:is(:hover, :focus-visible) { transform: none; }
  .fetcher-cta-button:is(:hover, :focus-visible) .fetcher-cta-arrow { transform: rotate(90deg); }
  .fetcher-cta-button::after, .fetcher-cta-button .fetcher-cta-light { animation: none !important; }
}
</style>
