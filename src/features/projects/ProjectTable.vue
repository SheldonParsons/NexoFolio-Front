<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { TooltipProvider } from 'reka-ui'
import AppIcon from '@/components/icons/AppIcon.vue'
import AppButton from '@/components/ui/AppButton.vue'
import ProjectRow from './ProjectRow.vue'
import type { Project } from './types'
const props = defineProps<{
  items: Project[]
  recent: Project[]
  recentReady: boolean
  hasResult: boolean
  busy: boolean
  showProgress: boolean
  error: string
  filtered: boolean
  openingId: string | null
  revision: number
  scrollTop: number
  restoreScroll: boolean
  limit: number
}>()
const emit = defineEmits<{
  open: [project: Project]
  retry: []
  clear: []
  scroll: [top: number]
  restored: []
}>()
const viewport = ref<HTMLElement>()
async function restore() {
  await nextTick()
  if (props.restoreScroll && (props.recentReady || props.scrollTop === 0) && viewport.value) {
    viewport.value.scrollTop = props.scrollTop
    emit('restored')
  }
}
watch(() => [props.revision, props.recentReady, props.recent.length, props.restoreScroll], restore)
onMounted(restore)
function handleScroll() {
  if (!props.restoreScroll) emit('scroll', viewport.value?.scrollTop ?? 0)
}
function scrollKeys(event: KeyboardEvent) {
  if (event.target !== viewport.value) return
  const el = viewport.value
  if (!el) return
  const rowHeight = el.querySelector('.project-row')?.getBoundingClientRect().height || 56
  const distance =
    event.key === 'PageDown'
      ? el.clientHeight - rowHeight
      : event.key === 'PageUp'
        ? -el.clientHeight + rowHeight
        : event.key === 'ArrowDown'
          ? rowHeight
          : event.key === 'ArrowUp'
            ? -rowHeight
            : 0
  if (distance) {
    event.preventDefault()
    el.scrollBy({ top: distance, behavior: 'instant' })
  }
}
</script>
<template>
  <TooltipProvider :delay-duration="350">
    <div class="project-list-frame">
      <div
        ref="viewport"
        class="project-results"
        data-scroll-container
        data-scroll-restoration="managed"
        tabindex="0"
        role="region"
        aria-label="项目列表，可滚动"
        :aria-busy="busy"
        @scroll.passive="handleScroll"
        @keydown="scrollKeys"
      >
        <table class="project-list">
          <caption class="sr-only">
            项目名称、状态和访问权限。最近访问独立于全部项目分页。
          </caption>
          <colgroup>
            <col />
            <col class="project-status-col" />
            <col class="project-access-col" />
            <col class="project-action-col" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" class="project-name-header">项目名称</th>
              <th scope="col" class="project-status-cell">状态</th>
              <th scope="col" class="project-access-cell">访问权限</th>
              <th scope="col" class="project-action-cell"><span class="sr-only">操作</span></th>
            </tr>
          </thead>
          <tbody v-if="error">
            <tr>
              <td colspan="4">
                <div class="project-state" role="alert">
                  <AppIcon name="network" :size="28" />
                  <h2>项目暂时无法加载</h2>
                  <p>{{ error }}</p>
                  <AppButton @click="emit('retry')">重新加载</AppButton>
                </div>
              </td>
            </tr>
          </tbody>
          <tbody
            v-else-if="!hasResult"
            :class="{ 'skeleton-hidden': !showProgress }"
            aria-hidden="true"
          >
            <tr v-for="i in limit" :key="i" class="project-skeleton-row">
              <td><span></span></td>
              <td class="project-status-cell"><span></span></td>
              <td class="project-access-cell"><span></span></td>
              <td class="project-action-cell"></td>
            </tr>
          </tbody>
          <tbody v-else :key="revision" class="project-table-body" :class="{ 'is-stale': busy }">
            <template v-if="!filtered && recent.length"
              ><tr class="project-group">
                <th colspan="4" scope="rowgroup">
                  <span>最近访问</span><span class="group-count">{{ recent.length }}</span>
                </th>
              </tr>
              <ProjectRow
                v-for="project in recent"
                :key="`recent-${project.project_id}`"
                :project="project"
                :blocked="busy || !!openingId"
                :opening="openingId === project.project_id"
                @open="emit('open', $event)"
            /></template>
            <tr v-if="!filtered && recent.length" class="project-group project-group--all">
              <th colspan="4" scope="rowgroup">
                <span>{{ filtered ? '搜索结果' : '全部项目' }}</span>
              </th>
            </tr>
            <ProjectRow
              v-for="project in items"
              :key="project.project_id"
              :project="project"
              :blocked="busy || !!openingId"
              :opening="openingId === project.project_id"
              @open="emit('open', $event)"
            />
            <tr v-if="!items.length">
              <td colspan="4">
                <div class="project-state" role="status">
                  <AppIcon :name="filtered ? 'search' : 'folder'" :size="28" />
                  <h2>{{ filtered ? '没有找到匹配的项目' : '还没有同步的项目' }}</h2>
                  <p>
                    {{
                      filtered
                        ? '试试其他关键词，或清除权限筛选。'
                        : '项目会在普通禅道账号登录成功后同步到这里。'
                    }}
                  </p>
                  <AppButton v-if="filtered" @click="emit('clear')">清除筛选</AppButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </TooltipProvider>
</template>
