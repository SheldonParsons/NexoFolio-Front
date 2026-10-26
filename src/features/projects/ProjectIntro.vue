<script setup lang="ts">
defineProps<{ filtered: boolean; total?: number }>()
</script>

<template>
  <header class="project-intro">
    <div class="project-collection-heading">
      <h1 id="project-page-title">{{ filtered ? '搜索结果' : '项目空间' }}</h1>
      <span v-if="total !== undefined" class="project-total">{{ total }}</span>
    </div>
    <p class="project-intro-description">选择项目，查看接口文档与整理结果。</p>
  </header>
</template>
