<script setup lang="ts">
import { RouterLink } from 'vue-router'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import KnowledgePreview from '@/features/home/KnowledgePreview.vue'
import NexoLogoHero from '@/components/brand/NexoLogoHero.vue'
import EnterNexoButton from '@/features/auth/EnterNexoButton.vue'
</script>

<template>
  <div id="top" class="homepage" data-scroll-container>
    <header class="home-header">
      <RouterLink to="/" aria-label="NexoFolio 首页"><BrandLogo tone="light" /></RouterLink>
      <nav aria-label="首页导航">
        <RouterLink :to="{ hash: '#overview' }">产品概览</RouterLink
        ><RouterLink :to="{ hash: '#workflow' }">工作方式</RouterLink
        ><RouterLink :to="{ hash: '#for-agents' }">面向 Agent</RouterLink>
      </nav>
      <EnterNexoButton class="header-cta" :icon-size="14" />
    </header>
    <main id="main-content" tabindex="-1">
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-copy">
          <div class="hero-kicker">
            <span></span>为团队与 Agent 而设计<span class="kicker-separator">/</span>产品预览
          </div>
          <h1 id="hero-title">每个接口，<br /><span>都值得被理解。</span></h1>
          <p>从真实调用到业务上下文。<br />把分散的接口，变成一份持续生长的知识。</p>
          <div class="hero-actions">
            <EnterNexoButton class="home-button home-button--primary" />
            <RouterLink to="/docs" class="home-button home-button--quiet"
              >探索 NexoFolio<span aria-hidden="true">↘</span></RouterLink
            >
          </div>
          <div class="hero-note">少一点反复寻找，多一点真正理解。</div>
        </div>
        <NexoLogoHero class="hero-visual" />
      </section>
      <section
        id="overview"
        class="home-container overview-section"
        aria-label="接口知识的组织方式"
      >
        <KnowledgePreview />
        <div class="overview-caption">
          <span>CAPTURE. CONNECT. UNDERSTAND.</span><span>让知识随着每一次调用，逐渐清晰。</span>
        </div>
      </section>
      <section id="for-agents" class="home-container agents-section">
        <div class="section-index">01 / BUILT FOR YOUR AGENT</div>
        <h2>你熟悉的 Agent，<br class="mobile-break" />更完整的上下文。</h2>
        <p>
          通过 HTTP MCP 提供分层的知识入口。<br />从目录找到方向，再按需读取接口定义与调用证据。
        </p>
        <div class="agent-names" aria-label="面向支持 MCP 的 Agent">
          <span>Codex</span><i></i><span>Claude Code</span><i></i><span>Cursor</span><i></i
          ><span class="agent-more"
            >以及更多 MCP 客户端<AppIcon name="arrow-right" :size="14"
          /></span>
        </div>
      </section>
      <section id="workflow" class="home-container workflow-section">
        <div class="workflow-heading">
          <div>
            <div class="section-index">02 / FROM TRAFFIC TO KNOWLEDGE</div>
            <h2>让一次调用，<br />留下长久的价值。</h2>
          </div>
          <p>接口的价值不只在请求成功的那一刻，<br />也在下一次需要理解它的时候。</p>
        </div>
        <div class="workflow-grid">
          <article>
            <div class="workflow-number">01<AppIcon name="code" :size="22" /></div>
            <h3>从真实调用开始</h3>
            <p>在授权范围内收集请求和响应，为接口知识保留第一手线索。</p>
            <span>CAPTURE THE EVIDENCE</span>
          </article>
          <article>
            <div class="workflow-number">02<AppIcon name="folder" :size="22" /></div>
            <h3>让知识各就其位</h3>
            <p>按业务组织目录，将接口定义、使用场景和变更记录连接起来。</p>
            <span>GIVE IT CONTEXT</span>
          </article>
          <article>
            <div class="workflow-number">03<AppIcon name="layers" :size="22" /></div>
            <h3>在需要时被理解</h3>
            <p>让团队和 Agent 找到同一份知识，让每次回答都能回到依据。</p>
            <span>MAKE IT DISCOVERABLE</span>
          </article>
        </div>
      </section>
      <section class="home-container home-closing">
        <BrandLogo variant="stacked" tone="light" />
        <div>
          <div class="section-index">KNOWLEDGE, CONNECTED.</div>
          <h2>下一次调用，<br />从理解开始。</h2>
          <EnterNexoButton class="home-button home-button--primary" />
          <p>使用已有禅道账号，连接你的知识工作空间。</p>
        </div>
      </section>
    </main>
    <footer class="home-footer home-container">
      <span>© {{ new Date().getFullYear() }} NexoFolio</span><span>为人，也为 Agent。</span
      ><RouterLink :to="{ hash: '#top' }">回到顶部<span aria-hidden="true">↑</span></RouterLink>
    </footer>
  </div>
</template>

<style scoped>
.homepage {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: none;
  --text: #f5f5f3;
  --focus: #e6d3b0;
  background: #000;
  color: #f5f5f3;
  min-height: 100dvh;
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    'PingFang SC',
    'Microsoft YaHei',
    sans-serif;
}
.home-container {
  max-width: 1120px;
  margin-inline: auto;
  width: calc(100% - 80px);
}
.home-header {
  max-width: 1280px;
  width: calc(100% - 80px);
  margin: auto;
  height: 94px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 30px;
  border-bottom: 1px solid #1a1a1a;
}
.home-header > a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
}
.home-header nav {
  display: flex;
  align-items: center;
  gap: 32px;
  font-size: 12px;
  color: #a5a5a5;
}
.home-header nav a {
  padding-block: 14px;
  transition: color 150ms;
}
.home-header nav a:hover {
  color: #fff;
}
.header-cta {
  background: transparent;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #e4e4e4;
  font-size: 11px;
  border: 1px solid #333;
  border-radius: 7px;
  padding: 8px 14px;
  transition: background 150ms;
}
.header-cta:hover {
  background: #171717;
}
.hero {
  padding: 91px 24px 70px;
  text-align: center;
}
.hero-kicker {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  font-size: 10px;
  letter-spacing: 1px;
  color: #aaa;
}
.hero-kicker > span:first-child {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #d6c4a7;
}
.hero-kicker .kicker-separator {
  color: #484848;
  margin-inline: 4px;
}
.hero h1 {
  font-size: clamp(44px, 5.6vw, 78px);
  line-height: 1.25;
  letter-spacing: -3px;
  font-weight: 550;
  margin-top: 25px;
}
.hero h1 > span {
  color: #bfbfb9;
}
.hero-copy > p {
  font-size: 14px;
  line-height: 1.95;
  color: #a0a0a0;
  margin-top: 24px;
  letter-spacing: 0.35px;
}
.hero-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 28px;
}
.home-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  min-height: 44px;
  padding: 12px 21px;
  border: 1px solid transparent;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 500;
  transition:
    background 150ms,
    color 150ms,
    border-color 150ms;
}
.home-button--primary {
  background: #f2f1ed;
  color: #111;
  border-color: #f2f1ed;
}
.home-button--primary:hover {
  background: #dcdad3;
  border-color: #dcdad3;
}
.home-button--quiet {
  color: #bdbdbd;
  background: transparent;
}
.home-button--quiet:hover {
  color: #fff;
  background: #111;
}
.home-button--quiet > span {
  color: #a5a5a5;
  font-size: 18px;
}
.hero-note {
  color: #888;
  font-size: 10px;
  margin-top: 20px;
}
.overview-section {
  max-width: 1030px;
}
.overview-caption {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin-top: 21px;
  color: #828282;
  font-size: 9px;
}
.overview-caption span:first-child {
  font-family: 'SFMono-Regular', Consolas, monospace;
  letter-spacing: 1px;
}
.agents-section {
  padding-block: 104px 86px;
  text-align: center;
  border-bottom: 1px solid #242424;
}
.section-index {
  font-family: 'SFMono-Regular', Consolas, monospace;
  letter-spacing: 1.4px;
  font-size: 9px;
  color: #999;
  margin-bottom: 21px;
}
.homepage h2 {
  font-size: clamp(26px, 3vw, 36px);
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: -1px;
}
.agents-section p {
  font-size: 12px;
  color: #999;
  line-height: 1.95;
  margin-top: 18px;
}
.agent-names {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 29px;
  margin-top: 41px;
  color: #dededb;
}
.agent-names > span:not(.agent-more) {
  font-size: 20px;
  font-weight: 500;
  letter-spacing: -0.6px;
}
.agent-names i {
  width: 1px;
  height: 15px;
  background: #353535;
}
.agent-names .agent-more {
  font-size: 10px;
  display: flex;
  align-items: center;
  gap: 9px;
  color: #999;
}
.mobile-break {
  display: none;
}
.workflow-section {
  padding-block: 83px 82px;
}
.workflow-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 30px;
}
.workflow-heading > p {
  font-size: 12px;
  line-height: 1.9;
  color: #999;
  padding-bottom: 4px;
}
.workflow-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 45px;
}
.workflow-grid article {
  padding: 0 34px;
  border-left: 1px solid #292929;
}
.workflow-grid article:first-child {
  padding-left: 0;
  border-left: 0;
}
.workflow-grid article:last-child {
  padding-right: 0;
}
.workflow-number {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: monospace;
  font-size: 11px;
  color: #999;
}
.workflow-number > svg {
  color: #c5c3ba;
}
.workflow-grid h3 {
  font-size: 17px;
  font-weight: 450;
  margin-top: 26px;
  letter-spacing: -0.4px;
}
.workflow-grid p {
  font-size: 12px;
  color: #999;
  line-height: 1.95;
  margin-top: 12px;
  max-width: 270px;
}
.workflow-grid article > span {
  display: block;
  color: #818181;
  font-family: monospace;
  font-size: 8px;
  letter-spacing: 1px;
  margin-top: 25px;
}
.home-closing {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 116px;
  border-block: 1px solid #242424;
  padding: 75px 30px;
}
.home-closing > :deep(.brand-logo--stacked) {
  width: 160px;
  opacity: 0.82;
}
.home-closing .section-index {
  margin-bottom: 13px;
}
.home-closing h2 {
  font-size: 35px;
}
.home-closing .home-button {
  margin-top: 24px;
}
.home-closing p {
  color: #888;
  font-size: 10px;
  margin-top: 15px;
}
.home-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 94px;
  color: #929292;
  font-size: 10px;
}
.home-footer > span:nth-child(2) {
  color: #888;
}
.home-footer a {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 44px;
}
.home-footer a:hover {
  color: white;
}
@media (min-width: 1600px) {
  .hero {
    padding-top: 112px;
  }
  .hero h1 {
    font-size: 84px;
  }
}
@media (max-width: 900px) {
  .home-container,
  .home-header {
    width: calc(100% - 48px);
  }
  .home-header nav {
    gap: 20px;
  }
  .hero {
    padding: 77px 24px 53px;
  }
  .hero h1 {
    font-size: 64px;
  }
  .hero-copy > p {
    font-size: 13px;
  }
  .workflow-grid article {
    padding-inline: 22px;
  }
  .home-closing {
    gap: 65px;
  }
  .agents-section {
    padding-top: 80px;
  }
}
@media (max-width: 650px) {
  .home-header {
    height: 79px;
    gap: 18px;
  }
  .home-header nav {
    display: none;
  }
  .home-header :deep(.brand-logo-icon) {
    width: 24px;
  }
  .home-header :deep(.brand-logo-text) {
    width: 106px;
  }
  .home-header :deep(.brand-logo) {
    gap: 8px;
  }
  .header-cta {
    font-size: 10px;
    gap: 7px;
    padding: 8px 10px;
  }
  .hero {
    padding-top: 66px;
  }
  .hero h1 {
    font-size: clamp(36px, 10.4vw, 50px);
    letter-spacing: -2px;
  }
  .hero-kicker {
    font-size: 9px;
    letter-spacing: 0.5px;
  }
  .hero-copy > p {
    font-size: 12px;
  }
  .hero-actions {
    gap: 5px;
  }
  .home-button {
    padding: 12px 15px;
    gap: 12px;
    font-size: 11px;
  }
  .overview-caption {
    justify-content: center;
  }
  .overview-caption > span:last-child {
    display: none;
  }
  .agents-section {
    padding: 70px 0 60px;
  }
  .mobile-break {
    display: block;
  }
  .agent-names {
    flex-wrap: wrap;
    gap: 18px;
  }
  .agent-names > span:not(.agent-more) {
    font-size: 17px;
  }
  .agent-names i:nth-of-type(3) {
    display: none;
  }
  .agent-names .agent-more {
    flex-basis: 100%;
    justify-content: center;
  }
  .workflow-section {
    padding-block: 60px;
  }
  .workflow-heading {
    display: block;
  }
  .workflow-heading > p {
    margin-top: 18px;
  }
  .workflow-grid {
    grid-template-columns: 1fr;
    margin-top: 34px;
    gap: 28px;
  }
  .workflow-grid article,
  .workflow-grid article:first-child,
  .workflow-grid article:last-child {
    border-left: 0;
    border-top: 1px solid #292929;
    padding: 24px 0 0;
  }
  .workflow-grid p {
    max-width: none;
  }
  .workflow-grid h3 {
    margin-top: 16px;
  }
  .workflow-grid article > span {
    margin-top: 15px;
  }
  .home-closing {
    gap: 27px;
    padding: 48px 0;
    align-items: flex-start;
  }
  .home-closing > :deep(.brand-logo--stacked) {
    width: 90px;
    margin-top: 14px;
  }
  .home-closing h2 {
    font-size: 28px;
  }
  .home-closing .section-index {
    font-size: 7px;
    letter-spacing: 0.6px;
  }
  .home-closing p {
    max-width: 190px;
    font-size: 9px;
  }
  .home-footer {
    font-size: 9px;
    min-height: 80px;
  }
  .home-footer > span:nth-child(2) {
    display: none;
  }
}
@media (max-width: 370px) {
  .home-container,
  .home-header {
    width: calc(100% - 32px);
  }
  .hero {
    padding-inline: 16px;
  }
  .hero h1 {
    font-size: 38px;
  }
  .home-header :deep(.brand-logo-text) {
    width: 93px;
  }
  .home-header :deep(.brand-logo-icon) {
    width: 22px;
  }
  .home-closing {
    gap: 20px;
  }
  .home-closing > :deep(.brand-logo--stacked) {
    width: 70px;
  }
}
.hero {
  max-width: 1280px;
  margin-inline: auto;
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  align-items: center;
  padding: 54px 40px 64px;
  text-align: left;
  gap: 0;
}
.hero-copy {
  position: relative;
  z-index: 1;
}
.hero h1 {
  font-size: clamp(44px, 4.3vw, 64px);
  letter-spacing: -2px;
}
.hero-kicker,
.hero-actions {
  justify-content: flex-start;
}
.hero-visual {
  min-width: 0;
}
@media (max-width: 900px) {
  .hero {
    padding: 40px 24px 50px;
    grid-template-columns: 1fr 1fr;
  }
  .hero h1 {
    font-size: 42px;
  }
  .hero-kicker {
    font-size: 9px;
    letter-spacing: 0;
  }
}
@media (max-width: 650px) {
  .hero {
    display: flex;
    flex-direction: column-reverse;
    padding: 6px 24px 46px;
    gap: 0;
    text-align: center;
  }
  .hero h1 {
    font-size: clamp(36px, 10.4vw, 50px);
  }
  .hero-kicker,
  .hero-actions {
    justify-content: center;
  }
}
</style>
