<script setup lang="ts">
import { RouterLink } from 'vue-router'
import EmptyState from '@/components/ui/EmptyState.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
</script>

<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <p class="eyebrow">API KNOWLEDGE</p>
        <h1>接口目录</h1>
        <p class="page-description">从目录找到接口，从证据理解业务。</p>
      </div>
    </div>
    <div class="empty-panel directory-panel">
      <EmptyState
        title="先连接一个项目空间"
        description="接口目录跟随项目组织。项目服务接入后，这里将呈现你有权访问的接口知识。"
        icon="network"
        ><RouterLink class="button button--primary" to="/projects"
          ><AppIcon name="folder" :size="17" />前往项目空间</RouterLink
        ></EmptyState
      >
    </div>
  </div>
</template>
