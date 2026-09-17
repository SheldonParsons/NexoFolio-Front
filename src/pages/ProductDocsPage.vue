<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppIcon from '@/components/icons/AppIcon.vue'
import { productArticles } from '@/features/product-docs/content'
import MarkdownContent from '@/features/product-docs/MarkdownContent.vue'
import PhilosophyArticle from '@/features/product-docs/PhilosophyArticle.vue'
import DocsSearch from '@/features/product-docs/DocsSearch.vue'
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
    <div class="pd-content-scroll" data-scroll-container>
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
      <div v-else class="pd-reading-grid">
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
      </div>
    </div>
  </section>
</template>
