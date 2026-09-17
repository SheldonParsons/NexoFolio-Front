<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from 'reka-ui'
import AppIcon from '@/components/icons/AppIcon.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import { useAuthStore } from '@/stores/auth'
import { clearCredential } from '@/api/session'
import { documentsAreMock } from '@/features/documents/source'
import { useDocumentWorkspace } from '@/features/documents/useDocumentWorkspace'
import InterfaceList from '@/features/documents/InterfaceList.vue'
import DefinitionView from '@/features/documents/DefinitionView.vue'
import InterfaceSemantics from '@/features/maintenance/InterfaceSemantics.vue'
import ObservationViewer from '@/features/documents/ObservationViewer.vue'
import DocumentPager from '@/features/documents/DocumentPager.vue'
import { formatTime, outcomeLabels, shortId } from '@/features/documents/presentation'
import '@/features/documents/documents.css'
import '@/features/catalog-preview/catalog-preview.css'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
let expired = false
function unauthorized() {
  if (expired) return
  expired = true
  clearCredential()
  auth.user = null
  auth.requestLogin(route.fullPath, '登录已过期，请重新登录。')
  void router.push('/')
}
const workspace = useDocumentWorkspace(
  () => String(route.params.projectId),
  () => {
    if (expired) return
    expired = true
    clearCredential()
    auth.user = null
    auth.requestLogin(route.fullPath, '登录已过期，请重新登录。')
    void router.push('/')
  },
)
const {
  project,
  projectLoading,
  projectError,
  environments,
  environmentId,
  environmentLoading,
  environmentError,
  environmentPage,
  environmentTotal,
  draftQuery,
  queryError,
  list,
  listBusy,
  listError,
  listPages,
  selectedId,
  definition,
  definitionLoading,
  definitionError,
  activeTab,
  observations,
  observationsLoading,
  observationsError,
  observationPages,
  selectedObservationId,
  observation,
  observationLoading,
  observationError,
  observationTab,
} = workspace
const environmentOptions = computed(() =>
  environments.value.map((item) => ({ value: item.id, label: item.name })),
)
const moreEnvironments = computed(() => environments.value.length < environmentTotal.value)
</script>

<template>
  <section class="document-workspace" :class="{ 'has-selection': !!selectedId }">
    <header class="document-workspace-heading">
      <div class="document-project-context">
        <RouterLink
          to="/projects"
          class="document-project-return"
          aria-label="返回项目列表"
          title="返回项目列表"
          ><AppIcon name="arrow-left" :size="18"
        /></RouterLink>
        <div>
          <p class="document-eyebrow">接口文档</p>
          <h1 :title="project?.name">{{ project?.name || '项目接口' }}</h1>
        </div>
        <span v-if="documentsAreMock" class="document-chip document-fixture-label">契约示例</span>
      </div>
      <div class="document-heading-actions">
        <RouterLink
          :to="`/projects/${encodeURIComponent(String(route.params.projectId))}/maintenance`"
          class="document-secondary-button"
          >重构 / 知识维护</RouterLink
        >
        <RouterLink
          :to="`/projects/${encodeURIComponent(String(route.params.projectId))}/catalog`"
          class="document-secondary-button"
          >接口目录</RouterLink
        >
        <RouterLink
          :to="`/projects/${encodeURIComponent(String(route.params.projectId))}/catalog-preview`"
          class="document-catalog-entry"
          ><AppIcon name="network" :size="16" />候选目录</RouterLink
        >
        <div class="document-environment-picker">
          <label>环境 <span aria-hidden="true">·</span> 必选</label>
          <AppSelect
            :model-value="environmentId"
            :options="environmentOptions"
            label="选择项目环境"
            placeholder="选择环境"
            :disabled="
              !project || (environmentLoading && !environments.length) || !environments.length
            "
            @update:model-value="workspace.selectEnvironment"
          />
          <span v-if="environmentLoading" class="document-environment-state" role="status"
            >读取环境中…</span
          >
          <button
            v-else-if="moreEnvironments"
            type="button"
            class="document-text-button"
            @click="workspace.loadEnvironments(environmentPage + 1)"
          >
            更多环境（{{ environments.length }}/{{ environmentTotal }}）
          </button>
        </div>
      </div>
    </header>

    <div v-if="projectLoading && !project" class="document-large-state" role="status">
      <AppIcon name="layers" :size="32" />
      <h2>正在打开项目</h2>
      <p>读取项目及环境信息…</p>
    </div>
    <div v-else-if="projectError" class="document-large-state" role="alert">
      <AppIcon name="lock" :size="32" />
      <h2>暂时无法打开项目</h2>
      <p>{{ projectError }}</p>
      <button type="button" class="document-secondary-button" @click="workspace.loadProject">
        重新读取项目
      </button>
    </div>
    <template v-else-if="project">
      <div v-if="environmentError" class="document-notice" role="alert">
        <span>{{ environmentError }}</span
        ><button
          type="button"
          class="document-text-button"
          @click="workspace.loadEnvironments(environmentPage ? environmentPage + 1 : 1)"
        >
          重新读取环境
        </button>
      </div>
      <div v-else-if="!environmentLoading && !environments.length" class="document-notice">
        <span>项目还没有环境。环境创建或同步后，可重新读取。</span
        ><button type="button" class="document-text-button" @click="workspace.loadEnvironments()">
          重新读取环境
        </button>
      </div>
      <div class="documents-board">
        <InterfaceList
          :page="list"
          :loading="listBusy"
          :error="listError"
          :selected-id="selectedId"
          :environment-id="environmentId"
          :query="draftQuery"
          :query-error="queryError"
          :pages="listPages"
          @select="workspace.selectInterface"
          @query="workspace.changeQuery"
          @submit="workspace.submitQuery"
          @clear="workspace.clearQuery"
          @composition-start="workspace.compositionStart"
          @composition-end="workspace.compositionEnd"
          @page="workspace.loadList"
          @retry="workspace.loadList(list?.page || 1)"
        />
        <section
          id="document-detail"
          class="document-detail"
          aria-label="接口定义与调用样例"
          :aria-busy="definitionLoading"
        >
          <button
            v-if="selectedId"
            class="document-mobile-back"
            type="button"
            @click="workspace.deselectInterface"
          >
            <AppIcon name="arrow-left" :size="16" />接口列表
          </button>
          <div v-if="!selectedId" class="document-large-state document-selection-state">
            <span class="document-empty-symbol"
              ><AppIcon :name="environmentId ? 'code' : 'layers'" :size="36"
            /></span>
            <p class="document-eyebrow">OBSERVED KNOWLEDGE</p>
            <h2>{{ environmentId ? '从一个接口开始' : '先选择项目环境' }}</h2>
            <p>
              {{
                environmentId
                  ? '选择左侧接口，查看该环境的当前观测定义与调用样例。'
                  : '不同环境分别保存自己的观测基线。选择环境后，接口会显示在左侧。'
              }}
            </p>
          </div>
          <div v-else-if="definitionLoading" class="document-large-state" role="status">
            <AppIcon name="code" :size="28" />
            <h2>正在读取当前定义</h2>
          </div>
          <div v-else-if="definitionError" class="document-large-state" role="alert">
            <h2>暂时无法读取接口</h2>
            <p>{{ definitionError }}</p>
            <button
              class="document-secondary-button"
              type="button"
              @click="workspace.loadDefinition"
            >
              重新读取定义
            </button>
          </div>
          <template v-else-if="definition">
            <header class="document-definition-heading">
              <div class="document-definition-title">
                <span
                  class="http-method http-method--large"
                  :class="{ 'http-method--write': definition.method !== 'GET' }"
                  >{{ definition.method }}</span
                >
                <h2>
                  <code>{{ definition.path }}</code>
                </h2>
              </div>
              <div class="document-definition-meta">
                <span class="document-chip">观测所得</span
                ><span class="document-chip">{{
                  definition.classification === 'classified' ? '已分类' : '待分类'
                }}</span
                ><span>{{ definition.environment.name }}</span
                ><button
                  v-if="definition.pending_difference_count"
                  type="button"
                  class="document-difference-link"
                  @click="workspace.setTab('observations')"
                >
                  {{ definition.pending_difference_count }} 条待处理差异
                  <AppIcon name="arrow-right" :size="13" />
                </button>
              </div>
              <dl class="document-inline-provenance">
                <div>
                  <dt>观测版本</dt>
                  <dd>
                    <code :title="definition.revision_id">{{
                      shortId(definition.revision_id)
                    }}</code>
                  </dd>
                </div>
                <div>
                  <dt>建档时间</dt>
                  <dd>
                    <time :datetime="definition.created_at" :title="definition.created_at">{{
                      formatTime(definition.created_at)
                    }}</time>
                  </dd>
                </div>
              </dl>
            </header>
            <TabsRoot
              class="document-content-tabs"
              :model-value="activeTab"
              @update:model-value="workspace.setTab"
            >
              <TabsList class="document-tabs" aria-label="接口内容"
                ><TabsTrigger value="definition" class="document-tab">当前定义</TabsTrigger
                ><TabsTrigger value="observations" class="document-tab">调用样例与差异</TabsTrigger
                ><button class="document-origin-link" type="button" @click="workspace.readOrigin">
                  <AppIcon name="code" :size="15" />查看源样例
                </button></TabsList
              >
              <TabsContent
                value="definition"
                class="document-scroll document-tab-panel"
                data-scroll-container
                data-scroll-restoration="managed"
                ><DefinitionView :definition="definition.definition" /><InterfaceSemantics
                  v-if="!documentsAreMock"
                  :project-id="definition.project_id"
                  :interface-id="definition.interface_id"
                  :environment-id="definition.environment.id"
                  :revision-id="definition.revision_id"
                  @unauthorized="unauthorized"
              /></TabsContent>
              <TabsContent
                value="observations"
                class="document-scroll document-tab-panel"
                data-scroll-container
                data-scroll-restoration="managed"
              >
                <header class="observations-heading">
                  <div>
                    <h3>调用样例</h3>
                    <p>列表仅展示处理摘要，选择记录后读取原文或差异。</p>
                  </div>
                  <span v-if="observations" class="document-count">{{ observations.total }}</span>
                </header>
                <p
                  v-if="observationsLoading && !observations"
                  class="document-empty-inline"
                  role="status"
                >
                  正在读取样例摘要…
                </p>
                <div v-else-if="observationsError" class="document-notice" role="alert">
                  <span>{{ observationsError }}</span
                  ><button
                    type="button"
                    class="document-text-button"
                    @click="workspace.loadObservations(observations?.page || 1)"
                  >
                    重新读取摘要
                  </button>
                </div>
                <template v-else-if="observations">
                  <div
                    v-if="observations.items.length"
                    class="observation-list"
                    :aria-busy="observationsLoading"
                  >
                    <button
                      v-for="item in observations.items"
                      :key="item.ingestion_id"
                      class="observation-list-item"
                      type="button"
                      :class="{ 'is-selected': selectedObservationId === item.ingestion_id }"
                      :disabled="observationsLoading"
                      :aria-label="`${outcomeLabels[item.outcome]}，${formatTime(item.processed_at)}`"
                      @click="
                        workspace.selectObservation(
                          item.ingestion_id,
                          item.outcome === 'difference_recorded',
                        )
                      "
                    >
                      <span
                        ><strong>{{ outcomeLabels[item.outcome] }}</strong
                        ><code :title="item.ingestion_id">{{
                          shortId(item.ingestion_id)
                        }}</code></span
                      ><time :datetime="item.processed_at">{{ formatTime(item.processed_at) }}</time
                      ><AppIcon name="chevron-right" :size="16" />
                    </button>
                  </div>
                  <p v-else class="document-empty-inline">暂无已处理的样例摘要。</p>
                  <DocumentPager
                    :page="observations.page"
                    :pages="observationPages"
                    :total="observations.total"
                    :loading="observationsLoading"
                    label="样例分页"
                    @change="workspace.loadObservations"
                  />
                </template>
                <div v-if="observationLoading" class="document-sample-loading" role="status">
                  正在按需读取观测记录…
                </div>
                <div v-else-if="observationError" class="document-notice" role="alert">
                  <span>{{ observationError }}</span
                  ><button
                    class="document-text-button"
                    type="button"
                    @click="workspace.refreshObservation"
                  >
                    重新读取样例
                  </button>
                </div>
                <ObservationViewer
                  v-else-if="observation"
                  v-model:view="observationTab"
                  :record="observation"
                  :baseline="definition"
                  @close="workspace.closeObservation"
                  @refresh="workspace.refreshObservation"
                />
                <p v-else-if="!selectedObservationId" class="document-observed-note">
                  选择上方记录查看原文。待处理差异不会改变当前定义。
                </p>
              </TabsContent>
            </TabsRoot>
          </template>
        </section>
      </div>
    </template>
  </section>
</template>
