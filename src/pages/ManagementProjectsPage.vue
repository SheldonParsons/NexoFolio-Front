<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import ProjectEditorDialog from '@/features/projects/management/ProjectEditorDialog.vue'
import ClearProjectDialog from '@/features/projects/management/ClearProjectDialog.vue'
import ManagementProjectRow from '@/features/management/ManagementProjectRow.vue'
import { useManagementProjects } from '@/features/management/useManagementProjects'
import type { ManagementProject } from '@/features/management/projects'
import type { ManagedProject } from '@/features/projects/management/api'
import { useAuthStore } from '@/stores/auth'
import '@/features/projects/management/management.css'
import '@/features/management/management.css'
const auth = useAuthStore()
const { query, origin, page, data, loading, error, load, changePage } = useManagementProjects()
const editorOpen = ref(false),
  target = ref<ManagementProject | null>(null),
  clearTarget = ref<ManagementProject | null>(null)
const notice = ref(''),
  savedId = ref('')
function changeOrigin(value: string) {
  origin.value = value === 'all' ? '' : value
  void load(true)
}
function edit(project: ManagementProject | null) {
  target.value = project
  editorOpen.value = true
}
function saved(project: ManagedProject, editing: boolean) {
  notice.value = editing
    ? `已更新“${project.name}”，项目内的资料和配置已保留。`
    : `已创建“${project.name}”，已绑定 ${project.permission_sources.length} 个禅道项目。`
  savedId.value = project.project_id
  void load()
}
function cleared(project: { name: string }) {
  notice.value = `已清空“${project.name}”的内容，项目及配置已保留。`
  savedId.value = ''
}
</script>
<template>
  <section class="management-panel" aria-label="项目管理" data-scroll-container>
    <header class="management-heading">
      <div>
        <p class="management-eyebrow">管理中心 / 项目管理</p>
        <h1>项目管理</h1>
        <p>管理独立项目与禅道权限来源，维护项目内容。</p>
      </div>
      <AppButton variant="primary" @click="edit(null)">创建项目</AppButton>
    </header>
    <p v-if="notice" class="management-notice" role="status">
      {{ notice }}
      <RouterLink v-if="savedId" :to="`/projects/${savedId}/interfaces`">打开项目文档</RouterLink>
    </p>
    <form class="management-toolbar" @submit.prevent="load(true)">
      <label class="management-search"
        ><span class="sr-only">搜索全部可管理项目</span
        ><input
          v-model="query"
          type="search"
          placeholder="搜索全部可管理项目"
          maxlength="100" /></label
      ><label
        ><span class="sr-only">项目来源</span
        ><AppSelect
          :model-value="origin || 'all'"
          label="项目来源"
          :options="[
            { value: 'all', label: '全部来源' },
            { value: 'local', label: '独立创建' },
            { value: 'zentao', label: '禅道同步' },
          ]"
          @update:model-value="changeOrigin" /></label
      ><AppButton type="submit" :disabled="loading">查询</AppButton
      ><span v-if="data" class="management-total">共 {{ data.total }} 个项目</span>
    </form>
    <div v-if="error" role="alert" class="management-empty">
      {{ error }} <AppButton @click="load()">重试</AppButton>
    </div>
    <p v-else-if="loading" role="status" class="management-empty">正在加载项目…</p>
    <template v-else-if="data">
      <div v-if="data.items.length" class="management-table-wrap">
        <table class="management-table">
          <thead>
            <tr>
              <th>项目</th>
              <th>禅道权限来源</th>
              <th>状态</th>
              <th><span class="sr-only">操作</span></th>
            </tr>
          </thead>
          <tbody>
            <ManagementProjectRow
              v-for="project in data.items"
              :key="project.project_id"
              :project="project"
              @edit="edit"
              @clear="clearTarget = $event"
            />
          </tbody>
        </table>
      </div>
      <p v-else class="management-empty">没有符合条件的项目。</p>
      <footer class="management-pagination">
        <span
          >第 {{ page }} / {{ Math.max(1, Math.ceil(data.total / data.limit)) }} 页 · 每页
          {{ data.limit }} 个</span
        ><AppButton :disabled="page <= 1" @click="changePage(page - 1)">上一页</AppButton
        ><AppButton :disabled="page * data.limit >= data.total" @click="changePage(page + 1)"
          >下一页</AppButton
        >
      </footer>
    </template>
    <ProjectEditorDialog
      v-model:open="editorOpen"
      :project="target"
      @saved="saved"
      @unavailable="auth.revokeManagement"
    />
    <ClearProjectDialog
      :project="clearTarget"
      @close="clearTarget = null"
      @cleared="cleared"
      @unavailable="auth.revokeManagement"
    />
  </section>
</template>
