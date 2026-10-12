<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import {
  accessReport,
  accessTitle,
  actorName,
  auditTime,
  accessProjectName,
  type AccessReport,
  type AccessRow,
} from './analysis'
const props = defineProps<{
  row: AccessRow | null
  params: string
  names: AccessReport | null
}>()
const open = defineModel<boolean>('open', { default: false })
const report = ref<AccessReport | null>(null),
  busy = ref(false),
  error = ref(''),
  page = ref(1)
let controller: AbortController | undefined
async function load() {
  controller?.abort()
  const request = (controller = new AbortController())
  busy.value = true
  error.value = ''
  report.value = null
  const q = new URLSearchParams(props.params)
  q.set('page', String(page.value))
  q.set('view', 'visits')
  try {
    const result = await accessReport(q, request.signal)
    if (!request.signal.aborted) report.value = result
  } catch (e) {
    if (!request.signal.aborted) error.value = e instanceof Error ? e.message : '明细读取失败'
  } finally {
    if (!request.signal.aborted) busy.value = false
  }
}
function move(delta: number) {
  page.value += delta
  void load()
}
watch(open, (value) => {
  controller?.abort()
  if (value) {
    page.value = 1
    void load()
  }
})
onScopeDispose(() => controller?.abort())
</script>
<template>
  <AppDialog
    v-model:open="open"
    placement="right"
    :title="row ? accessTitle(row, names) : '访问明细'"
    description="按当前筛选范围分页读取单次访问，身份来自服务端验证。"
  >
    <p v-if="error" role="alert" class="audit-warning">
      {{ error }} <AppButton @click="load">重试</AppButton>
    </p>
    <p v-else-if="busy" role="status">正在读取访问记录…</p>
    <template v-else-if="report"
      ><p class="audit-note">共 {{ report.total }} 次已记录访问</p>
      <ol class="audit-visits">
        <li v-for="(item, index) in report.items" :key="index">
          <div>
            <strong>{{ auditTime(item.at) }}</strong
            ><span>{{
              item.code ||
              (item.status
                ? `HTTP ${item.status}`
                : item.method === 'BROWSER'
                  ? '浏览器上报'
                  : '结果未记录')
            }}</span>
          </div>
          <p>{{ actorName(item, report) }}</p>
          <p>{{ accessTitle(item, report) }}</p>
          <small>{{ accessProjectName(item, report) }} · {{ item.method || '未记录' }}</small>
          <details>
            <summary>技术标识</summary>
            <dl>
              <dt>路由模板</dt>
              <dd>{{ item.route || '未记录' }}</dd>
              <dt>资源</dt>
              <dd>{{ item.resource || '未记录' }}</dd>
              <dt>请求</dt>
              <dd>{{ item.request_id || '未记录' }}</dd>
              <dt>耗时</dt>
              <dd>{{ item.duration_ms ?? '未记录' }} ms</dd>
              <dt>身份标识</dt>
              <dd>{{ item.actor || '未记录' }}</dd>
            </dl>
          </details>
        </li>
      </ol>
      <p v-if="!report.items.length" class="audit-empty">当前范围没有保留的访问记录。</p>
      <div class="audit-pagination">
        <AppButton :disabled="page === 1" @click="move(-1)">上一页</AppButton
        ><span>第 {{ page }} 页</span
        ><AppButton :disabled="page * 20 >= report.total" @click="move(1)">下一页</AppButton>
      </div></template
    >
  </AppDialog>
</template>
