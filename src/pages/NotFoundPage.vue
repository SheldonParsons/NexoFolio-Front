<script setup lang="ts">
import { RouterLink } from 'vue-router'
import EmptyState from '@/components/ui/EmptyState.vue'
</script>

<template>
  <div class="page-container">
    <p class="eyebrow">404 · PAGE NOT FOUND</p>
    <div class="empty-panel">
      <EmptyState
        title="这个页面暂时找不到了"
        description="链接可能有误，回到项目空间继续浏览吧。"
        icon="search"
        ><RouterLink to="/projects" class="button button--primary"
          >返回项目空间</RouterLink
        ></EmptyState
      >
    </div>
  </div>
</template>
