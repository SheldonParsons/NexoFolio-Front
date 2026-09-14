<script setup lang="ts">
import { usePreferencesStore, type ThemePreference } from '@/stores/preferences'
import AppIcon from '@/components/icons/AppIcon.vue'
import AppButton from '@/components/ui/AppButton.vue'
import type { IconName } from '@/components/icons/registry'

const preferences = usePreferencesStore()
const themes: { value: ThemePreference; label: string; icon: IconName; description: string }[] = [
  { value: 'light', label: '浅色', icon: 'sun', description: '清晰、轻盈的日间工作空间' },
  { value: 'dark', label: '深色', icon: 'moon', description: '柔和、专注的夜间工作空间' },
  { value: 'system', label: '跟随系统', icon: 'monitor', description: '根据设备外观自动切换' },
]
</script>

<template>
  <div class="page-container settings-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">MAKE IT YOURS</p>
        <h1>偏好设置</h1>
        <p class="page-description">为你的工作习惯，留一点自己的空间。</p>
      </div>
    </div>
    <section class="settings-section">
      <h2>外观</h2>
      <p>选择工作空间的显示主题，设置会自动保存。</p>
      <fieldset class="theme-options">
        <legend class="sr-only">选择显示主题</legend>
        <label
          v-for="theme in themes"
          :key="theme.value"
          class="theme-option"
          :class="{ selected: preferences.theme === theme.value }"
          ><input
            type="radio"
            name="theme"
            :value="theme.value"
            :checked="preferences.theme === theme.value"
            @change="preferences.setTheme(theme.value)"
          /><span class="theme-preview" :class="`theme-preview--${theme.value}`" aria-hidden="true"
            ><span class="preview-sidebar"></span
            ><span class="preview-main"><i></i><i></i><i></i></span></span
          ><span class="theme-option-title"
            ><AppIcon :name="theme.icon" :size="17" />{{ theme.label
            }}<AppIcon v-if="preferences.theme === theme.value" name="check" :size="17" /></span
          ><small>{{ theme.description }}</small></label
        >
      </fieldset>
    </section>
    <section class="settings-section settings-row">
      <div>
        <h2>动态效果</h2>
        <p>尊重设备的“减少动态效果”设置，保留必要的状态反馈。</p>
      </div>
      <span class="subtle-badge">跟随系统</span>
    </section>
    <section class="settings-section settings-row">
      <div>
        <h2>恢复默认外观</h2>
        <p>将主题恢复为跟随系统，不影响任何项目数据。</p>
      </div>
      <AppButton :disabled="preferences.theme === 'system'" @click="preferences.setTheme('system')"
        >恢复默认</AppButton
      >
    </section>
  </div>
</template>
