<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import AppConfirmDialog from '@/components/ui/AppConfirmDialog.vue'
import CreateCredentialDialog from '@/features/mcp-credentials/CreateCredentialDialog.vue'
import McpConnectionCard from '@/features/mcp-credentials/McpConnectionCard.vue'
import { useMcpCredentials } from '@/features/mcp-credentials/useMcpCredentials'
import { credentialTime, statusLabels } from '@/features/mcp-credentials/model'
import type { McpCredential } from '@/features/mcp-credentials/source'
import '@/features/mcp-credentials/mcp-credentials.css'

const auth = useAuthStore()
const connectionCard = ref<InstanceType<typeof McpConnectionCard> | null>(null)
function refresh() {
  void load()
  void connectionCard.value?.refresh()
}
const {
  listing,
  created,
  loading,
  saving,
  revoking,
  loadError,
  createError,
  revokeError,
  load,
  create,
  revoke,
} = useMcpCredentials()
const createOpen = ref(false),
  revokeTarget = ref<McpCredential | null>(null),
  notice = ref('')
const revokeOpen = computed({
  get: () => !!revokeTarget.value,
  set: (value) => {
    if (!value) revokeTarget.value = null
  },
})
const pages = computed(() => Math.max(1, Math.ceil((listing.value?.total ?? 0) / 20)))
function openCreate() {
  createError.value = ''
  notice.value = ''
  createOpen.value = true
}
function confirmRevoke(item: McpCredential) {
  revokeError.value = ''
  revokeTarget.value = item
}
async function performRevoke() {
  const target = revokeTarget.value
  if (target && (await revoke(target.id)) && revokeTarget.value === target) {
    revokeTarget.value = null
    notice.value = `“${target.name}”已撤销。`
  }
}
watch(
  () => auth.user?.id,
  () => {
    createOpen.value = false
    revokeTarget.value = null
    notice.value = ''
  },
  { flush: 'sync' },
)
</script>

<template>
  <div
    class="page-container mcp-credentials-page"
    data-scroll-container
    tabindex="0"
    aria-label="MCP 凭证管理"
  >
    <div class="page-heading mcp-page-heading">
      <div>
        <p class="eyebrow">MCP ACCESS</p>
        <h1>MCP 凭证</h1>
        <p class="page-description">让你的客户端访问 NexoFolio 中的接口知识。</p>
      </div>
      <AppButton
        id="create-mcp-credential"
        variant="primary"
        icon="lock"
        :disabled="!auth.user || saving || revoking"
        @click="openCreate"
        >创建凭证</AppButton
      >
    </div>
    <McpConnectionCard ref="connectionCard" />
    <section class="mcp-account-scope" aria-label="凭证访问范围">
      <AppIcon name="user-round" :size="17" />
      <div>
        <strong>跟随账号权限，适用于所有可访问项目</strong>
        <p>
          凭证属于
          {{
            auth.displayName || '当前账号'
          }}，访问范围随账号项目权限变化。每个客户端可使用独立凭证，随时单独撤销。
        </p>
      </div>
      <RouterLink to="/docs/mcp" class="mcp-guide-link"
        >接入说明<AppIcon name="arrow-up-right" :size="15"
      /></RouterLink>
    </section>
    <section class="mcp-credential-list" aria-labelledby="mcp-list-title" :aria-busy="loading">
      <div class="mcp-list-heading">
        <h2 id="mcp-list-title">
          我的凭证 <span v-if="listing">{{ listing.total }}</span>
        </h2>
        <AppButton
          variant="ghost"
          :disabled="loading || !auth.user || saving || revoking"
          @click="refresh"
          >{{ loading ? '读取中…' : '刷新' }}</AppButton
        >
      </div>
      <p v-if="notice" class="mcp-notice" role="status">{{ notice }}</p>
      <div v-if="loadError" class="mcp-load-error" role="alert">
        <p>{{ loadError }}</p>
        <AppButton :disabled="loading || !auth.user" @click="load()">重新加载</AppButton>
      </div>
      <div v-if="loading && !listing" class="mcp-empty" role="status">正在读取你的凭证…</div>
      <div v-else-if="listing && !listing.total" class="mcp-empty">
        <AppIcon name="lock" :size="28" />
        <h3>创建你的第一个 MCP 凭证</h3>
        <p>为客户端命名，选择有效期，即可获得专用 token。</p>
      </div>
      <div
        v-else-if="listing?.items.length"
        class="mcp-table-scroll"
        tabindex="0"
        aria-label="MCP 凭证列表"
      >
        <table class="mcp-table">
          <caption class="sr-only">
            当前账号创建的 MCP 凭证
          </caption>
          <thead>
            <tr>
              <th scope="col">名称 / 标识</th>
              <th scope="col">有效期</th>
              <th scope="col">状态</th>
              <th scope="col"><span class="sr-only">操作</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in listing.items" :key="item.id">
              <td>
                <strong>{{ item.name }}</strong
                ><small :title="item.id"
                  >ID {{ item.id.slice(0, 8) }} · 创建于 {{ credentialTime(item.issued_at) }}</small
                >
              </td>
              <td>
                <span>{{ credentialTime(item.starts_at) }}</span
                ><small>{{
                  item.expires_at ? `至 ${credentialTime(item.expires_at)}` : '无限期'
                }}</small>
              </td>
              <td>
                <span class="mcp-status" :class="{ 'is-inactive': item.status !== 'active' }">{{
                  statusLabels[item.status]
                }}</span>
              </td>
              <td class="mcp-row-action">
                <AppButton
                  v-if="item.status !== 'revoked'"
                  variant="ghost"
                  :disabled="saving || revoking"
                  :aria-label="`撤销 ${item.name}`"
                  @click="confirmRevoke(item)"
                  >撤销</AppButton
                ><span v-else class="mcp-help">{{
                  item.revoked_at ? credentialTime(item.revoked_at) : '已撤销'
                }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="listing && pages > 1" class="mcp-pagination">
        <span>第 {{ listing.page }} / {{ pages }} 页</span
        ><AppButton :disabled="loading || listing.page <= 1" @click="load(listing.page - 1)"
          >上一页</AppButton
        ><AppButton :disabled="loading || listing.page >= pages" @click="load(listing.page + 1)"
          >下一页</AppButton
        >
      </div>
    </section>
    <p class="mcp-footnote">
      完整 token 仅在创建时展示一次。MCP 凭证独立于网页登录凭证，也不能替代业务接口的 Authorization
      或 Cookie。
    </p>
    <CreateCredentialDialog
      v-model:open="createOpen"
      :pending="saving"
      :created="created"
      :error="createError"
      @create="create"
      @dismiss="created = null"
    />
    <AppConfirmDialog
      v-model:open="revokeOpen"
      title="撤销 MCP 凭证？"
      :description="`撤销“${revokeTarget?.name ?? ''}”后，使用此凭证的客户端将无法继续访问。其他凭证不受影响。`"
      confirm-label="撤销凭证"
      :pending="revoking"
      :error="revokeError"
      @confirm="performRevoke"
    />
  </div>
</template>
