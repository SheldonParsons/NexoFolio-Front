<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from '@/components/icons/AppIcon.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import FetcherDownloadButton from './FetcherDownloadButton.vue'
import { fetcherFaqs, fetcherSteps } from './fetcherGuide'

const active = ref(0)
const step = computed(() => fetcherSteps[active.value]!)
const guide = ref<HTMLElement>()
const tabs = ref<HTMLButtonElement[]>([])
const zoom = ref(false)
const zoomImage = ref({ src: '', alt: '', caption: '' })
const copied = ref(false)
const copyError = ref('')
const checks = ref<string[]>([])
const imageRoot = `${import.meta.env.BASE_URL}docs/fetcher/`
const screenshotSrc = (name: string) => `${imageRoot}${name}?v=2`
const checkItems = ['项目与环境正确', '侧边栏出现了新请求', '上传已确认，项目内能查到记录']
let copyTimer: ReturnType<typeof setTimeout> | undefined
function selectStep(index: number, scroll = true) {
  active.value = Math.max(0, Math.min(3, index))
  if (scroll)
    void nextTick(() =>
      guide.value?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
        block: 'start',
      }),
    )
}
async function startAt(index: number) {
  selectStep(index, false)
  await nextTick()
  guide.value?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    block: 'start',
  })
  tabs.value[index]?.focus({ preventScroll: true })
}
function tabKey(event: KeyboardEvent, index: number) {
  const next =
    event.key === 'ArrowRight'
      ? (index + 1) % 4
      : event.key === 'ArrowLeft'
        ? (index + 3) % 4
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? 3
            : -1
  if (next < 0) return
  event.preventDefault()
  selectStep(next)
  tabs.value[next]?.focus()
}
async function copyExtensions() {
  clearTimeout(copyTimer)
  copyError.value = ''
  copied.value = false
  try {
    await navigator.clipboard.writeText('chrome://extensions')
    copied.value = true
    copyTimer = setTimeout(() => {
      copied.value = false
    }, 2200)
  } catch {
    copyError.value = '复制未成功，请选中左侧地址手动复制。'
  }
}
function showImage(image: string, alt: string, caption: string) {
  zoomImage.value = { src: screenshotSrc(image), alt, caption }
  zoom.value = true
}
onBeforeUnmount(() => clearTimeout(copyTimer))
</script>

<template>
  <div class="fetcher-guide">
    <section class="fg-hero" aria-labelledby="fetcher-intro-title">
      <div class="fg-hero-copy">
        <div class="fg-badges"><span>CHROME 125+</span><span>开发版 ZIP</span></div>
        <h2 id="fetcher-intro-title">照常浏览，<br />开始积累。</h2>
        <p>安装、连接、绑定。<br />把业务页面里的真实调用，带回你的接口知识库。</p>
        <FetcherDownloadButton />
        <button class="fg-hero-link" type="button" @click="startAt(0)">
          跟着教程开始<AppIcon name="chevron-down" :size="15" mode="static" />
        </button>
      </div>
      <button
        class="fg-hero-shot"
        type="button"
        aria-label="放大查看 Fetcher 采集界面示例"
        @click="showImage('capture.png', fetcherSteps[3].imageAlt, fetcherSteps[3].imageCaption)"
      >
        <div class="fg-shot-label">
          <span class="fg-live-dot" />FETCHER · 界面示例<AppIcon
            name="scan-search"
            :size="13"
            mode="static"
          />
        </div>
        <img
          :src="screenshotSrc('capture.png')"
          :alt="fetcherSteps[3].imageAlt"
          width="420"
          height="485"
          fetchpriority="high"
        />
      </button>
    </section>

    <div class="fg-prerequisites">
      <span><AppIcon name="check" :size="14" mode="static" />准备团队账号</span
      ><span><AppIcon name="check" :size="14" mode="static" />确认后端服务地址</span
      ><span><AppIcon name="check" :size="14" mode="static" />具备项目访问权限</span>
    </div>

    <section ref="guide" class="fg-tutorial" aria-labelledby="fetcher-guide-title">
      <header class="fg-section-heading">
        <div>
          <span class="fg-eyebrow">QUICK START</span>
          <h2 id="fetcher-guide-title">四步，完成第一次采集。</h2>
        </div>
        <button class="fg-text-button" type="button" @click="startAt(1)">
          已安装？从连接开始<AppIcon name="arrow-right" :size="14" mode="static" />
        </button>
      </header>
      <div class="fg-tabs" role="tablist" aria-label="Fetcher 使用步骤">
        <button
          v-for="(item, index) in fetcherSteps"
          :id="`fetcher-tab-${index}`"
          :key="item.id"
          :ref="
            (el) => {
              if (el) tabs[index] = el as HTMLButtonElement
            }
          "
          type="button"
          role="tab"
          :aria-selected="active === index"
          aria-controls="fetcher-step-panel"
          :tabindex="active === index ? 0 : -1"
          :class="{ 'is-active': active === index }"
          @click="selectStep(index)"
          @keydown="tabKey($event, index)"
        >
          <span class="fg-step-number">0{{ index + 1 }}</span
          ><span
            ><strong>{{ item.label }}</strong
            ><small>{{ item.note }}</small></span
          >
        </button>
      </div>
      <div
        id="fetcher-step-panel"
        class="fg-step-panel"
        role="tabpanel"
        :aria-labelledby="`fetcher-tab-${active}`"
        tabindex="0"
      >
        <div :key="step.id" class="fg-step-layout">
          <div class="fg-instructions">
            <p class="fg-step-kicker">STEP 0{{ active + 1 }} / 04</p>
            <h3>{{ step.title }}</h3>
            <p class="fg-step-intro">{{ step.intro }}</p>
            <ol class="fg-actions">
              <li v-for="(action, index) in step.actions" :key="action.title">
                <span aria-hidden="true">{{ index + 1 }}</span>
                <div>
                  <strong>{{ action.title }}</strong>
                  <p>{{ action.text }}</p>
                  <template v-if="active === 0 && index === 1"
                    ><div class="fg-copy-field">
                      <code>chrome://extensions</code
                      ><button
                        type="button"
                        :aria-label="copied ? '已复制扩展管理页地址' : '复制扩展管理页地址'"
                        @click="copyExtensions"
                      >
                        <AppIcon :name="copied ? 'check' : 'panels'" :size="15" mode="static" />{{
                          copied ? '已复制' : '复制'
                        }}
                      </button>
                    </div>
                    <span class="fg-copy-feedback" role="status">{{
                      copyError || (copied ? '已复制，粘贴到 Chrome 地址栏打开。' : '')
                    }}</span></template
                  >
                </div>
              </li>
            </ol>
            <div class="fg-success">
              <AppIcon name="check" :size="16" mode="static" />
              <div>
                <strong>这一步完成后</strong>
                <p>{{ step.success }}</p>
              </div>
            </div>
          </div>
          <figure class="fg-step-figure">
            <button
              class="fg-image-button"
              type="button"
              :aria-label="`放大查看${step.label}界面示例`"
              @click="showImage(step.image, step.imageAlt, step.imageCaption)"
            >
              <img
                :src="screenshotSrc(step.image)"
                :alt="step.imageAlt"
                width="420"
                :height="[520, 460, 300, 485][active]"
                decoding="async"
              /><span><AppIcon name="scan-search" :size="14" mode="static" />查看大图</span>
            </button>
            <figcaption>{{ step.imageCaption }}<small>扩展界面示例 · 演示数据</small></figcaption>
          </figure>
        </div>
        <div class="fg-step-footer">
          <button
            type="button"
            class="fg-text-button"
            :disabled="active === 0"
            @click="selectStep(active - 1)"
          >
            <AppIcon name="arrow-left" :size="15" mode="static" />上一步</button
          ><span>0{{ active + 1 }} / 04</span
          ><button v-if="active < 3" type="button" class="fg-next" @click="selectStep(active + 1)">
            下一步 · {{ fetcherSteps[active + 1]?.label
            }}<AppIcon name="arrow-right" :size="15" mode="static" /></button
          ><a v-else class="fg-next" href="#fetcher-check"
            >核对第一条记录<AppIcon name="chevron-down" :size="15" mode="static"
          /></a>
        </div>
      </div>
    </section>

    <section id="fetcher-check" class="fg-check-section" aria-labelledby="fetcher-check-title">
      <div>
        <span class="fg-eyebrow">FIRST CAPTURE</span>
        <h2 id="fetcher-check-title">看到请求，只是第一步。</h2>
        <p>按这三项手动核对，确认资料真的进入了正确的位置。</p>
        <RouterLink to="/projects" class="fg-text-button"
          >前往项目空间<AppIcon name="arrow-up-right" :size="15" mode="static"
        /></RouterLink>
      </div>
      <div class="fg-checklist">
        <div class="fg-checklist-heading">
          <strong>第一次采集检查</strong><span aria-live="polite">{{ checks.length }} / 3</span>
        </div>
        <label v-for="item in checkItems" :key="item"
          ><input v-model="checks" type="checkbox" :value="item" /><span>{{ item }}</span></label
        >
        <p v-if="checks.length === 3" role="status" class="fg-check-complete">
          核对完成，接下来可以继续浏览和积累。
        </p>
      </div>
    </section>

    <section class="fg-faq" aria-labelledby="fetcher-faq-title">
      <header class="fg-section-heading">
        <div>
          <span class="fg-eyebrow">TROUBLESHOOTING</span>
          <h2 id="fetcher-faq-title">卡住了？从这里排查。</h2>
        </div>
      </header>
      <details v-for="faq in fetcherFaqs" :key="faq.question">
        <summary>
          {{ faq.question }}<AppIcon name="chevron-down" :size="17" mode="static" />
        </summary>
        <p>{{ faq.answer }}</p>
      </details>
    </section>
    <aside class="fg-api-note">
      <AppIcon name="code" :size="21" mode="static" />
      <div>
        <strong>已有自己的采集工具？</strong>
        <p>也可以通过开放 API，将调用记录录入同一个项目。</p>
      </div>
      <RouterLink to="/docs/api"
        >查看录入接口<AppIcon name="arrow-up-right" :size="15" mode="static"
      /></RouterLink>
    </aside>
    <AppDialog v-model:open="zoom" title="Fetcher 界面示例" :description="zoomImage.caption"
      ><img class="fg-zoom-image" :src="zoomImage.src" :alt="zoomImage.alt" />
      <p class="fg-zoom-note">使用现有扩展界面组件渲染；项目、地址与请求均为示例。</p></AppDialog
    >
  </div>
</template>

<style scoped>
.fetcher-guide {
  --fg-accent: #d96a34;
  margin-top: 30px;
}
.fetcher-guide button,
.fetcher-guide a {
  -webkit-tap-highlight-color: transparent;
}
.fetcher-guide button:focus-visible,
.fetcher-guide a:focus-visible,
.fg-step-panel:focus-visible,
.fg-faq summary:focus-visible {
  outline: 2px solid var(--fg-accent);
  outline-offset: 4px;
}
.fg-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(210px, 0.78fr);
  gap: 26px;
  padding: 32px 30px 0;
  overflow: hidden;
  border: 1px solid #292c31;
  border-radius: 15px;
  background: radial-gradient(ellipse at 90% 10%, #252a32, #111316 65%);
  color: #f5f5f5;
}
.fg-hero-copy {
  padding-bottom: 28px;
}
.fg-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.fg-badges span {
  border: 1px solid #42464c;
  border-radius: 4px;
  padding: 5px 7px;
  font-size: 9px;
  letter-spacing: 0.09em;
  color: #c7cbd2;
}
.fg-hero h2 {
  margin: 21px 0 15px;
  font-size: clamp(27px, 3vw, 37px);
  line-height: 1.4;
  font-weight: 600;
  letter-spacing: -0.9px;
}
.fg-hero-copy > p {
  margin: 0;
  color: #c0c4cc;
  font-size: 13px;
  line-height: 1.9;
  max-width: 330px;
}
.fg-hero :deep(.fetcher-cta) {
  margin: 23px 0 18px;
}
.fg-hero :deep(.fetcher-cta-button) {
  width: 100%;
  min-height: 62px;
  border-color: #f4f4f4;
  border-radius: 9px;
  background: #f5f5f5;
  color: #15171b;
  padding: 12px 15px;
  gap: 12px;
  box-shadow: none;
}
.fg-hero :deep(.fetcher-cta-copy > span) {
  color: #666b74;
}
.fg-hero :deep(.fetcher-cta-logo) {
  filter: none;
  width: 26px;
}
.fg-hero :deep(.fetcher-cta > p) {
  color: #a7adb8;
  font-size: 10px;
}
.fg-hero-link {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 0;
  border: 0;
  color: #f0f1f3;
  background: none;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.fg-hero-link:hover {
  color: #e9a17c;
}
.fg-hero-shot {
  min-width: 0;
  padding: 0;
  margin-top: 12px;
  align-self: end;
  text-align: left;
  background: #fff;
  border: 1px solid #d4d6db;
  border-bottom: 0;
  border-radius: 10px 10px 0 0;
  overflow: hidden;
  box-shadow: 0 12px 35px #0005;
  cursor: zoom-in;
  transition: transform 250ms;
}
.fg-hero-shot:hover {
  transform: translateY(-4px);
}
.fg-shot-label {
  height: 36px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 13px;
  background: #f6f7f8;
  border-bottom: 1px solid #e6e7ea;
  color: #666b73;
  font-size: 9px;
  letter-spacing: 0.04em;
}
.fg-shot-label .app-icon {
  margin-left: auto;
}
.fg-live-dot {
  width: 5px;
  height: 5px;
  background: #71927b;
  border-radius: 50%;
}
.fg-hero-shot img {
  display: block;
  width: 100%;
  height: auto;
}
.fg-prerequisites {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 22px;
  margin: 16px 0 44px;
  color: var(--muted);
  font-size: 11px;
}
.fg-prerequisites span {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.fg-prerequisites .app-icon {
  color: #7a8980;
}
.fg-section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
}
.fg-eyebrow {
  display: block;
  color: var(--muted);
  font-size: 9px;
  letter-spacing: 0.15em;
}
.fetcher-guide h2 {
  font-weight: 600;
}
.fg-section-heading h2,
.fg-check-section h2 {
  margin: 10px 0 0;
  font-size: 23px;
  line-height: 1.45;
  letter-spacing: -0.5px;
}
.fg-text-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 0;
  border: 0;
  background: none;
  color: var(--muted);
  font: inherit;
  font-size: 11px;
  text-decoration: none;
  cursor: pointer;
}
.fg-text-button:hover:not(:disabled) {
  color: var(--text);
}
.fg-text-button:disabled {
  opacity: 0.35;
  cursor: default;
}
.fg-tutorial,
#fetcher-check {
  scroll-margin-top: 25px;
}
.fg-tabs {
  position: sticky;
  top: 0;
  z-index: 2;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border: 1px solid var(--border);
  border-radius: 10px 10px 0 0;
  background: var(--bg);
  overflow: hidden;
}
.fg-tabs button {
  position: relative;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 17px 12px;
  border: 0;
  background: none;
  color: var(--muted);
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition:
    background 160ms,
    color 160ms;
}
.fg-tabs button + button {
  border-left: 1px solid var(--border);
}
.fg-tabs button:hover {
  background: color-mix(in srgb, var(--text) 3%, var(--bg));
}
.fg-tabs button.is-active {
  background: color-mix(in srgb, var(--text) 5%, var(--bg));
  color: var(--text);
}
.fg-tabs button.is-active::after {
  content: '';
  position: absolute;
  height: 2px;
  left: 13px;
  right: 13px;
  bottom: 0;
  background: var(--fg-accent);
}
.fg-tabs button:focus-visible {
  outline-offset: -4px;
}
.fg-step-number {
  font:
    11px ui-monospace,
    SFMono-Regular,
    monospace;
  opacity: 0.7;
}
.fg-tabs strong {
  display: block;
  font-size: 13px;
  font-weight: 550;
}
.fg-tabs small {
  display: block;
  margin-top: 5px;
  font-size: 9px;
  color: var(--muted);
}
.fg-step-panel {
  border: 1px solid var(--border);
  border-top: 0;
  border-radius: 0 0 10px 10px;
  background: var(--bg);
}
.fg-step-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(205px, 0.85fr);
  align-items: start;
  gap: 27px;
  min-height: 563px;
  padding: 28px 24px 25px;
  animation: fg-enter 240ms ease-out;
}
.fg-step-kicker {
  color: var(--fg-accent);
  font:
    9px ui-monospace,
    SFMono-Regular,
    monospace;
  letter-spacing: 0.1em;
  margin: 0 0 10px;
}
.fg-instructions h3 {
  font-size: 20px;
  line-height: 1.5;
  font-weight: 550;
  margin: 0 0 10px;
  letter-spacing: -0.35px;
}
.fg-step-intro {
  margin: 0 0 23px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.85;
}
.fg-actions {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 20px;
}
.fg-actions li {
  display: flex;
  gap: 10px;
  align-items: start;
}
.fg-actions li > span {
  display: grid;
  place-items: center;
  flex: none;
  width: 19px;
  height: 19px;
  margin-top: 1px;
  border: 1px solid var(--border);
  border-radius: 50%;
  color: var(--muted);
  font-size: 10px;
}
.fg-actions li > div {
  min-width: 0;
}
.fg-actions strong {
  font-size: 13px;
  font-weight: 550;
}
.fg-actions p {
  margin: 5px 0 0;
  font-size: 13px;
  color: var(--muted);
  line-height: 1.85;
}
.fg-copy-field {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 10px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: color-mix(in srgb, var(--text) 3%, var(--bg));
}
.fg-copy-field code {
  flex: 1;
  min-width: 0;
  font:
    10px ui-monospace,
    SFMono-Regular,
    monospace;
  color: var(--text);
  user-select: all;
  overflow-wrap: anywhere;
}
.fg-copy-field button {
  display: flex;
  flex: none;
  align-items: center;
  gap: 4px;
  background: none;
  border: 0;
  padding: 3px 1px;
  color: var(--muted);
  font-size: 10px;
  cursor: pointer;
}
.fg-copy-feedback {
  display: block;
  margin-top: 6px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.6;
}
.fg-success {
  display: flex;
  gap: 8px;
  margin-top: 23px;
  padding: 12px;
  background: color-mix(in srgb, #75987d 8%, var(--bg));
  border-radius: 7px;
  color: var(--text);
}
.fg-success > .app-icon {
  color: #75987d;
  flex: none;
  margin-top: 1px;
}
.fg-success strong {
  font-size: 12px;
  font-weight: 550;
}
.fg-success p {
  margin: 5px 0 0;
  font-size: 12px;
  line-height: 1.8;
  color: var(--muted);
}
.fg-step-figure {
  margin: 0;
  padding: 14px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--text) 3%, var(--bg));
}
.fg-image-button {
  position: relative;
  padding: 0;
  display: block;
  width: 100%;
  border: 1px solid #e2e4e7;
  border-radius: 7px;
  overflow: hidden;
  background: #fff;
  cursor: zoom-in;
  box-shadow: 0 4px 13px #00000009;
}
.fg-image-button img {
  display: block;
  width: 100%;
  height: auto;
}
.fg-image-button > span {
  display: flex;
  justify-content: center;
  gap: 6px;
  align-items: center;
  padding: 9px;
  border-top: 1px solid #e7e7e7;
  background: #fafafa;
  color: #656b73;
  font-size: 10px;
  transition:
    color 160ms,
    background 160ms;
}
.fg-image-button:hover > span {
  color: #17191c;
  background: #f1f2f4;
}
.fg-step-figure figcaption {
  margin-top: 12px;
  font-size: 11px;
  color: var(--muted);
  line-height: 1.8;
}
.fg-step-figure figcaption small {
  display: block;
  font-size: 9px;
  opacity: 0.8;
  margin-top: 7px;
}
.fg-step-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 24px;
  border-top: 1px solid var(--border);
}
.fg-step-footer > span {
  font:
    9px ui-monospace,
    SFMono-Regular,
    monospace;
  color: var(--muted);
}
.fg-next {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 9px 11px;
  background: var(--text);
  color: var(--bg);
  text-decoration: none;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.fg-next:hover {
  opacity: 0.85;
}
.fg-check-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  padding: 39px 0;
  margin: 18px 0 3px;
  border-bottom: 1px solid var(--border);
}
.fg-check-section > div > p {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.9;
  margin: 12px 0 15px;
}
.fg-checklist {
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 18px;
  align-self: start;
}
.fg-checklist-heading {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  align-items: center;
}
.fg-checklist-heading strong {
  font-size: 12px;
  font-weight: 550;
}
.fg-checklist-heading > span {
  font:
    10px ui-monospace,
    SFMono-Regular,
    monospace;
  color: var(--muted);
}
.fg-checklist label {
  display: flex;
  gap: 9px;
  align-items: start;
  padding: 8px 0;
  font-size: 12px;
  line-height: 1.7;
  cursor: pointer;
}
.fg-checklist input {
  accent-color: var(--text);
  width: 14px;
  height: 14px;
  flex: none;
  margin: 2px 0 0;
}
.fg-checklist input:checked + span {
  color: var(--muted);
}
.fg-check-complete {
  margin: 10px 0 0;
  color: #6c9175;
  font-size: 11px;
  line-height: 1.7;
}
.fg-faq {
  margin: 38px 0 32px;
}
.fg-faq details {
  border-bottom: 1px solid var(--border);
}
.fg-faq summary {
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 1px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.fg-faq summary::-webkit-details-marker {
  display: none;
}
.fg-faq summary .app-icon {
  transition: transform 180ms;
  color: var(--muted);
}
.fg-faq details[open] summary .app-icon {
  transform: rotate(180deg);
}
.fg-faq details > p {
  margin: 0 30px 20px 0;
  font-size: 13px;
  color: var(--muted);
  line-height: 1.95;
}
.fg-api-note {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 19px 20px;
  background: color-mix(in srgb, var(--text) 3%, var(--bg));
  border: 1px solid var(--border);
  border-radius: 8px;
}
.fg-api-note > .app-icon {
  color: var(--muted);
}
.fg-api-note strong {
  font-size: 12px;
  font-weight: 550;
}
.fg-api-note p {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.7;
}
.fg-api-note a {
  display: inline-flex;
  flex: none;
  gap: 5px;
  align-items: center;
  margin-left: auto;
  color: var(--text);
  font-size: 11px;
  text-decoration: none;
}
.fg-zoom-image {
  display: block;
  margin: 16px auto 0;
  max-width: 100%;
  width: auto;
  max-height: min(58dvh, calc(75dvh - 160px));
  object-fit: contain;
  border: 1px solid #e3e3e3;
  border-radius: 8px;
}
.fg-zoom-note {
  margin: 12px 0 0;
  text-align: center;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.7;
}
@keyframes fg-enter {
  from {
    opacity: 0.3;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (max-width: 720px) {
  .fg-hero {
    gap: 18px;
    padding: 26px 22px 0;
    grid-template-columns: minmax(0, 1fr) minmax(180px, 0.7fr);
  }
  .fg-tabs button {
    padding: 14px 9px;
    gap: 6px;
  }
  .fg-step-layout {
    padding: 24px 18px;
    gap: 18px;
  }
  .fg-tabs small {
    display: none;
  }
}
@media (max-width: 580px) {
  .fetcher-guide {
    margin-top: 24px;
  }
  .fg-hero {
    grid-template-columns: 1fr;
    padding: 25px 22px 0;
    gap: 0;
  }
  .fg-hero-copy {
    padding-bottom: 23px;
  }
  .fg-hero h2 {
    font-size: 30px;
  }
  .fg-hero-shot {
    width: min(100%, 285px);
    justify-self: center;
    max-height: 225px;
  }
  .fg-prerequisites {
    margin-bottom: 32px;
    gap: 9px 15px;
    font-size: 10px;
  }
  .fg-section-heading {
    align-items: start;
    flex-direction: column;
    gap: 12px;
  }
  .fg-section-heading h2,
  .fg-check-section h2 {
    font-size: 21px;
  }
  .fg-tabs button {
    flex-direction: column;
    align-items: start;
    gap: 7px;
    padding: 13px 8px;
  }
  .fg-tabs strong {
    font-size: 11px;
    white-space: nowrap;
  }
  .fg-step-layout {
    grid-template-columns: 1fr;
    gap: 23px;
    min-height: 0;
  }
  .fg-step-figure {
    width: min(100%, 285px);
    justify-self: center;
  }
  .fg-step-intro,
  .fg-actions p,
  .fg-success p {
    font-size: 12px;
  }
  .fg-step-footer {
    padding: 13px 15px;
  }
  .fg-check-section {
    grid-template-columns: 1fr;
    gap: 20px;
    padding: 31px 0;
  }
  .fg-api-note {
    flex-wrap: wrap;
    padding: 17px;
  }
  .fg-api-note > div {
    flex: 1;
    min-width: 180px;
  }
  .fg-api-note a {
    margin-left: 35px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .fetcher-guide *,
  .fetcher-guide *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto;
  }
}
</style>
