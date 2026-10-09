<script setup lang="ts">
import { computed, nextTick, onMounted, onScopeDispose, ref, watch } from 'vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import { apiBaseUrl } from '@/api'
import { useActiveProject } from '@/features/projects/useActiveProject'
import CollectWorkbench from './CollectWorkbench.vue'
import { checkBatch } from './contract'
import {
  collectCurl,
  collectQuickExamples,
  collectServiceBase,
  prepareCollectExample,
} from './guide'
import receiptAll from '@/contracts/collect/1.1.0/fixtures/receipt/valid/all-accepted.json'
import receiptSome from '@/contracts/collect/1.1.0/fixtures/receipt/valid/some-rejected.json'
import receiptError from '@/contracts/collect/1.1.0/fixtures/error/valid/rate-limited.json'

const props = defineProps<{ body: string }>()
const project = useActiveProject()
const currentBase = collectServiceBase(apiBaseUrl, window.location.href)
const examples = computed(() =>
  collectQuickExamples(props.body).map((item) => ({
    ...item,
    text: prepareCollectExample(item.text, project.current.value ?? {}),
  })),
)
const kind = ref(0)
const example = computed(() => examples.value[kind.value]!)
const active = ref(0)
const labels = ['选资料类型', '填写并检查', '生成发送命令', '看保存结果']
const target = ref<HTMLElement>()
const tabs = ref<HTMLButtonElement[]>([])
const workbench = ref<InstanceType<typeof CollectWorkbench>>()
const draft = ref(examples.value[0]?.text || '')
const draftCheck = computed(() => checkBatch(draft.value))
const baseUrl = ref(currentBase)
const curl = computed(() => collectCurl(baseUrl.value))
const copied = ref('')
const copyError = ref('')
const receiptMode = ref(0)
const receipt = computed(() => [receiptAll, receiptSome, receiptError][receiptMode.value])
let timer: ReturnType<typeof setTimeout> | undefined
let objectUrl = ''
watch(examples, (next, previous) => {
  const index = previous.findIndex((item) => item.text === draft.value)
  if (index < 0 || !next[index]) return
  draft.value = next[index]!.text
  workbench.value?.loadExample(draft.value, '已更新项目归属 · 示例')
})
function scrollToStart() {
  void nextTick(() =>
    target.value?.scrollIntoView({
      block: 'start',
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    }),
  )
}
function selectStep(index: number) {
  active.value = index
  scrollToStart()
}
function keyStep(event: KeyboardEvent, index: number) {
  const next =
    event.key === 'ArrowRight'
      ? (index + 1) % 4
      : event.key === 'ArrowLeft'
        ? (index + 3) % 4
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? 3
            : -1
  if (next < 0) return
  event.preventDefault()
  selectStep(next)
  tabs.value[next]?.focus()
}
function loadSelected() {
  draft.value = prepareCollectExample(example.value.text, project.current.value ?? {})
  workbench.value?.loadExample(
    draft.value,
    kind.value === 0 ? '一次真实调用 · 示例' : '接口结构声明 · 示例',
  )
  selectStep(1)
}
async function copy(value: string, name: string) {
  clearTimeout(timer)
  copied.value = ''
  copyError.value = ''
  try {
    await navigator.clipboard.writeText(value)
    copied.value = name
    timer = setTimeout(() => {
      copied.value = ''
    }, 2200)
  } catch {
    copyError.value = '复制未成功，请选中代码手动复制。'
  }
}
function download() {
  if (!draftCheck.value.valid) return
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = URL.createObjectURL(
    new Blob([draft.value], { type: 'application/json;charset=utf-8' }),
  )
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = 'batch.json'
  link.click()
}
onMounted(() => workbench.value?.loadExample(draft.value, '一次真实调用 · 示例'))
onScopeDispose(() => {
  clearTimeout(timer)
  if (objectUrl) URL.revokeObjectURL(objectUrl)
})
</script>

<template>
  <section id="api-quickstart" ref="target" class="cg-start" aria-labelledby="cg-start-title">
    <header class="cg-heading">
      <div>
        <span class="cg-eyebrow">QUICK START</span>
        <h2 id="cg-start-title">跟着一条示例，走完四步。</h2>
      </div>
      <span class="cg-local-note"
        ><AppIcon name="lock" :size="13" mode="static" />只校验，不发送</span
      >
    </header>
    <div class="cg-steps" role="tablist" aria-label="接口录入步骤">
      <button
        v-for="(label, index) in labels"
        :id="`collect-tab-${index}`"
        :key="label"
        :ref="
          (el) => {
            if (el) tabs[index] = el as HTMLButtonElement
          }
        "
        type="button"
        role="tab"
        :aria-selected="active === index"
        :aria-controls="`collect-panel-${index}`"
        :tabindex="active === index ? 0 : -1"
        @click="selectStep(index)"
        @keydown="keyStep($event, index)"
      >
        <span>0{{ index + 1 }}</span
        >{{ label }}
      </button>
    </div>
    <div
      id="collect-panel-0"
      v-show="active === 0"
      role="tabpanel"
      aria-labelledby="collect-tab-0"
      class="cg-panel"
      tabindex="0"
    >
      <p class="cg-intro">先看手里的资料是什么。实际调用和接口声明使用不同的记录结构。</p>
      <div class="cg-kind-options">
        <button type="button" :aria-pressed="kind === 0" @click="kind = 0">
          <AppIcon name="network" :size="20" mode="static" /><strong>实际发生的调用</strong
          ><code>http_exchange</code
          ><small>网关日志、抓包、测试脚本<br />需要指定项目与环境</small></button
        ><button type="button" :aria-pressed="kind === 1" @click="kind = 1">
          <AppIcon name="code" :size="20" mode="static" /><strong>声明的接口结构</strong
          ><code>http_declaration</code
          ><small>Swagger、OpenAPI、手工结构<br />纯声明批次可省略环境</small>
        </button>
      </div>
      <div class="cg-code">
        <header>
          <span>batch.json · {{ kind === 0 ? '调用记录' : '接口声明' }}</span
          ><button type="button" @click="copy(example.text, 'example')">
            {{ copied === 'example' ? '已复制' : '复制示例' }}
          </button>
        </header>
        <pre tabindex="0"><code>{{ example.text }}</code></pre>
      </div>
      <div class="cg-reminder">
        <AppIcon name="circle-help" :size="16" mode="static" />
        <p>
          {{
            project.current.value
              ? `已带入项目「${project.current.value.name}」。${project.current.value.environmentId ? '已带入所选环境。' : '环境名仍为示例，发送前请核对。'}`
              : '尚未选项目，项目 ID 和环境暂为示例；可先从项目空间进入项目，再回到这里。'
          }}批次和记录编号已自动生成，请把业务地址、Header
          和正文换成真实采集数据。重新载入会产生新批次；重试已发送的数据时保留同一份文件。
        </p>
      </div>
      <footer class="cg-panel-footer">
        <span>项目必须存在，不能根据域名猜归属。</span
        ><button type="button" class="cg-primary" @click="loadSelected">
          载入示例并校验<AppIcon name="arrow-right" :size="15" mode="static" />
        </button>
      </footer>
    </div>
    <div
      id="collect-panel-1"
      v-show="active === 1"
      role="tabpanel"
      aria-labelledby="collect-tab-1"
      class="cg-panel cg-panel--editor"
      tabindex="0"
    >
      <div class="cg-editor-intro">
        <h3>填入你的真实资料，先检查格式。</h3>
        <p>
          <code>platform</code>
          填来源工具名称，核对项目和环境，补入真实记录。绿色结果只表示格式符合规范，不表示已上传或项目一定存在。
        </p>
      </div>
      <CollectWorkbench ref="workbench" @draft-change="draft = $event" />
      <footer class="cg-panel-footer">
        <button class="cg-text-button" type="button" @click="selectStep(0)">返回选择记录</button
        ><button
          class="cg-primary"
          type="button"
          :disabled="!draftCheck.valid || !!draftCheck.oversizedRecords.length"
          @click="selectStep(2)"
        >
          生成发送命令<AppIcon name="arrow-right" :size="15" mode="static" />
        </button>
      </footer>
    </div>
    <div
      id="collect-panel-2"
      v-show="active === 2"
      role="tabpanel"
      aria-labelledby="collect-tab-2"
      class="cg-panel"
      tabindex="0"
    >
      <div class="cg-send-heading">
        <div>
          <h3>下载 JSON，在自己的终端发送。</h3>
          <p>此页面只生成命令，不会向任何服务发起录入请求。</p>
        </div>
        <span
          class="cg-draft-status"
          :class="{ 'is-error': !draftCheck.valid || draftCheck.oversizedRecords.length }"
          >{{
            !draftCheck.valid
              ? '批次需修正'
              : draftCheck.oversizedRecords.length
                ? '有超限记录'
                : '结构校验通过'
          }}</span
        >
      </div>
      <div class="cg-download-row">
        <div>
          <strong>1. 保存当前批次</strong>
          <p>
            先确认项目、环境和记录内容，再保存为
            <code>batch.json</code>。重新发送同一批时使用这份原文件。
          </p>
        </div>
        <button
          type="button"
          class="cg-secondary"
          :disabled="!draftCheck.valid || !!draftCheck.oversizedRecords.length"
          @click="download"
        >
          下载 batch.json<AppIcon name="chevron-down" :size="15" mode="static" />
        </button>
      </div>
      <label for="collect-base-url" class="cg-field-label"
        >2. 当前环境的服务地址 <span>已填写，可改为其他实例</span></label
      ><input
        id="collect-base-url"
        v-model="baseUrl"
        class="cg-url-input"
        type="url"
        :placeholder="currentBase"
        autocomplete="off"
        spellcheck="false"
        :aria-invalid="!!curl.error"
        aria-describedby="collect-url-help"
      />
      <p id="collect-url-help" class="cg-field-help" :class="{ 'is-error': curl.error }">
        {{ curl.error || '保留部署所需的端口或路径；不要填写业务网站的接口地址。' }}
      </p>
      <div v-if="curl.command" class="cg-code">
        <header>
          <span>3. 在 batch.json 所在目录执行</span
          ><button type="button" @click="copy(curl.command, 'curl')">
            {{ copied === 'curl' ? '已复制' : '复制 cURL' }}
          </button>
        </header>
        <pre tabindex="0"><code>{{ curl.command }}</code></pre>
      </div>
      <div class="cg-reminder">
        <AppIcon name="circle-help" :size="16" mode="static" />
        <p>
          <strong>本地校验通过 ≠ 服务端已接收。</strong>发送后还要核对 HTTP 状态、回执里的
          <code>batch_id</code> 和每条记录的结果。
        </p>
      </div>
      <footer class="cg-panel-footer">
        <button type="button" class="cg-text-button" @click="selectStep(1)">返回编辑与校验</button
        ><button type="button" class="cg-primary" @click="selectStep(3)">
          接下来，看懂回执<AppIcon name="arrow-right" :size="15" mode="static" />
        </button>
      </footer>
    </div>
    <div
      id="collect-panel-3"
      v-show="active === 3"
      role="tabpanel"
      aria-labelledby="collect-tab-3"
      class="cg-panel"
      tabindex="0"
    >
      <h3>HTTP 200，也可能有记录被拒绝。</h3>
      <p class="cg-intro">下面是独立的回执示例，并非刚才批次的真实提交结果。</p>
      <p class="cg-intro">
        下面是模拟回执，帮助理解保存结果，不代表当前编辑的批次已录入。实际结果以终端请求返回的回执为准。
      </p>
      <div class="cg-receipt-tabs" aria-label="回执示例">
        <button
          v-for="(label, index) in ['全部接收', '部分拒绝', '整批限流']"
          :key="label"
          type="button"
          :aria-pressed="receiptMode === index"
          @click="receiptMode = index"
        >
          {{ label }}
        </button>
      </div>
      <div class="cg-receipt-stats">
        <span
          ><small>HTTP</small><strong>{{ receiptMode === 2 ? '429' : '200' }}</strong></span
        ><span
          ><small>{{ receiptMode === 2 ? '处理方式' : 'accepted' }}</small
          ><strong>{{
            receiptMode === 2 ? '整批重试' : receiptMode === 0 ? '2' : '1'
          }}</strong></span
        ><span
          ><small>{{ receiptMode === 2 ? 'batch_id' : 'rejected' }}</small
          ><strong>{{
            receiptMode === 2 ? '保持不变' : receiptMode === 0 ? '0' : '1'
          }}</strong></span
        >
      </div>
      <div class="cg-code">
        <header>
          <span>{{ receiptMode === 2 ? 'error.json' : 'receipt.json' }}</span
          ><button type="button" @click="copy(JSON.stringify(receipt, null, 2), 'receipt')">
            {{ copied === 'receipt' ? '已复制' : '复制回执' }}
          </button>
        </header>
        <pre tabindex="0"><code>{{ JSON.stringify(receipt,null,2) }}</code></pre>
      </div>
      <div class="cg-reminder">
        <AppIcon name="circle-help" :size="16" mode="static" />
        <p v-if="receiptMode === 0">
          确认回执 <code>batch_id</code> 与原批次一致、记录数量对应。<code>rejected</code>
          为空时，这两条记录都已接收。
        </p>
        <p v-else-if="receiptMode === 1">
          <code>index: 1</code> 指第二条记录，从 0 开始计数。结合
          <code>id</code> 定位并修正超限记录，用新批次提交；不要把整批原样反复重发。
        </p>
        <p v-else>
          读取响应头 <code>Retry-After</code>，等待指定秒数，再用<strong
            >同一个 batch_id、完全相同的内容</strong
          >重试。
        </p>
      </div>
      <footer class="cg-panel-footer">
        <button type="button" class="cg-text-button" @click="selectStep(2)">返回发送命令</button
        ><a class="cg-primary" href="#api-errors"
          >查看完整重试规则<AppIcon name="chevron-down" :size="15" mode="static"
        /></a>
      </footer>
    </div>
    <p class="cg-copy-status" role="status">
      {{ copyError || (copied ? '已复制到剪贴板。' : '') }}
    </p>
  </section>
</template>
