<script setup lang="ts">
import { RouterLink } from 'vue-router'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
} from 'reka-ui'
import AppIcon from '@/components/icons/AppIcon.vue'
import type { ManagementProject } from './projects'
import { statusLabels } from '@/features/projects/types'
defineProps<{ project: ManagementProject }>()
const emit = defineEmits<{
  edit: [project: ManagementProject]
  clear: [project: ManagementProject]
}>()
</script>
<template>
  <tr>
    <td>
      <RouterLink class="management-project-name" :to="`/projects/${project.project_id}/interfaces`"
        ><AppIcon name="folder" :size="17" />{{ project.name }}</RouterLink
      ><span class="management-caption">{{
        project.origin === 'local' ? '独立创建' : '禅道同步'
      }}</span>
    </td>
    <td class="management-bindings">
      <template v-if="project.origin === 'local'"
        ><span v-for="source in project.permission_sources" :key="source.project_id">{{
          source.name
        }}</span></template
      ><span v-else>由禅道维护</span>
    </td>
    <td class="management-status">{{ statusLabels[project.status] || project.status }}</td>
    <td>
      <div class="management-row-actions">
        <button
          v-if="project.origin === 'local'"
          type="button"
          class="management-edit"
          @click="emit('edit', project)"
        >
          编辑项目
        </button>
        <DropdownMenuRoot
          ><DropdownMenuTrigger as-child
            ><button type="button" class="management-more" :aria-label="`管理${project.name}`">
              <AppIcon name="more-horizontal" :size="18" /></button
          ></DropdownMenuTrigger>
          <DropdownMenuPortal
            ><DropdownMenuContent
              class="project-management-menu"
              align="end"
              :side-offset="6"
              :collision-padding="12"
            >
              <DropdownMenuItem as-child
                ><RouterLink
                  class="project-management-menu-item"
                  :to="`/projects/${project.project_id}/interfaces`"
                  >打开项目文档</RouterLink
                ></DropdownMenuItem
              >
              <DropdownMenuItem
                class="project-management-menu-item"
                @select="emit('clear', project)"
                >清空项目内容</DropdownMenuItem
              >
            </DropdownMenuContent></DropdownMenuPortal
          >
        </DropdownMenuRoot>
      </div>
    </td>
  </tr>
</template>
