<script setup lang="ts">
import { ref, watch } from 'vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import DocumentPager from './DocumentPager.vue'
import type { InterfacePage, InterfaceCard } from './types'
const props = defineProps<{
  page: InterfacePage | null
  loading: boolean
  error: string
  selectedId: string
  environmentId: string
  query: string
  queryError: string
  pages: number
}>()
const emit = defineEmits<{
  select: [item: InterfaceCard]
  query: [value: string]
  submit: []
  clear: []
  compositionStart: []
  compositionEnd: [value: string]
  page: [page: number]
  retry: []
}>()
const input = ref<HTMLInputElement>()
const viewport = ref<HTMLElement>()
watch(
  () => props.page,
  () => {
    if (viewport.value) viewport.value.scrollTop = 0
  },
)
function keydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Enter') {
    event.preventDefault()
    emit('submit')
  }
  if (event.key === 'Escape' && props.query) {
    event.preventDefault()
    clear()
  }
}
function clear() {
  emit('clear')
  input.value?.focus()
}
</script>
<template>
  <aside class="interface-sidebar" aria-label="当前环境的接口列表">
    <div class="interface-sidebar-heading">
      <span class="document-eyebrow">INTERFACES</span>
      <div>
        <h2>待分类</h2>
        <span v-if="page && !error" class="document-count">{{ page.total }}</span>
      </div>
    </div>
    <div class="interface-search" :class="{ 'is-disabled': !environmentId }">
      <AppIcon name="search" :size="17" /><input
        ref="input"
        type="search"
        :value="query"
        :disabled="!environmentId"
        aria-label="按方法或路径搜索接口"
        :aria-invalid="!!queryError"
        placeholder="搜索 method / path…"
        autocomplete="off"
        spellcheck="false"
        @input="emit('query', ($event.target as HTMLInputElement).value)"
        @keydown="keydown"
        @compositionstart="emit('compositionStart')"
        @compositionend="emit('compositionEnd', ($event.target as HTMLInputElement).value)"
      /><button
        v-if="query"
        type="button"
        aria-label="清除接口搜索"
        @pointerdown.prevent
        @click="clear"
      >
        <AppIcon name="x" :size="15" />
      </button>
    </div>
    <p v-if="queryError" class="interface-query-note" role="alert">{{ queryError }}</p>
    <p v-else class="interface-query-note">
      {{ environmentId ? '当前环境 · 方法或路径的字面匹配' : '先选择环境' }}
    </p>
    <div
      ref="viewport"
      class="interface-list-scroll"
      data-scroll-container
      data-scroll-restoration="managed"
      :aria-busy="loading"
    >
      <div v-if="!environmentId" class="document-small-state">
        <AppIcon name="layers" :size="24" />
        <p>选择一个环境，<br />查看它的观测接口。</p>
      </div>
      <div v-else-if="error" class="document-small-state" role="alert">
        <p>{{ error }}</p>
        <button type="button" class="document-secondary-button" @click="emit('retry')">
          重新读取列表
        </button>
      </div>
      <div v-else-if="!page && loading" class="interface-skeletons" aria-label="正在读取接口">
        <div v-for="index in 8" :key="index"></div>
      </div>
      <template v-else>
        <p v-if="loading" class="interface-updating" role="status">正在读取…</p>
        <div
          v-if="page?.items.length"
          class="interface-items"
          :class="{ 'is-stale': loading || !!queryError }"
        >
          <button
            v-for="item in page.items"
            :key="item.interface_id"
            type="button"
            class="interface-list-item"
            :class="{ 'is-selected': selectedId === item.interface_id }"
            :aria-pressed="selectedId === item.interface_id"
            :disabled="loading || !!queryError"
            :aria-label="`${item.method} ${item.path}`"
            aria-controls="document-detail"
            @click="emit('select', item)"
          >
            <span class="http-method" :class="{ 'http-method--write': item.method !== 'GET' }">{{
              item.method
            }}</span
            ><span class="interface-item-content"
              ><code :title="item.path">{{ item.path }}</code
              ><small>{{
                item.pending_difference_count
                  ? `${item.pending_difference_count} 条待处理差异`
                  : '观测所得'
              }}</small></span
            ><AppIcon name="chevron-right" :size="14" />
          </button>
        </div>
        <div v-else-if="page" class="document-small-state">
          <AppIcon name="code" :size="24" />
          <p>{{ query ? '没有匹配的方法或路径。' : '此环境暂无已建档接口。' }}</p>
          <small v-if="!query">等待采集记录处理完成后，可重新读取列表。</small
          ><button
            type="button"
            class="document-secondary-button"
            @click="query ? clear() : emit('retry')"
          >
            {{ query ? '清除搜索' : '重新读取列表' }}
          </button>
        </div>
      </template>
    </div>
    <DocumentPager
      v-if="page && environmentId && !error"
      :page="page.page"
      :pages="pages"
      :total="page.total"
      :loading="loading || !!queryError"
      label="接口列表分页"
      @change="emit('page', $event)"
    />
  </aside>
</template>
