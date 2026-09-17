<script setup lang="ts">
import { RouterView } from 'vue-router'
import WorkspaceHeader from './WorkspaceHeader.vue'
import '@/features/product-docs/product-docs.css'
</script>
<template>
  <div class="pd-viewport">
    <WorkspaceHeader />
    <div class="pd-routed-view"><RouterView /></div>
  </div>
</template>
