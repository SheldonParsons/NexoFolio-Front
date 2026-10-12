<script setup lang="ts">
import { ref } from 'vue'
import { ToggleGroupRoot, ToggleGroupItem } from 'reka-ui'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCheckbox from '@/components/ui/AppCheckbox.vue'
import AuditProjectFilter from './AuditProjectFilter.vue'
import AccessVisits from './AccessVisits.vue'
import { useAccessAnalysis } from './useAccessAnalysis'
import {
  accessKinds,
  ranges,
  accessTitle,
  auditTime,
  pageGroups,
  pageCategory,
  accessProjectName,
  canInspectAccess,
  type AccessRow,
} from './analysis'
const { kind, pageGroup, days, project, background, page, report, busy, error, query, load, move } =
  useAccessAnalysis()
const selected = ref<AccessRow | null>(null),
  detailOpen = ref(false),
  detailParams = ref('')
function details(row: AccessRow) {
  if (!canInspectAccess(row)) return
  selected.value = row
  detailParams.value = query('visits', row).toString()
  detailOpen.value = true
}
</script>
<template>
  <section aria-label="访问分析">
    <form class="audit-controls" @submit.prevent="load()">
      <label
        ><span class="audit-label">访问范围</span
        ><AppSelect v-model="kind" label="访问范围" :options="accessKinds" /></label
      ><AuditProjectFilter v-model="project" /><label
        ><span class="audit-label">时间范围</span
        ><AppSelect v-model="days" label="时间范围" :options="ranges" /></label
      ><AppButton type="submit" :disabled="busy">查询</AppButton>
    </form>
    <ToggleGroupRoot
      v-if="kind === 'page'"
      :model-value="pageGroup"
      type="single"
      aria-label="页面分类"
      class="audit-page-groups"
      @update:model-value="pageGroup = String($event || 'all')"
      ><ToggleGroupItem v-for="group in pageGroups" :key="group.value" :value="group.value">{{
        group.label
      }}</ToggleGroupItem></ToggleGroupRoot
    >
    <div class="audit-scope-note">
      <span>页面访问、后台 API 和 MCP 分别计数。后台请求次数不代表页面浏览量或业务接口调用量。</span
      ><AppCheckbox v-if="kind === 'api'" v-model="background" label="包含系统与辅助查询" />
    </div>
    <p v-if="kind === 'api'" class="audit-note">
      默认排除会话校验、整理查询、MCP
      传输、站点匹配和版本元数据。站点匹配及版本查询未记录手动/自动触发来源，不能精确归因；排除展示不表示请求已被减少。整理轮次与成功/失败请查看“整理排查”。
    </p>
    <p v-if="error" class="audit-warning" role="alert">
      {{ error }} <AppButton @click="load()">重试</AppButton>
    </p>
    <p v-else-if="busy" class="audit-empty" role="status">正在汇总访问记录…</p>
    <template v-else-if="report"
      ><div class="audit-results-heading">
        <h2>{{ accessKinds.find((item) => item.value === kind)?.label }}热点</h2>
        <span
          ><template v-if="report.matching_visits !== undefined"
            >{{ report.matching_visits }} 次已记录{{
              kind === 'page' ? '浏览' : kind === 'api' ? '请求' : '工具调用'
            }}</template
          ><template v-else>访问总数未记录</template> · {{ report.total }} 个访问目标</span
        >
      </div>
      <p
        v-if="
          report.health?.enabled === false ||
          report.health?.dropped_access ||
          report.health?.storage_failures ||
          report.coverage.capacity_evictions
        "
        role="alert"
        class="audit-warning"
      >
        {{
          report.health?.enabled === false ? '采集已停用。' : '采集或保留范围存在缺口。'
        }}排行只覆盖当前仍保留的记录，不能代表完整访问量。
      </p>
      <div
        v-if="report.items.length"
        class="audit-table-wrap"
        tabindex="0"
        aria-label="访问热点表，可横向滚动"
      >
        <table class="audit-data-table">
          <thead>
            <tr>
              <th>访问目标</th>
              <th>方式</th>
              <th>
                {{ kind === 'page' ? '浏览次数' : kind === 'api' ? '请求次数' : '工具调用次数' }}
              </th>
              <th>访问身份</th>
              <th>最近访问</th>
              <th><span class="sr-only">明细</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in report.items" :key="index">
              <td>
                <button
                  type="button"
                  class="audit-name-button"
                  :disabled="!canInspectAccess(row)"
                  @click="details(row)"
                >
                  {{ accessTitle(row, report) }}</button
                ><small
                  ><span v-if="row.kind === 'page'">{{ pageCategory(row.route || '') }} · </span
                  >{{ accessProjectName(row, report) }}</small
                >
              </td>
              <td>{{ row.method === 'BROWSER' ? '浏览器上报' : row.method || '未记录' }}</td>
              <td>{{ row.hits ?? '未记录' }}</td>
              <td>
                {{ row.users === undefined ? '登录身份数未记录' : `${row.users} 个登录身份`
                }}<small
                  >{{
                    row.visitor_ips === undefined
                      ? '访客 IP 数未记录'
                      : `${row.visitor_ips} 个访客 IP`
                  }}<span v-if="row.unknown_visits">
                    · {{ row.unknown_visits }} 次身份未知</span
                  ></small
                >
              </td>
              <td>{{ auditTime(row.last_at) }}</td>
              <td>
                <AppButton variant="ghost" :disabled="!canInspectAccess(row)" @click="details(row)"
                  >查看访问</AppButton
                ><small v-if="!canInspectAccess(row)">明细标识未记录</small>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="audit-empty">当前范围暂无访问记录。</p>
      <div class="audit-pagination">
        <span>第 {{ page }} / {{ Math.max(1, Math.ceil(report.total / 20)) }} 页</span
        ><AppButton :disabled="page <= 1" @click="move(page - 1)">上一页</AppButton
        ><AppButton :disabled="page * 20 >= report.total" @click="move(page + 1)">下一页</AppButton>
      </div>
      <details class="audit-coverage">
        <summary>采集范围与完整性</summary>
        <p>
          记录起点：{{ auditTime(report.coverage.detail_recording_started_at) }}。
          {{
            report.retention?.days === undefined
              ? '保留期限未记录'
              : `保留 ${report.retention.days} 天`
          }}，
          {{
            report.retention?.max_details === undefined
              ? '容量上限未记录'
              : `最多 ${report.retention.max_details} 条`
          }}。 最早保留：{{ auditTime(report.coverage.retained_from) }}。
        </p>
        <p>
          首次打开、刷新和成功切换到不同路径各记一次页面访问；只改变查询参数（如环境）或页内锚点不新增浏览。后台
          API
          与轮询不计作页面浏览。文档资源由项目、目录或接口标识区分。时间为服务端接收/记录时刻，记录不证明页面全部内容已经成功加载。
        </p>
        <p>
          排行在后端对本次范围内所有保留明细聚合后分页，未把当前页当全量。IP
          数不等于真实人数；浏览器上报可能被拦截。容量累计淘汰
          {{ report.coverage.capacity_evictions ?? '未记录' }} 条。当前进程丢失
          {{ report.health?.dropped_access ?? '未记录' }} 条访问，存储失败
          {{ report.health?.storage_failures ?? '未记录' }} 次。
        </p>
      </details></template
    >
    <AccessVisits
      v-model:open="detailOpen"
      :row="selected"
      :params="detailParams"
      :names="report"
    />
  </section>
</template>
