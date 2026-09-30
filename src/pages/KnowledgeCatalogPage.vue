<script setup lang="ts">
import { computed, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppIcon from '@/components/icons/AppIcon.vue'
import { useIconInteraction } from '@/components/motion/useIconInteraction'
import CatalogFolderRow from '@/features/knowledge/CatalogFolderRow.vue'
import CatalogEndpointRow from '@/features/knowledge/CatalogEndpointRow.vue'
import CatalogDetail from '@/features/knowledge/CatalogDetail.vue'
import { useCatalogTree } from '@/features/knowledge/useCatalogTree'
import '@/features/knowledge/catalog.css'

const route = useRoute()
const projectId = computed(() => String(route.params.projectId))
const tree = useCatalogTree(projectId)
const {
  catalog,
  catalogLoading,
  catalogError,
  rows,
  total,
  selected,
  selectedCard,
  detail,
  detailLoading,
  detailError,
  describing,
  organizing,
  notice,
} = tree

const organizeMotion = useIconInteraction()

// The notice is a transient result line, not state: it should not sit there.
let noticeTimer: ReturnType<typeof setTimeout> | undefined
watch(notice, (value) => {
  clearTimeout(noticeTimer)
  if (value) noticeTimer = setTimeout(() => (notice.value = ''), 4200)
})

const empty = computed(() => !catalogLoading.value && !catalogError.value && total.value === 0)
</script>

<template>
  <section class="catalog-page" :class="{ 'has-detail': !!selected }">
    <header class="catalog-head">
      <div class="catalog-head-left">
        <RouterLink :to="`/projects`" class="catalog-back" aria-label="返回项目列表">
          <AppIcon name="arrow-left" :size="17" />
        </RouterLink>
        <div class="catalog-title">
          <p class="catalog-eyebrow"><span aria-hidden="true"></span>接口目录</p>
          <h1>
            <span>整理这个项目</span>
            <span>知道的一切<i class="catalog-title-dot">.</i></span>
          </h1>
        </div>
      </div>
      <div class="catalog-head-right">
        <dl class="catalog-stats">
          <div>
            <dt>接口</dt>
            <dd>{{ total }}</dd>
          </div>
          <div>
            <dt>目录</dt>
            <dd>{{ catalog?.folders.length ?? 0 }}</dd>
          </div>
          <div>
            <dt>待分类</dt>
            <dd>{{ catalog?.unplaced ?? 0 }}</dd>
          </div>
        </dl>
        <button
          type="button"
          class="catalog-organize"
          :aria-busy="organizing"
          :aria-disabled="organizing || !total"
          :data-interacting="organizeMotion.active.value"
          v-on="organizeMotion.events"
          @click="tree.organize()"
        >
          <span class="catalog-organize-sheen" aria-hidden="true"></span>
          <AppIcon name="layers" :size="16" class="catalog-organize-icon" />
          <span>{{ organizing ? '正在重排目录' : '自动整理目录' }}</span>
          <span v-if="organizing" class="ct-pulse" aria-hidden="true"><i></i><i></i><i></i></span>
        </button>
      </div>
    </header>

    <Transition name="catalog-notice">
      <p v-if="notice" class="catalog-notice" role="status">{{ notice }}</p>
    </Transition>

    <div class="catalog-body">
      <div class="catalog-tree-frame">
        <div class="catalog-tree-bar" aria-hidden="true">
          <span>目录与接口</span>
          <span>方法</span>
        </div>
        <div class="catalog-tree" role="tree" aria-label="接口目录">
          <div v-if="catalogLoading && !catalog" class="catalog-state" role="status">
            <span class="catalog-state-mark" aria-hidden="true"><i></i><i></i><i></i></span>
            <p>正在读取目录</p>
          </div>
          <div v-else-if="catalogError" class="catalog-state" role="alert">
            <AppIcon name="circle-x" :size="24" />
            <p>{{ catalogError }}</p>
            <button type="button" class="catalog-text-button" @click="tree.loadCatalog()">
              重试
            </button>
          </div>
          <div v-else-if="empty" class="catalog-state">
            <AppIcon name="folder" :size="24" />
            <p>这个项目还没有观测到接口</p>
          </div>
          <TransitionGroup v-else name="ct" tag="div" class="catalog-rows">
            <template v-for="(row, index) in rows" :key="row.key">
              <CatalogFolderRow
                v-if="row.kind === 'folder'"
                :row="row"
                :index="index"
                @toggle="tree.toggle"
              />
              <CatalogEndpointRow
                v-else
                :row="row"
                :index="index"
                :selected="selected === row.card.interface_id"
                :describing="describing === row.card.interface_id"
                :locked="!!describing || organizing"
                @open="tree.select"
                @describe="tree.describe"
              />
            </template>
          </TransitionGroup>
        </div>
      </div>

      <Transition name="catalog-detail">
        <CatalogDetail
          v-if="selected"
          :card="selectedCard"
          :detail="detail"
          :loading="detailLoading"
          :error="detailError"
          :describing="describing === selected"
          @describe="tree.describe"
          @close="tree.close"
        />
      </Transition>
    </div>
  </section>
</template>
