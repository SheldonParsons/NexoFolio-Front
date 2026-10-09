<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'reka-ui'
import AppButton from '@/components/ui/AppButton.vue'
import AppDateTimePicker from '@/components/ui/AppDateTimePicker.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import { credentialInput, newCredentialDraft } from './model'
import type { CreateCredential, CreatedCredential } from './source'
import '@/components/motion/modal.css'

const props = defineProps<{ pending: boolean; created: CreatedCredential | null; error: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ create: [input: CreateCredential]; dismiss: [] }>()
const draft = ref(newCredentialDraft()),
  validation = ref(''),
  copyMessage = ref('')
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
watch(
  open,
  (value) => {
    validation.value = ''
    copyMessage.value = ''
    draft.value = newCredentialDraft()
    if (!value) emit('dismiss')
  },
  { flush: 'sync' },
)
function submit() {
  if (props.pending || props.created) return
  validation.value = ''
  try {
    emit('create', credentialInput(draft.value))
  } catch (error) {
    validation.value = error instanceof Error ? error.message : '请检查输入。'
  }
}
function preventClose(event: Event) {
  if (props.pending || props.created) event.preventDefault()
}
function restoreFocus(event: Event) {
  event.preventDefault()
  ;(
    document.getElementById('create-mcp-credential') ?? document.getElementById('main-content')
  )?.focus({ preventScroll: true })
}
async function copy() {
  const current = props.created
  if (!current) return
  let message: string
  try {
    await navigator.clipboard.writeText(current.token)
    message = '已复制'
  } catch {
    message = '复制失败，请选中上方 token 手动复制。'
  }
  if (open.value && props.created === current) copyMessage.value = message
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="dialog-overlay" />
      <DialogContent
        class="dialog-content mcp-create-dialog t-modal"
        @escape-key-down="preventClose"
        @interact-outside="preventClose"
        @close-auto-focus="restoreFocus"
      >
        <div class="dialog-heading">
          <div>
            <DialogTitle class="dialog-title">{{
              created ? '凭证已创建' : '创建 MCP 凭证'
            }}</DialogTitle>
            <DialogDescription class="dialog-description">{{
              created
                ? '完整 token 仅在此展示一次，请复制并妥善保存。'
                : '为你的客户端创建独立凭证，访问账号有权限的所有项目。'
            }}</DialogDescription>
          </div>
          <DialogClose
            v-if="!created"
            class="icon-button"
            :disabled="pending"
            aria-label="关闭创建窗口"
            ><AppIcon name="x" :size="18"
          /></DialogClose>
        </div>
        <div v-if="created" class="mcp-created" aria-live="polite">
          <p>
            <strong>{{ created.credential.name }}</strong>
          </p>
          <label for="new-mcp-token">MCP token</label>
          <textarea
            id="new-mcp-token"
            :value="created.token"
            readonly
            rows="3"
            spellcheck="false"
            autocomplete="off"
          />
          <p class="mcp-help">
            将它用于 MCP 客户端的 Bearer 鉴权。关闭后无法再次查看，丢失时请撤销并新建。
          </p>
          <p v-if="copyMessage" class="mcp-help" role="status">{{ copyMessage }}</p>
          <div class="mcp-dialog-actions">
            <AppButton @click="copy">复制 token</AppButton>
            <DialogClose as-child
              ><AppButton variant="primary" :disabled="pending"
                >我已保存，关闭</AppButton
              ></DialogClose
            >
          </div>
        </div>
        <form v-else class="mcp-create-form" @submit.prevent="submit">
          <fieldset :disabled="pending">
            <label for="mcp-name">凭证名称</label>
            <input
              id="mcp-name"
              v-model="draft.name"
              required
              placeholder="例如：我的开发客户端"
              autocomplete="off"
            />
            <p class="mcp-help">用名称区分不同设备或客户端，最多 64 字。</p>
            <fieldset class="mcp-validity-options">
              <legend>有效期</legend>
              <label
                ><input
                  v-model="draft.validity"
                  type="radio"
                  name="mcp-validity"
                  value="range"
                />自选时间区间</label
              >
              <label
                ><input
                  v-model="draft.validity"
                  type="radio"
                  name="mcp-validity"
                  value="unlimited"
                />无限期</label
              >
            </fieldset>
            <div v-if="draft.validity === 'range'" class="mcp-date-range">
              <AppDateTimePicker
                id="mcp-starts-at"
                v-model="draft.startsAt"
                label="开始时间"
                :disabled="pending"
              />
              <AppDateTimePicker
                id="mcp-expires-at"
                v-model="draft.expiresAt"
                label="结束时间"
                :disabled="pending"
              />
            </div>
            <p class="mcp-help">
              {{
                draft.validity === 'range'
                  ? `按设备时区 ${timezone} 保存。到期后自动失效。`
                  : '创建后立即生效，直到你手动撤销。'
              }}
            </p>
          </fieldset>
          <p v-if="validation || error" class="mcp-error" role="alert">{{ validation || error }}</p>
          <div class="mcp-dialog-actions">
            <DialogClose as-child><AppButton :disabled="pending">取消</AppButton></DialogClose>
            <AppButton type="submit" variant="primary" :disabled="pending">{{
              pending ? '正在创建…' : '创建凭证'
            }}</AppButton>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
