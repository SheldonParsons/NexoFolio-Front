<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppDialog from '@/components/ui/AppDialog.vue'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import { useAuthStore } from '@/stores/auth'
import { authErrorMessage, login } from '@/api/auth'
import { saveCredential } from '@/api/session'
import {
  readRememberedCredentials,
  setRememberPreference,
  rememberSuccessfulLogin,
  credentialPreferenceRevision,
} from './rememberedCredentials'

const auth = useAuthStore()
const router = useRouter()
const account = ref('')
const password = ref('')
const showPassword = ref(false)
const remember = ref(true)
const preferenceError = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const accountInput = ref<HTMLInputElement | null>(null)
let controller: AbortController | undefined
let generation = 0
let returnFocus: HTMLElement | null = null

function cancel() {
  generation++
  controller?.abort()
  controller = undefined
  submitting.value = false
  password.value = ''
  showPassword.value = false
}
watch(
  () => auth.loginOpen,
  (open) => {
    cancel()
    if (open) {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
      errorMessage.value = auth.entryError
      preferenceError.value = ''
      try {
        const saved = readRememberedCredentials()
        remember.value = saved.enabled
        account.value = saved.account
        password.value = saved.password
      } catch {
        remember.value = false
        preferenceError.value = '无法读取已记住的信息，可手动输入账号和密码。'
      }
    } else errorMessage.value = ''
  },
  { immediate: true },
)
onBeforeUnmount(cancel)
function focusDialog(event: Event) {
  event.preventDefault()
  accountInput.value?.closest<HTMLElement>('[role="dialog"]')?.focus({ preventScroll: true })
}
function restoreFocus(event: Event) {
  event.preventDefault()
  if (auth.arrival) {
    document.querySelector<HTMLElement>('.login-success-overlay')?.focus({ preventScroll: true })
    return
  }
  if (returnFocus?.isConnected) returnFocus.focus()
}

function changeRemember(event: Event) {
  const enabled = (event.target as HTMLInputElement).checked
  preferenceError.value = ''
  try {
    setRememberPreference(enabled)
    remember.value = enabled
  } catch {
    ;(event.target as HTMLInputElement).checked = remember.value
    preferenceError.value = enabled
      ? '无法保存记住密码设置，请检查浏览器存储权限。'
      : '无法清除记住的密码，请检查浏览器存储权限后重试。'
  }
}

async function submit() {
  if (submitting.value) return
  errorMessage.value = ''
  const name = account.value.trim()
  if (!name || !password.value) {
    errorMessage.value = '请输入账号和密码。'
    return
  }
  const encoder = new TextEncoder()
  if (encoder.encode(name).length > 128 || encoder.encode(password.value).length > 1024) {
    errorMessage.value = '账号或密码长度超出限制。'
    return
  }
  const current = ++generation
  let preferenceRevision: string | null = null
  try {
    preferenceRevision = credentialPreferenceRevision()
  } catch {
    /* Storage may be unavailable. */
  }
  controller = new AbortController()
  submitting.value = true
  try {
    const result = await login(name, password.value, controller.signal)
    if (current !== generation || !auth.loginOpen) return
    saveCredential({ token: result.token, expiresAt: result.expires_at })
    auth.user = result.user
    auth.notice = ''
    try {
      rememberSuccessfulLogin(name, password.value, remember.value, preferenceRevision)
    } catch {
      auth.notice = '已登录，但浏览器未能保存记住密码设置。'
    }
    const target = auth.destination
    auth.beginArrival()
    auth.loginOpen = false
    password.value = ''
    await router.push(target)
  } catch (error) {
    if (current !== generation || controller?.signal.aborted) return
    errorMessage.value = authErrorMessage(error, true)
  } finally {
    if (current === generation) submitting.value = false
  }
}
</script>

<template>
  <AppDialog
    v-model:open="auth.loginOpen"
    title="登录 NexoFolio"
    description="使用你的禅道账号，进入知识工作空间。"
    tone="dark"
    @open-auto-focus="focusDialog"
    @close-auto-focus="restoreFocus"
  >
    <div class="login-brand"><BrandLogo tone="light" /></div>
    <form class="login-form" @submit.prevent="submit">
      <div class="login-field">
        <label for="nexo-account">账号</label
        ><input
          id="nexo-account"
          ref="accountInput"
          v-model="account"
          name="username"
          autocomplete="username"
          autocapitalize="none"
          spellcheck="false"
          placeholder="请输入禅道账号"
          :disabled="submitting"
          required
          :aria-invalid="!!errorMessage"
          :aria-describedby="errorMessage ? 'login-error' : undefined"
        />
      </div>
      <div class="login-field">
        <label for="nexo-password">密码</label>
        <div class="password-field">
          <input
            id="nexo-password"
            v-model="password"
            name="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            placeholder="请输入密码"
            :disabled="submitting"
            required
            :aria-invalid="!!errorMessage"
            :aria-describedby="errorMessage ? 'login-error' : undefined"
          /><button
            type="button"
            class="password-toggle"
            :aria-pressed="showPassword"
            :aria-label="showPassword ? '隐藏密码' : '显示密码'"
            @click="showPassword = !showPassword"
          >
            {{ showPassword ? '隐藏' : '显示' }}
          </button>
        </div>
      </div>
      <div class="remember-row">
        <label
          ><input
            type="checkbox"
            :checked="remember"
            :disabled="submitting"
            @change="changeRemember"
          />记住账号和密码</label
        >
        <span>仅保存在当前浏览器</span>
      </div>
      <p v-if="preferenceError" class="login-error" role="alert">{{ preferenceError }}</p>
      <p v-if="errorMessage" id="login-error" class="login-error" role="alert">
        {{ errorMessage }}
      </p>
      <button class="login-submit" type="submit" :disabled="submitting" :aria-busy="submitting">
        {{ submitting ? '正在登录…' : '登录并进入'
        }}<AppIcon v-if="!submitting" name="arrow-right" :size="17" />
      </button>
      <p class="login-footnote">使用已有账号登录，无需重复注册。</p>
    </form>
  </AppDialog>
</template>

<style scoped>
.login-brand {
  padding: 2px 0 27px;
}
.login-form {
  display: grid;
  gap: 19px;
}
.login-field {
  display: grid;
  gap: 8px;
}
.login-field label {
  font-size: 12px;
  color: #c7c7c7;
}
.login-field input {
  width: 100%;
  height: 46px;
  padding: 0 13px;
  background: #161616;
  border: 1px solid #333;
  border-radius: 7px;
  color: #eee;
  font-size: 13px;
  outline-offset: 3px;
}
.login-field input::placeholder {
  color: #777;
}
.login-field input:focus {
  border-color: #999;
}
.login-field input:disabled {
  opacity: 0.6;
}
.password-field {
  position: relative;
}
.password-field input {
  padding-right: 60px;
}
.password-toggle {
  position: absolute;
  right: 3px;
  top: 1px;
  min-width: 48px;
  min-height: 44px;
  background: transparent;
  border: 0;
  color: #aaa;
  font-size: 11px;
  border-radius: 5px;
}
.password-toggle:hover {
  color: #fff;
}
.login-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 13px;
  background: #efeeea;
  color: #111;
  border: 0;
  border-radius: 7px;
  min-height: 46px;
  font-size: 13px;
  font-weight: 500;
  margin-top: 4px;
}
.login-submit:hover:not(:disabled) {
  background: #dcdad3;
}
.login-error {
  color: #f0a5a5;
  font-size: 12px;
  line-height: 1.8;
  padding: 10px 12px;
  background: #ee77770a;
  border: 1px solid #ee77772a;
  border-radius: 7px;
}
.login-footnote {
  text-align: center;
  color: #929292;
  font-size: 11px;
  padding-bottom: 1px;
}
.remember-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 11px;
}
.remember-row label {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  color: #ccc;
  cursor: pointer;
}
.remember-row input {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: #eee;
}
.remember-row > span {
  color: #999;
  font-size: 10px;
}
@media (max-width: 380px) {
  .remember-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 0;
  }
}
</style>
