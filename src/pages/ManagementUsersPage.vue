<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import UserAvatar from '@/features/management/UserAvatar.vue'
import { useManagementUsers } from '@/features/management/useManagementUsers'
import '@/features/management/management.css'
import '@/features/management/users.css'
const { query, page, data, loading, error, load, changePage } = useManagementUsers()
const date = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
function time(value: string) {
  return date.format(new Date(value))
}
</script>
<template>
  <section class="management-panel management-users" :aria-busy="loading">
    <header class="management-heading">
      <div>
        <p class="management-eyebrow">管理中心 / 用户管理</p>
        <h1>用户管理</h1>
        <p>查看已注册用户。首次登录 NexoFolio 后，用户会出现在这里。</p>
      </div>
      <AppButton variant="ghost" :disabled="loading" @click="load()">刷新列表</AppButton>
    </header>
    <form
      class="management-toolbar"
      role="search"
      aria-label="搜索已注册用户"
      @submit.prevent="load(true)"
    >
      <label class="management-search management-user-search">
        <AppIcon name="search" :size="16" mode="static" />
        <span class="sr-only">姓名或账号</span>
        <input v-model="query" type="search" placeholder="搜索姓名或账号" maxlength="100" />
      </label>
      <AppButton type="submit" :disabled="loading">查询</AppButton>
      <span v-if="data" class="management-total" role="status">共 {{ data.total }} 位用户</span>
    </form>
    <div v-if="error" class="management-empty" role="alert">
      <p>{{ error }}</p>
      <AppButton @click="load()">重新加载</AppButton>
    </div>
    <p v-else-if="loading" class="management-empty" role="status">正在读取用户列表…</p>
    <template v-else-if="data">
      <table v-if="data.items.length" class="management-users-table">
        <caption class="sr-only">
          已注册用户，按首次登录时间从新到旧排列
        </caption>
        <thead>
          <tr>
            <th scope="col">用户</th>
            <th scope="col">账号</th>
            <th scope="col">首次登录</th>
            <th scope="col">最近登录</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in data.items" :key="user.id">
            <td>
              <div class="management-user-identity">
                <UserAvatar
                  :name="user.display_name"
                  :account="user.account"
                  :src="user.avatar_url"
                />
                <div>
                  <strong>{{ user.display_name || user.account }}</strong
                  ><small v-if="!user.enabled">账号已停用</small>
                </div>
              </div>
            </td>
            <td data-label="账号" class="management-user-account">{{ user.account }}</td>
            <td data-label="首次登录">
              <time :datetime="user.created_at">{{ time(user.created_at) }}</time>
            </td>
            <td data-label="最近登录">
              <time :datetime="user.last_login_at">{{ time(user.last_login_at) }}</time>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="management-empty management-users-empty">
        <AppIcon name="user-round" :size="28" mode="static" />
        <p>{{ query.trim() ? '没有找到匹配的用户' : '暂无已注册用户' }}</p>
        <small>{{
          query.trim() ? '试试其他姓名或账号。' : '用户首次登录后，会自动出现在这里。'
        }}</small>
      </div>
      <footer v-if="data.total > data.limit" class="management-pagination">
        <span
          >第 {{ page }} / {{ Math.ceil(data.total / data.limit) }} 页 · 每页
          {{ data.limit }} 位</span
        >
        <AppButton :disabled="page <= 1" @click="changePage(page - 1)">上一页</AppButton>
        <AppButton :disabled="page * data.limit >= data.total" @click="changePage(page + 1)"
          >下一页</AppButton
        >
      </footer>
    </template>
  </section>
</template>
