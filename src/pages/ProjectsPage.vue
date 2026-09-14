<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const guideOpen = ref(false)
</script>

<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <p class="eyebrow">YOUR WORKSPACE</p>
        <h1>项目空间</h1>
        <p class="page-description">把分散的接口，整理成有上下文的知识。</p>
      </div>
      <span class="subtle-badge"><span class="status-dot"></span>等待接入</span>
    </div>
    <section class="intro-banner">
      <div class="intro-banner-icon"><AppIcon name="layers" :size="23" /></div>
      <div>
        <strong>从项目开始，让知识自然连接。</strong>
        <p>每个项目都有独立的接口目录、调用证据与变更记录。</p>
      </div>
      <span class="banner-decoration" aria-hidden="true"
        ><span></span><span></span><span></span
      ></span>
    </section>
    <div class="section-heading">
      <h2>全部项目</h2>
      <span>同步自禅道</span>
    </div>
    <div class="empty-panel">
      <EmptyState
        title="你的项目，即将在这里相遇"
        description="项目服务尚未接入。完成禅道账号与项目同步后，你可以在这里浏览自己的知识空间。"
      >
        <AppDialog
          v-model:open="guideOpen"
          title="项目如何进入 NexoFolio"
          description="沿用你已有的项目，让知识集中在同一个地方。"
        >
          <template #trigger
            ><AppButton variant="primary" icon="book"
              >了解项目同步<AppIcon name="arrow-right" :size="16" /></AppButton
          ></template>
          <ol class="guide-steps">
            <li>
              <span>01</span>
              <div>
                <strong>使用禅道身份登录</strong>
                <p>由后端验证账号，NexoFolio 保留必要的基础用户信息。</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>同步已有项目</strong>
                <p>项目来自禅道，本平台不提供手动创建项目入口。</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>让接口知识归位</strong>
                <p>在授权范围内接收接口信息，逐步组织目录和调用证据。</p>
              </div>
            </li>
          </ol>
          <div class="inline-notice">账号登录与项目同步将在后端接入后开放。</div>
        </AppDialog>
      </EmptyState>
      <div class="empty-panel-footer">
        <AppIcon name="folder" :size="15" /><span>保留已有项目结构，专注沉淀接口知识。</span>
      </div>
    </div>
    <div class="feature-notes">
      <div>
        <AppIcon name="network" :size="20" /><strong>有组织的目录</strong>
        <p>从业务上下文发现接口。</p>
      </div>
      <div>
        <AppIcon name="code" :size="20" /><strong>有依据的知识</strong>
        <p>定义、样例与变更各有来源。</p>
      </div>
      <div>
        <AppIcon name="layers" :size="20" /><strong>共享的工作空间</strong>
        <p>为团队与 Agent 提供同一份知识。</p>
      </div>
    </div>
  </div>
</template>
