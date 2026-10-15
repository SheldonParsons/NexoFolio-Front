<script setup lang="ts">
import { computed } from 'vue'
import MetricSource from './MetricSource.vue'
import { number, mib, reasonLabels } from './format'
import type { Summary } from './types'
const props = defineProps<{ data: Summary; now: number }>()
const model = computed(() => props.data.model.value),
  intake = computed(() => props.data.intake.value)
const container = computed(() => {
  const v = props.data.resources?.container_limit_bytes
  return v?.sampled_at && v.value == null && !v.error ? '无限制' : mib(v?.value)
})
const poolNames: Record<string, string> = {
  access: '访问与身份',
  access_activity: '项目活动租约',
  knowledge: '知识与整理',
  observe: '流量观察',
  intake: '采集账本',
  audit: '审计',
}
</script>
<template>
  <div class="ops-resource-grid">
    <section class="ops-card">
      <h2>模型请求</h2>
      <p class="ops-note">当前 API 实例 · 不代表其他副本或整个服务商</p>
      <dl class="ops-facts">
        <dt>实际 HTTP 在途</dt>
        <dd>{{ number(model?.http_in_flight) }}</dd>
        <dt>当前 / 配置额度</dt>
        <dd>{{ number(model?.current_limit) }} / {{ number(model?.configured_limit) }}</dd>
        <dt>已占许可 / 等待许可</dt>
        <dd>{{ number(model?.permits_in_use) }} / {{ number(model?.waiting_for_permit) }}</dd>
        <dt>冷却剩余</dt>
        <dd>{{ model ? `${number(model.cooldown_remaining_ms / 1000, 1)} 秒` : '未采集' }}</dd>
        <dt>排队平均 / P95</dt>
        <dd>{{ number(model?.queue.mean_ms, 1) }} / {{ number(model?.queue.p95_ms) }} ms</dd>
        <dt>请求平均 / P95</dt>
        <dd>{{ number(model?.request.mean_ms, 1) }} / {{ number(model?.request.p95_ms) }} ms</dd>
        <dt>已结束尝试 / 已取消</dt>
        <dd>{{ number(model?.completed) }} / {{ number(model?.cancelled) }}</dd>
      </dl>
      <p class="ops-note">
        耗时覆盖最近 {{ number(model?.request.samples) }} 次已结束请求，最多 256
        次；未知耗时不计为零。
      </p>
      <div v-if="model" class="ops-failures">
        <span v-for="(count, reason) in model.failures" :key="reason"
          >{{ reasonLabels[reason] || reason }} <b>{{ count }}</b></span
        ><span v-if="!Object.keys(model.failures).length">本实例尚未记录失败</span>
      </div>
      <MetricSource :value="data.model" :now="now" />
    </section>
    <section class="ops-card">
      <h2>进程与内存</h2>
      <p class="ops-note">RSS、容器预算和宿主可用内存分别观察</p>
      <div class="ops-resource-fact">
        <span>API 进程 RSS</span><strong>{{ mib(data.resources?.rss_bytes.value) }}</strong
        ><MetricSource :value="data.resources?.rss_bytes" :now="now" />
      </div>
      <div class="ops-resource-fact">
        <span>CPU 核心用量</span><strong>{{ number(data.resources?.cpu_cores.value, 3) }}</strong>
        <p class="ops-note">1.0 表示占用一个完整逻辑核心</p>
        <MetricSource :value="data.resources?.cpu_cores" :now="now" />
      </div>
      <div class="ops-resource-fact">
        <span>容器内存上限</span><strong>{{ container }}</strong
        ><MetricSource :value="data.resources?.container_limit_bytes" :now="now" />
      </div>
      <div class="ops-resource-fact">
        <span>宿主可用内存</span
        ><strong>{{ mib(data.resources?.host_available_bytes.value) }}</strong
        ><MetricSource :value="data.resources?.host_available_bytes" :now="now" />
      </div>
    </section>
    <section class="ops-card ops-wide">
      <h2>数据库连接池</h2>
      <p class="ops-note">
        每个模块独立计数；使用量按连接数减空闲数估算，两个读数并非原子快照。驱动未提供的等待和超时保留未知。
      </p>
      <div class="ops-table-scroll">
        <table class="ops-table">
          <thead>
            <tr>
              <th>模块</th>
              <th>连接 / 配置上限</th>
              <th>使用估算 / 空闲</th>
              <th>等待</th>
              <th>获取超时</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pool in data.pools.value ?? []" :key="pool.name">
              <td>{{ poolNames[pool.name] || pool.name }}</td>
              <td>{{ pool.size }} / {{ pool.configured_max }}</td>
              <td>
                {{ number(pool.size >= pool.idle ? pool.size - pool.idle : null) }} /
                {{ pool.idle }}
              </td>
              <td>{{ number(pool.waiting) }}</td>
              <td>{{ number(pool.acquire_timeouts) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <MetricSource :value="data.pools" :now="now" />
    </section>
    <section class="ops-card ops-wide">
      <h2>采集接收</h2>
      <p class="ops-note">
        当前实例已完成的接收处理，包含重传与拒绝；字节量只覆盖成功读取的请求体。
      </p>
      <dl class="ops-intake">
        <div>
          <dt>批次 / 秒</dt>
          <dd>{{ number(intake?.batches_per_second, 2) }}</dd>
        </div>
        <div>
          <dt>字节 / 秒</dt>
          <dd>{{ number(intake?.bytes_per_second, 1) }}</dd>
        </div>
        <div>
          <dt>处理平均耗时</dt>
          <dd>{{ number(intake?.totals.mean_receive_ms, 1) }} ms</dd>
        </div>
        <div>
          <dt>429 / 503</dt>
          <dd>{{ number(intake?.totals.http_429) }} / {{ number(intake?.totals.http_503) }}</dd>
        </div>
        <div>
          <dt>接收尝试 / 接受批次</dt>
          <dd>
            {{ number(intake?.totals.batches) }} / {{ number(intake?.totals.accepted_batches) }}
          </dd>
        </div>
        <div>
          <dt>Fetcher 本地待上传</dt>
          <dd>未采集</dd>
        </div>
      </dl>
      <p class="ops-note">
        速率窗口
        {{ number(intake?.window_seconds, 1) }} 秒；耗时不包含读取请求体之前的网络等待。Fetcher
        本地积压无法由服务端接收量推算。
      </p>
      <MetricSource :value="data.intake" :now="now" />
    </section>
    <section class="ops-card ops-wide">
      <h2>近期资源采样</h2>
      <p class="ops-note">最多保留 60 个采样点。查看最近 12 次，断点表示本次未采集到有效值。</p>
      <div
        class="ops-history"
        role="img"
        aria-label="近期 API 进程 RSS，条形高度按当前窗口最大值缩放"
      >
        <div
          v-for="point in data.history.slice(-12)"
          :key="point.at"
          :title="`${point.at} · RSS ${mib(point.rss_bytes)} · CPU ${number(point.cpu_cores, 3)}`"
        >
          <span
            :style="{
              height:
                point.rss_bytes == null
                  ? '0px'
                  : `${Math.max(3, (point.rss_bytes / Math.max(1, ...data.history.slice(-12).map((p) => p.rss_bytes ?? 0))) * 60)}px`,
            }"
          ></span
          ><small>{{ point.rss_bytes == null ? '—' : number(point.rss_bytes / 1048576) }}</small>
        </div>
      </div>
      <p class="ops-note">RSS · MiB</p>
    </section>
  </div>
</template>
