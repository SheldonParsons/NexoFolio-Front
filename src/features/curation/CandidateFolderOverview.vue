<script setup lang="ts">
import { useLifecycle } from '@/features/documents/lifecycle/context'
const lifecycle = useLifecycle()
import AppIcon from '@/components/icons/AppIcon.vue'
import type { Folder } from '@/contracts/knowledge/types'
import type { DocumentFolder } from '@/features/documents/documentTree'
import type { DocumentTarget } from '@/features/documents/documentRoutes'
import type { Candidate } from './types'
import type { KnowledgeChange } from './changes'
import CurationChangeDetail from './CurationChangeDetail.vue'
defineProps<{
  folder: DocumentFolder
  path: Folder[]
  change?: KnowledgeChange
  candidate: Candidate
}>()
defineEmits<{ select: [target: DocumentTarget] }>()
</script>
<template>
  <header class="candidate-folder-overview-heading">
    <p class="document-breadcrumbs">{{ path.map((f) => f.name).join(' / ') || folder.name }}</p>
    <h2 :class="{ 'lifecycle-retired-name': !!lifecycle?.get({ kind: 'folder', id: folder.id }) }">
      <AppIcon name="folder-open" :size="21" />{{ folder.name }}
    </h2>
    <p>{{ folder.summary || '目录介绍尚未补充。' }}</p>
    <p class="document-overview-meta">
      {{ folder.children.length }} 个子目录 · {{ folder.count }} 个接口
    </p>
  </header>
  <div class="document-overview">
    <section v-if="folder.children.length">
      <h3>子目录</h3>
      <div class="document-overview-grid">
        <button
          v-for="child in folder.children"
          :key="child.id"
          type="button"
          class="document-overview-card"
          @click="$emit('select', { kind: 'folder', id: child.id })"
        >
          <strong
            ><span
              :class="{
                'lifecycle-retired-name': !!lifecycle?.get({ kind: 'folder', id: child.id }),
              }"
              >{{ child.name }}</span
            >
            <small>{{ child.count }} 个接口</small></strong
          >
          <p>{{ child.summary || '暂无目录介绍' }}</p>
        </button>
      </div>
    </section>
    <section v-if="folder.entries.length">
      <h3>接口与用途</h3>
      <article
        v-for="entry in folder.entries"
        :key="entry.interface_id"
        class="document-overview-entry"
      >
        <button
          type="button"
          class="interface-list-item candidate-overview-entry"
          @click="$emit('select', { kind: 'endpoint', id: entry.interface_id })"
        >
          <span class="http-method" :data-method="entry.method">{{ entry.method }}</span
          ><span class="interface-item-content"
            ><strong
              :class="{
                'lifecycle-retired-name': !!lifecycle?.get({
                  kind: 'endpoint',
                  id: entry.interface_id,
                }),
              }"
              >{{ entry.name || entry.path }}</strong
            ></span
          ><AppIcon name="arrow-right" :size="13" />
        </button>
        <p>{{ entry.purpose || '用途尚未补充' }}</p>
      </article>
    </section>
    <details v-if="change" class="candidate-folder-change">
      <summary>查看本轮目录变化</summary>
      <CurationChangeDetail :change="change" :candidate="candidate" />
    </details>
  </div>
</template>
