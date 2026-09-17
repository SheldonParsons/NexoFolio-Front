<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { renderArticle } from './markdown'
const props = withDefaults(defineProps<{ body: string; prefix?: string }>(), { prefix: '' })
const router = useRouter()
const rendered = computed(() => renderArticle(props.body, props.prefix))
function navigate(event: MouseEvent) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const link = (event.target as Element | null)?.closest('a')
  if (!link || link.target === '_blank') return
  const url = new URL(link.href, window.location.href)
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  if (url.origin !== window.location.origin || !url.pathname.startsWith(`${base}/`)) return
  const path = url.pathname.slice(base.length)
  if (!/^\/(docs|changelog)(?:\/|$)/.test(path)) return
  event.preventDefault()
  void router.push(`${path}${url.search}${url.hash}`)
}
</script>
<template><div class="pd-markdown" @click="navigate" v-html="rendered.html" /></template>
