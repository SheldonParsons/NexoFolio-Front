<script setup lang="ts">
import { useLifecycle } from './lifecycle/context'
import LifecycleMenu from './lifecycle/LifecycleMenu.vue'
import LifecycleNotice from './lifecycle/LifecycleNotice.vue'
const lifecycle = useLifecycle()
import { RouterLink } from 'vue-router'
import type { DocumentFolder } from './documentTree'
import type { Folder } from '@/contracts/knowledge/types'
import DocumentBreadcrumbs from './DocumentBreadcrumbs.vue'
import DocumentPreview from './DocumentPreview.vue'
import DocumentEndpointRow from './DocumentEndpointRow.vue'
import DocumentShare from './DocumentShare.vue'
import { documentLocation } from './documentRoutes'
defineProps<{
  folder: DocumentFolder
  path: Folder[]
  projectId: string
  environmentId: string
  environmentName: string
}>()
</script>
<template>
  <header class="document-definition-heading document-overview-heading">
    <RouterLink class="document-mobile-back" :to="documentLocation(projectId, null, environmentId)"
      >返回目录列表</RouterLink
    >
    <DocumentBreadcrumbs :path="path" :project-id="projectId" :environment-id="environmentId" />
    <div class="document-overview-title">
      <h2
        :class="{ 'lifecycle-retired-name': !!lifecycle?.get({ kind: 'folder', id: folder.id }) }"
      >
        {{ folder.name }}
      </h2>
      <LifecycleMenu :target="{ kind: 'folder', id: folder.id }" :name="folder.name" />
      <DocumentShare
        :to="documentLocation(projectId, { kind: 'folder', id: folder.id }, environmentId)"
      />
    </div>
    <LifecycleNotice :target="{ kind: 'folder', id: folder.id }" />
    <p class="document-purpose">
      {{ folder.summary || '目录介绍尚未补充。以下用途来自已保存的接口知识。' }}
    </p>
    <p class="document-overview-meta">
      {{ environmentName || '无环境' }} · {{ folder.children.length }} 个子目录 ·
      {{ folder.count }} 个接口
    </p>
  </header>
  <div class="document-scroll document-overview" data-scroll-container>
    <section v-if="folder.children.length">
      <h3>子目录</h3>
      <div class="document-overview-grid">
        <DocumentPreview
          v-for="child in folder.children"
          :key="child.id"
          :to="documentLocation(projectId, { kind: 'folder', id: child.id }, environmentId)"
          placement="overview"
          :name="child.name"
          :purpose="child.summary"
          :context="folder.name + ' / ' + child.name"
          :meta="child.count + ' 个接口'"
          v-slot="preview"
          ><RouterLink
            class="document-overview-card"
            :to="documentLocation(projectId, { kind: 'folder', id: child.id }, environmentId)"
            :aria-describedby="preview.previewOpen ? preview.previewId : undefined"
            aria-keyshortcuts="Escape"
            ><strong
              ><span
                :class="{
                  'lifecycle-retired-name': !!lifecycle?.get({ kind: 'folder', id: child.id }),
                }"
                >{{ child.name }}</span
              >
              <small>{{ child.count }}</small></strong
            >
            <p>{{ child.summary || '暂无目录介绍' }}</p></RouterLink
          ></DocumentPreview
        >
      </div>
    </section>
    <section v-if="folder.entries.length">
      <h3>接口与用途</h3>
      <article
        v-for="entry in folder.entries"
        :key="entry.interface_id"
        class="document-overview-entry"
      >
        <DocumentEndpointRow
          :entry="entry"
          :selected="false"
          preview-placement="overview"
          :project-id="projectId"
          :environment-id="environmentId"
          :context="path.map((f) => f.name).join(' / ')"
        />
        <p>{{ entry.purpose || '用途尚未补充' }}</p>
      </article>
    </section>
    <p v-if="!folder.count" class="document-small-state">
      此目录在当前环境尚无接口观测。目录与链接仍保留。
    </p>
  </div>
</template>
