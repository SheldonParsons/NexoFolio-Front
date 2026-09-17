<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/icons/AppIcon.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import DocumentPager from '@/features/documents/DocumentPager.vue'
import JsonDisclosure from '@/features/documents/JsonDisclosure.vue'
import { formatTime, shortId } from '@/features/documents/presentation'
import { useAuthStore } from '@/stores/auth'
import { clearCredential } from '@/api/session'
import CatalogChange from '@/features/catalog/CatalogChange.vue'
import { catalogSource } from '@/features/catalog/source'
import type { CatalogState } from '@/features/catalog/types'
import { previewSource } from '@/features/catalog-preview/source'
import { useCatalogPreview } from '@/features/catalog-preview/useCatalogPreview'
import { ALL, UNCLASSIFIED, previewModel, statusLabels } from '@/features/catalog-preview/model'
import { mergePreview } from '@/features/catalog-preview/mergeGroups'
import '@/features/documents/documents.css'
import '@/features/catalog-preview/catalog-preview.css'
import '@/features/catalog/catalog.css'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
let expired = false
const workspace = useCatalogPreview(
  () => String(route.params.projectId),
  previewSource,
  () => {
    if (expired) return
    expired = true
    clearCredential()
    auth.user = null
    auth.requestLogin(route.fullPath, '登录已过期，请重新登录。')
    void router.push('/')
  },
  () => (typeof route.query.task === 'string' ? route.query.task : undefined),
)
const {
  page,
  task,
  published,
  defaultItem,
  selectedTaskId,
  selectedDirectory,
  selectedInterface,
  expanded,
  listBusy,
  detailBusy,
  listError,
  detailError,
  pages,
} = workspace
const taskOptions = computed(() => {
  const items = [...(page.value?.items ?? [])]
  if (defaultItem.value && !items.some((item) => item.task_id === defaultItem.value?.task_id))
    items.unshift(defaultItem.value)
  const options = items.map((item) => ({
    value: item.task_id,
    label: `${statusLabels[item.status]} · ${formatTime(item.snapshot_at)} · ${shortId(item.task_id)}`,
  }))
  if (task.value && !options.some((option) => option.value === task.value?.task_id))
    options.unshift({
      value: task.value.task_id,
      label: `${statusLabels[task.value.status]} · ${formatTime(task.value.snapshot_at)} · ${shortId(task.value.task_id)}`,
    })
  return options
})
const model = computed(() => (task.value ? previewModel(task.value) : null))
const visibleDirectories = computed(
  () =>
    model.value?.directories.filter((row) => row.ancestors.every((id) => expanded.value.has(id))) ??
    [],
)
const directory = computed(() => model.value?.byId.get(selectedDirectory.value))
const entries = computed(() =>
  (model.value?.entries ?? []).filter(
    (entry) =>
      selectedDirectory.value === ALL ||
      (selectedDirectory.value === UNCLASSIFIED
        ? entry.unclassified
        : entry.assignments.some(
            (assignment) => assignment.directory_id === selectedDirectory.value,
          )),
  ),
)
const selected = computed(() =>
  entries.value.find((entry) => entry.item.interface_id === selectedInterface.value),
)
const merged = computed(() =>
  task.value && model.value ? mergePreview(task.value, model.value) : null,
)
const visibleCards = computed(() => {
  const ids = new Set(entries.value.map((entry) => entry.item.interface_id))
  return (
    merged.value?.cards.filter((card) =>
      card.members.some((member) => ids.has(member.item.interface_id)),
    ) ?? []
  )
})
const selectedMerge = computed(() => merged.value?.byMember.get(selectedInterface.value))
const unclassifiedCount = computed(
  () => model.value?.entries.filter((entry) => entry.unclassified).length ?? 0,
)
const groupName = computed(() =>
  selectedDirectory.value === ALL
    ? '全部快照接口'
    : selectedDirectory.value === UNCLASSIFIED
      ? '待分类 / 未分配'
      : (directory.value?.name ?? '目录接口'),
)
const issues = computed(() => [
  ...(task.value?.review?.issues ?? []),
  ...(task.value?.review?.warnings ?? []),
])
function count(id: string) {
  return (
    model.value?.entries.filter((entry) =>
      entry.assignments.some((assignment) => assignment.directory_id === id),
    ).length ?? 0
  )
}
function officialUpdated(value: CatalogState) {
  published.value = value.sourceTaskId === task.value?.task_id
}
function unauthorized() {
  if (expired) return
  expired = true
  clearCredential()
  auth.user = null
  auth.requestLogin(route.fullPath, '登录已过期，请重新登录。')
  void router.push('/')
}
</script>

<template>
  <section class="document-workspace catalog-preview">
    <header class="document-workspace-heading">
      <div class="document-project-context">
        <RouterLink
          :to="`/projects/${encodeURIComponent(String(route.params.projectId))}/interfaces`"
          class="document-project-return"
          aria-label="返回接口文档"
          title="返回接口文档"
          ><AppIcon name="arrow-left" :size="18"
        /></RouterLink>
        <div>
          <p class="document-eyebrow">候选目录</p>
          <h1>{{ task?.snapshot.project_name || '项目候选目录' }}</h1>
        </div>
      </div>
      <div class="document-heading-actions">
        <RouterLink
          :to="`/projects/${encodeURIComponent(String(route.params.projectId))}/catalog`"
          class="document-secondary-button"
          >接口目录</RouterLink
        ><span class="catalog-preview-badge">{{
          published ? '当前使用的版本 · 快照预览' : '候选预览，尚未生效'
        }}</span>
      </div>
    </header>

    <div class="catalog-task-toolbar">
      <CatalogChange
        v-if="task"
        :key="`${route.params.projectId}:${auth.user?.id}`"
        :project-id="String(route.params.projectId)"
        :intent="{ kind: 'publish', task_id: task.task_id }"
        label="发布此目录…"
        :disabled="published || task.status !== 'ready' || !!model?.flat || !!merged?.fallback"
        :source="catalogSource"
        @updated="officialUpdated"
        @unauthorized="unauthorized"
      />
      <span class="catalog-task-label">候选任务</span>
      <AppSelect
        :model-value="selectedTaskId"
        :options="taskOptions"
        label="选择候选任务"
        placeholder="选择候选任务"
        :disabled="listBusy || !taskOptions.length"
        @update:model-value="workspace.selectTask"
      />
      <button
        type="button"
        class="document-secondary-button"
        :disabled="listBusy || detailBusy"
        @click="workspace.loadPage(1, true)"
      >
        重新读取
      </button>
      <DocumentPager
        v-if="page"
        :page="page.page"
        :pages="pages"
        :total="page.total"
        :loading="listBusy"
        label="候选任务分页"
        @change="workspace.loadPage($event)"
      />
    </div>

    <div v-if="listBusy" class="document-large-state" role="status">
      <h2>正在读取候选任务</h2>
      <p>优先打开最近可预览的候选。</p>
    </div>
    <div v-else-if="listError" class="document-large-state" role="alert">
      <h2>暂时无法读取任务</h2>
      <p>{{ listError }}</p>
      <button class="document-secondary-button" type="button" @click="workspace.loadPage(1, true)">
        重试
      </button>
    </div>
    <div v-else-if="!page?.total" class="document-large-state">
      <AppIcon name="folder" :size="28" />
      <h2>还没有候选目录</h2>
      <p>候选生成后会出现在这里。此页面仅供查看。</p>
    </div>
    <div v-else-if="detailBusy" class="document-large-state" role="status">
      <h2>正在打开候选快照</h2>
    </div>
    <div v-else-if="detailError" class="document-large-state" role="alert">
      <h2>暂时无法打开候选</h2>
      <p>{{ detailError }}</p>
      <button
        class="document-secondary-button"
        type="button"
        @click="workspace.selectTask(selectedTaskId)"
      >
        重试
      </button>
    </div>
    <template v-else-if="task && model">
      <div class="catalog-preview-body" :key="task.task_id">
        <section class="catalog-task-summary" aria-label="任务状态">
          <div class="catalog-summary-line">
            <strong>{{ statusLabels[task.status] }}</strong
            ><span>快照 {{ formatTime(task.snapshot_at) }}</span
            ><span
              >原始 {{ task.snapshot.interfaces.length }} 条 /
              {{ merged?.groupCount ? '合并后' : '展示' }}
              {{ merged?.cards.length ?? task.snapshot.interfaces.length }} 项</span
            ><span v-if="merged?.groupCount"
              >其中 {{ merged.groupCount }} 个合并组，其他为独立接口</span
            ><span>{{ task.candidate?.nodes.length ?? 0 }} 个候选目录</span
            ><code :title="task.task_id">任务 {{ shortId(task.task_id) }}</code>
          </div>
          <p>这是生成时的项目快照，包含各环境的观测定义；之后新增或变更的接口不在本次快照中。</p>
          <p v-if="task.status === 'pending' || task.status === 'running'" role="status">
            {{
              task.status === 'pending' ? '任务正在等待生成。' : '候选正在生成中。'
            }}可稍后点击“重新读取”，当前仍可查看输入快照。
          </p>
          <p v-if="task.status === 'failed'" role="alert">
            生成失败{{ task.error_code ? `（${task.error_code}）` : '' }}。当前仅展示输入快照。
          </p>
          <p v-if="task.status === 'ready'">
            结构检查通过，仅代表结构有效，不代表分类已经确认或发布。
          </p>
          <p v-if="model.flat" role="alert">
            候选结构未通过检查或链接异常，已安全平铺目录；不按父子关系展开。
          </p>
          <div v-if="merged?.fallback" class="catalog-merge-warning" role="alert">
            <p>合并检查存在问题，已取消折叠并保留全部原始接口。</p>
            <ul>
              <li v-for="problem in merged.problems" :key="problem">{{ problem }}</li>
            </ul>
          </div>
          <details v-if="issues.length" class="catalog-review">
            <summary>查看检查问题与提示（{{ issues.length }}）</summary>
            <ul>
              <li v-for="(issue, index) in issues" :key="index">
                <code>{{ issue.code }}</code
                ><span v-if="issue.subject"> · {{ issue.subject }}</span>
              </li>
            </ul>
          </details>
          <JsonDisclosure
            v-if="(model.flat || merged?.fallback) && task.candidate"
            :value="task.candidate"
            label="查看原始候选结构 JSON"
          />
        </section>

        <div class="catalog-columns">
          <nav class="catalog-directories catalog-panel" aria-label="候选目录">
            <header>
              <h2>候选目录</h2>
              <span>数量为直属接口数</span>
            </header>
            <div class="catalog-panel-scroll">
              <button
                type="button"
                class="catalog-directory-button"
                :aria-current="selectedDirectory === ALL ? 'true' : undefined"
                @click="workspace.selectDirectory(ALL)"
              >
                <AppIcon name="layers" :size="16" /><span>全部快照接口</span
                ><small>{{ task.snapshot.interfaces.length }}</small>
              </button>
              <div
                v-for="row in visibleDirectories"
                :key="row.key"
                class="catalog-directory-row"
                :style="{ paddingLeft: `${Math.min(row.depth, 6) * 14}px` }"
              >
                <button
                  v-if="row.hasChildren"
                  type="button"
                  class="catalog-expand"
                  :aria-label="`${expanded.has(row.node.id) ? '收起' : '展开'}${row.node.name}`"
                  :aria-expanded="expanded.has(row.node.id)"
                  @click="workspace.toggleDirectory(row.node.id)"
                >
                  <AppIcon
                    :name="expanded.has(row.node.id) ? 'chevron-down' : 'chevron-right'"
                    :size="14"
                  /></button
                ><span v-else class="catalog-expand-placeholder" />
                <button
                  type="button"
                  class="catalog-directory-button"
                  :aria-current="selectedDirectory === row.node.id ? 'true' : undefined"
                  :title="row.node.name"
                  @click="workspace.selectDirectory(row.node.id)"
                >
                  <AppIcon name="folder" :size="16" /><span>{{
                    row.node.name || '未命名目录'
                  }}</span
                  ><small>{{ count(row.node.id) }}</small>
                </button>
              </div>
              <button
                type="button"
                class="catalog-directory-button"
                :aria-current="selectedDirectory === UNCLASSIFIED ? 'true' : undefined"
                @click="workspace.selectDirectory(UNCLASSIFIED)"
              >
                <AppIcon name="circle-help" :size="16" /><span>待分类 / 未分配</span
                ><small>{{ unclassifiedCount }}</small>
              </button>
            </div>
          </nav>

          <section class="catalog-interfaces catalog-panel" aria-label="目录内接口">
            <header>
              <h2>
                {{ groupName }}
              </h2>
              <span>原始 {{ entries.length }} 条 / 展示 {{ visibleCards.length }} 项</span>
              <p v-if="directory?.description">{{ directory.description }}</p>
            </header>
            <div :key="`${task.task_id}:${selectedDirectory}`" class="catalog-panel-scroll">
              <p v-if="!entries.length" class="catalog-empty">
                此目录没有直属接口，可展开后选择子目录。
              </p>
              <template v-for="card in visibleCards" :key="card.key">
                <details v-if="card.group" class="catalog-merge-group">
                  <summary>
                    <span class="http-method">{{ card.method }}</span
                    ><code>{{ card.path }}</code
                    ><small>合并组 · {{ card.members.length }} 条原始接口</small>
                  </summary>
                  <p class="catalog-merge-reason">{{ card.group.reason }}</p>
                  <button
                    v-for="member in card.members"
                    :key="member.item.interface_id"
                    type="button"
                    class="catalog-interface-button"
                    :aria-current="
                      selectedInterface === member.item.interface_id ? 'true' : undefined
                    "
                    @click="selectedInterface = member.item.interface_id"
                  >
                    <span class="http-method">{{ member.item.method }}</span
                    ><code>{{ member.item.path }}</code
                    ><small
                      >{{ member.item.environments.length }} 个环境{{
                        member.item.interface_id === card.group.representative_id
                          ? ' · 代表成员'
                          : ''
                      }}</small
                    >
                  </button>
                </details>
                <button
                  v-else
                  type="button"
                  class="catalog-interface-button"
                  :aria-current="
                    selectedInterface === card.members[0]!.item.interface_id ? 'true' : undefined
                  "
                  @click="selectedInterface = card.members[0]!.item.interface_id"
                >
                  <span class="http-method">{{ card.method }}</span
                  ><code>{{ card.path }}</code
                  ><small>{{ card.members[0]!.item.environments.length }} 个环境</small>
                </button>
              </template>
            </div>
          </section>

          <section class="catalog-definition catalog-panel" aria-label="接口分类理由与快照定义">
            <div v-if="!selected" class="catalog-empty">
              选择接口，查看分类理由与各环境的快照定义。
            </div>
            <div
              v-else
              :key="selected.item.interface_id"
              class="catalog-panel-scroll catalog-definition-content"
            >
              <header>
                <span class="http-method">{{ selected.item.method }}</span>
                <h2>
                  <code>{{ selected.item.path }}</code>
                </h2>
              </header>
              <template v-if="selectedMerge"
                ><h3>合并理由</h3>
                <p>
                  <code>{{ selectedMerge.path_template }}</code>
                </p>
                <p>{{ selectedMerge.reason }}</p>
                <p class="catalog-caption">
                  当前选择的是该组中的原始成员，以下定义仅属于此成员，不以代表成员的定义替代。
                </p></template
              >
              <section v-if="selected.item.recognized_path" class="catalog-recognized-path">
                <h3>本次快照的路径识别提示</h3>
                <p>
                  <code>{{ selected.item.recognized_path.template }}</code>
                </p>
                <p class="catalog-caption">机械识别提示，与候选合并组分别展示。</p>
                <ul>
                  <li
                    v-for="parameter in selected.item.recognized_path.parameters"
                    :key="`${parameter.segment_index}:${parameter.name}`"
                  >
                    <code>{{ parameter.name }}</code> · {{ parameter.kind }} · 路径段索引
                    {{ parameter.segment_index }}
                  </li>
                </ul>
              </section>
              <h3>分类理由</h3>
              <p v-if="!selected.assignments.length">
                {{ task.candidate ? '候选未为此接口提供分类。' : '尚未生成候选分类。' }}
              </p>
              <section
                v-for="(assignment, index) in selected.assignments"
                :key="index"
                class="catalog-reason"
              >
                <strong>{{
                  assignment.directory_id
                    ? (model.byId.get(assignment.directory_id)?.name ?? '目录引用不存在')
                    : '待分类'
                }}</strong>
                <p>{{ assignment.reason || '未提供分类理由' }}</p>
              </section>
              <h3>快照中的环境定义</h3>
              <p class="catalog-caption">以下是生成时保存的观测定义，并非实时定义。</p>
              <p v-if="!selected.item.environments.length">快照未包含环境定义。</p>
              <section
                v-for="environment in selected.item.environments"
                :key="environment.environment_id"
                class="catalog-environment"
              >
                <h4>{{ environment.environment_name }}</h4>
                <p class="catalog-caption">
                  版本 <code>{{ environment.revision_id }}</code>
                </p>
                <JsonDisclosure :value="environment.definition" label="展开快照定义 JSON" />
              </section>
            </div>
          </section>
        </div>
      </div>
    </template>
  </section>
</template>
