<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from 'reka-ui'
import { useAuthStore } from '@/stores/auth'
import { usePersonalProfile } from './usePersonalProfile'
import ProfileDialog from './ProfileDialog.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import './profile.css'
const auth = useAuthStore(),
  profile = usePersonalProfile(),
  router = useRouter(),
  route = useRoute()
const menuOpen = ref(false),
  dialogOpen = ref(false)
onMounted(() => void profile.load())
const emit = defineEmits<{ logout: [] }>()
function show() {
  dialogOpen.value = true
  void profile.load()
}
watch(
  () => route.fullPath,
  () => (menuOpen.value = false),
)
</script>
<template>
  <DropdownMenuRoot v-model:open="menuOpen"
    ><DropdownMenuTrigger
      class="profile-menu-trigger"
      :title="auth.displayName"
      aria-label="打开个人菜单"
      ><span class="profile-avatar-mini"
        ><img v-if="auth.user?.avatar_url" :src="auth.user.avatar_url" alt="" /><span v-else>{{
          auth.displayName.slice(0, 1) || 'N'
        }}</span></span
      ><span class="profile-menu-name">{{ auth.displayName }}</span
      ><AppIcon name="chevron-down" :size="12" /></DropdownMenuTrigger
    ><DropdownMenuPortal
      ><DropdownMenuContent class="profile-menu-content" :side-offset="9" align="end"
        ><div class="profile-menu-identity">
          <span class="profile-avatar-mini"
            ><img v-if="auth.user?.avatar_url" :src="auth.user.avatar_url" alt="" /><span v-else>{{
              auth.displayName.slice(0, 1) || 'N'
            }}</span></span
          >
          <div>
            <strong>{{ auth.displayName }}</strong
            ><small>@{{ auth.user?.account }}</small>
          </div>
        </div>
        <DropdownMenuSeparator class="profile-menu-separator" /><DropdownMenuItem
          class="profile-menu-item"
          @select="show"
          ><AppIcon name="user-round" :size="15" /><span
            >个人资料<small>查看与编辑你的展示信息</small></span
          ></DropdownMenuItem
        ><DropdownMenuItem class="profile-menu-item" @select="router.push('/settings')"
          ><AppIcon name="settings" :size="15" /><span>偏好设置</span></DropdownMenuItem
        ><DropdownMenuItem class="profile-menu-item" @select="router.push('/settings/mcp')"
          ><AppIcon name="lock" :size="15" /><span
            >MCP 凭证<small>管理当前账号的访问凭证</small></span
          ></DropdownMenuItem
        ><DropdownMenuSeparator class="profile-menu-separator" /><DropdownMenuItem
          class="profile-menu-item"
          @select="emit('logout')"
          ><AppIcon name="log-out" :size="15" /><span>退出登录</span></DropdownMenuItem
        ></DropdownMenuContent
      ></DropdownMenuPortal
    ></DropdownMenuRoot
  ><ProfileDialog v-model:open="dialogOpen" />
</template>
