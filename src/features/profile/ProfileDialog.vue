<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'reka-ui'
import AppIcon from '@/components/icons/AppIcon.vue'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import { usePersonalProfile } from './usePersonalProfile'
import AvatarEditor from './AvatarEditor.vue'
import { formatTime } from '@/features/documents/presentation'
import '@/components/motion/modal.css'
import './profile.css'
const open = defineModel<boolean>('open', { default: false })
const state = usePersonalProfile()
const mode = ref<'view' | 'edit' | 'avatar'>('view'),
  name = ref(''),
  bio = ref(''),
  saved = ref(false)
watch(open, async (value) => {
  if (!value) return
  mode.value = 'view'
  saved.value = false
  await state.load()
  fill()
})
function fill() {
  name.value = state.profile?.display_name_override ?? ''
  bio.value = state.profile?.bio ?? ''
}
function avatar() {
  mode.value = 'avatar'
  state.error = ''
}
function edit() {
  fill()
  mode.value = 'edit'
  saved.value = false
  state.error = ''
}
async function saveText() {
  if (await state.saveText(name.value || null, bio.value)) {
    mode.value = 'view'
    saved.value = true
  }
}
async function saveAvatar(url: string) {
  if (await state.saveAvatar(url)) {
    mode.value = 'view'
    saved.value = true
  }
}
const title = computed(() =>
  mode.value === 'avatar' ? '调整您的图片' : mode.value === 'edit' ? '编辑你的资料' : '你的资料',
)
function preventClose(event: Event) {
  if (state.saving) event.preventDefault()
}
</script>
<template>
  <DialogRoot v-model:open="open"
    ><DialogPortal
      ><DialogOverlay class="dialog-overlay" /><DialogContent
        class="profile-dialog t-modal"
        :class="{ 'is-avatar': mode === 'avatar' }"
        @escape-key-down="preventClose"
        @interact-outside="preventClose"
        ><header class="profile-dialog-heading">
          <div>
            <DialogTitle>{{ title }}</DialogTitle
            ><DialogDescription :class="{ 'sr-only': mode === 'avatar' }">{{
              mode === 'avatar'
                ? '拖动图片调整位置，用滑杆缩放，然后保存头像。也可以使用方向键移动图片。'
                : '你的 NexoFolio 身份与个人展示。'
            }}</DialogDescription>
          </div>
          <DialogClose :disabled="state.saving" class="profile-close" aria-label="关闭个人资料"
            ><AppIcon name="x" :size="17"
          /></DialogClose>
        </header>
        <div class="profile-dialog-body">
          <p v-if="state.loading && !state.profile" class="profile-loading">正在读取个人资料…</p>
          <template v-else-if="state.profile"
            ><AvatarEditor
              v-if="mode === 'avatar'"
              :saving="state.saving"
              @save="saveAvatar"
              @cancel="mode = 'view'"
            />
            <div v-else class="profile-layout">
              <aside class="profile-identity-card">
                <BrandLogo variant="icon" class="profile-watermark" />
                <div class="profile-large-avatar">
                  <img
                    v-if="state.profile.user.avatar_url"
                    :src="state.profile.user.avatar_url"
                    alt="你的头像"
                  /><span v-else>{{ state.profile.user.display_name.slice(0, 1) || 'N' }}</span>
                </div>
                <h3>{{ state.profile.user.display_name }}</h3>
                <p>@{{ state.profile.user.account }}</p>
                <button type="button" :disabled="state.saving" @click="avatar">
                  修改头像<AppIcon name="arrow-up-right" :size="12" /></button
                ><button
                  v-if="state.profile.user.avatar_url"
                  type="button"
                  class="profile-reset-avatar"
                  :disabled="state.saving"
                  @click="state.saveAvatar(null)"
                >
                  恢复默认头像
                </button>
              </aside>
              <section v-if="mode === 'view'" class="profile-information">
                <dl>
                  <div>
                    <dt>登录账号</dt>
                    <dd>{{ state.profile.user.account }}<small>来自禅道</small></dd>
                  </div>
                  <div>
                    <dt>账号姓名</dt>
                    <dd>{{ state.profile.account_display_name }}</dd>
                  </div>
                  <div>
                    <dt>个人简介</dt>
                    <dd>{{ state.profile.bio || '还没有写下简介。' }}</dd>
                  </div>
                  <div>
                    <dt>加入 NexoFolio</dt>
                    <dd>{{ formatTime(state.profile.created_at) }}</dd>
                  </div>
                  <div>
                    <dt>最近登录</dt>
                    <dd>{{ formatTime(state.profile.last_login_at) }}</dd>
                  </div>
                </dl>
                <p v-if="saved" class="profile-saved" role="status">
                  <AppIcon name="check" :size="13" />资料已更新
                </p>
                <footer class="profile-actions">
                  <button type="button" class="profile-primary" @click="edit">
                    编辑资料<AppIcon name="arrow-right" :size="13" />
                  </button>
                </footer>
              </section>
              <form v-else class="profile-edit-form" @submit.prevent="saveText">
                <label
                  >显示名称<input
                    v-model="name"
                    maxlength="40"
                    :placeholder="state.profile.account_display_name"
                    :disabled="state.saving"
                  /><small>留空时使用账号姓名，最多 40 字。</small></label
                ><label
                  >个人简介<textarea
                    v-model="bio"
                    maxlength="160"
                    rows="4"
                    :disabled="state.saving"
                    placeholder="留下一句关于你的介绍。"
                  ></textarea
                  ><small>{{ bio.length }} / 160</small></label
                >
                <p class="profile-edit-note">
                  保存在 NexoFolio。登录账号、账号状态及项目权限由账号系统管理。
                </p>
                <footer class="profile-actions">
                  <button
                    type="button"
                    class="profile-secondary"
                    :disabled="state.saving"
                    @click="mode = 'view'"
                  >
                    取消编辑</button
                  ><button type="submit" class="profile-primary" :disabled="state.saving">
                    {{ state.saving ? '保存中…' : '保存资料' }}
                  </button>
                </footer>
              </form>
            </div></template
          >
          <p v-if="state.error" class="profile-error" role="alert">
            {{ state.error
            }}<button v-if="!state.profile" type="button" @click="state.load(true)">
              重新读取
            </button>
          </p>
        </div></DialogContent
      ></DialogPortal
    ></DialogRoot
  >
</template>
