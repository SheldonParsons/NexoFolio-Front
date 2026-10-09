<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from '@/components/icons/AppIcon.vue'
import { apiBaseUrl } from '@/api'
import MarkdownContent from '@/features/product-docs/MarkdownContent.vue'
import CollectQuickstart from './CollectQuickstart.vue'
import CollectAgentBrief from './CollectAgentBrief.vue'
import { collectContract } from './contract'
import { collectServiceBase, splitCollectSections } from './guide'
import './collect-guide.css'

const props = defineProps<{ body: string; prefix: string }>()
const serviceBase = collectServiceBase(apiBaseUrl, window.location.href)
const endpoint = serviceBase ? `${serviceBase}/v1/collect/batches` : ''
const sections = computed(() => splitCollectSections(props.body))
const sectionBody = (title: string) =>
  sections.value.find((section) => section.title === title)?.body || ''
const references = [
  {
    title: '批次',
    label: '一批数据怎么打包',
    code: 'batch_id · platform · records',
    note: '编号、来源工具和记录列表',
  },
  { title: '归属', label: '数据保存到哪里', code: 'target', note: '项目、环境与站点入口' },
  {
    title: '记录',
    label: '真实调用和接口声明有什么区别',
    code: 'http_exchange / http_declaration',
    note: '一次实际调用，或一份文档中的接口结构',
  },
  {
    title: '内容状态',
    label: '正文没拿全时怎么填写',
    code: 'full · truncated · partial · unreadable · none',
    note: '准确说明实际采集到了什么',
  },
  {
    title: '回执',
    label: '怎么判断哪些记录已保存',
    code: 'accepted · rejected',
    note: '看接收数量和被拒绝的具体记录',
  },
]
const copyState = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
async function copyEndpoint() {
  if (!endpoint) return
  clearTimeout(timer)
  try {
    await navigator.clipboard.writeText(endpoint)
    copyState.value = '已复制'
  } catch {
    copyState.value = '请选中路径复制'
  }
  timer = setTimeout(() => {
    copyState.value = ''
  }, 2200)
}
onScopeDispose(() => clearTimeout(timer))
const bundle = `${import.meta.env.BASE_URL}contracts/collect-1.1.0.zip`
</script>

<template>
  <div class="ca-guide">
    <section class="cg-hero" aria-label="录入接口概览">
      <div class="cg-hero-heading">
        <span class="cg-contract-badge">COLLECT / {{ collectContract.version }}</span
        ><span>application/json</span>
      </div>
      <h2>把接口资料，<br />保存到项目里。</h2>
      <p>
        已有抓包结果、网关日志、测试脚本或 Swagger 资料？<br />按项目和环境提交，查看每条记录的保存结果。
      </p>
      <div class="cg-endpoint">
        <span>POST</span><code>{{ endpoint || '服务地址未配置' }}</code
        ><button type="button" :disabled="!endpoint" @click="copyEndpoint">
          {{ copyState || '复制地址' }}
        </button>
      </div>
      <div class="cg-hero-actions">
        <a href="#api-overview"
          >先看我该用哪一种<AppIcon name="arrow-right" :size="15" mode="static" /></a
        ><a href="#api-fields"
          >查阅字段规范<AppIcon name="chevron-down" :size="15" mode="static"
        /></a>
      </div>
    </section>
    <div class="cg-facts">
      <span><AppIcon name="lock" :size="13" mode="static" />录入请求无需 Token</span
      ><span><AppIcon name="code" :size="13" mode="static" />需要说明来源工具</span
      ><span
        ><AppIcon name="layers" :size="13" mode="static" />每批 1–{{
          collectContract.recordsPerBatch
        }}
        条</span
      >
    </div>

    <CollectAgentBrief />

    <section id="api-overview" class="cg-overview" aria-labelledby="cg-overview-title">
      <header class="cg-heading">
        <div>
          <span class="cg-eyebrow">START HERE</span>
          <h2 id="cg-overview-title">你需要自己写接入代码吗？</h2>
        </div>
      </header>
      <MarkdownContent :body="sectionBody('什么时候使用')" :prefix="prefix" />
      <h3>资料录入后，还会经历什么？</h3>
      <MarkdownContent :body="sectionBody('录入以后会怎样')" :prefix="prefix" />
    </section>
    <div class="cg-source-note">
      <strong>已有浏览器场景？</strong
      ><span>可以直接使用 Fetcher；自建工具从下面的 JSON 开始。</span
      ><RouterLink to="/docs/fetcher"
        >Fetcher 教程<AppIcon name="arrow-up-right" :size="14" mode="static"
      /></RouterLink>
    </div>

    <CollectQuickstart :body="body" />

    <section id="api-fields" class="cg-reference" aria-labelledby="cg-fields-title">
      <header class="cg-heading">
        <div>
          <span class="cg-eyebrow">REFERENCE</span>
          <h2 id="cg-fields-title">不确定怎么填，再展开对应说明。</h2>
        </div>
      </header>
      <details v-for="item in references" :key="item.title">
        <summary>
          <span
            ><strong>{{ item.label }}</strong
            ><small>{{ item.note }}</small></span
          ><code>{{ item.code }}</code
          ><AppIcon name="chevron-down" :size="16" mode="static" />
        </summary>
        <MarkdownContent :body="sectionBody(item.title)" :prefix="prefix" />
      </details>
    </section>

    <section id="api-errors" class="cg-errors" aria-labelledby="cg-errors-title">
      <header class="cg-heading">
        <div>
          <span class="cg-eyebrow">RECOVERY</span>
          <h2 id="cg-errors-title">失败后，先分清是哪一种。</h2>
        </div>
      </header>
      <div class="cg-recovery-grid">
        <div>
          <span class="cg-recovery-label">可以重试</span>
          <h3>网络或服务暂时出问题：稍后重发原文件。</h3>
          <p>
            <code>429</code> 按 Retry-After 等待；<code>503</code> 或网络中断后退避。复用 batch_id
            与完全相同的内容。
          </p>
        </div>
        <div>
          <span class="cg-recovery-label">需要修正</span>
          <h3>数据写错或超限：先修正，再建新批次。</h3>
          <p>
            结构错误、超限或 ID 复用，先修正或拆批。项目、环境错误先纠正归属；改变内容后使用新批次。
          </p>
        </div>
      </div>
      <details class="cg-error-details">
        <summary>
          查看所有错误码与处理方式<AppIcon name="chevron-down" :size="16" mode="static" />
        </summary>
        <MarkdownContent :body="sectionBody('错误与重试')" :prefix="prefix" />
      </details>
    </section>

    <section id="api-limits" class="cg-limits" aria-labelledby="cg-limits-title">
      <header class="cg-heading">
        <div>
          <span class="cg-eyebrow">LIMITS & CONTRACT</span>
          <h2 id="cg-limits-title">最多能传多少？规范在哪里下载？</h2>
        </div>
      </header>
      <div class="cg-limit-grid">
        <div>
          <strong>{{ collectContract.recordsPerBatch }}</strong
          ><span>每批最多记录</span>
        </div>
        <div>
          <strong>8 <small>MiB</small></strong
          ><span>整个请求体上限</span>
        </div>
        <div>
          <strong>4 <small>MiB</small></strong
          ><span>单条序列化上限</span>
        </div>
        <div>
          <strong>7 <small>天</small></strong
          ><span>批次幂等窗口</span>
        </div>
      </div>
      <p class="cg-boundary-note">
        整批超限返回 413；单条超限写入 rejected，同批其他记录照常处理。每组请求头或响应头最多 256
        对。
      </p>
      <div class="cg-contract-download">
        <div>
          <strong>collect {{ collectContract.version }}</strong>
          <p>请求格式、回执、错误说明和完整示例，供接入程序自动校验。</p>
        </div>
        <a class="cg-primary" :href="bundle" download="collect-1.1.0.zip"
          >下载接入规范包<AppIcon name="chevron-down" :size="15" mode="static"
        /></a>
      </div>
      <details class="cg-error-details">
        <summary>
          规范文件与完整限制<AppIcon name="chevron-down" :size="16" mode="static" />
        </summary>
        <MarkdownContent
          :body="sectionBody('限制') + '\n\n' + sectionBody('合同文件')"
          :prefix="prefix"
        />
      </details>
    </section>
    <p class="cg-page-footnote">
      本页基于 collect
      {{ collectContract.version }}
      规范。结构校验在浏览器本地完成，服务可用性、项目和环境归属由实际服务端确认。
    </p>
  </div>
</template>
