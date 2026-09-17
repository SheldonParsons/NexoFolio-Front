<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/icons/AppIcon.vue'
import MarkdownContent from '@/features/product-docs/MarkdownContent.vue'
import DocsSearch from '@/features/product-docs/DocsSearch.vue'
import { productUpdates, productLabels } from '@/features/product-docs/content'
import { useCopyLink } from '@/features/product-docs/useCopyLink'
const route = useRoute()
const router = useRouter()
const filter = computed(() =>
  route.query.product === 'nexofolio' || route.query.product === 'fetcher'
    ? route.query.product
    : 'all',
)
const entries = computed(() =>
  route.params.entry
    ? productUpdates.filter((entry) => entry.slug === route.params.entry)
    : productUpdates.filter((entry) => filter.value === 'all' || entry.product === filter.value),
)
const { copy, copied, error } = useCopyLink()
function select(product: string) {
  void router.push({ path: '/changelog', query: product === 'all' ? {} : { product } })
}
function date(value: string) {
  const [year, month, day] = value.split('-')
  return `${year} 年 ${Number(month)} 月 ${Number(day)} 日`
}
</script>
<template>
  <main id="main-content" tabindex="-1" class="pd-changelog-scroll" data-scroll-container>
    <div class="pd-changelog">
      <header class="pd-changelog-heading">
        <p class="pd-sidebar-eyebrow">PRODUCT UPDATES</p>
        <div class="pd-changelog-title-line">
          <h1>更新日志</h1>
          <DocsSearch />
        </div>
        <p>记录 NexoFolio 的每一步。</p>
        <nav v-if="!route.params.entry" class="pd-product-filters" aria-label="按产品筛选更新">
          <button
            v-for="option in [
              { value: 'all', label: '全部' },
              { value: 'nexofolio', label: 'NexoFolio' },
              { value: 'fetcher', label: 'Fetcher' },
            ]"
            :key="option.value"
            type="button"
            :class="{ 'is-active': filter === option.value }"
            :aria-pressed="filter === option.value"
            @click="select(option.value)"
          >
            {{ option.label }}
          </button>
        </nav>
        <RouterLink v-else class="pd-return-link" to="/changelog"
          ><AppIcon name="arrow-left" :size="15" />全部更新</RouterLink
        >
      </header>
      <div v-if="!entries.length" class="pd-changelog-empty">
        <AppIcon name="layers" :size="28" />
        <h2>{{ route.params.entry ? '没有找到这条记录' : '新的记录，留待下一次更新' }}</h2>
        <p>
          {{
            route.params.entry
              ? '可以返回更新日志继续浏览。'
              : 'Fetcher 的版本记录将在这里更新，当前安装包可从顶部下载入口获取。'
          }}
        </p>
        <RouterLink to="/changelog"
          >查看全部更新 <AppIcon name="arrow-right" :size="15"
        /></RouterLink>
      </div>
      <div v-else class="pd-release-list">
        <article v-for="entry in entries" :key="entry.slug" class="pd-release">
          <aside class="pd-release-meta">
            <time :datetime="entry.date">{{ date(entry.date) }}</time
            ><span class="pd-release-version">{{ entry.version }}</span
            ><span class="pd-release-product">{{ productLabels[entry.product] }}</span>
          </aside>
          <div class="pd-release-content">
            <header>
              <span v-if="entry.preview" class="pd-preview-label">预览记录</span>
              <h2>
                <RouterLink :to="`/changelog/${entry.slug}`">{{ entry.title }}</RouterLink>
              </h2>
              <p class="pd-release-description">{{ entry.description }}</p>
            </header>
            <MarkdownContent :body="entry.body" :prefix="entry.slug" />
            <footer>
              <button type="button" @click="copy(`/changelog/${entry.slug}`)">
                <AppIcon
                  :name="copied === `/changelog/${entry.slug}` ? 'check' : 'arrow-up-right'"
                  :size="14"
                />{{
                  copied === `/changelog/${entry.slug}` ? '已复制链接' : '复制此条链接'
                }}</button
              ><RouterLink to="/docs"
                >阅读文档 <AppIcon name="arrow-right" :size="14"
              /></RouterLink>
            </footer>
          </div>
        </article>
      </div>
      <p v-if="error" class="pd-copy-error" role="status">{{ error }}</p>
      <footer class="pd-changelog-footer">
        <span>NexoFolio</span><span>让知识持续生长。</span>
      </footer>
    </div>
  </main>
</template>
