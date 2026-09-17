<script setup lang="ts">
import { computed } from 'vue'
import {
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuTrigger,
} from 'reka-ui'
import AppIcon from '@/components/icons/AppIcon.vue'
import { desktopChannels, downloadStatus, useDownloads } from './useDownloads'
import './downloads.css'

const { state, refresh, selectChannel } = useDownloads()
const desktop = computed(() => state.desktop[state.channel])
const channelLabel = computed(
  () => desktopChannels.find((channel) => channel.id === state.channel)!.label,
)
const assetBase = import.meta.env.BASE_URL
const desktopVersion = computed(() => {
  const versions = [
    ...new Set(desktop.value.flatMap((entry) => (entry.release ? [entry.release.version] : []))),
  ]
  if (versions.length === 1) return `v${versions[0]}`
  if (versions.length > 1) return '选择版本'
  return desktop.value.some((entry) => entry.status === 'loading' || entry.status === 'idle')
    ? '检查中'
    : '暂不可用'
})
const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`
</script>

<template>
  <NavigationMenuItem
    value="download-fetcher"
    class="navigation-download-item navigation-download-item--first"
  >
    <NavigationMenuTrigger
      class="workspace-navigation-trigger navigation-download-trigger"
      title="下载 NexoFolio Fetcher 开发版"
    >
      <img
        :src="`${assetBase}brand/nexofolio-icon.svg`"
        class="navigation-download-logo navigation-download-logo--fetcher"
        alt=""
        width="18"
        height="18"
      />
      <span>Fetcher</span>
      <span class="navigation-download-version">{{
        state.fetcher.release
          ? `v${state.fetcher.release.version}`
          : downloadStatus(state.fetcher.status)
      }}</span>
      <span class="navigation-development-badge">开发版</span>
      <AppIcon class="navigation-chevron" name="chevron-down" mode="static" :size="12" />
    </NavigationMenuTrigger>
    <NavigationMenuContent class="workspace-navigation-content">
      <div class="navigation-download-panel">
        <div class="download-heading">
          <strong>NexoFolio Fetcher</strong><span class="navigation-development-badge">开发版</span>
        </div>
        <p class="download-description">下载后解压，通过浏览器开发者模式手动加载。</p>
        <NavigationMenuLink v-if="state.fetcher.release" as-child>
          <a
            class="download-primary"
            :href="state.fetcher.release.url"
            :download="state.fetcher.release.filename"
            target="_blank"
            rel="noopener noreferrer"
          >
            下载 ZIP · v{{ state.fetcher.release.version }}
            <span>{{ megabytes(state.fetcher.release.size) }}</span
            ><AppIcon name="arrow-right" mode="static" :size="16" />
          </a>
        </NavigationMenuLink>
        <p v-else class="download-status" role="status">
          {{
            state.fetcher.status === 'unpublished'
              ? '开发版正在准备，上传后即可下载。'
              : state.fetcher.status === 'error'
                ? '暂时无法获取版本，请稍后重试。'
                : '正在读取最新版本…'
          }}
        </p>
        <ol class="download-install-steps">
          <li>解压 ZIP 到一个独立文件夹。</li>
          <li>打开 <code>chrome://extensions</code>，开启「开发者模式」。</li>
          <li>点击「加载未打包的扩展程序」，直接选择解压出的文件夹。</li>
        </ol>
        <p class="download-footnote">
          文件夹内直接包含 manifest.json，无需再进入内层目录。{{
            state.fetcher.release
              ? `需要 Chrome ${state.fetcher.release.minimumChromeVersion}+。`
              : ''
          }}
        </p>
        <button
          class="download-retry"
          type="button"
          :disabled="state.fetcher.status === 'loading'"
          @click="refresh()"
        >
          重新检查版本
        </button>
      </div>
    </NavigationMenuContent>
  </NavigationMenuItem>

  <NavigationMenuItem value="download-desktop" class="navigation-download-item">
    <NavigationMenuTrigger
      class="workspace-navigation-trigger navigation-download-trigger"
      :title="`下载 AsyncTest 桌面端 · ${channelLabel}`"
    >
      <img
        :src="`${assetBase}brand/asynctest-icon.svg`"
        class="navigation-download-logo navigation-download-logo--asynctest"
        alt=""
        width="20"
        height="20"
      />
      <span>AsyncTest</span><span class="navigation-download-version">{{ desktopVersion }}</span>
      <AppIcon class="navigation-chevron" name="chevron-down" mode="static" :size="12" />
    </NavigationMenuTrigger>
    <NavigationMenuContent class="workspace-navigation-content">
      <div class="navigation-download-panel">
        <div class="download-heading"><strong>AsyncTest 桌面端</strong></div>
        <p class="download-description">选择版本渠道，再下载与你的电脑匹配的安装包。</p>
        <fieldset
          class="download-channel-switch"
          aria-label="AsyncTest 版本渠道"
          @keydown.left.stop
          @keydown.right.stop
        >
          <label v-for="channel in desktopChannels" :key="channel.id">
            <input
              type="radio"
              name="asynctest-download-channel"
              :value="channel.id"
              :checked="state.channel === channel.id"
              @change="selectChannel(channel.id)"
            />
            <span>{{ channel.label }}</span>
          </label>
        </fieldset>
        <div class="download-platforms">
          <template v-for="platform in desktop" :key="`${state.channel}:${platform.id}`">
            <NavigationMenuLink v-if="platform.release" as-child>
              <a
                class="download-platform"
                :href="platform.release.url"
                :download="platform.release.filename"
                target="_blank"
                rel="noopener noreferrer"
              >
                <AppIcon name="monitor" mode="static" :size="20" />
                <span
                  ><strong>{{ platform.label }}</strong
                  ><small
                    >v{{ platform.release.version }} · {{ megabytes(platform.release.size) }}</small
                  ></span
                >
                <AppIcon
                  class="download-platform-arrow"
                  name="arrow-up-right"
                  mode="static"
                  :size="16"
                />
              </a>
            </NavigationMenuLink>
            <div v-else class="download-platform download-platform--unavailable">
              <span
                ><strong>{{ platform.label }}</strong
                ><small>{{ downloadStatus(platform.status) }}</small></span
              >
            </div>
          </template>
        </div>
        <p class="download-footnote">
          Mac 的芯片类型可在「关于本机」查看。已安装的桌面端可通过头像菜单中的「检查更新」升级。
        </p>
        <button
          class="download-retry"
          type="button"
          :disabled="desktop.some((item) => item.status === 'loading')"
          @click="refresh()"
        >
          重新检查版本
        </button>
      </div>
    </NavigationMenuContent>
  </NavigationMenuItem>
</template>
