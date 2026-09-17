<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import { productArticles, productUpdates } from './content'
const open = ref(false)
const query = ref('')
const route = useRoute()
const records = [
  ...productArticles.map((article) => ({
    title: article.title,
    description: article.description,
    group: article.section,
    path: article.path,
    text: `${article.title} ${article.description} ${article.body}`,
  })),
  ...productUpdates.map((update) => ({
    title: update.title,
    description: update.description,
    group: '更新日志',
    path: `/changelog/${update.slug}`,
    text: `${update.title} ${update.description} ${update.body}`,
  })),
]
const results = computed(() => {
  const terms = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return records.filter((record) => terms.every((term) => record.text.toLowerCase().includes(term)))
})
function shortcut(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    open.value = !open.value
  }
}
onMounted(() => window.addEventListener('keydown', shortcut))
onScopeDispose(() => window.removeEventListener('keydown', shortcut))
watch(
  () => route.fullPath,
  () => {
    open.value = false
  },
)
watch(open, (value) => {
  if (value) query.value = ''
})
</script>
<template>
  <AppDialog v-model:open="open" title="搜索文档" description="查找产品理念、接入方式与更新内容。"
    ><template #trigger
      ><button type="button" class="pd-search-trigger">
        <AppIcon name="search" :size="15" /><span>搜索文档…</span><kbd>⌘ K</kbd>
      </button></template
    >
    <div class="pd-search-dialog">
      <input
        v-model="query"
        type="search"
        aria-label="搜索文档内容"
        placeholder="输入关键词，例如 Fetcher、回退、MCP"
      />
      <p class="pd-search-count" role="status">
        {{ query ? `找到 ${results.length} 项内容` : '从这里开始' }}
      </p>
      <div class="pd-search-results">
        <RouterLink
          v-for="record in results"
          :key="record.path"
          :to="record.path"
          @click="open = false"
          ><span>{{ record.group }}</span
          ><strong>{{ record.title }}</strong>
          <p>{{ record.description }}</p>
          <AppIcon name="arrow-up-right" :size="16"
        /></RouterLink>
        <p v-if="!results.length" class="pd-empty-note">没有找到相关内容，试试更短的关键词。</p>
      </div>
    </div></AppDialog
  >
</template>
