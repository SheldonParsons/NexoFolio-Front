<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppIcon from '@/components/icons/AppIcon.vue'
import { productArticles } from '@/features/product-docs/content'
import { renderArticle } from '@/features/product-docs/markdown'
import MarkdownContent from '@/features/product-docs/MarkdownContent.vue'
import PhilosophyArticle from '@/features/product-docs/PhilosophyArticle.vue'
import DocsSearch from '@/features/product-docs/DocsSearch.vue'
import CollectApiArticle from '@/features/collect-docs/CollectApiArticle.vue'
const route = useRoute()
const article = computed(() =>
  productArticles.find((item) => item.slug === (route.params.docSlug || 'philosophy')),
)
const position = computed(() => productArticles.findIndex((item) => item === article.value))
const previous = computed(() => productArticles[position.value - 1])
const next = computed(() => productArticles[position.value + 1])
const mobileOpen = ref(false)
const groups = ['使用文档', '开放 API', 'MCP'] as const
watch(
  article,
  (value) => {
    if (value) document.title = `${value.title} · NexoFolio 文档`
    mobileOpen.value = false
  },
  { immediate: true },
)

// Long reference pages get an in-page outline on wide screens.
const tocSlugs = new Set(['api'])
const toc = computed(() =>
  article.value && tocSlugs.has(article.value.slug)
    ? renderArticle(article.value.body, article.value.slug).headings.filter((h) => h.level === 2)
    : [],
)
const scroller = ref<HTMLElement>()
const activeHeading = ref('')
let frame = 0
function trackHeading() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => {
    const container = scroller.value
    if (!container || !toc.value.length) return
    const line = container.getBoundingClientRect().top + container.clientHeight * 0.25
    let current = toc.value[0]!.id
    for (const heading of toc.value) {
      const element = document.getElementById(heading.id)
      if (element && element.getBoundingClientRect().top <= line) current = heading.id
    }
    activeHeading.value = current
  })
}
watch(toc, () => void nextTick(trackHeading), { immediate: true })
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>
<template>
  <section class="pd-frame">
    <aside class="pd-sidebar" :class="{ 'is-open': mobileOpen }">
      <p class="pd-sidebar-eyebrow">NEXOFOLIO DOCS</p>
      <DocsSearch />
      <button
        type="button"
        class="pd-mobile-close"
        aria-label="关闭文档目录"
        @click="mobileOpen = false"
      >
        <AppIcon name="x" :size="18" />
      </button>
      <nav aria-label="文档目录">
        <section v-for="group in groups" :key="group">
          <h2>{{ group }}</h2>
          <RouterLink
            v-for="item in productArticles.filter((item) => item.section === group)"
            :key="item.slug"
            :to="item.path"
            :class="{ 'is-active': article?.slug === item.slug }"
            :aria-current="article?.slug === item.slug ? 'page' : undefined"
            >{{ item.title }}</RouterLink
          >
        </section>
      </nav>
      <div class="pd-sidebar-foot">
        <span class="pd-tiny-mark" />
        <p>让每一次调用，<br />成为下一次的知识。</p>
      </div>
    </aside>
    <div
      ref="scroller"
      class="pd-content-scroll"
      data-scroll-container
      @scroll.passive="trackHeading"
    >
      <button
        class="pd-mobile-menu"
        type="button"
        :aria-expanded="mobileOpen"
        @click="mobileOpen = !mobileOpen"
      >
        <AppIcon :name="mobileOpen ? 'x' : 'menu'" :size="16" />文档目录
      </button>
      <div v-if="!article" class="pd-not-found">
        <h1>没有找到这篇文档</h1>
        <RouterLink to="/docs">返回使用文档 <AppIcon name="arrow-right" :size="16" /></RouterLink>
      </div>
      <div v-else class="pd-reading-grid" :class="{ 'has-toc': toc.length }">
        <main id="main-content" class="pd-article" tabindex="-1" :key="article.slug">
          <header class="pd-article-header">
            <h1>{{ article.title }}</h1>
            <p class="pd-lead">{{ article.description }}</p>
          </header>
          <PhilosophyArticle
            v-if="article.slug === 'philosophy'"
            :body="article.body"
            :prefix="article.slug"
          />
          <CollectApiArticle
            v-else-if="article.slug === 'api'"
            :body="article.body"
            :prefix="article.slug"
          />
          <MarkdownContent v-else :body="article.body" :prefix="article.slug" />
          <footer class="pd-article-footer">
            <RouterLink v-if="previous" :to="previous.path"
              ><small>上一篇</small
              ><span><AppIcon name="arrow-left" :size="15" />{{ previous.title }}</span></RouterLink
            ><RouterLink v-if="next" :to="next.path" class="pd-next"
              ><small>接下来</small
              ><span>{{ next.title }}<AppIcon name="arrow-right" :size="15" /></span
            ></RouterLink>
          </footer>
        </main>
        <nav v-if="toc.length" class="pd-toc" aria-label="本页内容">
          <h2>本页内容</h2>
          <RouterLink
            v-for="heading in toc"
            :key="heading.id"
            :to="{ hash: `#${heading.id}` }"
            :class="{ 'is-active': activeHeading === heading.id }"
            :aria-current="activeHeading === heading.id ? 'location' : undefined"
            >{{ heading.title }}</RouterLink
          >
        </nav>
      </div>
    </div>
  </section>
</template>
